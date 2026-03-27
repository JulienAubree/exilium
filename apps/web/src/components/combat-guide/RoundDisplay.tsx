// apps/web/src/components/combat-guide/RoundDisplay.tsx
import { useState, useEffect, useCallback } from 'react';
import type { CombatResult, RoundResult } from '@ogame-clone/game-engine';
import { getUnitName } from '@/lib/entity-names';
import { useGameConfig } from '@/hooks/useGameConfig';

interface RoundDisplayProps {
  result: CombatResult;
  /** Initial fleet counts before combat (for hull bar %) */
  initialAttacker: Record<string, number>;
  initialDefender: Record<string, number>;
  /** Auto-advance rounds with this delay (ms). 0 = manual. */
  autoPlayDelay?: number;
  /** Called when animation finishes all rounds */
  onComplete?: () => void;
}

export function RoundDisplay({
  result,
  initialAttacker,
  initialDefender,
  autoPlayDelay = 1500,
  onComplete,
}: RoundDisplayProps) {
  const { data: gameConfig } = useGameConfig();
  const [displayedRound, setDisplayedRound] = useState(0); // 0 = initial state
  const totalRounds = result.rounds.length;

  const reset = useCallback(() => setDisplayedRound(0), []);

  useEffect(() => {
    if (autoPlayDelay <= 0 || displayedRound > totalRounds) return;
    if (displayedRound === totalRounds) {
      onComplete?.();
      return;
    }
    const timer = setTimeout(() => setDisplayedRound((r) => r + 1), autoPlayDelay);
    return () => clearTimeout(timer);
  }, [displayedRound, totalRounds, autoPlayDelay, onComplete]);

  // Current state to display
  const attackerShips =
    displayedRound === 0 ? initialAttacker : result.rounds[displayedRound - 1].attackerShips;
  const defenderShips =
    displayedRound === 0 ? initialDefender : result.rounds[displayedRound - 1].defenderShips;

  const allAttackerTypes = Object.keys(initialAttacker);
  const allDefenderTypes = Object.keys(initialDefender);

  const isFinished = displayedRound >= totalRounds;

  return (
    <div className="space-y-3">
      {/* Round indicator */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {displayedRound === 0
            ? 'Déploiement'
            : isFinished
              ? `Round ${totalRounds}/${totalRounds} — Terminé`
              : `Round ${displayedRound}/${totalRounds}`}
        </span>
        {isFinished && (
          <span
            className={`font-bold ${
              result.outcome === 'attacker'
                ? 'text-green-400'
                : result.outcome === 'defender'
                  ? 'text-red-400'
                  : 'text-yellow-400'
            }`}
          >
            {result.outcome === 'attacker'
              ? 'Victoire attaquant'
              : result.outcome === 'defender'
                ? 'Victoire défenseur'
                : 'Match nul'}
          </span>
        )}
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-2 gap-4">
        <FleetColumn
          title="Attaquant"
          types={allAttackerTypes}
          initial={initialAttacker}
          current={attackerShips}
          gameConfig={gameConfig}
          color="text-blue-400"
          barColor="bg-blue-500"
        />
        <FleetColumn
          title="Défenseur"
          types={allDefenderTypes}
          initial={initialDefender}
          current={defenderShips}
          gameConfig={gameConfig}
          color="text-rose-400"
          barColor="bg-rose-500"
        />
      </div>

      {/* Manual controls if no auto-play */}
      {autoPlayDelay === 0 && (
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded bg-muted px-3 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
            disabled={displayedRound === 0}
            onClick={() => setDisplayedRound((r) => Math.max(0, r - 1))}
          >
            ← Précédent
          </button>
          <button
            type="button"
            className="rounded bg-muted px-3 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
            disabled={isFinished}
            onClick={() => setDisplayedRound((r) => r + 1)}
          >
            Suivant →
          </button>
          <button
            type="button"
            className="rounded bg-muted px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={reset}
          >
            Réinitialiser
          </button>
        </div>
      )}

      {/* Losses summary when finished */}
      {isFinished && (
        <div className="grid grid-cols-2 gap-4 text-xs">
          <LossesSummary label="Pertes attaquant" losses={result.attackerLosses} gameConfig={gameConfig} />
          <LossesSummary label="Pertes défenseur" losses={result.defenderLosses} gameConfig={gameConfig} />
        </div>
      )}

      {/* Debris */}
      {isFinished && (result.debris.minerai > 0 || result.debris.silicium > 0) && (
        <div className="text-xs text-muted-foreground">
          Débris : {result.debris.minerai > 0 && <span className="text-minerai">M: {result.debris.minerai.toLocaleString('fr-FR')}</span>}
          {result.debris.minerai > 0 && result.debris.silicium > 0 && ' · '}
          {result.debris.silicium > 0 && <span className="text-silicium">S: {result.debris.silicium.toLocaleString('fr-FR')}</span>}
        </div>
      )}
    </div>
  );
}

function FleetColumn({
  title,
  types,
  initial,
  current,
  gameConfig,
  color,
  barColor,
}: {
  title: string;
  types: string[];
  initial: Record<string, number>;
  current: Record<string, number>;
  gameConfig: any;
  color: string;
  barColor: string;
}) {
  return (
    <div className="space-y-2">
      <h4 className={`text-xs font-semibold uppercase tracking-wider ${color}`}>{title}</h4>
      {types.map((type) => {
        const init = initial[type] ?? 0;
        const curr = current[type] ?? 0;
        const pct = init > 0 ? (curr / init) * 100 : 0;
        return (
          <div key={type} className="space-y-0.5">
            <div className="flex items-center justify-between text-xs">
              <span className={curr === 0 ? 'text-muted-foreground/40 line-through' : 'text-foreground'}>
                {getUnitName(type, gameConfig)}
              </span>
              <span className={curr === 0 ? 'text-muted-foreground/40' : 'text-muted-foreground'}>
                {curr}/{init}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LossesSummary({
  label,
  losses,
  gameConfig,
}: {
  label: string;
  losses: Record<string, number>;
  gameConfig: any;
}) {
  const entries = Object.entries(losses).filter(([, n]) => n > 0);
  if (entries.length === 0) return <div className="text-xs text-muted-foreground">{label} : aucune</div>;
  return (
    <div className="text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{label} :</span>{' '}
      {entries.map(([type, count], i) => (
        <span key={type}>
          {i > 0 && ', '}
          {count}× {getUnitName(type, gameConfig)}
        </span>
      ))}
    </div>
  );
}
