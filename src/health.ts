import type { AppConfig } from "./config.js";
import type { AppState } from "./types.js";

export interface HealthCheckResult {
  ok: boolean;
  checks: Array<{
    name: string;
    ok: boolean;
    message: string;
  }>;
}

export function checkHealth(state: AppState, config: AppConfig, now = new Date()): HealthCheckResult {
  const checks = [
    {
      name: "matches",
      ok: state.matches.length > 0,
      message: `${state.matches.length} matches loaded`
    },
    {
      name: "publication",
      ok: Boolean(state.publication),
      message: state.publication ? `published at ${state.publication.publishedAt}` : "not published"
    },
    freshCheck({
      name: "publicationFreshness",
      iso: state.publication?.publishedAt,
      thresholdMs: config.HEALTH_PUBLICATION_STALE_MS,
      now
    }),
    freshCheck({
      name: "workerHeartbeat",
      iso: state.workerHeartbeatAt,
      thresholdMs: config.HEALTH_WORKER_STALE_MS,
      now
    }),
    ...state.providers.map((provider) => ({
      name: `provider:${provider.name}`,
      ok:
        provider.ok &&
        Boolean(provider.lastSuccessAt) &&
        ageMs(provider.lastSuccessAt, now) <= config.HEALTH_PROVIDER_STALE_MS,
      message: provider.ok
        ? `last success ${provider.lastSuccessAt ?? "never"}`
        : provider.message ?? "provider failed"
    }))
  ];

  return {
    ok: checks.every((check) => check.ok),
    checks
  };
}

function freshCheck(input: {
  name: string;
  iso?: string;
  thresholdMs: number;
  now: Date;
}): HealthCheckResult["checks"][number] {
  if (!input.iso) {
    return { name: input.name, ok: false, message: "missing timestamp" };
  }

  const age = ageMs(input.iso, input.now);
  return {
    name: input.name,
    ok: age <= input.thresholdMs,
    message: `age ${Math.round(age / 1000)}s, threshold ${Math.round(input.thresholdMs / 1000)}s`
  };
}

function ageMs(iso: string | undefined, now: Date): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  return Math.max(0, now.getTime() - new Date(iso).getTime());
}
