// apps/web/src/components/combat-guide/FleetComposer.tsx
import { useState } from 'react';
import { computeFleetFP, type FPConfig } from '@exilium/game-engine';
import { buildShipCombatConfigs } from '@/lib/combat-helpers';
import { getUnitName } from '@/lib/entity-names';
import { useGameConfig } from '@/hooks/useGameConfig';

interface FleetComposerProps {
  fleet: Record<string, number>;
  onChange: (fleet: Record<string, number>) => void;
  label: string;
  color: string;
}

export function FleetComposer({ fleet, onChange, label, color }: FleetComposerProps) {
  const { data: gameConfig } = useGameConfig();
  const [selectedType, setSelectedType] = useState('');
  const [count, setCount] = useState(1);

  if (!gameConfig) return null;

  // All combat units (ships + defenses that have weapons > 0)
  const availableUnits = [
    ...Object.entries(gameConfig.ships)
      .filter(([, s]) => s.weapons > 0)
      .map(([id]) => ({ id, group: 'Vaisseaux' })),
    ...Object.entries(gameConfig.defenses)
      .filter(([, d]) => d.weapons > 0)
      .map(([id]) => ({ id, group: 'Défenses' })),
  ];

  const fpConfig: FPConfig = {
    shotcountExponent: Number(gameConfig.universe?.fp_shotcount_exponent ?? 1.5),
    divisor: Number(gameConfig.universe?.fp_divisor ?? 100),
  };

  const shipCombatConfigs = buildShipCombatConfigs(gameConfig);
  const shipStats: Record<string, { weapons: number; shotCount: number; shield: number; hull: number }> = {};
  for (const [id, cfg] of Object.entries(shipCombatConfigs)) {
    shipStats[id] = {
      weapons: cfg.baseWeaponDamage,
      shotCount: cfg.baseShotCount,
      shield: cfg.baseShield,
      hull: cfg.baseHull,
    };
  }

  const totalFP = computeFleetFP(fleet, shipStats, fpConfig);

  const addUnit = () => {
    if (!selectedType || count <= 0) return;
    const updated = { ...fleet, [selectedType]: (fleet[selectedType] ?? 0) + count };
    onChange(updated);
    setCount(1);
  };

  const removeUnit = (id: string) => {
    const updated = { ...fleet };
    delete updated[id];
    onChange(updated);
  };

  const fleetEntries = Object.entries(fleet).filter(([, n]) => n > 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className={`text-xs font-semibold uppercase tracking-wider ${color}`}>{label}</h4>
        <span className="text-xs font-bold text-foreground">{totalFP} FP</span>
      </div>

      {/* Add unit row */}
      <div className="flex gap-2">
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
        >
          <option value="">Sélectionner...</option>
          {availableUnits.map(({ id, group }) => (
            <option key={id} value={id}>
              [{group === 'Vaisseaux' ? 'V' : 'D'}] {getUnitName(id, gameConfig)}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          max={9999}
          value={count}
          onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-16 rounded border border-border bg-background px-2 py-1 text-xs text-center"
        />
        <button
          type="button"
          onClick={addUnit}
          disabled={!selectedType}
          className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          +
        </button>
      </div>

      {/* Fleet list */}
      {fleetEntries.length === 0 ? (
        <p className="text-xs text-muted-foreground/60">Aucune unité ajoutée.</p>
      ) : (
        <div className="space-y-1">
          {fleetEntries.map(([id, n]) => (
            <div key={id} className="flex items-center justify-between text-xs">
              <span>
                {n}× {getUnitName(id, gameConfig)}
              </span>
              <button
                type="button"
                onClick={() => removeUnit(id)}
                className="text-muted-foreground/60 hover:text-red-400"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
