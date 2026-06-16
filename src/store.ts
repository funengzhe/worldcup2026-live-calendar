import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AppState, Match, ProviderStatus, Publication } from "./types.js";

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

export class JsonStore {
  constructor(private readonly statePath: string) {}

  async read(): Promise<AppState> {
    try {
      return JSON.parse(await readFile(this.statePath, "utf8")) as AppState;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { ...EMPTY_STATE };
      }
      throw error;
    }
  }

  async write(state: AppState): Promise<void> {
    await mkdir(path.dirname(this.statePath), { recursive: true });
    const tmpPath = `${this.statePath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
    await writeFile(tmpPath, `${JSON.stringify(state, null, 2)}\n`);
    await rename(tmpPath, this.statePath);
  }

  async update(mutator: (state: AppState) => AppState | Promise<AppState>): Promise<AppState> {
    const next = await mutator(await this.read());
    await this.write(next);
    return next;
  }
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
