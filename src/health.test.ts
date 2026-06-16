import { describe, expect, it } from "vitest";
import { checkHealth } from "./health.js";
import type { AppConfig } from "./config.js";
import type { AppState } from "./types.js";

const config = {
  HEALTH_WORKER_STALE_MS: 180_000,
  HEALTH_PUBLICATION_STALE_MS: 900_000,
  HEALTH_PROVIDER_STALE_MS: 600_000
} as AppConfig;

describe("checkHealth", () => {
  it("fails when worker heartbeat is stale", () => {
    const state: AppState = {
      matches: [
        {
          id: "match-001",
          matchNo: 1,
          round: "Matchday 1",
          stage: "group",
          kickoffAtUtc: "2026-06-11T19:00:00.000Z",
          homeTeam: "Mexico",
          awayTeam: "South Africa",
          venue: "Mexico City",
          status: "scheduled",
          goals: [],
          confidence: "none",
          source: "schedule",
          sequence: 0,
          updatedAt: "2026-06-16T00:00:00.000Z"
        }
      ],
      providers: [
        {
          name: "espn",
          ok: true,
          lastSuccessAt: "2026-06-16T00:09:00.000Z"
        }
      ],
      publication: {
        version: 1,
        publishedAt: "2026-06-16T00:09:00.000Z",
        matchCount: 1,
        finalCount: 0,
        path: "/worldcup2026.ics",
        sha256: "abc"
      },
      workerHeartbeatAt: "2026-06-16T00:00:00.000Z"
    };

    const result = checkHealth(state, config, new Date("2026-06-16T00:10:00.000Z"));

    expect(result.ok).toBe(false);
    expect(result.checks.find((check) => check.name === "workerHeartbeat")?.ok).toBe(false);
  });

  it("does not fail when a non-required provider is stale", () => {
    const state: AppState = {
      matches: [
        {
          id: "match-001",
          matchNo: 1,
          round: "Matchday 1",
          stage: "group",
          kickoffAtUtc: "2026-06-11T19:00:00.000Z",
          homeTeam: "Mexico",
          awayTeam: "South Africa",
          venue: "Mexico City",
          status: "scheduled",
          goals: [],
          confidence: "none",
          source: "schedule",
          sequence: 0,
          updatedAt: "2026-06-16T00:00:00.000Z"
        }
      ],
      providers: [{ name: "api-football", ok: false, required: false, message: "missing key" }],
      publication: {
        version: 1,
        publishedAt: "2026-06-16T00:09:00.000Z",
        matchCount: 1,
        finalCount: 0,
        path: "/worldcup2026.ics",
        sha256: "abc"
      },
      workerHeartbeatAt: "2026-06-16T00:09:00.000Z"
    };

    const result = checkHealth(state, config, new Date("2026-06-16T00:10:00.000Z"));

    expect(result.ok).toBe(true);
  });
});
