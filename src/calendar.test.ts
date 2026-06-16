import { describe, expect, it } from "vitest";
import { generateIcs, summary } from "./calendar.js";
import type { Match } from "./types.js";

const baseMatch: Match = {
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

describe("calendar generation", () => {
  it("generates a valid VCALENDAR with a stable match UID", () => {
    const ics = generateIcs([baseMatch], {
      calendarDomain: "example.com",
      baseUrl: "https://example.com"
    });

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:worldcup2026-match-001@example.com");
    expect(ics).toContain("DTSTART:20260611T190000Z");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("puts final scores in the event summary", () => {
    expect(
      summary({
        ...baseMatch,
        status: "final",
        score: { home: 2, away: 1 }
      })
    ).toBe("Mexico 2-1 South Africa");
  });
});
