import type { Match, MatchStatus, ScoreUpdate } from "../types.js";
import { teamNameZh } from "../localization.js";

const CCTV_MATCH_URL_PREFIX = "https://worldcup.cctv.com/2026/match";

interface CctvScheduleResponse {
  success?: boolean;
  results?: CctvGame[];
}

interface CctvGame {
  id?: number;
  gameName?: string;
  gamePlace?: string;
  startTime?: string;
  statusDesc?: string;
  homeName?: string;
  guestName?: string;
  homeScore?: number;
  guestScore?: number;
  homeHalfScore?: number;
  guestHalfScore?: number;
  liveChannel?: string;
  scores?: {
    Current?: {
      game_id?: number;
    };
  };
}

export async function fetchCctvUpdates(matches: Match[], url: string): Promise<ScoreUpdate[]> {
  const response = await fetch(url, {
    headers: { "user-agent": "worldcup2026-live-calendar/1.0" }
  });

  if (!response.ok) {
    throw new Error(`CCTV request failed: ${response.status} ${response.statusText}`);
  }

  const body = (await response.json()) as CctvScheduleResponse;
  if (!body.success || !Array.isArray(body.results)) {
    throw new Error("CCTV response is not successful");
  }

  const checkedAt = new Date().toISOString();
  return body.results.flatMap((game) => normalizeCctvGame(game, matches, checkedAt));
}

export function cctvMatchUrl(gameId: number): string {
  return `${CCTV_MATCH_URL_PREFIX}/${gameId}/index.shtml`;
}

function normalizeCctvGame(game: CctvGame, matches: Match[], checkedAt: string): ScoreUpdate[] {
  const matched = matchLocalGame(game, matches);
  const gameId = game.scores?.Current?.game_id ?? game.id;
  const kickoffAtUtc = game.startTime ? cctvBeijingTimeToUtc(game.startTime) : undefined;
  if (!matched || !gameId || !kickoffAtUtc) return [];

  const status = normalizeStatus(game.statusDesc);
  const hasScore = typeof game.homeScore === "number" && typeof game.guestScore === "number";
  const score =
    hasScore && status !== "scheduled"
      ? {
          home: game.homeName === teamNameZh(matched.homeTeam) ? game.homeScore! : game.guestScore!,
          away: game.homeName === teamNameZh(matched.homeTeam) ? game.guestScore! : game.homeScore!,
          halftimeHome: alignHalfScore(game, matched, "home"),
          halftimeAway: alignHalfScore(game, matched, "away")
        }
      : undefined;

  return [
    {
      provider: "cctv",
      externalId: String(gameId),
      kickoffAtUtc,
      homeTeam: matched.homeTeam,
      awayTeam: matched.awayTeam,
      venue: matched.venue,
      status,
      score,
      goals: [],
      confidence: status === "final" ? "high" : "medium",
      cctvGameId: gameId,
      cctvUrl: cctvMatchUrl(gameId),
      cctvVenue: game.gamePlace,
      cctvChannel: game.liveChannel?.toUpperCase(),
      checkedAt
    }
  ];
}

function matchLocalGame(game: CctvGame, matches: Match[]): Match | undefined {
  if (!game.startTime || !game.homeName || !game.guestName) return undefined;

  return matches.find((match) => {
    if (formatBeijingSecond(match.kickoffAtUtc) !== game.startTime) return false;
    const localTeams = new Set([normalizeTeamZh(teamNameZh(match.homeTeam)), normalizeTeamZh(teamNameZh(match.awayTeam))]);
    return localTeams.has(normalizeTeamZh(game.homeName!)) && localTeams.has(normalizeTeamZh(game.guestName!));
  });
}

function alignHalfScore(game: CctvGame, matched: Match, side: "home" | "away"): number | undefined {
  if (typeof game.homeHalfScore !== "number" || typeof game.guestHalfScore !== "number") return undefined;
  const cctvHomeIsLocalHome = game.homeName === teamNameZh(matched.homeTeam);
  if (side === "home") return cctvHomeIsLocalHome ? game.homeHalfScore : game.guestHalfScore;
  return cctvHomeIsLocalHome ? game.guestHalfScore : game.homeHalfScore;
}

function normalizeStatus(status?: string): MatchStatus {
  if (!status) return "scheduled";
  if (status.includes("中场")) return "halftime";
  if (status.includes("进行") || status.includes("直播")) return "live";
  if (status.includes("结束") || status.includes("集锦") || status.includes("回放")) return "final";
  if (status.includes("延期")) return "postponed";
  return "scheduled";
}

function cctvBeijingTimeToUtc(value: string): string {
  return new Date(`${value.replace(" ", "T")}+08:00`).toISOString();
}

function formatBeijingSecond(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(iso));
}

function normalizeTeamZh(value: string): string {
  return value
    .replace(/\s+/g, "")
    .replace(/[()（）]/g, "")
    .replace(/民主刚果/g, "刚果金")
    .replace(/刚果（金）/g, "刚果金")
    .replace(/美国队/g, "美国")
    .trim();
}
