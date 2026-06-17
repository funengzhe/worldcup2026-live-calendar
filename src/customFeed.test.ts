import { describe, expect, it } from "vitest";
import { buildCustomFeed, customFeedQuery, parseCustomFeedOptions } from "./customFeed.js";
import type { Match } from "./types.js";

const matches: Match[] = [
  {
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
  },
  {
    id: "match-101",
    matchNo: 101,
    round: "Final",
    stage: "final",
    kickoffAtUtc: "2026-07-19T19:00:00.000Z",
    homeTeam: "Argentina",
    awayTeam: "Brazil",
    venue: "New York New Jersey",
    status: "final",
    score: { home: 2, away: 1 },
    goals: [],
    confidence: "high",
    source: "score",
    sequence: 3,
    updatedAt: "2026-07-19T22:00:00.000Z"
  }
];

describe("custom feeds", () => {
  it("parses team slugs and filters a personalized feed", () => {
    const options = parseCustomFeedOptions(matches, new URLSearchParams("teams=mexico&statuses=scheduled"));
    const feed = buildCustomFeed(matches, options);

    expect(feed.title).toBe("2026 世界杯：🇲🇽 墨西哥专属赛程");
    expect(feed.matches.map((match) => match.id)).toEqual(["match-001"]);
    expect(customFeedQuery(options)).toBe("teams=mexico&statuses=scheduled");
  });

  it("maps star subscriptions to their national team schedule", () => {
    const options = parseCustomFeedOptions(matches, new URLSearchParams("stars=messi&packs=knockout&statuses=final"));
    const feed = buildCustomFeed(matches, options);

    expect(feed.title).toBe("2026 世界杯：梅西关注赛程");
    expect(feed.description).toContain("球星关注：梅西");
    expect(feed.matches.map((match) => match.id)).toEqual(["match-101"]);
    expect(customFeedQuery(options)).toBe("packs=knockout&stars=messi&statuses=final");
  });

  it("combines packs and focus teams as a union", () => {
    const options = parseCustomFeedOptions(matches, new URLSearchParams("teams=mexico&packs=knockout&statuses=scheduled,final"));
    const feed = buildCustomFeed(matches, options);

    expect(feed.matches.map((match) => match.id)).toEqual(["match-001", "match-101"]);
    expect(feed.description).toContain("赛程包：淘汰赛");
  });

  it("returns an empty reason when filters match nothing", () => {
    const options = parseCustomFeedOptions(matches, new URLSearchParams("packs=prime&statuses=scheduled"));
    const feed = buildCustomFeed(matches, options);

    expect(feed.matches).toHaveLength(0);
    expect(feed.emptyReason).toContain("暂无比赛");
  });

  it("supports manually adding and removing matches", () => {
    const options = parseCustomFeedOptions(
      matches,
      new URLSearchParams("teams=mexico&include=101&exclude=1")
    );
    const feed = buildCustomFeed(matches, options);

    expect(feed.matches.map((match) => match.id)).toEqual(["match-101"]);
    expect(customFeedQuery(options)).toBe("teams=mexico&include=101&exclude=1");
    expect(feed.description).toContain("手动添加：1 场");
    expect(feed.description).toContain("已移除：1 场");
  });
});
