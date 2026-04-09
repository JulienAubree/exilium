import { useState } from 'react';
import { getPlanetImageUrl } from '@/lib/assets';

interface BiomeData {
  id: string;
  name: string;
  description?: string;
  rarity: string;
  effects?: Array<{ stat: string; modifier: number }>;
}

interface PlanetCardProps {
  name: string;
  planetTypeName?: string;
  planetClassId?: string | null;
  planetImageIndex?: number | null;
  maxTemp: number;
  bonus?: {
    mineraiBonus: number;
    siliciumBonus: number;
    hydrogeneBonus: number;
  };
  biomes?: BiomeData[];
}

const RARITY_COLORS: Record<string, string> = {
  common: '#9ca3af',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#eab308',
};

const RARITY_LABELS: Record<string, string> = {
  common: 'Commun',
  uncommon: 'Peu commun',
  rare: 'Rare',
  epic: 'Epique',
  legendary: 'Legendaire',
};

const STAT_LABELS: Record<string, string> = {
  production_minerai: 'Prod. minerai',
  production_silicium: 'Prod. silicium',
  production_hydrogene: 'Prod. hydrogene',
  energy_production: 'Prod. energie',
  storage_minerai: 'Stock. minerai',
  storage_silicium: 'Stock. silicium',
  storage_hydrogene: 'Stock. hydrogene',
};

// Map planet type bonus keys to the same stat keys used by biomes
const PLANET_BONUS_TO_STAT: Record<string, string> = {
  mineraiBonus: 'production_minerai',
  siliciumBonus: 'production_silicium',
  hydrogeneBonus: 'production_hydrogene',
};

function formatBonus(value: number): string {
  const percent = Math.round(value * 100);
  return `${percent > 0 ? '+' : ''}${percent}%`;
}

function BiomePopover({ biome }: { biome: BiomeData }) {
  const [isOpen, setIsOpen] = useState(false);
  const color = RARITY_COLORS[biome.rarity] ?? '#9ca3af';

  return (
    <span
      className="relative"
      style={isOpen ? { zIndex: 9999 } : undefined}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <span
        className="inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[11px] font-medium border cursor-default transition-colors"
        style={{
          color,
          borderColor: `${color}${isOpen ? '55' : '33'}`,
          backgroundColor: `${color}${isOpen ? '25' : '15'}`,
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
        {biome.name}
      </span>
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-56 rounded-lg border border-border bg-popover p-3 shadow-xl pointer-events-none" style={{ zIndex: 9999 }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-sm font-semibold" style={{ color }}>{biome.name}</span>
          </div>
          <span
            className="inline-block rounded-full px-1.5 py-px text-[10px] font-medium mb-2"
            style={{ color, backgroundColor: `${color}20` }}
          >
            {RARITY_LABELS[biome.rarity] ?? biome.rarity}
          </span>
          {biome.description && (
            <p className="text-xs text-muted-foreground mb-2 italic">{biome.description}</p>
          )}
          {biome.effects && biome.effects.length > 0 && (
            <div className="space-y-1">
              {biome.effects.map((e, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{STAT_LABELS[e.stat] ?? e.stat}</span>
                  <span className={e.modifier > 0 ? 'text-emerald-400 font-medium' : 'text-red-400 font-medium'}>
                    {formatBonus(e.modifier)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </span>
  );
}

export function PlanetCard({ name, planetTypeName, planetClassId, planetImageIndex, maxTemp, bonus, biomes }: PlanetCardProps) {
  // Compute planet type effects as stat modifiers
  const planetTypeEffects: Record<string, number> = {};
  if (bonus) {
    for (const [key, stat] of Object.entries(PLANET_BONUS_TO_STAT)) {
      const val = bonus[key as keyof typeof bonus];
      if (val && val !== 1) {
        planetTypeEffects[stat] = val - 1; // 1.2 -> 0.2
      }
    }
  }

  // Aggregate biome effects
  const biomeEffects: Record<string, number> = {};
  if (biomes) {
    for (const biome of biomes) {
      for (const e of biome.effects ?? []) {
        biomeEffects[e.stat] = (biomeEffects[e.stat] ?? 0) + e.modifier;
      }
    }
  }

  // Compute totals
  const allStats = new Set([...Object.keys(planetTypeEffects), ...Object.keys(biomeEffects)]);
  const totals: Record<string, number> = {};
  for (const stat of allStats) {
    totals[stat] = (planetTypeEffects[stat] ?? 0) + (biomeEffects[stat] ?? 0);
  }

  const hasBonuses = allStats.size > 0;

  return (
    <div className="glass-card p-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        {planetClassId && planetImageIndex != null ? (
          <img
            src={getPlanetImageUrl(planetClassId, planetImageIndex, 'thumb')}
            alt={name}
            className="size-14 shrink-0 rounded-full object-cover border-2 border-border/50"
          />
        ) : (
          <div
            className="size-14 shrink-0 rounded-full shadow-lg shadow-primary/20"
            style={{
              background: 'radial-gradient(circle at 35% 35%, hsl(var(--primary) / 0.6), hsl(var(--primary) / 0.2), hsl(var(--background)))',
            }}
          />
        )}
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-foreground tracking-wide truncate">{name}</h2>
          <p className="text-xs text-muted-foreground">
            {planetTypeName ?? 'Inconnue'} · {maxTemp}°C
          </p>
        </div>
      </div>

      {/* Bonus breakdown */}
      {hasBonuses && (
        <div className="mt-4 space-y-3">
          {/* Planet type row */}
          {Object.keys(planetTypeEffects).length > 0 && (
            <div>
              <div className="text-[11px] text-muted-foreground font-medium mb-1">Type : {planetTypeName}</div>
              <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5">
                {Object.entries(planetTypeEffects).map(([stat, val]) => (
                  <div key={stat} className="contents text-xs">
                    <span className="text-muted-foreground">{STAT_LABELS[stat] ?? stat}</span>
                    <span className={val > 0 ? 'text-emerald-400 font-medium text-right' : 'text-red-400 font-medium text-right'}>
                      {formatBonus(val)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Biomes row */}
          {biomes && biomes.length > 0 && (
            <div>
              <div className="text-[11px] text-muted-foreground font-medium mb-1">Biomes</div>
              <div className="flex flex-wrap gap-1 mb-2">
                {biomes.map((biome) => (
                  <BiomePopover key={biome.id} biome={biome} />
                ))}
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5">
                {Object.entries(biomeEffects).map(([stat, val]) => (
                  <div key={stat} className="contents text-xs">
                    <span className="text-muted-foreground">{STAT_LABELS[stat] ?? stat}</span>
                    <span className={val > 0 ? 'text-emerald-400 font-medium text-right' : 'text-red-400 font-medium text-right'}>
                      {formatBonus(val)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Total */}
          <div className="border-t border-border/30 pt-2">
            <div className="text-[11px] text-foreground font-semibold mb-1">Total bonus planete</div>
            <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5">
              {Object.entries(totals).map(([stat, val]) => (
                <div key={stat} className="contents text-xs">
                  <span className="text-muted-foreground">{STAT_LABELS[stat] ?? stat}</span>
                  <span className={`font-semibold text-right ${val > 0 ? 'text-emerald-400' : val < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                    {formatBonus(val)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
