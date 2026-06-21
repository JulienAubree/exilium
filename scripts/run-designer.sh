#!/usr/bin/env bash
# Lance l'AGENT-DESIGNER : synthèse des findings des bots (reports/*/run.json)
# + rubric (design-rules.md) → reco-design priorisée dans reports/_designer/.
#
# Ne touche ni la prod ni la base : lit seulement les rapports déjà produits.
#
# Provider LLM : DeepSeek (clé réutilisée depuis ~/studio-podcast/.env.local).
#   DESIGNER_MODEL  (def: deepseek-reasoner — attrape les findings architecturaux
#                   que le modèle éco rate ; ne tourne qu'une fois par lot)
set -euo pipefail

REPO="/opt/exilium"

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

cd "$REPO/apps/web"
exec node e2e/bots/designer.mjs "$@"
