import { mkdir, readFile, rename, rm, rmdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AppState, Match, ProviderStatus, Publication, SavedCalendar, SponsorRecord } from "./types.js";

const EMPTY_STATE: AppState = {
  matches: [],
  providers: []
};

const CONFIDENCE_RANK = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3
};
const LOCK_STALE_MS = 30_000;
const LOCK_RETRY_MS = 25;
const LOCK_TIMEOUT_MS = 10_000;

export class JsonStore {
  constructor(private readonly statePath: string) {}

  async read(): Promise<AppState> {
    return this.readUnlocked();
  }

  async write(state: AppState): Promise<void> {
    await this.withLock(() => this.writeUnlocked(state));
  }

  async update(mutator: (state: AppState) => AppState | Promise<AppState>): Promise<AppState> {
    return this.withLock(async () => {
      const next = await mutator(await this.readUnlocked());
      await this.writeUnlocked(next);
      return next;
    });
  }

  private async readUnlocked(): Promise<AppState> {
    try {
      return JSON.parse(await readFile(this.statePath, "utf8")) as AppState;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { ...EMPTY_STATE };
      }
      throw error;
    }
  }

  private async writeUnlocked(state: AppState): Promise<void> {
    await mkdir(path.dirname(this.statePath), { recursive: true });
    const tmpPath = `${this.statePath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
    await writeFile(tmpPath, `${JSON.stringify(state, null, 2)}\n`);
    await rename(tmpPath, this.statePath);
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const lockPath = `${this.statePath}.lock`;
    const startedAt = Date.now();
    await mkdir(path.dirname(this.statePath), { recursive: true });

    while (true) {
      try {
        await mkdir(lockPath, { recursive: false });
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        await removeStaleLock(lockPath);
        if (Date.now() - startedAt > LOCK_TIMEOUT_MS) {
          throw new Error(`Timed out waiting for state lock: ${lockPath}`, { cause: error });
        }
        await sleep(LOCK_RETRY_MS);
      }
    }

    try {
      return await fn();
    } finally {
      await rmdir(lockPath).catch(() => undefined);
    }
  }
}

async function removeStaleLock(lockPath: string): Promise<void> {
  try {
    const lockStat = await stat(lockPath);
    if (Date.now() - lockStat.mtimeMs > LOCK_STALE_MS) {
      await rm(lockPath, { recursive: true, force: true });
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function mergeMatches(existing: Match[], incoming: Match[]): Match[] {
  const existingById = new Map(existing.map((match) => [match.id, match]));

  return incoming.map((match) => {
    const current = existingById.get(match.id);
    if (!current) return match;

    const currentHasHigherConfidence = CONFIDENCE_RANK[current.confidence] > CONFIDENCE_RANK[match.confidence];
    const scoreState = currentHasHigherConfidence
      ? {
          status: current.status,
          score: current.score,
          goals: current.goals,
          confidence: current.confidence,
          source: current.source
        }
      : {
          status: match.status,
          score: match.score,
          goals: match.goals,
          confidence: match.confidence,
          source: match.source
        };

    const changed =
      current.homeTeam !== match.homeTeam ||
      current.awayTeam !== match.awayTeam ||
      current.kickoffAtUtc !== match.kickoffAtUtc ||
      current.venue !== match.venue ||
      JSON.stringify(current.score) !== JSON.stringify(scoreState.score) ||
      current.status !== scoreState.status;

    return {
      ...current,
      ...match,
      ...scoreState,
      sequence: changed ? current.sequence + 1 : current.sequence,
      updatedAt: changed ? new Date().toISOString() : current.updatedAt
    };
  });
}

export function upsertProviderStatus(state: AppState, status: ProviderStatus): AppState {
  const providers = state.providers.filter((provider) => provider.name !== status.name);
  return { ...state, providers: [...providers, status].sort((a, b) => a.name.localeCompare(b.name)) };
}

export function setPublication(state: AppState, publication: Publication): AppState {
  return { ...state, publication };
}

export function upsertSponsor(state: AppState, sponsor: SponsorRecord): AppState {
  const sponsors = state.sponsors ?? [];
  const next = sponsors.filter((item) => item.outTradeNo !== sponsor.outTradeNo);
  return { ...state, sponsors: [sponsor, ...next].slice(0, 200) };
}

export function markSponsorPaid(
  state: AppState,
  input: {
    outTradeNo: string;
    tradeNo?: string;
    amount?: string;
    paidAt: string;
  }
): AppState {
  const sponsors = state.sponsors ?? [];
  const existing = sponsors.find((item) => item.outTradeNo === input.outTradeNo);
  const paid: SponsorRecord = {
    outTradeNo: input.outTradeNo,
    tradeNo: input.tradeNo ?? existing?.tradeNo,
    amount: input.amount ?? existing?.amount ?? "0.00",
    displayName: existing?.displayName || "匿名球迷",
    note: existing?.note,
    status: "paid",
    createdAt: existing?.createdAt ?? input.paidAt,
    paidAt: input.paidAt
  };
  return upsertSponsor(state, paid);
}

export function upsertSavedCalendar(state: AppState, calendar: SavedCalendar): AppState {
  const savedCalendars = state.savedCalendars ?? [];
  const next = savedCalendars.filter((item) => item.slug !== calendar.slug);
  return { ...state, savedCalendars: [calendar, ...next].slice(0, 500) };
}
