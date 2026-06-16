import type { AppState } from "./types.js";

export function renderPrometheusMetrics(state: AppState, now = new Date()): string {
  const lines = [
    "# HELP wc2026_matches_total Total matches loaded.",
    "# TYPE wc2026_matches_total gauge",
    `wc2026_matches_total ${state.matches.length}`,
    "# HELP wc2026_matches_final_total Matches marked as final.",
    "# TYPE wc2026_matches_final_total gauge",
    `wc2026_matches_final_total ${state.matches.filter((match) => match.status === "final").length}`,
    "# HELP wc2026_calendar_publication_age_seconds Seconds since the last calendar publication.",
    "# TYPE wc2026_calendar_publication_age_seconds gauge",
    `wc2026_calendar_publication_age_seconds ${secondsSince(state.publication?.publishedAt, now)}`,
    "# HELP wc2026_worker_heartbeat_age_seconds Seconds since the last worker heartbeat.",
    "# TYPE wc2026_worker_heartbeat_age_seconds gauge",
    `wc2026_worker_heartbeat_age_seconds ${secondsSince(state.workerHeartbeatAt, now)}`,
    "# HELP wc2026_provider_up Provider health, 1 for up and 0 for down.",
    "# TYPE wc2026_provider_up gauge",
    ...state.providers.map((provider) => `wc2026_provider_up{provider="${escapeLabel(provider.name)}"} ${provider.ok ? 1 : 0}`),
    "# HELP wc2026_provider_last_success_age_seconds Seconds since provider last success.",
    "# TYPE wc2026_provider_last_success_age_seconds gauge",
    ...state.providers.map(
      (provider) =>
        `wc2026_provider_last_success_age_seconds{provider="${escapeLabel(provider.name)}"} ${secondsSince(provider.lastSuccessAt, now)}`
    ),
    "# HELP wc2026_calendar_publication_info Calendar publication metadata.",
    "# TYPE wc2026_calendar_publication_info gauge",
    `wc2026_calendar_publication_info{sha256="${escapeLabel(state.publication?.sha256 ?? "")}"} ${state.publication ? 1 : 0}`
  ];

  return `${lines.join("\n")}\n`;
}

function secondsSince(iso: string | undefined, now: Date): number {
  if (!iso) return -1;
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 1000));
}

function escapeLabel(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}
