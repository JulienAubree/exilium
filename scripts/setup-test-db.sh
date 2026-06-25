#!/usr/bin/env bash
# Prépare la base de test `exilium_test` (séparée de prod `exilium`) + y pousse
# le schéma Drizzle. Idempotent. À lancer en local ET en CI (filet de test du
# rework recherche — les helpers/services DB ont besoin d'une vraie DB).
#
# NB : on utilise `db:push` (synchro directe du schéma depuis src/schema/*.ts)
# et PAS `db:migrate` — une migration historique a un bug qui plante sur une DB
# vierge (« column "value" is of type jsonb but expression is of type numeric »).
# push donne le schéma courant, ce qu'on veut pour les tests.
set -euo pipefail
cd "$(dirname "$0")/.."

# URL de test = mêmes creds que prod (.env), mais DB `exilium_test`.
# En CI, fournir TEST_DATABASE_URL directement (service postgres).
if [[ -n "${TEST_DATABASE_URL:-}" ]]; then
  TEST_URL="$TEST_DATABASE_URL"
else
  TEST_URL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed -E 's#/exilium($|\?)#/exilium_test\1#')
fi

# Crée la DB si absente — LOCAL uniquement (via le superuser postgres).
# En CI, `exilium_test` est fournie par le service postgres du workflow
# (TEST_DATABASE_URL est défini), donc on ne crée rien ici.
if [[ -z "${TEST_DATABASE_URL:-}" ]] && command -v sudo >/dev/null 2>&1 && sudo -n -u postgres true 2>/dev/null; then
  sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='exilium_test'" | grep -q 1 \
    || sudo -u postgres psql -c "CREATE DATABASE exilium_test OWNER exilium;"
fi

# Pousse le schéma courant.
( cd packages/db && DATABASE_URL="$TEST_URL" pnpm exec tsx node_modules/drizzle-kit/bin.cjs push --force )

echo "✓ exilium_test prête (schéma poussé)."
