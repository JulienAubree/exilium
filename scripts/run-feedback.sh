#!/usr/bin/env bash
# Publie les recommandations de l'agent-designer dans la partie FEEDBACK in-game
# (table feedbacks du STAGING), via la vraie mutation tRPC, sous un compte
# « reporter » dédié. Dédup par titre. Aucune prod touchée.
set -euo pipefail

REPO="/opt/exilium"
export E2E_STAGING_URL="${E2E_STAGING_URL:-http://localhost:3001}"

case "$E2E_STAGING_URL" in
  *:3000* | *//exilium-game.com* | *.exilium-game.com*)
    echo "REFUS: E2E_STAGING_URL ($E2E_STAGING_URL) ressemble à la prod." >&2
    exit 1
    ;;
esac

if ! curl -s -m 5 "$E2E_STAGING_URL/trpc/health" >/dev/null; then
  echo "FATAL: API staging injoignable sur $E2E_STAGING_URL" >&2
  exit 1
fi

cd "$REPO/apps/web"
exec node e2e/bots/publish-feedback.mjs "$@"
