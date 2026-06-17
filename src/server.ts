import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { sendAlert } from "./alerts.js";
import { generateIcs } from "./calendar.js";
import { loadConfig } from "./config.js";
import { buildCustomFeed, customFeedQuery, parseCustomFeedOptions } from "./customFeed.js";
import { findTeamFeed, knockoutMatches, matchesForTeam, teamFeeds } from "./feeds.js";
import { checkHealth } from "./health.js";
import { teamDisplayNameZh } from "./localization.js";
import { renderPrometheusMetrics } from "./metrics.js";
import { createAlipayOrder, isAlipayConfigured, verifyAlipayNotify } from "./payments/alipay.js";
import { checkReadiness } from "./readiness.js";
import { renderCustomSharePage, renderHome, renderMatchPage, renderReadiness, renderStatus } from "./render.js";
import { JsonStore, markSponsorPaid, upsertSavedCalendar, upsertSponsor } from "./store.js";
import { publishCalendar, syncSchedule } from "./sync.js";

const config = loadConfig();
const store = new JsonStore(config.statePath);
const app = Fastify({ logger: true, trustProxy: true });
const calendarCacheControl = "no-cache, max-age=0, must-revalidate";
const customCalendarName = "我订阅的2026世界杯赛程";
const paymentRateLimiter = createRateLimiter(config.PAYMENT_RATE_LIMIT_MAX, config.PAYMENT_RATE_LIMIT_WINDOW_MS);
const feedbackRateLimiter = createRateLimiter(config.FEEDBACK_RATE_LIMIT_MAX, config.FEEDBACK_RATE_LIMIT_WINDOW_MS);
const calendarRateLimiter = createRateLimiter(60, 60_000);

app.addContentTypeParser(
  "application/x-www-form-urlencoded",
  { parseAs: "string" },
  (_request, body, done) => {
    const params = new URLSearchParams(body.toString());
    done(null, Object.fromEntries(params.entries()));
  }
);

app.get("/", async (_request, reply) => {
  const state = await store.read();
  reply.type("text/html; charset=utf-8").send(
    await renderHome(state, config.PUBLIC_BASE_URL, {
      alipayUrl: config.SUPPORT_ALIPAY_URL,
      alipayQrUrl: config.SUPPORT_ALIPAY_QR_URL,
      githubSponsorsUrl: config.SUPPORT_GITHUB_SPONSORS_URL
    })
  );
});

app.get("/robots.txt", async (_request, reply) => {
  const baseUrl = config.PUBLIC_BASE_URL.replace(/\/$/, "");
  reply.type("text/plain; charset=utf-8").send(["User-agent: *", "Allow: /", `Sitemap: ${baseUrl}/sitemap.xml`, ""].join("\n"));
});

