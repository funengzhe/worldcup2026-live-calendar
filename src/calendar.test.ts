import { afterEach, describe, expect, it, vi } from "vitest";
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

afterEach(() => {
  vi.useRealTimers();
});

describe("calendar generation", () => {
  it("generates a valid VCALENDAR with a stable match UID", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-17T18:50:00.000Z"));
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
    expect(ics).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT5M");
    expect(ics).toContain("X-PUBLISHED-TTL:PT5M");
    expect(ics).toContain("DTSTAMP:20260617T185000Z");
    expect(ics).toContain("LAST-MODIFIED:20260617T185000Z");
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

  it("puts live scores in the event summary so mobile calendars show updates in lists", () => {
    expect(
      summary({
        ...baseMatch,
        status: "live",
        score: { home: 1, away: 1 }
      })
    ).toBe("🇲🇽 墨西哥 1-1 🇿🇦 南非（进行中）");
  });
});
