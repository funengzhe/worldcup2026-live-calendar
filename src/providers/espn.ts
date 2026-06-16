import type { Goal, Match, ScoreUpdate } from "../types.js";

const ESPN_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";

interface EspnEvent {
  id: string;
  date: string;
  competitions?: Array<{
    date: string;
    status?: {
      type?: {
        state?: string;
        completed?: boolean;
        name?: string;
      };
    };
    venue?: {
      fullName?: string;
      displayName?: string;
      address?: { city?: string; country?: string };
    };
    competitors?: Array<{
      homeAway: "home" | "away";
      score?: string;
      team?: {
        id?: string;
        displayName?: string;
        shortDisplayName?: string;
        name?: string;
      };
    }>;
    details?: Array<{
      scoringPlay?: boolean;
      penaltyKick?: boolean;
      ownGoal?: boolean;
      shootout?: boolean;
      clock?: { displayValue?: string };
      team?: { id?: string };
      athletesInvolved?: Array<{ displayName?: string }>;
    }>;
  }>;
}

interface EspnResponse {
  events?: EspnEvent[];
}

export async function fetchEspnUpdates(matches: Match[], now = new Date()): Promise<ScoreUpdate[]> {
  const dates = datesToPoll(matches, now);
  const responses = await Promise.all(dates.map((date) => fetchEspnDate(date)));
  return responses.flat();
}

function datesToPoll(matches: Match[], now: Date): string[] {
  const nowMs = now.getTime();
  const activeMatchDates = matches
    .filter((match) => {
      const kickoff = new Date(match.kickoffAtUtc).getTime();
      return kickoff >= nowMs - 72 * 60 * 60 * 1000 && kickoff <= nowMs + 24 * 60 * 60 * 1000;
    })
    .map((match) => yyyymmdd(new Date(match.kickoffAtUtc)));

  return Array.from(
    new Set([
      yyyymmdd(new Date(nowMs - 24 * 60 * 60 * 1000)),
      yyyymmdd(now),
      yyyymmdd(new Date(nowMs + 24 * 60 * 60 * 1000)),
      ...activeMatchDates
    ])
  );
}

async function fetchEspnDate(date: string): Promise<ScoreUpdate[]> {
  const response = await fetch(`${ESPN_URL}?dates=${date}`, {
    headers: { "user-agent": "worldcup2026-live-calendar/1.0" }
  });

  if (!response.ok) {
    throw new Error(`ESPN request failed: ${response.status} ${response.statusText}`);
  }

  const body = (await response.json()) as EspnResponse;
  return (body.events ?? []).flatMap(normalizeEspnEvent);
}

function normalizeEspnEvent(event: EspnEvent): ScoreUpdate[] {
  const competition = event.competitions?.[0];
  const home = competition?.competitors?.find((competitor) => competitor.homeAway === "home");
  const away = competition?.competitors?.find((competitor) => competitor.homeAway === "away");
  if (!competition || !home?.team || !away?.team) return [];

  const statusType = competition.status?.type;
  const status = statusType?.completed
    ? "final"
    : statusType?.state === "in"
      ? "live"
      : statusType?.name === "STATUS_HALFTIME"
        ? "halftime"
        : "scheduled";

  const homeScore = Number(home.score ?? "0");
  const awayScore = Number(away.score ?? "0");
  const score = status !== "scheduled" ? { home: homeScore, away: awayScore } : undefined;

  return [
    {
      provider: "espn",
      externalId: event.id,
      kickoffAtUtc: new Date(competition.date || event.date).toISOString(),
      homeTeam: home.team.displayName ?? home.team.shortDisplayName ?? home.team.name ?? "Home",
      awayTeam: away.team.displayName ?? away.team.shortDisplayName ?? away.team.name ?? "Away",
      venue: competition.venue?.fullName ?? competition.venue?.displayName,
      status,
      score,
      goals: normalizeGoals(competition.details ?? [], home.team.id, away.team.id),
      confidence: status === "final" ? "high" : "medium",
      checkedAt: new Date().toISOString()
    }
  ];
}

function normalizeGoals(
  details: NonNullable<NonNullable<EspnEvent["competitions"]>[number]["details"]>,
  homeTeamId?: string,
  awayTeamId?: string
): Goal[] {
  return details
    .filter((detail) => detail.scoringPlay && !detail.shootout)
    .map((detail) => {
      const teamId = detail.team?.id;
      return {
        team: teamId === homeTeamId ? "home" : teamId === awayTeamId ? "away" : "home",
        name: detail.athletesInvolved?.[0]?.displayName ?? "Goal",
        minute: detail.clock?.displayValue?.replace("'", "") ?? "",
        penalty: detail.penaltyKick,
        ownGoal: detail.ownGoal
      };
    });
}

function yyyymmdd(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}