app.get("/sitemap.xml", async (_request, reply) => {
  const baseUrl = config.PUBLIC_BASE_URL.replace(/\/$/, "");
  const urls = ["", "/share/custom", "/worldcup2026.ics"].map((path) => `${baseUrl}${path}`);
  reply.type("application/xml; charset=utf-8").send(
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...urls.map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`),
      "</urlset>",
      ""
    ].join("\n")
  );
});

app.get("/status", async (request, reply) => {
  if (!requireStatusAccess(request, reply)) return;
  const state = await store.read();
  reply.type("text/html; charset=utf-8").send(renderStatus(state));
});

app.get("/api/status", async (request, reply) => {
  if (!requireStatusAccess(request, reply)) return;
  const state = await store.read();
  return publicStatus(state);
});

app.get("/api/feeds", async () => {
  const state = await store.read();
  return {
    full: "/worldcup2026.ics",
    knockout: "/feeds/knockout.ics",
    custom: "/feeds/custom.ics",
    teams: teamFeeds(state.matches).map((feed) => ({
      ...feed,
      path: `/feeds/teams/${feed.slug}.ics`
    }))
  };
});

app.post("/api/v1/alipay/create_order", async (request, reply) => {
  if (!checkRateLimit(paymentRateLimiter, rateLimitKey(request, "pay"))) {
    reply.code(429).send({
      ok: false,
      code: "RATE_LIMITED",
      message: "请求太频繁，请稍后再试。"
    });
    return;
  }

  if (!isAlipayConfigured(config)) {
    reply.code(503).send({
      ok: false,
      code: "ALIPAY_NOT_CONFIGURED",
      message: "支付宝支付通道正在配置中，请稍后再试。"
    });
    return;
  }

  try {
    const body = request.body as { amount?: unknown; displayName?: unknown; note?: unknown } | undefined;
    const order = createAlipayOrder(config, {
      amount: body?.amount,
      userAgent: request.headers["user-agent"]
    });
    await store.update((state) =>
      upsertSponsor(state, {
        outTradeNo: order.orderNo,
        amount: order.amount,
        displayName: normalizeSponsorText(body?.displayName, "匿名球迷", 18),
        note: normalizeSponsorText(body?.note, "", 36) || undefined,
        status: "pending",
        createdAt: new Date().toISOString()
      })
    );
    reply.send({
      ok: true,
      amount: order.amount,
      formHtml: order.formHtml,
      method: order.method,
      orderNo: order.orderNo
    });
  } catch (error) {
    reply.code(400).send({
      ok: false,
      code: "ALIPAY_ORDER_FAILED",
      message: error instanceof Error ? error.message : "创建支付订单失败"
    });
  }
});

app.post("/api/v1/alipay/notify", async (request, reply) => {
  const payload = (request.body ?? {}) as Record<string, unknown>;
  const verified = verifyAlipayNotify(config, payload);
  if (!verified) {
    app.log.warn(
      {
        outTradeNo: payload.out_trade_no,
        tradeNo: payload.trade_no,
        tradeStatus: payload.trade_status
      },
      "Alipay notify signature verification failed"
    );
    reply.type("text/plain").send("failure");
    return;
  }

  const tradeStatus = String(payload.trade_status ?? "");
  if (tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED") {
    const outTradeNo = String(payload.out_trade_no ?? "");
    if (outTradeNo) {
      const next = await store.update((state) =>
        markSponsorPaid(state, {
          outTradeNo,
          tradeNo: typeof payload.trade_no === "string" ? payload.trade_no : undefined,
          amount: typeof payload.total_amount === "string" ? payload.total_amount : undefined,
          paidAt: typeof payload.gmt_payment === "string" ? payload.gmt_payment : new Date().toISOString()
        })
      );
      const sponsor = next.sponsors?.find((item) => item.outTradeNo === outTradeNo);
      await sendAlert(config, {
        key: `sponsor-paid-${outTradeNo}`,
        title: "收到新的打赏支持",
        message: [
          `昵称：${sponsor?.displayName || "匿名球迷"}`,
          `金额：¥${sponsor?.amount ?? payload.total_amount ?? "0.00"}`,
          sponsor?.note ? `留言：${sponsor.note}` : undefined,
          `订单：${outTradeNo}`,
          `时间：${sponsor?.paidAt ?? payload.gmt_payment ?? new Date().toISOString()}`
        ]
          .filter(Boolean)
          .join("\n"),
        severity: "warning"
      });
    }
  }

  app.log.info(
    {
      outTradeNo: payload.out_trade_no,
      tradeNo: payload.trade_no,
      tradeStatus: payload.trade_status,
      totalAmount: payload.total_amount
    },
    "Alipay sponsor payment notify verified"
  );
  reply.type("text/plain").send("success");
});

app.get("/api/v1/sponsors", async () => {
  const state = await store.read();
  return {
    ok: true,
    sponsors: (state.sponsors ?? [])
      .filter((sponsor) => sponsor.status === "paid")
      .sort(compareSponsorsByRank)
      .slice(0, 50)
      .map((sponsor) => ({
        displayName: sponsor.displayName,
        note: sponsor.note,
        amount: sponsor.amount,
        paidAt: sponsor.paidAt
      }))
  };
});

app.get("/api/v1/alipay/notify", async (_request, reply) => {
  reply.send({
    ok: true,
    message: "Alipay notify endpoint is ready. Payment notifications must use POST."
  });
});

app.get("/api/v1/alipay/auth/callback", async (_request, reply) => {
  reply.send({
    ok: true,
    message: "Alipay auth callback endpoint is reserved."
  });
});

app.post("/api/v1/feedback", async (request, reply) => {
  if (!checkRateLimit(feedbackRateLimiter, rateLimitKey(request, "feedback"))) {
    reply.code(429).send({
      ok: false,
      message: "反馈提交太频繁，请稍后再试。"
    });
    return;
  }

  const body = request.body as
    | {
        type?: unknown;
        name?: unknown;
        contact?: unknown;
        message?: unknown;
        page?: unknown;
        website?: unknown;
      }
    | undefined;

  if (body?.website) {
    reply.send({ ok: true });
    return;
  }

  try {
    const feedback = {
      type: normalizeFeedbackType(body?.type),
      name: normalizeSponsorText(body?.name, "匿名访客", 24),
      contact: normalizeSponsorText(body?.contact, "", 80),
      message: normalizeSponsorText(body?.message, "", 800),
      page: normalizeSponsorText(body?.page, "", 200)
    };

    if (feedback.message.length < 3) {
      reply.code(400).send({ ok: false, message: "请至少输入 3 个字的留言内容。" });
      return;
    }

    await sendAlert(config, {
      key: `feedback-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: `收到新的${feedback.type}`,
      message: [
        `昵称：${feedback.name}`,
        feedback.contact ? `联系方式：${feedback.contact}` : undefined,
        `内容：${feedback.message}`,
        feedback.page ? `页面：${feedback.page}` : undefined,
        `来源 IP：${request.ip}`
      ]
        .filter(Boolean)
        .join("\n"),
      severity: "warning"
    });

    reply.send({ ok: true, message: "已收到，会通过飞书通知作者。" });
  } catch (error) {
    reply.code(400).send({
      ok: false,
      message: error instanceof Error ? error.message : "反馈提交失败"
    });
  }
});

