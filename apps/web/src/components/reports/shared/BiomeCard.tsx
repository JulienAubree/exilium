import { RARITY_COLORS, RARITY_LABELS, STAT_LABELS } from '@/lib/biome-display';

interface BiomeLike {
  id: string;
  name: string;
  rarity: string;
  effects?: Array<{ stat: string; modifier: number }>;
}

interface Props {
  biome: BiomeLike;
  gameConfig: any;
}

export function BiomeCard({ biome, gameConfig }: Props) {
  const color = RARITY_COLORS[biome.rarity] ?? '#9ca3af';
  // Get effects from game config biome definition (authoritative source with modifiers)
  const configBiome = gameConfig?.biomes?.find((b: any) => b.id === biome.id);
  const effects: Array<{ stat: string; modifier: number }> =
    (configBiome?.effects as Array<{ stat: string; modifier: number }>) ??
    biome.effects ??
    [];

  return (
    <div
      className="rounded-lg border border-border/30 bg-card/40 p-3"
      style={{ borderLeftWidth: 3, borderLeftColor: color }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-sm font-semibold" style={{ color }}>
          {biome.name}
        </span>
        <span
          className="text-[10px] rounded-full px-1.5 py-px font-medium"
          style={{ color, backgroundColor: `${color}20` }}
        >
          {RARITY_LABELS[biome.rarity] ?? biome.rarity}
        </span>
      </div>
      {effects.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 ml-4">
          {effects.map((e, i) => (
            <span key={i} className="text-xs">
              <span className={e.modifier > 0 ? 'text-emerald-400 font-medium' : 'text-red-400 font-medium'}>
                {e.modifier > 0 ? '+' : ''}{Math.round(e.modifier * 100)}%
              </span>
              {' '}
              <span className="text-muted-foreground">
                {STAT_LABELS[e.stat] ?? e.stat}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
