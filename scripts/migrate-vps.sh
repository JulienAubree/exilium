#!/bin/bash
set -e

# ============================================================
# Exilium — VPS Migration Script (ogame-clone → exilium)
# Run once as root: sudo bash scripts/migrate-vps.sh
# ============================================================

OLD_DIR="/opt/ogame-clone"
NEW_DIR="/opt/exilium"
OLD_DB_USER="ogame"
NEW_DB_USER="exilium"
OLD_DB_NAME="ogame"
NEW_DB_NAME="exilium"

echo "========================================"
echo "  Exilium — VPS Migration"
echo "  ogame-clone → exilium"
echo "========================================"

# --- Pre-flight checks ---
if [ ! -d "$OLD_DIR" ]; then
  echo "ERROR: $OLD_DIR does not exist. Nothing to migrate."
  exit 1
fi

if [ -d "$NEW_DIR" ]; then
  echo "ERROR: $NEW_DIR already exists. Migration may have already been done."
  exit 1
fi

# --- 1. Stop PM2 processes ---
echo ""
echo "==> Stopping PM2 processes..."
pm2 stop all 2>/dev/null || echo "    (No PM2 processes running)"
pm2 delete all 2>/dev/null || echo "    (No PM2 processes to delete)"

# --- 2. Rename directory ---
echo ""
echo "==> Renaming $OLD_DIR → $NEW_DIR..."
mv "$OLD_DIR" "$NEW_DIR"

# --- 3. Update git remote ---
echo ""
echo "==> Updating git remote URL..."
cd "$NEW_DIR"
git remote set-url origin https://github.com/JulienAubree/exilium.git
echo "    Remote: $(git remote get-url origin)"

# --- 4. Create new PostgreSQL user + DB (keep old ones for safety) ---
echo ""
echo "==> Creating new PostgreSQL user '$NEW_DB_USER' and database '$NEW_DB_NAME'..."
read -sp "Enter password for new PostgreSQL user '$NEW_DB_USER': " DB_PASSWORD
echo ""

sudo -u postgres psql -c "CREATE USER $NEW_DB_USER WITH PASSWORD '${DB_PASSWORD}';" 2>/dev/null || echo "    User $NEW_DB_USER already exists"
sudo -u postgres psql -c "CREATE DATABASE $NEW_DB_NAME OWNER $NEW_DB_USER;" 2>/dev/null || echo "    Database $NEW_DB_NAME already exists"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $NEW_DB_NAME TO $NEW_DB_USER;"

# --- 5. Copy data from old DB to new DB ---
echo ""
echo "==> Copying data from '$OLD_DB_NAME' to '$NEW_DB_NAME'..."
sudo -u postgres pg_dump "$OLD_DB_NAME" | sudo -u postgres psql "$NEW_DB_NAME"
echo "    Data copied."

# --- 6. Update .env ---
echo ""
echo "==> Updating .env file..."
if [ -f "$NEW_DIR/.env" ]; then
  sed -i "s|postgresql://$OLD_DB_USER:[^@]*@localhost:5432/$OLD_DB_NAME|postgresql://$NEW_DB_USER:${DB_PASSWORD}@localhost:5432/$NEW_DB_NAME|g" "$NEW_DIR/.env"
  echo "    .env updated with new DB credentials."
else
  echo "    WARNING: .env not found. You'll need to create it manually."
fi

# --- 7. Pull latest code ---
echo ""
echo "==> Pulling latest code..."
git pull origin main

# --- 8. Install and build ---
echo ""
echo "==> Installing dependencies..."
NODE_ENV=development pnpm install --frozen-lockfile

echo ""
echo "==> Building all packages..."
pnpm exec turbo build

# --- 9. Push schema (ensure DB is in sync) ---
echo ""
echo "==> Loading environment variables..."
export $(grep -v '^#' "$NEW_DIR/.env" | xargs)

echo "==> Pushing database schema..."
pnpm --filter @exilium/db db:push

# --- 10. Start PM2 with new names ---
echo ""
echo "==> Starting PM2 processes..."
pm2 start ecosystem.config.cjs
pm2 save

# --- 11. Reload Caddy ---
echo ""
echo "==> Reloading Caddy config..."
sudo caddy reload --config "$NEW_DIR/Caddyfile" 2>/dev/null || echo "    (Caddy reload skipped)"

# --- Done ---
echo ""
echo "========================================"
echo "  Migration complete!"
echo ""
echo "  Old: $OLD_DIR → New: $NEW_DIR"
echo "  Old DB: $OLD_DB_NAME → New DB: $NEW_DB_NAME"
echo "  PM2 processes: exilium-api, exilium-worker"
echo ""
echo "  Verify everything works, then you can drop the old DB:"
echo "    sudo -u postgres psql -c \"DROP DATABASE $OLD_DB_NAME;\""
echo "    sudo -u postgres psql -c \"DROP USER $OLD_DB_USER;\""
echo "========================================"
pm2 list
