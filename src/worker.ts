import { sendAlert } from "./alerts.js";
import { loadConfig } from "./config.js";
import { formatError } from "./errors.js";
import { JsonStore } from "./store.js";
import { heartbeat, publishCalendar, syncSchedule, syncScores } from "./sync.js";

const config = loadConfig();
const store = new JsonStore(config.statePath);

async function tick() {
  await heartbeat(store);
  try {
    await syncSchedule(config, store);
  } catch (error) {
    const state = await store.read();
    if (state.matches.length === 0) throw error;
    console.warn("schedule source refresh failed; continuing with cached schedule", error);
    await sendAlert(config, {
      key: "schedule-source-temporary-failed",
      title: "赛程源暂时无法访问",
      message: `数据源：OpenFootball\n地址：${config.OPENFOOTBALL_URL}\n本轮抓取赛程源失败：${formatError(error)}\n当前已有 ${state.matches.length} 场赛程缓存，比分同步和日历发布会继续执行。`,
      severity: "warning",
      cooldownMs: 60 * 60 * 1000
    });
  }
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
      sendAlert(config, {
        key: "worker-tick-failed",
        title: "日历后台完整同步失败",
        message: `后台执行完整同步时失败：${formatError(error)}\n如果连续出现，请检查服务器网络、数据源和 worker 服务状态。`,
        severity: "critical"
      });
    });
  }, config.SCHEDULE_SYNC_INTERVAL_MS);

  setInterval(() => {
    scoreTick().catch((error) => {
      console.error("worker score tick failed", error);
      sendAlert(config, {
        key: "worker-score-tick-failed",
        title: "赛果同步失败",
        message: `本轮赛果同步失败：${formatError(error)}\n网页和日历会继续保留上一版已发布数据。`,
        severity: "warning"
      });
    });
  }, config.SCORE_SYNC_INTERVAL_MS);

  setInterval(() => {
    heartbeat(store).catch((error) => {
      console.error("worker heartbeat failed", error);
      sendAlert(config, {
        key: "worker-heartbeat-failed",
        title: "日历后台心跳失败",
        message: `后台心跳写入失败：${formatError(error)}\n如果健康检查随后变红，请重启 worker 服务。`,
        severity: "critical"
      });
    });
  }, 30_000);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
