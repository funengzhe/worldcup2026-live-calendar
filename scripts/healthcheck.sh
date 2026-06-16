#!/usr/bin/env sh
set -eu

HEALTHCHECK_URL="${HEALTHCHECK_URL:-http://127.0.0.1:3026/healthz}"
WEB_SERVICE="${WEB_SERVICE:-wc2026-calendar-web}"
WORKER_SERVICE="${WORKER_SERVICE:-wc2026-calendar-worker}"

if ! curl -fsS --max-time 10 "$HEALTHCHECK_URL" >/dev/null; then
  systemctl restart "$WEB_SERVICE" "$WORKER_SERVICE"
  sleep 5
  curl -fsS --max-time 10 "$HEALTHCHECK_URL" >/dev/null
fi
