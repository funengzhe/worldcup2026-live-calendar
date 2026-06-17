import { describe, expect, it, vi } from "vitest";
import { cctvMatchUrl, fetchCctvUpdates } from "./cctv.js";
import type { Match } from "../types.js";

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

const portugalMatch: Match = {
  id: "match-061",
  matchNo: 61,
  round: "Matchday 1",
  group: "Group K",
  stage: "group",
  kickoffAtUtc: "2026-06-17T17:00:00.000Z",
  homeTeam: "Portugal",
  awayTeam: "DR Congo",
  venue: "Houston",
  status: "scheduled",
  goals: [],
  confidence: "none",
  source: "schedule",
  sequence: 60,
  updatedAt: "2026-06-01T00:00:00.000Z"
};

describe("fetchCctvUpdates", () => {
  it("matches CCTV Chinese schedule rows to local matches and builds live URLs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          success: true,
          results: [
            {
              id: 22920296,
              gameName: "墨西哥vs南非",
              gamePlace: "阿兹台克人体育场",
              startTime: "2026-06-12 03:00:00",
              statusDesc: "已结束",
              homeName: "墨西哥",
              guestName: "南非",
              homeScore: 2,
              guestScore: 0,
              homeHalfScore: 1,
              guestHalfScore: 0,
              liveChannel: "cctv5",
              scores: { Current: { game_id: 22920296 } }
            }
          ]
        })
      }))
    );

    const updates = await fetchCctvUpdates([match], "https://example.com/cctv.json");

    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      provider: "cctv",
      externalId: "22920296",
      kickoffAtUtc: "2026-06-11T19:00:00.000Z",
      homeTeam: "Mexico",
      awayTeam: "South Africa",
      status: "final",
      score: { home: 2, away: 0, halftimeHome: 1, halftimeAway: 0 },
      cctvGameId: 22920296,
      cctvUrl: "https://worldcup.cctv.com/2026/match/22920296/index.shtml",
      cctvVenue: "阿兹台克人体育场",
      cctvChannel: "CCTV5"
    });
    expect(cctvMatchUrl(22920330)).toBe("https://worldcup.cctv.com/2026/match/22920330/index.shtml");

    vi.unstubAllGlobals();
  });

  it("treats CCTV first-half and second-half labels as live and keeps live scores", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          success: true,
          results: [
            {
              id: 23510453,
              gameName: "葡萄牙 vs 刚果（金）",
              gamePlace: "休斯敦体育场",
              startTime: "2026-06-18 01:00:00",
              statusDesc: "下半场",
              homeName: "葡萄牙",
              guestName: "刚果（金）",
              homeScore: 1,
              guestScore: 1,
              homeHalfScore: 1,
              guestHalfScore: 0,
              liveChannel: "cctv5",
              scores: { Current: { game_id: 23510453 } }
            }
          ]
        })
      }))
    );

    const updates = await fetchCctvUpdates([portugalMatch], "https://example.com/cctv.json");

    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      provider: "cctv",
      externalId: "23510453",
      homeTeam: "Portugal",
      awayTeam: "DR Congo",
      status: "live",
      score: { home: 1, away: 1, halftimeHome: 1, halftimeAway: 0 },
      cctvUrl: "https://worldcup.cctv.com/2026/match/23510453/index.shtml"
    });

    vi.unstubAllGlobals();
  });
});
