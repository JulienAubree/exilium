// apps/web/src/components/combat-guide/CombatSimulator.tsx
import { useState } from 'react';
import { simulateCombat, type CombatResult } from '@exilium/game-engine';
import { useGameConfig } from '@/hooks/useGameConfig';
import { buildCombatInput } from '@/lib/combat-helpers';
import { FleetComposer } from './FleetComposer';
import { RoundDisplay } from './RoundDisplay';

export function CombatSimulator() {
  const { data: gameConfig } = useGameConfig();
  const [attackerFleet, setAttackerFleet] = useState<Record<string, number>>({});
  const [defenderFleet, setDefenderFleet] = useState<Record<string, number>>({});
  const [result, setResult] = useState<CombatResult | null>(null);
  const [simKey, setSimKey] = useState(0);
  const [snapshotAttacker, setSnapshotAttacker] = useState<Record<string, number>>({});
  const [snapshotDefender, setSnapshotDefender] = useState<Record<string, number>>({});

  const canSimulate =
    Object.values(attackerFleet).some((n) => n > 0) &&
    Object.values(defenderFleet).some((n) => n > 0);

  const runSimulation = () => {
    if (!gameConfig || !canSimulate) return;
    const input = buildCombatInput(attackerFleet, defenderFleet, gameConfig);
    const combatResult = simulateCombat(input);
    setSnapshotAttacker({ ...attackerFleet });
    setSnapshotDefender({ ...defenderFleet });
    setResult(combatResult);
    setSimKey((k) => k + 1);
  };

  const reset = () => {
    setAttackerFleet({});
    setDefenderFleet({});
    setResult(null);
  };

  return (
    <div className="glass-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Simulateur de combat</h4>
        {(Object.keys(attackerFleet).length > 0 || Object.keys(defenderFleet).length > 0) && (
          <button
            type="button"
            onClick={reset}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Réinitialiser
          </button>
        )}
      </div>

      {/* Fleet composers */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FleetComposer
          fleet={attackerFleet}
          onChange={setAttackerFleet}
          label="Ta flotte"
          color="text-blue-400"
        />
        <FleetComposer
          fleet={defenderFleet}
          onChange={setDefenderFleet}
          label="Flotte ennemie"
          color="text-rose-400"
        />
      </div>

      {/* Simulate button */}
      <button
        type="button"
        onClick={runSimulation}
        disabled={!canSimulate}
        className="w-full rounded bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Simuler le combat
      </button>

      {/* Result */}
      {result && (
        <div className="space-y-3">
          <div className="h-px bg-border" />
          <RoundDisplay
            key={simKey}
            result={result}
            initialAttacker={snapshotAttacker}
            initialDefender={snapshotDefender}
            autoPlayDelay={0}
          />

          {/* Detailed stats */}
          <div className="h-px bg-border" />
          <div className="grid grid-cols-2 gap-4 text-xs">
            <StatsPanel label="Stats attaquant" stats={result.attackerStats} color="text-blue-400" />
            <StatsPanel label="Stats défenseur" stats={result.defenderStats} color="text-rose-400" />
          </div>
        </div>
      )}
    </div>
  );
}

function StatsPanel({
  label,
  stats,
  color,
}: {
  label: string;
  stats: { shieldAbsorbed: number; armorBlocked: number; overkillWasted: number };
  color: string;
}) {
  const fmt = (n: number) => n.toLocaleString('fr-FR');
  return (
    <div className="space-y-1">
      <span className={`text-xs font-semibold ${color}`}>{label}</span>
      <div className="text-xs text-muted-foreground space-y-0.5">
        <div>Bouclier absorbé : {fmt(stats.shieldAbsorbed)}</div>
        <div>Armure bloquée : {fmt(stats.armorBlocked)}</div>
        <div>Overkill gaspillé : {fmt(stats.overkillWasted)}</div>
      </div>
    </div>
  );
}
