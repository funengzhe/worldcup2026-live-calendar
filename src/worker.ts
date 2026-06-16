import { loadConfig } from "./config.js";
import { JsonStore } from "./store.js";
import { heartbeat, publishCalendar, syncSchedule, syncScores } from "./sync.js";

const config = loadConfig();
const store = new JsonStore(config.statePath);

async function tick() {
  await heartbeat(store);
  await syncSchedule(config, store);
  await syncScores(config, store);
  await publishCalendar(config, store);
}

async function scoreTick() {
  await heartbeat(store);
  await syncScores(config, store);
  await publishCalendar(config, store);
}

async function main() {
  console.log("worker started");
  await tick();

  setInterval(() => {
    tick().catch((error) => {
      console.error("worker tick failed", error);
    });
  }, config.SCHEDULE_SYNC_INTERVAL_MS);

  setInterval(() => {
    scoreTick().catch((error) => {
      console.error("worker score tick failed", error);
    });
  }, config.SCORE_SYNC_INTERVAL_MS);

  setInterval(() => {
    heartbeat(store).catch((error) => {
      console.error("worker heartbeat failed", error);
    });
  }, 30_000);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