app.get("/metrics", async (request, reply) => {
  if (!requireStatusAccess(request, reply)) return;
  const state = await store.read();
  reply.type("text/plain; version=0.0.4; charset=utf-8").send(renderPrometheusMetrics(state));
});

app.get("/api/readiness", async (request, reply) => {
  if (!requireStatusAccess(request, reply)) return;
  const state = await store.read();
  return checkReadiness(state, config, checkHealth(state, config));
});

app.get("/readiness", async (request, reply) => {
  if (!requireStatusAccess(request, reply)) return;
  const state = await store.read();
  const readiness = checkReadiness(state, config, checkHealth(state, config));
  reply.type("text/html; charset=utf-8").send(renderReadiness(readiness));
});

app.get("/healthz", async (_request, reply) => {
  const state = await store.read();
  const health = checkHealth(state, config);

  reply.code(health.ok ? 200 : 503).send({
    ok: health.ok,
    checks: health.checks,
    lastScheduleSyncAt: state.lastScheduleSyncAt,
    lastScoreSyncAt: state.lastScoreSyncAt,
    workerHeartbeatAt: state.workerHeartbeatAt,
    publication: state.publication
  });
});

const imageAssets = new Map([
  ["2026-chinese-calendar-logo.webp", "image/webp"],
  ["blank-match-pass.png", "image/png"],
  ["stadium-hero-mobile.webp", "image/webp"],
  ["stadium-hero-pc.webp", "image/webp"],
  ["stadium-bg-mobile.webp", "image/webp"],
  ["stadium-bg-pc.webp", "image/webp"],
  ["knockout-bracket-frame.png", "image/png"],
  ["worldcup-trophy-circle-icon.webp", "image/webp"],
  ["worldcup-trophy-hero.webp", "image/webp"]
]);

app.get("/assets/img/:file", async (request, reply) => {
  const { file } = request.params as { file: string };
  const mimeType = imageAssets.get(file);
  if (!mimeType) {
    reply.code(404).send({ ok: false, error: "Asset not found" });
    return;
  }

  const image = await readFile(`${config.publicDir}/assets/img/${file}`);
  reply.header("cache-control", "public, max-age=31536000, immutable").type(mimeType).send(image);
});

app.get("/worldcup2026.ics", async (request, reply) => {
  try {
    const ics = await readFile(config.calendarPath, "utf8");
    sendCalendar(request, reply, ics);
  } catch {
    await syncSchedule(config, store);
    await publishCalendar(config, store);
    const ics = await readFile(config.calendarPath, "utf8");
    sendCalendar(request, reply, ics);
  }
});

