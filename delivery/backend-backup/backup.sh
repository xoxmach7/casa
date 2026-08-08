#!/bin/sh
# Runs once per invocation — Railway's Cron Schedule starts this container on
# schedule, waits for it to exit, then stops it (not a long-running daemon).
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[backup] DATABASE_URL is not set — nothing to back up" >&2
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
FILE="$BACKUP_DIR/casa-$STAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[backup] starting pg_dump -> $FILE"
pg_dump "$DATABASE_URL" --no-owner --no-privileges | gzip > "$FILE.tmp"
mv "$FILE.tmp" "$FILE"

SIZE=$(du -h "$FILE" | cut -f1)
echo "[backup] wrote $FILE ($SIZE)"

echo "[backup] pruning backups older than $RETENTION_DAYS days"
find "$BACKUP_DIR" -name 'casa-*.sql.gz' -mtime "+$RETENTION_DAYS" -print -delete

echo "[backup] current backups:"
ls -lh "$BACKUP_DIR"

echo "[backup] done"
