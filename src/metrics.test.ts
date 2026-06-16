import { describe, expect, it } from "vitest";
import { renderPrometheusMetrics } from "./metrics.js";
import type { AppState } from "./types.js";

describe("renderPrometheusMetrics", () => {
  it("renders core Prometheus metrics", () => {
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
          status: "final",
          score: { home: 2, away: 0 },
          goals: [],
          confidence: "high",
          source: "espn",
          sequence: 1,
          updatedAt: "2026-06-16T00:00:00.000Z"
        }
      ],
      providers: [{ name: "espn", ok: true, lastSuccessAt: "2026-06-16T00:09:00.000Z" }],
      publication: {
        version: 1,
        publishedAt: "2026-06-16T00:05:00.000Z",
        matchCount: 1,
        finalCount: 1,
        path: "/worldcup2026.ics",
        sha256: "abc"
      },
      workerHeartbeatAt: "2026-06-16T00:09:30.000Z"
    };

    const metrics = renderPrometheusMetrics(state, new Date("2026-06-16T00:10:00.000Z"));

    expect(metrics).toContain("wc2026_matches_total 1");
    expect(metrics).toContain("wc2026_matches_final_total 1");
    expect(metrics).toContain("wc2026_calendar_publication_age_seconds 300");
    expect(metrics).toContain("wc2026_worker_heartbeat_age_seconds 30");
    expect(metrics).toContain('wc2026_provider_up{provider="espn"} 1');
  });
});
