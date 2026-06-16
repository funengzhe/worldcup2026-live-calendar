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
    expect(ics).toContain("X-WR-TIMEZONE:Asia/Shanghai");
    expect(ics).toContain("X-WR-CALCOLOR:#1f8f3a");
    expect(ics).toContain("X-APPLE-CALENDAR-COLOR:#1f8f3a");
    expect(ics).toContain("DTSTART;TZID=Asia/Shanghai:20260612T030000");
    expect(ics).toContain("SUMMARY:🇲🇽 墨西哥 vs 🇿🇦 南非");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("puts final scores in the event summary", () => {
    expect(
      summary({
        ...baseMatch,
        status: "final",
        score: { home: 2, away: 1 }
      })
    ).toBe("🇲🇽 墨西哥 2-1 🇿🇦 南非");
  });
});