app.get("/feeds/knockout.ics", async (request, reply) => {
  const state = await store.read();
  const matches = knockoutMatches(state.matches);
  if (matches.length === 0) {
    reply.code(404).send({ ok: false, error: "Knockout matches are not available yet" });
    return;
  }

  sendCalendar(
    request,
    reply,
    generateIcs(matches, {
      calendarDomain: config.CALENDAR_DOMAIN,
      baseUrl: config.PUBLIC_BASE_URL,
      calendarName: "2026 世界杯淘汰赛",
      calendarDescription: "2026 世界杯淘汰赛赛程与赛果（北京时间）"
    })
  );
});

app.get("/feeds/teams/:slug.ics", async (request, reply) => {
  const { slug } = request.params as { slug: string };
  const state = await store.read();
  const feed = findTeamFeed(state.matches, slug);
  if (!feed) {
    reply.code(404).send({ ok: false, error: "Team feed not found" });
    return;
  }

  sendCalendar(
    request,
    reply,
    generateIcs(matchesForTeam(state.matches, feed.team), {
      calendarDomain: config.CALENDAR_DOMAIN,
      baseUrl: config.PUBLIC_BASE_URL,
      calendarName: `2026 世界杯：${teamDisplayNameZh(feed.team)}`,
      calendarDescription: `2026 世界杯 ${teamDisplayNameZh(feed.team)}赛程与赛果（北京时间）`
    })
  );
});

app.get("/feeds/custom.ics", async (request, reply) => {
  const state = await store.read();
  const options = parseCustomFeedOptions(state.matches, queryToSearchParams(request.query));
  const feed = buildCustomFeed(state.matches, options);
  if (feed.matches.length === 0) {
    reply.code(404).send({ ok: false, error: feed.emptyReason ?? "Custom feed has no matches" });
    return;
  }

  sendCalendar(
    request,
    reply,
    generateIcs(feed.matches, {
      calendarDomain: config.CALENDAR_DOMAIN,
      baseUrl: config.PUBLIC_BASE_URL,
      calendarName: customCalendarName,
      calendarDescription: feed.description
    })
  );
});

app.post("/api/v1/calendars/save", async (request, reply) => {
  if (!checkRateLimit(calendarRateLimiter, rateLimitKey(request, "calendar-save"))) {
    reply.code(429).send({
      ok: false,
      message: "保存太频繁，请稍后再试。"
    });
    return;
  }

  const state = await store.read();
  const body = request.body as { query?: unknown; title?: unknown } | undefined;
  const rawQuery = normalizeCalendarQuery(body?.query);
  const options = parseCustomFeedOptions(state.matches, new URLSearchParams(rawQuery));
  const canonicalQuery = customCanonicalQuery(options);
  const feed = buildCustomFeed(state.matches, options);
  if (feed.matches.length === 0) {
    reply.code(400).send({
      ok: false,
      message: feed.emptyReason ?? "当前方案没有匹配比赛，暂时不能保存。"
    });
    return;
  }

  const now = new Date().toISOString();
  const slug = savedCalendarSlug(canonicalQuery);
  const title = normalizeSponsorText(body?.title, feed.title, 50);
  await store.update((current) => {
    const existing = current.savedCalendars?.find((item) => item.slug === slug);
    return upsertSavedCalendar(current, {
      slug,
      query: canonicalQuery,
      title,
      matchCount: feed.matches.length,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    });
  });

  reply.send(savedCalendarResponse(slug, title, feed.matches.length));
});

app.get("/feeds/saved/:slug.ics", async (request, reply) => {
  const { slug } = request.params as { slug: string };
  const state = await store.read();
  const saved = state.savedCalendars?.find((item) => item.slug === slug);
  if (!saved) {
    reply.code(404).send({ ok: false, error: "Saved calendar not found" });
    return;
  }

  const options = parseCustomFeedOptions(state.matches, new URLSearchParams(saved.query));
  const feed = buildCustomFeed(state.matches, options);
  if (feed.matches.length === 0) {
    reply.code(404).send({ ok: false, error: feed.emptyReason ?? "Saved calendar has no matches" });
    return;
  }

  sendCalendar(
    request,
    reply,
    generateIcs(feed.matches, {
      calendarDomain: config.CALENDAR_DOMAIN,
      baseUrl: config.PUBLIC_BASE_URL,
      calendarName: customCalendarName,
      calendarDescription: feed.description
    })
  );
});

