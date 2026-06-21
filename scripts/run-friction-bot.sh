#!/usr/bin/env bash
# Lance un bot de friction (agent-persona) contre le STAGING d'Exilium.
#
# Le bot sert lui-même le build web staging en local + proxy /trpc → :3001,
# s'inscrit avec un compte jetable, joue vers son objectif, puis écrit un
# rapport dans apps/web/e2e/bots/reports/<persona>-<date>/.
#
# Aucune prod n'est touchée. Le compte de test est créé en base STAGING.
#
# Provider LLM : DeepSeek (clé réutilisée depuis ~/studio-podcast/.env.local).
# Réglages via env :
#   FRICTION_BOT_PERSONA    (def: nouveau-joueur)
#   FRICTION_BOT_MAX_STEPS  (def: 15)
#   FRICTION_BOT_MODEL      (def: deepseek-chat)
#   FRICTION_BOT_HEADFUL=1  (voir le navigateur)
set -euo pipefail

REPO="/opt/exilium"

# Clé DeepSeek : env, sinon studio-podcast.
if [[ -z "${DEEPSEEK_API_KEY:-}" ]]; then
  ENVF="$HOME/studio-podcast/.env.local"
  if [[ -r "$ENVF" ]]; then
    export DEEPSEEK_API_KEY="$(grep -E '^DEEPSEEK_API_KEY=' "$ENVF" | head -1 | cut -d= -f2- | tr -d '\r\n')"
  fi
fi
if [[ -z "${DEEPSEEK_API_KEY:-}" ]]; then
  echo "FATAL: DEEPSEEK_API_KEY introuvable (ni env, ni ~/studio-podcast/.env.local)." >&2
  exit 1
fi

export E2E_STAGING_URL="${E2E_STAGING_URL:-http://localhost:3001}"

# Garde-fou : ne jamais pointer le bot vers la prod.
case "$E2E_STAGING_URL" in
  *:3000* | *//exilium-game.com* | *.exilium-game.com*)
    echo "REFUS: E2E_STAGING_URL ($E2E_STAGING_URL) ressemble à la prod. Le bot ne tourne QUE sur le staging." >&2
    exit 1
    ;;
esac

if ! curl -s -m 5 "$E2E_STAGING_URL/trpc/health" >/dev/null; then
  echo "FATAL: API staging injoignable sur $E2E_STAGING_URL" >&2
  exit 1
fi

cd "$REPO/apps/web"
exec node e2e/bots/friction-bot.mjs "$@"
