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
  reply.type("text/html; charset=utf-8").send(await renderHome(state, config.PUBLIC_BASE_URL));
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
