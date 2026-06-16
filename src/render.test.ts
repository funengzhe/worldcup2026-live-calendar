import { describe, expect, it } from "vitest";
import { renderHome } from "./render.js";
import type { AppState, Match } from "./types.js";

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

describe("renderHome", () => {
  it("renders a user-facing subscription and schedule page", async () => {
    const state: AppState = {
      matches: [match],
      providers: [],
      publication: {
        version: 1,
        publishedAt: "2026-06-01T00:00:00.000Z",
        matchCount: 1,
        finalCount: 0,
        path: "/worldcup2026.ics",
        sha256: "abc"
      }
    };

    const html = await renderHome(state, "https://example.com");

    expect(html).toContain("全部赛程，一次订阅");
    expect(html).toContain("<svg");
    expect(html).toContain('data-copy="https://example.com/worldcup2026.ics"');
    expect(html).toContain("🇲🇽 墨西哥 vs 🇿🇦 南非");
    expect(html).toContain("CCTV");
    expect(html).toContain("抖音");
    expect(html).toContain("小红书");
    expect(html).toContain("B站");
  });
});
