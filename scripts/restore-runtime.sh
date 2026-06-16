#!/usr/bin/env sh
set -eu

APP_DIR="${APP_DIR:-$(pwd)}"
BACKUP_PATH="${1:-}"

if [ -z "$BACKUP_PATH" ]; then
  echo "Usage: APP_DIR=/path/to/app scripts/restore-runtime.sh /path/to/backup" >&2
  exit 2
fi

if [ ! -d "$BACKUP_PATH" ]; then
  echo "Backup path does not exist: $BACKUP_PATH" >&2
  exit 2
fi

mkdir -p "$APP_DIR/data/runtime" "$APP_DIR/public"

if [ -f "$BACKUP_PATH/state.json" ]; then
  cp "$BACKUP_PATH/state.json" "$APP_DIR/data/runtime/state.json"
fi

if [ -f "$BACKUP_PATH/worldcup2026.ics" ]; then
  cp "$BACKUP_PATH/worldcup2026.ics" "$APP_DIR/public/worldcup2026.ics"
fi
