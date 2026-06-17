import type { AppState, Match, ScoreUpdate } from "../types.js";

const CONFIDENCE_RANK = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3
};

export function applyScoreUpdates(state: AppState, updates: ScoreUpdate[]): AppState {
  if (updates.length === 0) return state;

  const matches = state.matches.map((match) => {
    const update = bestUpdateForMatch(match, updates);
    if (!update) return match;
    if (CONFIDENCE_RANK[update.confidence] < CONFIDENCE_RANK[match.confidence]) return match;

    const aligned = alignUpdateToMatch(match, update);

    const metadataChanged =
      (aligned.cctvGameId !== undefined && match.cctvGameId !== aligned.cctvGameId) ||
      (aligned.cctvUrl !== undefined && match.cctvUrl !== aligned.cctvUrl) ||
      (aligned.cctvVenue !== undefined && match.cctvVenue !== aligned.cctvVenue) ||
      (aligned.cctvChannel !== undefined && match.cctvChannel !== aligned.cctvChannel);

    const changed =
      match.status !== aligned.status ||
      JSON.stringify(match.score) !== JSON.stringify(aligned.score) ||
      JSON.stringify(match.goals) !== JSON.stringify(aligned.goals) ||
      metadataChanged;

    if (!changed) return match;

    return {
      ...match,
      status: aligned.status,
      score: aligned.score,
      goals: aligned.goals.length > 0 ? aligned.goals : match.goals,
      confidence: aligned.confidence,
      source: aligned.provider,
      cctvGameId: aligned.cctvGameId ?? match.cctvGameId,
      cctvUrl: aligned.cctvUrl ?? match.cctvUrl,
      cctvVenue: aligned.cctvVenue ?? match.cctvVenue,
      cctvChannel: aligned.cctvChannel ?? match.cctvChannel,
      sequence: match.sequence + 1,
      updatedAt: aligned.checkedAt
    };
  });

  return { ...state, matches, lastScoreSyncAt: new Date().toISOString() };
}

function alignUpdateToMatch(match: Match, update: ScoreUpdate): ScoreUpdate {
  const direct =
    normalize(match.homeTeam) === normalize(update.homeTeam) &&
    normalize(match.awayTeam) === normalize(update.awayTeam);

  if (direct || !update.score) return update;

  return {
    ...update,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    score: {
      home: update.score.away,
      away: update.score.home,
      halftimeHome: update.score.halftimeAway,
      halftimeAway: update.score.halftimeHome,
      penaltyHome: update.score.penaltyAway,
      penaltyAway: update.score.penaltyHome
    },
    goals: update.goals.map((goal) => ({
      ...goal,
      team: goal.team === "home" ? "away" : "home"
    }))
  };
}

function bestUpdateForMatch(match: Match, updates: ScoreUpdate[]): ScoreUpdate | undefined {
  return updates
    .map((update) => ({ update, score: matchScore(match, update) }))
    .filter((candidate) => candidate.score >= 3)
    .sort((a, b) => b.score - a.score)[0]?.update;
}

function matchScore(match: Match, update: ScoreUpdate): number {
  let score = 0;
  const kickoffDiff = Math.abs(new Date(match.kickoffAtUtc).getTime() - new Date(update.kickoffAtUtc).getTime());
  if (kickoffDiff <= 3 * 60 * 60 * 1000) score += 2;
  if (sameTeamSet([match.homeTeam, match.awayTeam], [update.homeTeam, update.awayTeam])) score += 4;
  if (update.venue && normalize(update.venue).includes(normalize(match.venue).split(" ")[0] ?? "")) score += 1;
  return score;
}

function sameTeamSet(left: [string, string], right: [string, string]): boolean {
  const normalizedLeft = left.map(normalize).sort();
  const normalizedRight = right.map(normalize).sort();
  return normalizedLeft[0] === normalizedRight[0] && normalizedLeft[1] === normalizedRight[1];
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/\brepublic of korea\b/g, "south korea")
    .replace(/\bkorea republic\b/g, "south korea")
    .replace(/\bunited states\b/g, "usa")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
