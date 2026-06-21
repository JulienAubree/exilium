#!/usr/bin/env bash
# Pipeline complet « friction → recos design » en UNE commande :
#   1. audit déterministe (sans LLM, lecture seule du code)
#   2. session bot-persona sur le STAGING (joue, tague ses frictions par règle)
#   3. agent-designer : synthèse audit + sessions + rubric → reco-design.md priorisé
#
# Staging-only / aucune prod touchée. Variables transmises aux étages :
#   FRICTION_BOT_PERSONA · FRICTION_BOT_MAX_STEPS · FRICTION_BOT_HEADFUL
#   FRICTION_BOT_MODEL · DESIGNER_MODEL
#
# Ex : FRICTION_BOT_HEADFUL=1 FRICTION_BOT_MAX_STEPS=18 bash scripts/run-pipeline.sh
set -euo pipefail
REPO="/opt/exilium"

echo "═══ 1/3 · Audit déterministe ═══"
node "$REPO/apps/web/e2e/bots/audit.mjs"

echo
echo "═══ 2/3 · Session bot-persona ═══"
bash "$REPO/scripts/run-friction-bot.sh" "$@"

echo
echo "═══ 3/3 · Agent-designer ═══"
bash "$REPO/scripts/run-designer.sh"

echo
echo "═══ Pipeline terminé ═══"
LAST=$(ls -t "$REPO/apps/web/e2e/bots/reports/_designer/"reco-design-*.md 2>/dev/null | head -1 || true)
echo "Livrable : ${LAST:-(voir reports/_designer/)}"
