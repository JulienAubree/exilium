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

echo "[deploy-staging] building..."
pnpm build

echo "[deploy-staging] applying DB migrations..."
bash scripts/apply-migrations.sh

echo "[deploy-staging] reloading PM2 processes..."
pm2 reload staging.config.cjs --update-env
pm2 save

echo "[deploy-staging] done. Check: pm2 logs exilium-api-staging"
