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

# --- 4. Rename PostgreSQL database and user ---
echo ""
echo "==> Renaming PostgreSQL database '$OLD_DB_NAME' → '$NEW_DB_NAME'..."
# ALTER DATABASE requires no active connections (PM2 is already stopped)
sudo -u postgres psql -c "ALTER DATABASE $OLD_DB_NAME RENAME TO $NEW_DB_NAME;"
echo "    Database renamed."

echo "==> Renaming PostgreSQL user '$OLD_DB_USER' → '$NEW_DB_USER'..."
sudo -u postgres psql -c "ALTER USER $OLD_DB_USER RENAME TO $NEW_DB_USER;"
echo "    User renamed."

echo "==> Updating password for '$NEW_DB_USER'..."
read -sp "Enter new password for PostgreSQL user '$NEW_DB_USER' (or press Enter to keep current): " DB_PASSWORD
echo ""

if [ -n "$DB_PASSWORD" ]; then
  sudo -u postgres psql -c "ALTER USER $NEW_DB_USER WITH PASSWORD '${DB_PASSWORD}';"
  echo "    Password updated."
else
  echo "    Password unchanged."
fi

# --- 5. Update .env ---
echo ""
echo "==> Updating .env file..."
if [ -f "$NEW_DIR/.env" ]; then
  sed -i "s|$OLD_DB_USER|$NEW_DB_USER|g" "$NEW_DIR/.env"
  sed -i "s|/$OLD_DB_NAME|/$NEW_DB_NAME|g" "$NEW_DIR/.env"
  if [ -n "$DB_PASSWORD" ]; then
    sed -i "s|$NEW_DB_USER:[^@]*@|$NEW_DB_USER:${DB_PASSWORD}@|g" "$NEW_DIR/.env"
  fi
  echo "    .env updated."
else
  echo "    WARNING: .env not found. You'll need to create it manually."
fi

# --- 6. Pull latest code ---
echo ""
echo "==> Pulling latest code..."
git pull origin main

# --- 7. Install and build ---
echo ""
echo "==> Installing dependencies..."
NODE_ENV=development pnpm install --frozen-lockfile

echo ""
echo "==> Building all packages..."
pnpm exec turbo build

# --- 8. Push schema (ensure DB is in sync) ---
echo ""
echo "==> Loading environment variables..."
export $(grep -v '^#' "$NEW_DIR/.env" | xargs)

echo "==> Pushing database schema..."
pnpm --filter @exilium/db db:push

# --- 9. Start PM2 with new names ---
echo ""
echo "==> Starting PM2 processes..."
pm2 start ecosystem.config.cjs
pm2 save

# --- 10. Reload Caddy ---
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
echo "  DB and user renamed in place (no old DB to clean up)."
echo "========================================"
pm2 list
