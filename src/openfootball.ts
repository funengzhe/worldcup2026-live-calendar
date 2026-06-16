import { z } from "zod";
import type { Match, NormalizedSourceMatch, Goal } from "./types.js";
import { parseOpenFootballDateTime } from "./time.js";

const SourceMatchSchema = z.object({
  round: z.string(),
  date: z.string(),
  time: z.string().optional(),
  team1: z.string(),
  team2: z.string(),
  group: z.string().optional(),
  ground: z.string(),
  score: z
    .object({
      ft: z.tuple([z.number(), z.number()]).optional(),
      ht: z.tuple([z.number(), z.number()]).optional(),
      et: z.tuple([z.number(), z.number()]).optional(),
      p: z.tuple([z.number(), z.number()]).optional()
    })
    .optional(),
  goals1: z
    .array(z.object({ name: z.string(), minute: z.string(), penalty: z.boolean().optional(), owngoal: z.boolean().optional() }))
    .optional(),
  goals2: z
    .array(z.object({ name: z.string(), minute: z.string(), penalty: z.boolean().optional(), owngoal: z.boolean().optional() }))
    .optional()
});

const SourceSchema = z.object({
  name: z.string(),
  matches: z.array(SourceMatchSchema)
});

export async function fetchOpenFootballMatches(url: string): Promise<NormalizedSourceMatch[]> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "worldcup2026-live-calendar/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`OpenFootball request failed: ${response.status} ${response.statusText}`);
  }

  const parsed = SourceSchema.parse(await response.json());
  return parsed.matches;
}

export function normalizeOpenFootballMatches(sourceMatches: NormalizedSourceMatch[], now = new Date()): Match[] {
  return sourceMatches.map((source, index) => {
    const kickoffAtUtc = parseOpenFootballDateTime(source.date, source.time);
    const hasFinalScore = Boolean(source.score?.ft);
    const matchNo = index + 1;
    const goals: Goal[] = [
      ...(source.goals1 ?? []).map((goal) => ({
        team: "home" as const,
        name: goal.name,
        minute: goal.minute,
        penalty: goal.penalty,
        ownGoal: goal.owngoal
      })),
      ...(source.goals2 ?? []).map((goal) => ({
        team: "away" as const,
        name: goal.name,
        minute: goal.minute,
        penalty: goal.penalty,
        ownGoal: goal.owngoal
      }))
    ];

    return {
      id: `match-${String(matchNo).padStart(3, "0")}`,
      matchNo,
      round: source.round,
      group: source.group,
      stage: inferStage(source.round),
      kickoffAtUtc,
      homeTeam: source.team1,
      awayTeam: source.team2,
      venue: source.ground,
      status: hasFinalScore ? "final" : "scheduled",
      score: source.score?.ft
        ? {
            home: source.score.ft[0],
            away: source.score.ft[1],
            halftimeHome: source.score.ht?.[0],
            halftimeAway: source.score.ht?.[1],
            penaltyHome: source.score.p?.[0],
            penaltyAway: source.score.p?.[1]
          }
        : undefined,
      goals,
      confidence: hasFinalScore ? "medium" : "none",
      source: hasFinalScore ? "openfootball" : "schedule",
      sequence: 0,
      updatedAt: now.toISOString()
    };
  });
}

function inferStage(round: string): string {
  const normalized = round.toLowerCase();
  if (normalized.includes("final")) return "final";
  if (normalized.includes("semi")) return "semi-final";
  if (normalized.includes("quarter")) return "quarter-final";
  if (normalized.includes("round of 16")) return "round-of-16";
  if (normalized.includes("matchday")) return "group";
  return normalized.replace(/\s+/g, "-");
}
