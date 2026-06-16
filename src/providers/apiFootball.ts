import type { AppConfig } from "../config.js";
import type { Goal, MatchStatus, ScoreUpdate } from "../types.js";

interface ApiFootballFixture {
  fixture: {
    id: number;
    date: string;
    status: {
      short: string;
      elapsed?: number | null;
    };
    venue?: {
      name?: string | null;
      city?: string | null;
    };
  };
  league?: {
    round?: string;
  };
  teams: {
    home: { name: string };
    away: { name: string };
  };
  goals?: {
    home?: number | null;
    away?: number | null;
  };
  score?: {
    halftime?: { home?: number | null; away?: number | null };
    fulltime?: { home?: number | null; away?: number | null };
    extratime?: { home?: number | null; away?: number | null };
    penalty?: { home?: number | null; away?: number | null };
  };
  events?: Array<{
    time?: { elapsed?: number | null; extra?: number | null };
    team?: { name?: string };
    player?: { name?: string };
    type?: string;
    detail?: string;
  }>;
}

interface ApiFootballResponse {
  errors?: unknown;
  results?: number;
  response?: ApiFootballFixture[];
}

export async function fetchApiFootballUpdates(config: AppConfig): Promise<ScoreUpdate[]> {
  const apiKey = config.API_FOOTBALL_API_KEY || config.PRIMARY_SCORE_PROVIDER_API_KEY;
  if (!apiKey) {
    throw new Error("API_FOOTBALL_API_KEY is not configured");
  }

  const url = new URL("/fixtures", config.API_FOOTBALL_BASE_URL);
  url.searchParams.set("league", String(config.API_FOOTBALL_LEAGUE_ID));
  url.searchParams.set("season", String(config.API_FOOTBALL_SEASON));

  const response = await fetch(url, {
    headers: {
      "x-apisports-key": apiKey,
      "user-agent": "worldcup2026-live-calendar/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`API-Football request failed: ${response.status} ${response.statusText}`);
  }

  const body = (await response.json()) as ApiFootballResponse;
  if (body.errors && JSON.stringify(body.errors) !== "[]" && JSON.stringify(body.errors) !== "{}") {
    throw new Error(`API-Football returned errors: ${JSON.stringify(body.errors)}`);
  }

  return normalizeApiFootballFixtures(body.response ?? []);
}

export function normalizeApiFootballFixtures(fixtures: ApiFootballFixture[]): ScoreUpdate[] {
  const checkedAt = new Date().toISOString();
  return fixtures.map((fixture) => {
    const status = normalizeStatus(fixture.fixture.status.short);
    const score = status === "scheduled" ? undefined : normalizeScore(fixture);
    const venue = [fixture.fixture.venue?.name, fixture.fixture.venue?.city].filter(Boolean).join(", ");

    return {
      provider: "api-football",
      externalId: String(fixture.fixture.id),
      kickoffAtUtc: new Date(fixture.fixture.date).toISOString(),
      homeTeam: fixture.teams.home.name,
      awayTeam: fixture.teams.away.name,
      venue: venue || undefined,
      status,
      score,
      goals: normalizeGoals(fixture),
      confidence: status === "final" ? "high" : status === "scheduled" ? "medium" : "high",
      checkedAt
    };
  });
}

function normalizeStatus(short: string): MatchStatus {
  if (["FT", "AET", "PEN"].includes(short)) return "final";
  if (short === "HT") return "halftime";
  if (["1H", "2H", "ET", "P", "BT", "LIVE"].includes(short)) return "live";
  if (["PST", "CANC", "ABD", "SUSP"].includes(short)) return "postponed";
  return "scheduled";
}

function normalizeScore(fixture: ApiFootballFixture) {
  const fulltime = fixture.score?.fulltime;
  const extratime = fixture.score?.extratime;
  const penalty = fixture.score?.penalty;
  const home = extratime?.home ?? fulltime?.home ?? fixture.goals?.home ?? 0;
  const away = extratime?.away ?? fulltime?.away ?? fixture.goals?.away ?? 0;

  return {
    home,
    away,
    halftimeHome: fixture.score?.halftime?.home ?? undefined,
    halftimeAway: fixture.score?.halftime?.away ?? undefined,
    penaltyHome: penalty?.home ?? undefined,
    penaltyAway: penalty?.away ?? undefined
  };
}

function normalizeGoals(fixture: ApiFootballFixture): Goal[] {
  return (fixture.events ?? [])
    .filter((event) => event.type === "Goal")
    .map((event) => ({
      team: event.team?.name === fixture.teams.home.name ? ("home" as const) : ("away" as const),
      name: event.player?.name ?? "Goal",
      minute: formatMinute(event.time?.elapsed, event.time?.extra),
      penalty: event.detail === "Penalty",
      ownGoal: event.detail === "Own Goal"
    }));
}

function formatMinute(elapsed?: number | null, extra?: number | null): string {
  if (!elapsed) return "";
  return extra ? `${elapsed}+${extra}` : String(elapsed);
}