app.get("/share/custom", async (request, reply) => {
  const state = await store.read();
  const options = parseCustomFeedOptions(state.matches, queryToSearchParams(request.query));
  const feed = buildCustomFeed(state.matches, options);
  reply.type("text/html; charset=utf-8").send(await renderCustomSharePage(feed, config.PUBLIC_BASE_URL));
});

app.get("/c/:slug", async (request, reply) => {
  const { slug } = request.params as { slug: string };
  const state = await store.read();
  const saved = state.savedCalendars?.find((item) => item.slug === slug);
  if (!saved) {
    reply
      .code(404)
      .type("text/html; charset=utf-8")
      .send("<!doctype html><html lang=\"zh-CN\"><meta charset=\"utf-8\"><title>分享链接不存在</title><body style=\"font-family:system-ui;background:#040d08;color:#fff;padding:48px\"><h1>分享链接不存在</h1><p>这个世界杯日历分享链接不存在或已经失效。</p><p><a style=\"color:#00ff66\" href=\"/\">返回首页重新定制</a></p></body></html>");
    return;
  }

  const options = parseCustomFeedOptions(state.matches, new URLSearchParams(saved.query));
  const feed = buildCustomFeed(state.matches, options);
  reply.type("text/html; charset=utf-8").send(
    await renderCustomSharePage(feed, config.PUBLIC_BASE_URL, {
      title: saved.title,
      shareUrl: `${config.PUBLIC_BASE_URL.replace(/\/$/, "")}/c/${saved.slug}`,
      feedUrl: `${config.PUBLIC_BASE_URL.replace(/\/$/, "")}/feeds/saved/${saved.slug}.ics`
    })
  );
});

app.get("/matches/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const state = await store.read();
  const match = state.matches.find((item) => item.id === id);
  if (!match) {
    reply.code(404).send({ ok: false, error: "Match not found" });
    return;
  }
  reply.type("text/html; charset=utf-8").send(renderMatchPage(match));
});

