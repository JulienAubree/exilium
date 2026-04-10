// apps/web/src/components/reports/ExploreReportDetail.tsx

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

interface BiomeDiscovery {
  id: string;
  name: string;
  rarity: string;
  effects?: Array<{ stat: string; modifier: number }>;
}

interface ExploreReportDetailProps {
  result: {
    discovered?: BiomeDiscovery[];
    discoveredCount?: number;
    remaining?: number;
  };
}

export function ExploreReportDetail({ result }: ExploreReportDetailProps) {
  const discovered = result.discovered ?? [];
  const discoveredCount = result.discoveredCount ?? discovered.length;
  const remaining = result.remaining ?? 0;
  const total = discoveredCount + remaining;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="glass-card p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Résultat de l'exploration
        </h3>
        <div className="flex items-baseline gap-6">
          <div>
            <div className="text-2xl font-bold text-cyan-400">{discoveredCount}</div>
            <div className="text-[11px] text-muted-foreground">Biome{discoveredCount > 1 ? 's' : ''} découvert{discoveredCount > 1 ? 's' : ''}</div>
          </div>
          {total > 0 && (
            <div>
              <div className="text-2xl font-bold text-muted-foreground">{remaining}</div>
              <div className="text-[11px] text-muted-foreground">Biome{remaining > 1 ? 's' : ''} restant{remaining > 1 ? 's' : ''}</div>
            </div>
          )}
        </div>
        {discoveredCount === 0 && (
          <p className="text-xs text-muted-foreground mt-3 italic">
            Aucun biome détecté lors de cette exploration. Renforcez votre flotte ou améliorez la recherche Exploration planétaire pour augmenter vos chances.
          </p>
        )}
      </div>

      {/* Biomes discovered */}
      {discovered.length > 0 && (
        <div className="glass-card p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Nouveaux biomes
          </h3>
          <div className="space-y-3">
            {discovered.map((biome) => {
              const color = RARITY_COLORS[biome.rarity] ?? '#9ca3af';
              return (
                <div key={biome.id} className="border-l-2 pl-3" style={{ borderColor: color }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-sm font-semibold" style={{ color }}>{biome.name}</span>
                    <span
                      className="text-[10px] rounded-full px-1.5 py-px font-medium"
                      style={{ color, backgroundColor: `${color}20` }}
                    >
                      {RARITY_LABELS[biome.rarity] ?? biome.rarity}
                    </span>
                  </div>
                  {biome.effects && biome.effects.length > 0 && (
                    <div className="text-xs space-y-0.5 ml-4">
                      {biome.effects.map((e, i) => (
                        <div key={i} className="flex justify-between gap-3">
                          <span className="text-muted-foreground">{STAT_LABELS[e.stat] ?? e.stat}</span>
                          <span className={e.modifier > 0 ? 'text-emerald-400 font-medium' : 'text-red-400 font-medium'}>
                            {e.modifier > 0 ? '+' : ''}{Math.round(e.modifier * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
