export type MatchStatus = "scheduled" | "live" | "halftime" | "final" | "postponed";

export type Confidence = "none" | "low" | "medium" | "high";

export interface Score {
  home: number;
  away: number;
  penaltyHome?: number;
  penaltyAway?: number;
  halftimeHome?: number;
  halftimeAway?: number;
}

export interface Goal {
  team: "home" | "away";
  name: string;
  minute: string;
  penalty?: boolean;
  ownGoal?: boolean;
}

export interface Match {
  id: string;
  matchNo: number;
  round: string;
  group?: string;
  stage: string;
  kickoffAtUtc: string;
  homeTeam: string;
  awayTeam: string;
  venue: string;
  status: MatchStatus;
  score?: Score;
  goals: Goal[];
  confidence: Confidence;
  source: string;
  cctvGameId?: number;
  cctvUrl?: string;
  cctvVenue?: string;
  cctvChannel?: string;
  sequence: number;
  updatedAt: string;
}

export interface ProviderStatus {
  name: string;
  ok: boolean;
  required?: boolean;
  lastCheckedAt?: string;
  lastSuccessAt?: string;
  message?: string;
}

export interface Publication {
  version: number;
  publishedAt: string;
  matchCount: number;
  finalCount: number;
  path: string;
  sha256: string;
}

export type SponsorStatus = "pending" | "paid";

export interface SponsorRecord {
  outTradeNo: string;
  tradeNo?: string;
  amount: string;
  displayName: string;
  note?: string;
  status: SponsorStatus;
  createdAt: string;
  paidAt?: string;
}

export interface SavedCalendar {
  slug: string;
  query: string;
  title: string;
  matchCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AppState {
  matches: Match[];
  providers: ProviderStatus[];
  sponsors?: SponsorRecord[];
  savedCalendars?: SavedCalendar[];
  publication?: Publication;
  lastScheduleSyncAt?: string;
  lastScoreSyncAt?: string;
  workerHeartbeatAt?: string;
}

export interface ScoreUpdate {
  provider: string;
  externalId: string;
  kickoffAtUtc: string;
  homeTeam: string;
  awayTeam: string;
  venue?: string;
  status: MatchStatus;
  score?: Score;
  goals: Goal[];
  confidence: Confidence;
  cctvGameId?: number;
  cctvUrl?: string;
  cctvVenue?: string;
  cctvChannel?: string;
  checkedAt: string;
}

export interface NormalizedSourceMatch {
  round: string;
  date: string;
  time?: string;
  team1: string;
  team2: string;
  group?: string;
  ground: string;
  score?: {
    ft?: [number, number];
    ht?: [number, number];
    et?: [number, number];
    p?: [number, number];
  };
  goals1?: Array<{ name: string; minute: string; penalty?: boolean; owngoal?: boolean }>;
  goals2?: Array<{ name: string; minute: string; penalty?: boolean; owngoal?: boolean }>;
}
