import { readFile } from "node:fs/promises";
import Fastify from "fastify";
import { generateIcs } from "./calendar.js";
import { loadConfig } from "./config.js";
import { findTeamFeed, knockoutMatches, matchesForTeam, teamFeeds } from "./feeds.js";
import { checkHealth } from "./health.js";
import { teamDisplayNameZh } from "./localization.js";
import { renderPrometheusMetrics } from "./metrics.js";
import { checkReadiness } from "./readiness.js";
import { renderHome, renderMatchPage, renderReadiness, renderStatus } from "./render.js";
import { JsonStore } from "./store.js";
import { publishCalendar, syncSchedule } from "./sync.js";

const config = loadConfig();
const store = new JsonStore(config.statePath);
const app = Fastify({ logger: true });

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

app.get("/status", async (_request, reply) => {
  const state = await store.read();
  reply.type("text/html; charset=utf-8").send(renderStatus(state));
});

app.get("/api/status", async () => store.read());

app.get("/api/feeds", async () => {
  const state = await store.read();
  return {
    full: "/worldcup2026.ics",
    knockout: "/feeds/knockout.ics",
    teams: teamFeeds(state.matches).map((feed) => ({
      ...feed,
      path: `/feeds/teams/${feed.slug}.ics`
    }))
  };
});

app.get("/metrics", async (_request, reply) => {
  const state = await store.read();
  reply.type("text/plain; version=0.0.4; charset=utf-8").send(renderPrometheusMetrics(state));
});

app.get("/api/readiness", async () => {
  const state = await store.read();
  return checkReadiness(state, config, checkHealth(state, config));
});

app.get("/readiness", async (_request, reply) => {
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
  ["stadium-bg-mobile.webp", "image/webp"],
  ["stadium-bg-pc.webp", "image/webp"],
  ["worldcup-trophy-circle-icon.webp", "image/webp"]
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

app.get("/worldcup2026.ics", async (_request, reply) => {
  try {
    const ics = await readFile(config.calendarPath, "utf8");
    reply
      .header("cache-control", "public, max-age=60")
      .type("text/calendar; charset=utf-8")
      .send(ics);
  } catch {
    await syncSchedule(config, store);
    await publishCalendar(config, store);
    const ics = await readFile(config.calendarPath, "utf8");
    reply
      .header("cache-control", "public, max-age=60")
      .type("text/calendar; charset=utf-8")
      .send(ics);
  }
});

app.get("/feeds/knockout.ics", async (_request, reply) => {
  const state = await store.read();
  const matches = knockoutMatches(state.matches);
  if (matches.length === 0) {
    reply.code(404).send({ ok: false, error: "Knockout matches are not available yet" });
    return;
  }

  reply
    .header("cache-control", "public, max-age=60")
    .type("text/calendar; charset=utf-8")
    .send(
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

  reply
    .header("cache-control", "public, max-age=60")
    .type("text/calendar; charset=utf-8")
    .send(
      generateIcs(matchesForTeam(state.matches, feed.team), {
        calendarDomain: config.CALENDAR_DOMAIN,
        baseUrl: config.PUBLIC_BASE_URL,
        calendarName: `2026 世界杯：${teamDisplayNameZh(feed.team)}`,
        calendarDescription: `2026 世界杯 ${teamDisplayNameZh(feed.team)}赛程与赛果（北京时间）`
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
