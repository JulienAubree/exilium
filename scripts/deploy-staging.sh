#!/usr/bin/env bash
# Deploy the staging environment from the latest main (or a specific ref).
#
# Workflow:
#   1. Pull the requested ref into /opt/exilium-staging
#   2. Install deps + build all packages
#   3. Apply Drizzle migrations against exilium_staging DB
#   4. Reload PM2 staging processes (zero-downtime)
#
# Usage:
#   ./scripts/deploy-staging.sh           # deploys origin/main
#   ./scripts/deploy-staging.sh <ref>     # deploys any branch/tag/SHA
#
# Designed to run from either /opt/exilium (dev machine) or the staging
# directory itself — both work because the script operates on an absolute
# staging path.

set -euo pipefail

STAGING_DIR="/opt/exilium-staging"
REF="${1:-origin/main}"

if [[ ! -d "$STAGING_DIR/.git" ]]; then
  echo "FATAL: $STAGING_DIR is not a git repo. Run the initial setup first." >&2
  exit 1
fi

echo "[deploy-staging] fetching latest refs..."
cd "$STAGING_DIR"
git fetch --all --tags --prune

echo "[deploy-staging] checking out $REF..."
git checkout -f "$REF"
git reset --hard "$REF"

echo "[deploy-staging] installing deps..."
pnpm install --frozen-lockfile

# tsc -b consults a per-project .tsbuildinfo and skips type checks when it
# believes inputs haven't changed. After a deploy chain (where deploy.sh
# runs prod first and leaves a partially-shared pnpm store / hoisted state),
# we've observed phantom type errors here that vanish after a clean rebuild.
# Wiping the .tsbuildinfo files is cheap (~1s rebuild penalty) and avoids
# the failure mode entirely. node_modules is left alone — pnpm install
# above is already responsible for keeping it in sync with the lockfile.
echo "[deploy-staging] clearing stale TS build cache..."
find apps packages -maxdepth 4 -name "*.tsbuildinfo" -not -path "*/node_modules/*" -delete 2>/dev/null || true

echo "[deploy-staging] building..."
pnpm build

echo "[deploy-staging] applying DB migrations..."
bash scripts/apply-migrations.sh

# The seed upserts game_config rows (buildings, research, bonuses, etc.)
# from packages/db/src/seed-game-config.ts. Without this step, any seed-only
# tuning (rebalance, new fields like max_level / bonus_type) lands in code
# but never reaches the staging DB — observed on Sprint 1 deploy.
# We must override DATABASE_URL with the staging .env value because the
# seed script defaults to the prod connection string.
echo "[deploy-staging] seeding game config..."
STAGING_DB_URL=$(grep -E '^DATABASE_URL=' "$STAGING_DIR/.env" | head -1 | cut -d'=' -f2-)
STAGING_DB_URL="${STAGING_DB_URL%\"}"
STAGING_DB_URL="${STAGING_DB_URL#\"}"
DATABASE_URL="$STAGING_DB_URL" pnpm --filter @exilium/db db:seed

echo "[deploy-staging] reloading PM2 processes..."
pm2 reload staging.config.cjs --update-env
pm2 save

echo "[deploy-staging] done. Check: pm2 logs exilium-api-staging"
