#!/bin/bash
set -e

# ============================================================
# OGame Clone — VPS Initial Setup
# Run once as root: sudo bash scripts/setup-vps.sh
# ============================================================

echo "========================================"
echo "  OGame Clone — VPS Setup"
echo "========================================"

# --- PostgreSQL 16 ---
echo ""
echo "==> Installing PostgreSQL..."
apt-get update -qq
apt-get install -y -qq postgresql postgresql-contrib

echo "==> Configuring PostgreSQL..."
read -sp "Enter password for PostgreSQL user 'ogame': " DB_PASSWORD
echo ""

sudo -u postgres psql -c "CREATE USER ogame WITH PASSWORD '${DB_PASSWORD}';" 2>/dev/null || echo "User ogame already exists"
sudo -u postgres psql -c "CREATE DATABASE ogame OWNER ogame;" 2>/dev/null || echo "Database ogame already exists"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ogame TO ogame;"

systemctl enable postgresql
systemctl start postgresql

# --- Redis ---
echo ""
echo "==> Installing Redis..."
apt-get install -y -qq redis-server

systemctl enable redis-server
systemctl start redis-server

# --- Caddy ---
echo ""
echo "==> Installing Caddy..."
apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update -qq
apt-get install -y -qq caddy

# --- pnpm ---
echo ""
echo "==> Installing pnpm..."
npm install -g pnpm

# --- PM2 ---
echo ""
echo "==> Installing PM2..."
npm install -g pm2

# --- Clone repo ---
INSTALL_DIR="/opt/ogame-clone"
if [ ! -d "$INSTALL_DIR" ]; then
  echo ""
  read -p "Enter GitHub repo URL (e.g. git@github.com:user/ogame-clone.git): " REPO_URL
  echo "==> Cloning repo to ${INSTALL_DIR}..."
  git clone "$REPO_URL" "$INSTALL_DIR"
else
  echo "==> ${INSTALL_DIR} already exists, skipping clone"
fi

# --- .env ---
echo ""
echo "==> Creating .env file..."
if [ ! -f "${INSTALL_DIR}/.env" ]; then
  read -sp "Enter JWT_SECRET (32+ chars, random string): " JWT_SECRET
  echo ""

  cat > "${INSTALL_DIR}/.env" << EOF
DATABASE_URL=postgresql://ogame:${DB_PASSWORD}@localhost:5432/ogame
REDIS_URL=redis://localhost:6379
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
API_PORT=3000
NODE_ENV=production
EOF

  chmod 600 "${INSTALL_DIR}/.env"
  echo "==> .env created with restricted permissions"
else
  echo "==> .env already exists, skipping"
fi

# --- Caddy config ---
echo ""
echo "==> Installing Caddyfile..."
cp "${INSTALL_DIR}/Caddyfile" /etc/caddy/Caddyfile
systemctl reload caddy

# --- PM2 startup ---
echo ""
echo "==> Configuring PM2 startup..."
pm2 startup systemd -u root --hp /root | bash

echo ""
echo "========================================"
echo "  Setup complete!"
echo ""
echo "  Next steps:"
echo "    cd ${INSTALL_DIR}"
echo "    ./scripts/deploy.sh"
echo "========================================"
