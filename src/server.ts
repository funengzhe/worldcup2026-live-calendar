import { readFile } from "node:fs/promises";
import Fastify from "fastify";
import { loadConfig } from "./config.js";
import { checkHealth } from "./health.js";
import { renderHome, renderMatchPage, renderStatus } from "./render.js";
import { JsonStore } from "./store.js";
import { publishCalendar, syncSchedule } from "./sync.js";

const config = loadConfig();
const store = new JsonStore(config.statePath);
const app = Fastify({ logger: true });

app.get("/", async (_request, reply) => {
  const state = await store.read();
  reply.type("text/html; charset=utf-8").send(renderHome(state, config.PUBLIC_BASE_URL));
});

app.get("/status", async (_request, reply) => {
  const state = await store.read();
  reply.type("text/html; charset=utf-8").send(renderStatus(state));
});

app.get("/api/status", async () => store.read());

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
