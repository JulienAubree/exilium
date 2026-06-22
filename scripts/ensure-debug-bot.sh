#!/usr/bin/env bash
# Crée (ou met à jour) le compte superviseur « Debug bot » sur la base cible,
# en ADMIN et SANS planète (insert direct — pas d'inscription, donc pas d'empire
# fantôme dans la galaxie). Mot de passe : DEBUG_BOT_PASSWORD (def constant,
# le même que celui lu par publish-feedback.mjs).
#
# Usage : bash scripts/ensure-debug-bot.sh [exilium|exilium_staging]
set -euo pipefail

DB="${1:-exilium}"
EMAIL="debug-bot@exilium-game.com"
USERNAME="DebugBot"
PASS_FILE="/opt/exilium/.debug-bot-password"

# Mot de passe : env > fichier gitignoré > généré aléatoirement (et stocké).
# Aucun secret n'est jamais committé.
if [ -n "${DEBUG_BOT_PASSWORD:-}" ]; then
  PASS="$DEBUG_BOT_PASSWORD"
elif [ -r "$PASS_FILE" ]; then
  PASS="$(tr -d '\n\r' < "$PASS_FILE")"
else
  PASS="$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 28)"
  ( umask 077; printf '%s' "$PASS" > "$PASS_FILE" )
  echo "[ensure-debug-bot] mot de passe généré → $PASS_FILE (gitignoré)"
fi

# Hash argon2 via la lib de l'API (même algo que auth.service).
HASH="$(cd /opt/exilium/apps/api && P="$PASS" node -e "import('argon2').then(a=>a.hash(process.env.P)).then(h=>process.stdout.write(h))")"
[ -n "$HASH" ] || { echo "FATAL: hash argon2 vide" >&2; exit 1; }

# SQL via stdin (et non -c) : c'est là que psql interpole les variables :'var'.
sudo -u postgres psql -d "$DB" -v ON_ERROR_STOP=1 \
  -v email="$EMAIL" -v username="$USERNAME" -v hash="$HASH" <<'SQL'
INSERT INTO users (email, username, password_hash, is_admin, email_verified_at)
VALUES (:'email', :'username', :'hash', true, now())
ON CONFLICT (email) DO UPDATE
  SET password_hash = EXCLUDED.password_hash, is_admin = true, email_verified_at = now()
RETURNING id, username, is_admin;
SQL

echo "[ensure-debug-bot] OK sur $DB : $USERNAME ($EMAIL) — admin, sans planète."
