import { describe, expect, it } from "vitest";
import { applyScoreUpdates } from "./resolver.js";
import type { AppState, Match, ScoreUpdate } from "../types.js";

const match: Match = {
  id: "match-001",
  matchNo: 1,
  round: "Matchday 1",
  group: "Group A",
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
  updatedAt: "2026-06-01T00:00:00.000Z"
};

describe("applyScoreUpdates", () => {
  it("aligns reversed provider home/away order to the canonical match order", () => {
    const update: ScoreUpdate = {
      provider: "espn",
      externalId: "1",
      kickoffAtUtc: "2026-06-11T19:00:00.000Z",
      homeTeam: "South Africa",
      awayTeam: "Mexico",
      status: "final",
      score: { home: 1, away: 2 },
      goals: [],
      confidence: "high",
      checkedAt: "2026-06-11T21:00:00.000Z"
    };

    const state: AppState = { matches: [match], providers: [] };
    const next = applyScoreUpdates(state, [update]);

    expect(next.matches[0]?.score).toEqual({ home: 2, away: 1 });
    expect(next.matches[0]?.source).toBe("espn");
    expect(next.matches[0]?.sequence).toBe(1);
  });

  it("stores CCTV metadata and keeps it when a later provider has no CCTV fields", () => {
    const cctvUpdate: ScoreUpdate = {
      provider: "cctv",
      externalId: "22920296",
      kickoffAtUtc: "2026-06-11T19:00:00.000Z",
      homeTeam: "Mexico",
      awayTeam: "South Africa",
      status: "scheduled",
      goals: [],
      confidence: "medium",
      cctvGameId: 22920296,
      cctvUrl: "https://worldcup.cctv.com/2026/match/22920296/index.shtml",
      cctvVenue: "阿兹台克人体育场",
      cctvChannel: "CCTV5",
      checkedAt: "2026-06-11T18:00:00.000Z"
    };

    const withCctv = applyScoreUpdates({ matches: [match], providers: [] }, [cctvUpdate]);
    expect(withCctv.matches[0]?.cctvUrl).toBe("https://worldcup.cctv.com/2026/match/22920296/index.shtml");
    expect(withCctv.matches[0]?.cctvVenue).toBe("阿兹台克人体育场");

    const unchanged = applyScoreUpdates(withCctv, [
      {
        provider: "espn",
        externalId: "espn-1",
        kickoffAtUtc: "2026-06-11T19:00:00.000Z",
        homeTeam: "Mexico",
        awayTeam: "South Africa",
        status: "scheduled",
        goals: [],
        confidence: "medium",
        checkedAt: "2026-06-11T18:01:00.000Z"
      }
    ]);

    expect(unchanged.matches[0]?.cctvUrl).toBe(withCctv.matches[0]?.cctvUrl);
    expect(unchanged.matches[0]?.sequence).toBe(withCctv.matches[0]?.sequence);
  });
});
