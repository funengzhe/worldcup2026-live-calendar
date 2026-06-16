import type { AppConfig } from "./config.js";
import type { HealthCheckResult } from "./health.js";
import type { AppState } from "./types.js";

export interface ReadinessResult {
  ready: boolean;
  operational: boolean;
  checks: Array<{
    name: string;
    ok: boolean;
    required: boolean;
    message: string;
  }>;
}

export function checkReadiness(
  state: AppState,
  config: AppConfig,
  health: HealthCheckResult
): ReadinessResult {
  const hasPaidProvider =
    config.PRIMARY_SCORE_PROVIDER.toLowerCase() === "api-football" &&
    Boolean(config.API_FOOTBALL_API_KEY || config.PRIMARY_SCORE_PROVIDER_API_KEY);
  const hasAlertWebhook = Boolean(config.ALERT_WEBHOOK_URL);

  const checks = [
    {
      name: "runtimeHealth",
      ok: health.ok,
      required: true,
      message: health.ok ? "runtime health is green" : "runtime health has failing checks"
    },
    {
      name: "completeCalendar",
      ok: state.publication?.matchCount === 104,
      required: true,
      message: `${state.publication?.matchCount ?? 0} matches published`
    },
    {
      name: "paidPrimaryScoreProvider",
      ok: hasPaidProvider,
      required: true,
      message: hasPaidProvider
        ? "API-Football primary provider is configured"
        : "set PRIMARY_SCORE_PROVIDER=api-football and API_FOOTBALL_API_KEY"
    },
    {
      name: "externalAlertWebhook",
      ok: hasAlertWebhook,
      required: true,
      message: hasAlertWebhook ? "external alert webhook is configured" : "set ALERT_WEBHOOK_URL"
    },
    {
      name: "staticIcsPublication",
      ok: Boolean(state.publication?.sha256),
      required: true,
      message: state.publication?.sha256 ? `sha256 ${state.publication.sha256}` : "missing ICS hash"
    }
  ];

  return {
    operational: health.ok,
    ready: checks.every((check) => check.ok),
    checks
  };
}
