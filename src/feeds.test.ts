import { describe, expect, it } from "vitest";
import { findTeamFeed, knockoutMatches, matchesForTeam, slugify, teamFeeds } from "./feeds.js";
import type { Match } from "./types.js";

const matches: Match[] = [
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
    updatedAt: "2026-06-01T00:00:00.000Z"
  },
  {
    id: "match-073",
    matchNo: 73,
    round: "Round of 32",
    stage: "round-of-16",
    kickoffAtUtc: "2026-07-01T19:00:00.000Z",
    homeTeam: "Mexico",
    awayTeam: "France",
    venue: "Dallas",
    status: "scheduled",
    goals: [],
    confidence: "none",
    source: "schedule",
    sequence: 0,
    updatedAt: "2026-06-01T00:00:00.000Z"
  },
  {
    id: "match-074",
    matchNo: 74,
    round: "Round of 32",
    stage: "round-of-16",
    kickoffAtUtc: "2026-07-01T23:00:00.000Z",
    homeTeam: "1A",
    awayTeam: "W73",
    venue: "Atlanta",
    status: "scheduled",
    goals: [],
    confidence: "none",
    source: "schedule",
    sequence: 0,
    updatedAt: "2026-06-01T00:00:00.000Z"
  }
];

describe("feeds", () => {
  it("slugifies team names", () => {
    expect(slugify("Côte d'Ivoire")).toBe("cote-d-ivoire");
    expect(slugify("Bosnia & Herzegovina")).toBe("bosnia-and-herzegovina");
  });

  it("lists team feeds and filters by team", () => {
    expect(teamFeeds(matches).find((feed) => feed.team === "Mexico")).toMatchObject({
      slug: "mexico",
      matchCount: 2
    });
    expect(teamFeeds(matches).some((feed) => feed.team === "1A")).toBe(false);
    expect(teamFeeds(matches).some((feed) => feed.team === "W73")).toBe(false);
    expect(findTeamFeed(matches, "mexico")?.team).toBe("Mexico");
    expect(matchesForTeam(matches, "Mexico")).toHaveLength(2);
  });

  it("filters knockout matches", () => {
    expect(knockoutMatches(matches)).toHaveLength(2);
    expect(knockoutMatches(matches)[0]?.matchNo).toBe(73);
  });
});
