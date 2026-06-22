#!/usr/bin/env bash
# Simulateur de rythme de progression — déterministe, sans base live ni navigateur.
set -euo pipefail
cd /opt/exilium/packages/game-sim
exec pnpm sim "$@"
