import { describe, expect, it } from "vitest";
import { normalizeApiFootballFixtures } from "./apiFootball.js";

describe("normalizeApiFootballFixtures", () => {
  it("normalizes final fixtures with penalties", () => {
    const updates = normalizeApiFootballFixtures([
      {
        fixture: {
          id: 123,
          date: "2026-07-19T19:00:00+00:00",
          status: { short: "PEN" },
          venue: { name: "MetLife Stadium", city: "New York New Jersey" }
        },
        teams: {
          home: { name: "Argentina" },
          away: { name: "France" }
        },
        goals: { home: 1, away: 1 },
        score: {
          halftime: { home: 0, away: 0 },
          fulltime: { home: 1, away: 1 },
          penalty: { home: 4, away: 2 }
        },
        events: [
          {
            type: "Goal",
            detail: "Penalty",
            time: { elapsed: 72 },
            team: { name: "Argentina" },
            player: { name: "Lionel Messi" }
          }
        ]
      }
    ]);

    expect(updates[0]).toMatchObject({
      provider: "api-football",
      externalId: "123",
      homeTeam: "Argentina",
      awayTeam: "France",
      status: "final",
      score: {
        home: 1,
        away: 1,
        halftimeHome: 0,
        halftimeAway: 0,
        penaltyHome: 4,
        penaltyAway: 2
      },
      goals: [{ team: "home", name: "Lionel Messi", minute: "72", penalty: true }]
    });
  });
});
