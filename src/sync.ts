import type { AppConfig } from "./config.js";
import { publishIcs } from "./calendar.js";
import { fetchOpenFootballMatches, normalizeOpenFootballMatches } from "./openfootball.js";
import { fetchApiFootballUpdates } from "./providers/apiFootball.js";
import { fetchEspnUpdates } from "./providers/espn.js";
import { applyScoreUpdates } from "./providers/resolver.js";
import { JsonStore, mergeMatches, setPublication, upsertProviderStatus } from "./store.js";
import type { ScoreUpdate } from "./types.js";

export async function syncSchedule(config: AppConfig, store: JsonStore) {
  const checkedAt = new Date().toISOString();

  try {
    const source = await fetchOpenFootballMatches(config.OPENFOOTBALL_URL);
    const matches = normalizeOpenFootballMatches(source);
    const state = await store.update((current) => ({
      ...upsertProviderStatus(current, {
        name: "openfootball",
        ok: true,
        lastCheckedAt: checkedAt,
        lastSuccessAt: checkedAt,
        message: `${source.length} matches loaded`
      }),
      matches: mergeMatches(current.matches, matches),
      lastScheduleSyncAt: checkedAt,
      lastScoreSyncAt: checkedAt
    }));

    return state;
  } catch (error) {
    await store.update((current) =>
      upsertProviderStatus(current, {
        name: "openfootball",
        ok: false,
        lastCheckedAt: checkedAt,
        message: error instanceof Error ? error.message : String(error)
      })
    );
    throw error;
  }
}

export async function publishCalendar(config: AppConfig, store: JsonStore) {
  const state = await store.read();
  if (state.matches.length === 0) {
    await syncSchedule(config, store);
  }

  const freshState = await store.read();
  const publication = await publishIcs(freshState.matches, {
    calendarDomain: config.CALENDAR_DOMAIN,
    baseUrl: config.PUBLIC_BASE_URL,
    calendarPath: config.calendarPath
  });

  await store.update((current) => setPublication(current, publication));
  return publication;
}

export async function syncScores(config: AppConfig, store: JsonStore) {
  const checkedAt = new Date().toISOString();
  const state = await store.read();
  if (state.matches.length === 0) {
    await syncSchedule(config, store);
  }

  const updates: ScoreUpdate[] = [];
  const primary = config.PRIMARY_SCORE_PROVIDER.toLowerCase();

  if (primary === "api-football") {
    try {
      const apiFootballUpdates = await fetchApiFootballUpdates(config);
      updates.push(...apiFootballUpdates);
      await store.update((current) =>
        upsertProviderStatus(current, {
          name: "api-football",
          ok: true,
          required: true,
          lastCheckedAt: checkedAt,
          lastSuccessAt: checkedAt,
          message: `${apiFootballUpdates.length} updates loaded`
        })
      );
    } catch (error) {
      await store.update((current) =>
        upsertProviderStatus(current, {
          name: "api-football",
          ok: false,
          required: true,
          lastCheckedAt: checkedAt,
          message: error instanceof Error ? error.message : String(error)
        })
      );
    }
  }

  try {
    const espnUpdates = await fetchEspnUpdates((await store.read()).matches);
    updates.push(...espnUpdates);
    const next = await store.update((current) =>
      upsertProviderStatus(applyScoreUpdates(current, updates), {
        name: "espn",
        ok: true,
        required: primary !== "api-football",
        lastCheckedAt: checkedAt,
        lastSuccessAt: checkedAt,
        message: `${espnUpdates.length} updates loaded`
      })
    );
    return next;
  } catch (error) {
    await store.update((current) =>
      upsertProviderStatus(current, {
        name: "espn",
        ok: false,
        required: primary !== "api-football",
        lastCheckedAt: checkedAt,
        message: error instanceof Error ? error.message : String(error)
      })
    );
    if (updates.length > 0) {
      return store.update((current) => applyScoreUpdates(current, updates));
    }
    throw error;
  }
}

export async function heartbeat(store: JsonStore) {
  await store.update((current) => ({ ...current, workerHeartbeatAt: new Date().toISOString() }));
}
