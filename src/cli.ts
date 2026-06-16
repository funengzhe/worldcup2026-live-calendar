import { loadConfig } from "./config.js";
import { JsonStore } from "./store.js";
import { publishCalendar, syncSchedule, syncScores } from "./sync.js";

const command = process.argv[2];
const config = loadConfig();
const store = new JsonStore(config.statePath);

async function main() {
  switch (command) {
    case "sync:schedule": {
      const state = await syncSchedule(config, store);
      console.log(`synced ${state.matches.length} matches`);
      return;
    }
    case "publish:ics": {
      const publication = await publishCalendar(config, store);
      console.log(`published ${publication.matchCount} matches to ${publication.path}`);
      return;
    }
    case "sync:scores": {
      const state = await syncScores(config, store);
      console.log(`score sync complete, ${state.matches.filter((match) => match.source === "espn").length} ESPN-backed matches`);
      return;
    }
    default:
      throw new Error(`Unknown command: ${command ?? "(empty)"}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
