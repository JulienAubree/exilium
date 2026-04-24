#!/usr/bin/env bash
# Daily Postgres backup for Exilium.
# - Reads DATABASE_URL from /opt/exilium/.env
# - Writes a custom-format dump to /opt/backups/postgres/
# - Prunes dumps older than RETENTION_DAYS (default 14)
# - Logs to /opt/backups/postgres/backup.log
#
# Designed to be called from cron:
#   0 3 * * * /opt/exilium/scripts/backup-postgres.sh >> /opt/backups/postgres/backup.log 2>&1

set -euo pipefail

ENV_FILE="/opt/exilium/.env"
BACKUP_DIR="/opt/backups/postgres"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

if [[ ! -r "$ENV_FILE" ]]; then
  echo "[$(date -Iseconds)] FATAL: cannot read $ENV_FILE" >&2
  exit 1
fi

DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
if [[ -z "$DATABASE_URL" ]]; then
  echo "[$(date -Iseconds)] FATAL: DATABASE_URL not found in $ENV_FILE" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_DIR/exilium-$TS.dump"

echo "[$(date -Iseconds)] starting backup -> $OUT"
pg_dump --format=custom --compress=9 --no-owner --no-acl --dbname="$DATABASE_URL" --file="$OUT"

SIZE="$(du -h "$OUT" | cut -f1)"
echo "[$(date -Iseconds)] backup done ($SIZE)"

echo "[$(date -Iseconds)] pruning dumps older than $RETENTION_DAYS days"
find "$BACKUP_DIR" -maxdepth 1 -name 'exilium-*.dump' -type f -mtime +"$RETENTION_DAYS" -print -delete || true

echo "[$(date -Iseconds)] done"
