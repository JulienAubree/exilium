#!/usr/bin/env bash
# Audit accessibilité (axe-core, WCAG 2.1 AA) sur le STAGING — déterministe, sans
# LLM. Se connecte avec un compte établi, parcourt les pages clés, agrège les
# violations R13 dans reports/_a11y/.
set -euo pipefail

REPO="/opt/exilium"
export E2E_STAGING_URL="${E2E_STAGING_URL:-http://localhost:3001}"

case "$E2E_STAGING_URL" in
  *:3000* | *//exilium-game.com* | *.exilium-game.com*)
    echo "REFUS: E2E_STAGING_URL ($E2E_STAGING_URL) ressemble à la prod." >&2
    exit 1
    ;;
esac

export LOGIN_EMAIL="${LOGIN_EMAIL:-zecharia@staging.local}"
if [[ -z "${LOGIN_PASSWORD:-}" && -r /opt/exilium-staging/.staging-password ]]; then
  export LOGIN_PASSWORD="$(tr -d '\n\r' < /opt/exilium-staging/.staging-password)"
fi

if ! curl -s -m 5 "$E2E_STAGING_URL/trpc/health" >/dev/null; then
  echo "FATAL: API staging injoignable sur $E2E_STAGING_URL" >&2
  exit 1
fi

cd "$REPO/apps/web"
exec node e2e/bots/a11y-audit.mjs "$@"
