#!/usr/bin/env bash
# Publie les findings du simulateur de rythme dans la table feedback (DebugBot).
# Mode DRY-RUN par défaut — affiche les findings sans rien poster.
# Pour publier : PUBLISH=1 bash scripts/run-gamesim-publish.sh
set -euo pipefail
cd /opt/exilium/packages/game-sim
exec pnpm exec tsx src/publish.ts "$@"
