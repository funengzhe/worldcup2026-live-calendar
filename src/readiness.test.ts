import { describe, expect, it } from "vitest";
import { checkReadiness } from "./readiness.js";
import type { AppConfig } from "./config.js";
import type { AppState } from "./types.js";

const state: AppState = {
  matches: [],
  providers: [],
  publication: {
    version: 1,
    publishedAt: "2026-06-16T00:00:00.000Z",
    matchCount: 104,
    finalCount: 0,
    path: "/worldcup2026.ics",
    sha256: "abc"
  }
};

describe("checkReadiness", () => {
  it("is operational but not ready without alert webhook", () => {
    const result = checkReadiness(
      state,
      {
        PRIMARY_SCORE_PROVIDER: "openfootball",
        API_FOOTBALL_API_KEY: undefined,
        PRIMARY_SCORE_PROVIDER_API_KEY: undefined,
        ALERT_WEBHOOK_URL: undefined
      } as AppConfig,
      { ok: true, checks: [] }
    );

    expect(result.operational).toBe(true);
    expect(result.ready).toBe(false);
    expect(result.checks.find((check) => check.name === "paidPrimaryScoreProvider")?.required).toBe(
      false
    );
    expect(result.checks.find((check) => check.name === "externalAlertWebhook")?.ok).toBe(false);
  });

  it("is ready when runtime, paid provider, alerting, and publication are configured", () => {
    const result = checkReadiness(
      state,
      {
        PRIMARY_SCORE_PROVIDER: "api-football",
        API_FOOTBALL_API_KEY: "secret",
        ALERT_WEBHOOK_URL: "https://example.com/webhook"
      } as AppConfig,
      { ok: true, checks: [] }
    );

    expect(result.ready).toBe(true);
  });

  it("can be ready without a paid provider when alerting is configured", () => {
    const result = checkReadiness(
      state,
      {
        PRIMARY_SCORE_PROVIDER: "openfootball",
        API_FOOTBALL_API_KEY: undefined,
        PRIMARY_SCORE_PROVIDER_API_KEY: undefined,
        ALERT_WEBHOOK_URL: "https://example.com/webhook"
      } as AppConfig,
      { ok: true, checks: [] }
    );

    expect(result.ready).toBe(true);
    expect(result.checks.find((check) => check.name === "paidPrimaryScoreProvider")?.required).toBe(
      false
    );
  });
});