function normalizeSponsorText(value: unknown, fallback: string, maxLength: number): string {
  const text = String(value ?? "")
    .replace(/[<>{}[\]\\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return (text || fallback).slice(0, maxLength);
}

function normalizeFeedbackType(value: unknown): string {
  const text = normalizeSponsorText(value, "留言反馈", 20);
  if (text.includes("问题")) return "问题反馈";
  if (text.includes("留言")) return "访客留言";
  if (text.includes("建议")) return "功能建议";
  return "留言反馈";
}

function compareSponsorsByRank(
  a: { amount: string; paidAt?: string; createdAt: string },
  b: { amount: string; paidAt?: string; createdAt: string }
): number {
  const amountDiff = Number(b.amount) - Number(a.amount);
  if (Number.isFinite(amountDiff) && amountDiff !== 0) return amountDiff;
  return Date.parse(b.paidAt ?? b.createdAt) - Date.parse(a.paidAt ?? a.createdAt);
}

function normalizeCalendarQuery(value: unknown): string {
  return String(value ?? "")
    .replace(/^\?/, "")
    .slice(0, 2000);
}

function customCanonicalQuery(options: ReturnType<typeof parseCustomFeedOptions>): string {
  return customFeedQuery(options);
}

function savedCalendarSlug(query: string): string {
  const source = query || "all";
  return createHash("sha256").update(source).digest("base64url").slice(0, 10);
}

function savedCalendarResponse(slug: string, title: string, matchCount: number) {
  const baseUrl = config.PUBLIC_BASE_URL.replace(/\/$/, "");
  const shareUrl = `${baseUrl}/c/${slug}`;
  const feedUrl = `${baseUrl}/feeds/saved/${slug}.ics`;
  return {
    ok: true,
    slug,
    title,
    matchCount,
    shareUrl,
    feedUrl,
    webcalUrl: feedUrl.replace(/^https?:\/\//, "webcal://")
  };
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

function createRateLimiter(max: number, windowMs: number) {
  return { max, windowMs, buckets: new Map<string, RateLimitBucket>() };
}

function checkRateLimit(
  limiter: ReturnType<typeof createRateLimiter>,
  key: string,
  now = Date.now()
): boolean {
  const existing = limiter.buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    limiter.buckets.set(key, { count: 1, resetAt: now + limiter.windowMs });
    cleanupRateLimiter(limiter, now);
    return true;
  }

  if (existing.count >= limiter.max) return false;
  existing.count += 1;
  return true;
}

function cleanupRateLimiter(limiter: ReturnType<typeof createRateLimiter>, now: number): void {
  if (limiter.buckets.size < 1000) return;
  for (const [key, bucket] of limiter.buckets) {
    if (bucket.resetAt <= now) limiter.buckets.delete(key);
  }
}

function rateLimitKey(request: FastifyRequest, scope: string): string {
  return `${scope}:${request.ip || "unknown"}`;
}

function sendCalendar(request: FastifyRequest, reply: FastifyReply, ics: string): void {
  const etag = calendarEntityTag(ics);
  const lastModified = calendarLastModified(ics).toUTCString();
  const ifNoneMatch = request.headers["if-none-match"];
  if (typeof ifNoneMatch === "string" && ifNoneMatch.split(",").map((value) => value.trim()).includes(etag)) {
    reply
      .code(304)
      .header("cache-control", calendarCacheControl)
      .header("etag", etag)
      .header("last-modified", lastModified)
      .send();
    return;
  }

  reply
    .header("cache-control", calendarCacheControl)
    .header("pragma", "no-cache")
    .header("expires", "0")
    .header("etag", etag)
    .header("last-modified", lastModified)
    .type("text/calendar; charset=utf-8")
    .send(ics);
}

function calendarEntityTag(ics: string): string {
  const stableIcs = ics.replace(/^DTSTAMP:.+$/gm, "DTSTAMP:*").replace(/^CREATED:.+$/gm, "CREATED:*");
  return `"${createHash("sha256").update(stableIcs).digest("base64url")}"`;
}

function calendarLastModified(ics: string): Date {
  const stamps = Array.from(ics.matchAll(/^LAST-MODIFIED:(\d{8}T\d{6}Z)$/gm))
    .map((match) => parseUtcStamp(match[1]))
    .filter((date): date is Date => date instanceof Date)
    .filter((date) => Number.isFinite(date.getTime()));
  if (stamps.length === 0) return new Date();
  return new Date(Math.max(...stamps.map((date) => date.getTime())));
}

function parseUtcStamp(value: string): Date | undefined {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value);
  if (!match) return undefined;
  const [, year, month, day, hour, minute, second] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)));
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function queryToSearchParams(query: unknown): URLSearchParams {
  const params = new URLSearchParams();
  if (!query || typeof query !== "object") return params;
  for (const [key, value] of Object.entries(query as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      params.set(key, value.map(String).join(","));
    } else if (value !== undefined) {
      params.set(key, String(value));
    }
  }
  return params;
}

function requireStatusAccess(request: FastifyRequest, reply: FastifyReply): boolean {
  if (!config.STATUS_ACCESS_TOKEN) return true;
  const query = request.query as { token?: string } | undefined;
  const header = request.headers["x-status-token"];
  const token = typeof header === "string" ? header : query?.token;
  if (token === config.STATUS_ACCESS_TOKEN) return true;
  reply.code(404).send({ ok: false, error: "Not found" });
  return false;
}

function publicStatus(state: Awaited<ReturnType<JsonStore["read"]>>) {
  return {
    ok: checkHealth(state, config).ok,
    matches: {
      total: state.matches.length,
      final: state.matches.filter((match) => match.status === "final").length
    },
    providers: state.providers.map((provider) => ({
      name: provider.name,
      ok: provider.ok,
      required: Boolean(provider.required),
      lastCheckedAt: provider.lastCheckedAt,
      lastSuccessAt: provider.lastSuccessAt,
      message: provider.message
    })),
    lastScheduleSyncAt: state.lastScheduleSyncAt,
    lastScoreSyncAt: state.lastScoreSyncAt,
    workerHeartbeatAt: state.workerHeartbeatAt,
    publication: state.publication,
    sponsors: {
      paidCount: (state.sponsors ?? []).filter((sponsor) => sponsor.status === "paid").length
    }
  };
}

async function bootstrap() {
  const state = await store.read();
  if (state.matches.length === 0 || !state.publication) {
    app.log.info("Bootstrapping schedule and calendar feed");
    await syncSchedule(config, store);
    await publishCalendar(config, store);
  }

  await app.listen({ host: config.HOST, port: config.PORT });
}

bootstrap().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
