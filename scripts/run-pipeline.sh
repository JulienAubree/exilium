#!/usr/bin/env bash
# Pipeline complet « friction → recos design → feedback in-game » en UNE commande :
#   1. audit déterministe (sans LLM, lecture seule du code)
#   2. session bot-persona sur le STAGING (joue, tague ses frictions par règle)
#   3. agent-designer : synthèse audit + sessions + rubric → reco-design.md priorisé
#   4. publication des recos dans la partie FEEDBACK in-game (table feedbacks staging)
#
# Staging-only / aucune prod touchée. Variables transmises aux étages :
#   FRICTION_BOT_PERSONA · FRICTION_BOT_MAX_STEPS · FRICTION_BOT_HEADFUL
#   FRICTION_BOT_MODEL · DESIGNER_MODEL · FEEDBACK_MAX
#   NO_FEEDBACK=1 → saute l'étape 4 (pas de publication).
#
# Ex : FRICTION_BOT_HEADFUL=1 FRICTION_BOT_MAX_STEPS=18 bash scripts/run-pipeline.sh
set -euo pipefail
REPO="/opt/exilium"

echo "═══ 1/5 · Audit code (déterministe) ═══"
node "$REPO/apps/web/e2e/bots/audit.mjs"

echo
echo "═══ 2/5 · Audit accessibilité (axe-core) ═══"
bash "$REPO/scripts/run-a11y.sh"

echo
echo "═══ 3/5 · Session bot-persona ═══"
bash "$REPO/scripts/run-friction-bot.sh" "$@"

echo
echo "═══ 4/5 · Agent-designer ═══"
bash "$REPO/scripts/run-designer.sh"

echo
if [[ -n "${NO_FEEDBACK:-}" ]]; then
  echo "═══ 5/5 · Publication feedback — SAUTÉE (NO_FEEDBACK) ═══"
else
  echo "═══ 5/5 · Publication dans le feedback in-game ═══"
  bash "$REPO/scripts/run-feedback.sh"
fi

echo
echo "═══ Pipeline terminé ═══"
LAST=$(ls -t "$REPO/apps/web/e2e/bots/reports/_designer/"reco-design-*.md 2>/dev/null | head -1 || true)
echo "Livrable : ${LAST:-(voir reports/_designer/)}"
