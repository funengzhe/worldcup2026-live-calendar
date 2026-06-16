#!/usr/bin/env sh
set -eu

APP_DIR="${APP_DIR:-$(pwd)}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

STATE_FILE="$APP_DIR/data/runtime/state.json"
ICS_FILE="$APP_DIR/public/worldcup2026.ics"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="$BACKUP_DIR/$STAMP"

mkdir -p "$DEST"

if [ -f "$STATE_FILE" ]; then
  cp "$STATE_FILE" "$DEST/state.json"
fi

if [ -f "$ICS_FILE" ]; then
  cp "$ICS_FILE" "$DEST/worldcup2026.ics"
fi

find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime +"$RETENTION_DAYS" -exec rm -rf {} +

printf '%s\n' "$DEST"
