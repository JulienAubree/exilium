// apps/web/src/components/combat-guide/CombatReplay.tsx
import { useState, useMemo } from 'react';
import { simulateCombat } from '@exilium/game-engine';
import { useGameConfig } from '@/hooks/useGameConfig';
import { buildCombatInput } from '@/lib/combat-helpers';
import { RoundDisplay } from './RoundDisplay';

interface Scenario {
  id: string;
  label: string;
  description: string;
  attacker: Record<string, number>;
  defender: Record<string, number>;
  seed: number;
}

const SCENARIOS: Scenario[] = [
  {
    id: 'balanced',
    label: 'Combat équilibré',
    description: '5 intercepteurs contre 5 intercepteurs — un duel classique à forces égales.',
    attacker: { interceptor: 5 },
    defender: { interceptor: 5 },
    seed: 42,
  },
  {
    id: 'numbers',
    label: 'Supériorité numérique',
    description: "10 intercepteurs contre 3 frégates — la quantité l'emporte-t-elle sur la qualité ?",
    attacker: { interceptor: 10 },
    defender: { frigate: 3 },
    seed: 123,
  },
  {
    id: 'shotcount',
    label: 'ShotCount en action',
    description: '8 intercepteurs (3 tirs/round) contre 2 croiseurs (1 tir/round) — les tirs multiples font la différence.',
    attacker: { interceptor: 8 },
    defender: { cruiser: 2 },
    seed: 777,
  },
];

export function CombatReplay() {
  const { data: gameConfig } = useGameConfig();
  const [selectedId, setSelectedId] = useState<string>(SCENARIOS[0].id);
  const [playing, setPlaying] = useState(false);
  const [key, setKey] = useState(0); // force remount to replay

  const scenario = SCENARIOS.find((s) => s.id === selectedId) ?? SCENARIOS[0];

  const result = useMemo(() => {
    if (!gameConfig) return null;
    const input = buildCombatInput(scenario.attacker, scenario.defender, gameConfig, scenario.seed);
    return simulateCombat(input);
  }, [gameConfig, scenario]);

  if (!gameConfig || !result) return null;

  return (
    <div className="glass-card p-4 space-y-4">
      <h4 className="text-sm font-semibold">Exemples de combat</h4>

      {/* Scenario selector */}
      <div className="flex flex-wrap gap-2">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              setSelectedId(s.id);
              setPlaying(false);
              setKey((k) => k + 1);
            }}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              selectedId === s.id
                ? 'border-rose-500/40 bg-rose-500/20 text-rose-300'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground">{scenario.description}</p>

      {/* Play / Replay button */}
      {!playing ? (
        <button
          type="button"
          onClick={() => {
            setPlaying(true);
            setKey((k) => k + 1);
          }}
          className="rounded bg-rose-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-rose-700 transition-colors"
        >
          Lancer le combat
        </button>
      ) : (
        <RoundDisplay
          key={key}
          result={result}
          initialAttacker={scenario.attacker}
          initialDefender={scenario.defender}
          autoPlayDelay={1500}
          onComplete={() => {}}
        />
      )}

      {/* Replay button after animation */}
      {playing && (
        <button
          type="button"
          onClick={() => {
            setKey((k) => k + 1);
          }}
          className="rounded bg-muted px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          Rejouer
        </button>
      )}
    </div>
  );
}
