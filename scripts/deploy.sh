#!/bin/bash
set -e

# ============================================================
# Exilium — Deploy Script
# Run from project root: ./scripts/deploy.sh
# ============================================================

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

echo "==> Pulling latest changes..."
git pull origin main

echo "==> Installing dependencies..."
NODE_ENV=development pnpm install --frozen-lockfile

echo "==> Building all packages..."
pnpm exec turbo build

echo "==> Loading environment variables..."
export $(grep -v '^#' .env | xargs)

echo "==> Ensuring uploads directory..."
UPLOADS_DIR="/opt/exilium/uploads/assets"
mkdir -p "$UPLOADS_DIR"/{buildings,research,ships,defenses,planets,flagships}

# Sync assets from web public to uploads (copies missing files, keeps existing)
echo "    Syncing assets from web/public to uploads..."
for cat in buildings research ships defenses; do
  if [ -d "apps/web/public/assets/$cat" ] && [ -n "$(ls -A apps/web/public/assets/$cat/ 2>/dev/null)" ]; then
    cp -n apps/web/public/assets/$cat/* "$UPLOADS_DIR/$cat/" 2>/dev/null || true
  fi
done
# Planets and flagships have subdirectories — use recursive copy
for cat in planets flagships; do
  if [ -d "apps/web/public/assets/$cat" ]; then
    cp -rn apps/web/public/assets/$cat/* "$UPLOADS_DIR/$cat/" 2>/dev/null || true
  fi
done

echo "==> Applying pending database migrations..."
"$PROJECT_DIR/scripts/apply-migrations.sh"

echo "==> Seeding game config..."
pnpm --filter @exilium/db db:seed

echo "==> Reloading PM2 processes..."
pm2 reload ecosystem.config.cjs --update-env

echo "==> Saving PM2 process list..."
pm2 save

echo "==> Reloading Caddy config..."
# On recharge /etc/caddy/Caddyfile — le fichier que le service Caddy charge
# reellement (cf. `systemctl show caddy -p ExecStart`) — et NON celui du depot.
#
# Les deux ont diverge : /etc/caddy/Caddyfile est une COPIE, pas un lien, et il
# porte un `import /etc/caddy/cartes.conf` absent du depot. Recharger la version
# du depot mettait donc cartes.julien-aubree.space hors ligne a chaque
# deploiement d Exilium — une panne sur un autre projet, declenchee par un
# deploiement qui ne touche meme pas a la conf du serveur web.
#
# Un deploiement de code ne change jamais la configuration Caddy : ce reload est
# un no-op de securite. Si tu modifies /opt/exilium/Caddyfile, reporte le
# changement dans /etc/caddy/Caddyfile a la main (en preservant ses imports),
# puis `sudo caddy reload --config /etc/caddy/Caddyfile`.
sudo caddy reload --config /etc/caddy/Caddyfile 2>/dev/null || echo "    (Caddy reload skipped — not running or no permission)"

echo ""
echo "==> Deploying staging from the freshly-deployed main..."
# Unset every variable we sourced from prod's .env so it doesn't leak into
# the staging deploy. Otherwise pm2 reload --update-env propagates prod's
# API_PORT/REDIS_URL/etc. onto the staging processes (port 3000 conflict
# observed in production), and apply-migrations.sh inherits prod's
# DATABASE_URL — making it query prod's _migrations table while pretending
# to run against staging.
for var in $(grep -v '^#' .env | grep -E '^[A-Z_][A-Z0-9_]*=' | cut -d'=' -f1); do
  unset "$var"
done
"$PROJECT_DIR/scripts/deploy-staging.sh"

echo ""
echo "==> Deploy complete! Checking status..."
pm2 list
