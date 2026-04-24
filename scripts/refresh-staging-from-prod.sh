#!/usr/bin/env bash
# Copy the prod DB onto staging with anonymization.
#
# After this script:
#   - Every prod user exists on staging, keeping their uuid, username, role,
#     game state (planets, fleets, research, ...).
#   - Emails become <username_slug>@staging.local so you can log in as any
#     user without exposing real prod emails on staging.
#   - All passwords are replaced with a single known staging password,
#     stored out-of-band in /opt/exilium-staging/.staging-password (chmod 600).
#   - Refresh tokens, password reset tokens, email verification tokens, push
#     subscriptions and login events are purged (PII or non-portable).
#   - is_admin flags are preserved so admin dashboards stay accessible.
#
# Staging workers are stopped during the copy and restarted afterwards. The
# BullMQ job queues in staging Redis (index 1) are NOT restored — the
# event-catchup cron will re-enqueue pending fleet/build work from DB state.
#
# Designed to be idempotent: run it again to refresh staging from current prod.
# Safe to kill mid-way (wraps critical steps in a transaction where possible).
#
# Usage:  sudo /opt/exilium/scripts/refresh-staging-from-prod.sh

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "This script needs sudo (psql -u postgres + chmod on files in /opt)." >&2
  exit 1
fi

PROD_ENV="/opt/exilium/.env"
STAGING_ENV="/opt/exilium-staging/.env"
STAGING_PASS_FILE="/opt/exilium-staging/.staging-password"

if [[ ! -r "$PROD_ENV" || ! -r "$STAGING_ENV" ]]; then
  echo "Missing .env files." >&2
  exit 1
fi

PROD_DB_URL="$(grep -E '^DATABASE_URL=' "$PROD_ENV" | head -1 | cut -d= -f2-)"
STAGING_DB_URL="$(grep -E '^DATABASE_URL=' "$STAGING_ENV" | head -1 | cut -d= -f2-)"

if [[ -z "$PROD_DB_URL" || -z "$STAGING_DB_URL" ]]; then
  echo "Could not parse DATABASE_URL from env files." >&2
  exit 1
fi

# Guardrail: make sure we never point staging ops at prod by accident.
if [[ "$STAGING_DB_URL" == "$PROD_DB_URL" ]]; then
  echo "FATAL: prod and staging DATABASE_URL are identical — refusing." >&2
  exit 1
fi

echo "[refresh] stopping staging processes..."
sudo -u ubuntu bash -c "pm2 stop exilium-api-staging exilium-worker-staging" || true

echo "[refresh] generating staging password..."
STAGING_PASSWORD="$(openssl rand -base64 18 | tr -d '/+=' | head -c 20)"
PASSWORD_HASH="$(sudo -u ubuntu bash -c "cd /opt/exilium-staging/apps/api && node --input-type=module -e \"
import { hash } from 'argon2';
const h = await hash(process.argv[1]);
process.stdout.write(h);
\" '$STAGING_PASSWORD'")"

if [[ -z "$PASSWORD_HASH" ]]; then
  echo "FATAL: could not generate argon2 hash." >&2
  exit 1
fi

echo "[refresh] dropping + recreating staging DB..."
# Kill any existing connections first so DROP doesn't block.
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'exilium_staging' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS exilium_staging;
CREATE DATABASE exilium_staging OWNER exilium_staging;
GRANT ALL PRIVILEGES ON DATABASE exilium_staging TO exilium_staging;
SQL

echo "[refresh] dumping prod and restoring to staging..."
# --clean not needed since DB was just recreated. --no-owner/--no-acl lets the
# staging role own everything after restore.
pg_dump "$PROD_DB_URL" --no-owner --no-acl \
  | psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -q

echo "[refresh] anonymizing..."
# Replace emails with a slug derived from username, reset passwords to the
# generated staging password, purge PII and non-portable state.
# slug: lowercase, keep [a-z0-9_-], replace other runs with '-', strip edges.
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 <<SQL
BEGIN;

UPDATE users
SET email = (
  regexp_replace(
    regexp_replace(lower(username), '[^a-z0-9_-]+', '-', 'g'),
    '^-+|-+\$', '', 'g'
  )
) || '@staging.local',
password_hash = '${PASSWORD_HASH}',
failed_login_attempts = 0,
locked_until = NULL;

-- In case slug collision (shouldn't happen since usernames are unique,
-- but defensive): ensure email uniqueness by appending id suffix if dup.
WITH dups AS (
  SELECT email FROM users GROUP BY email HAVING count(*) > 1
)
UPDATE users u SET email = split_part(u.email, '@', 1) || '-' || left(u.id::text, 8) || '@staging.local'
WHERE u.email IN (SELECT email FROM dups);

-- Purge tables that carry PII or reference infrastructure that doesn't exist
-- on staging (emails, push endpoints, IPs from real visitors).
TRUNCATE TABLE refresh_tokens, password_reset_tokens, email_verification_tokens, push_subscriptions, login_events;

COMMIT;
SQL

echo "[refresh] writing staging password to $STAGING_PASS_FILE..."
umask 077
echo "$STAGING_PASSWORD" > "$STAGING_PASS_FILE"
chown ubuntu:ubuntu "$STAGING_PASS_FILE"
chmod 600 "$STAGING_PASS_FILE"

echo "[refresh] syncing uploaded assets (planets/flagships/avatars)..."
rsync -a --delete /opt/exilium/uploads/ /opt/exilium-staging/uploads/
chown -R ubuntu:ubuntu /opt/exilium-staging/uploads

echo "[refresh] restarting staging..."
sudo -u ubuntu bash -c "pm2 start exilium-api-staging exilium-worker-staging" || true

USER_COUNT="$(psql "$STAGING_DB_URL" -t -A -c 'SELECT count(*) FROM users;')"
PLANET_COUNT="$(psql "$STAGING_DB_URL" -t -A -c 'SELECT count(*) FROM planets;')"

echo
echo "===================================================="
echo "  Staging refreshed from prod"
echo "----------------------------------------------------"
echo "  Users:   $USER_COUNT  (all passwords replaced)"
echo "  Planets: $PLANET_COUNT"
echo "  Password file: $STAGING_PASS_FILE"
echo "  Log in as any user with  <username_slug>@staging.local"
echo "===================================================="
