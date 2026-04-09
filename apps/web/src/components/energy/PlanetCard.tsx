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
  production_minerai: 'Production minerai',
  production_silicium: 'Production silicium',
  production_hydrogene: 'Production hydrogene',
  energy_production: 'Production energie',
  storage_minerai: 'Stockage minerai',
  storage_silicium: 'Stockage silicium',
  storage_hydrogene: 'Stockage hydrogene',
};

function bonusTag(label: string, value: number) {
  if (!value || value === 1) return null;
  const percent = Math.round((value - 1) * 100);
  const positive = percent > 0;
  return (
    <span
      key={label}
      className={`text-[11px] px-2 py-0.5 rounded font-medium border ${
        positive
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          : 'bg-destructive/10 text-destructive border-destructive/20'
      }`}
    >
      {positive ? '+' : ''}{percent}% {label}
    </span>
  );
}

function BiomeBadge({ biome }: { biome: BiomeData }) {
  const [isOpen, setIsOpen] = useState(false);
  const color = RARITY_COLORS[biome.rarity] ?? '#9ca3af';

  return (
    <div
      className="relative"
      style={isOpen ? { zIndex: 9999 } : undefined}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border cursor-default transition-colors"
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
                    {e.modifier > 0 ? '+' : ''}{Math.round(e.modifier * 100)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PlanetCard({ name, planetTypeName, planetClassId, planetImageIndex, maxTemp, bonus, biomes }: PlanetCardProps) {
  return (
    <div className="glass-card flex items-center gap-4 p-4">
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
        {bonus && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {bonusTag('minerai', bonus.mineraiBonus)}
            {bonusTag('silicium', bonus.siliciumBonus)}
            {bonusTag('hydrogene', bonus.hydrogeneBonus)}
          </div>
        )}
        {biomes && biomes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {biomes.map((biome) => (
              <BiomeBadge key={biome.id} biome={biome} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
