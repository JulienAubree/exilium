import { Sparkles } from 'lucide-react';

const STAT_LABELS: Record<string, string> = {
  production_minerai: 'Production minerai',
  production_silicium: 'Production silicium',
  production_hydrogene: 'Production hydrogène',
  energy_production: 'Production énergie',
  storage_minerai: 'Stockage minerai',
  storage_silicium: 'Stockage silicium',
  storage_hydrogene: 'Stockage hydrogène',
};

interface Props {
  planet: {
    planetClassId?: string | null;
    biomes?: Array<{ id: string; effects?: Array<{ stat: string; modifier: number }> }>;
  };
  resourceData?: {
    planetTypeBonus?: { mineraiBonus: number; siliciumBonus: number; hydrogeneBonus: number };
  };
  gameConfig?: {
    biomes?: Array<{ id: string; effects?: Array<{ stat: string; modifier: number }> }>;
  };
  governance?: { harvestMalus: number; overextend: number } | null;
}

export function OverviewBonuses({ planet, resourceData, gameConfig, governance }: Props) {
  const totals: Record<string, number> = {};

  // Planet type bonuses (multiplicative → deltas)
  const typeBonus = resourceData?.planetTypeBonus;
  if (typeBonus) {
    if (typeBonus.mineraiBonus !== 1) totals.production_minerai = (totals.production_minerai ?? 0) + (typeBonus.mineraiBonus - 1);
    if (typeBonus.siliciumBonus !== 1) totals.production_silicium = (totals.production_silicium ?? 0) + (typeBonus.siliciumBonus - 1);
    if (typeBonus.hydrogeneBonus !== 1) totals.production_hydrogene = (totals.production_hydrogene ?? 0) + (typeBonus.hydrogeneBonus - 1);
  }

  // Biome effects (additive)
  const biomes = planet.biomes ?? [];
  for (const b of biomes) {
    const cfg = gameConfig?.biomes?.find((cb) => cb.id === b.id);
    const effects = cfg?.effects ?? b.effects ?? [];
    for (const e of effects) {
      if (typeof e.modifier === 'number') {
        totals[e.stat] = (totals[e.stat] ?? 0) + e.modifier;
      }
    }
  }

  // Governance harvest malus
  if (governance && governance.harvestMalus > 0) {
    for (const stat of ['production_minerai', 'production_silicium', 'production_hydrogene']) {
      totals[stat] = (totals[stat] ?? 0) - governance.harvestMalus;
    }
  }

  const entries = Object.entries(totals).filter(([, v]) => Math.abs(v) >= 0.005);
  if (entries.length === 0) return null;

  // Sort: prod first (the most impactful), then storage, then energy.
  const order = ['production_minerai', 'production_silicium', 'production_hydrogene', 'energy_production', 'storage_minerai', 'storage_silicium', 'storage_hydrogene'];
  entries.sort(([a], [b]) => order.indexOf(a) - order.indexOf(b));

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase text-primary/70 font-semibold tracking-wider mb-2">
        <Sparkles className="h-3 w-3" />
        Bonus actifs sur la planète
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {entries.map(([stat, mod]) => (
          <span
            key={stat}
            className={`text-sm font-semibold tabular-nums ${mod > 0 ? 'text-emerald-400' : 'text-red-400'}`}
          >
            {mod > 0 ? '+' : ''}
            {Math.round(mod * 100)}% <span className="text-foreground/70 font-normal">{STAT_LABELS[stat] ?? stat}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
