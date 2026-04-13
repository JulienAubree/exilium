import { useState } from 'react';
import { trpc } from '@/trpc';
import { Button } from '@/components/ui/button';
import { PlanetDot } from '@/components/galaxy/PlanetDot';
import { useGameConfig } from '@/hooks/useGameConfig';
import { useToastStore } from '@/stores/toast.store';
import { cn } from '@/lib/utils';

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

const RARITY_OPTIONS = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;

function formatPrice(mi: number, si: number, h2: number) {
  const parts: string[] = [];
  if (mi > 0) parts.push(`${mi.toLocaleString('fr-FR')} Mi`);
  if (si > 0) parts.push(`${si.toLocaleString('fr-FR')} Si`);
  if (h2 > 0) parts.push(`${h2.toLocaleString('fr-FR')} H2`);
  return parts.join(' + ') || '0';
}

interface MarketReportsBuyProps {
  planetId: string;
}

export function MarketReportsBuy({ planetId }: MarketReportsBuyProps) {
  const utils = trpc.useUtils();
  const addToast = useToastStore((s) => s.addToast);
  const { data: gameConfig } = useGameConfig();

  const [galaxyFilter, setGalaxyFilter] = useState<string>('');
  const [systemFilter, setSystemFilter] = useState<string>('');
  const [minRarityFilter, setMinRarityFilter] = useState<string>('');

  const galaxy = galaxyFilter ? Number(galaxyFilter) : undefined;
  const system = systemFilter ? Number(systemFilter) : undefined;
  const minRarity = minRarityFilter || undefined;

  const { data, isFetching } = trpc.market.listReports.useQuery(
    {
      galaxy,
      system,
      minRarity: minRarity as typeof RARITY_OPTIONS[number] | undefined,
    },
  );

  const buyMutation = trpc.market.buyReport.useMutation({
    onSuccess: () => {
      addToast('Rapport acquis');
      utils.market.listReports.invalidate();
      utils.galaxy.system.invalidate();
    },
    onError: (err) => addToast(err.message, 'error'),
  });

  const resolvePlanetName = (planetClassId: string): string => {
    if (!gameConfig?.planetTypes) return planetClassId;
    const pt = gameConfig.planetTypes.find((t: any) => t.id === planetClassId);
    return pt?.name ?? planetClassId;
  };

  const offers = data?.offers ?? [];

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Galaxie</label>
          <input
            type="number"
            min={1}
            value={galaxyFilter}
            onChange={(e) => setGalaxyFilter(e.target.value)}
            placeholder="--"
            className="w-20 rounded-md border border-border bg-muted/50 px-2 py-1.5 text-xs focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Systeme</label>
          <input
            type="number"
            min={1}
            value={systemFilter}
            onChange={(e) => setSystemFilter(e.target.value)}
            placeholder="--"
            className="w-20 rounded-md border border-border bg-muted/50 px-2 py-1.5 text-xs focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Rarete min.</label>
          <select
            value={minRarityFilter}
            onChange={(e) => setMinRarityFilter(e.target.value)}
            className="w-32 rounded-md border border-border bg-muted/50 px-2 py-1.5 text-xs focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors"
          >
            <option value="">Toutes</option>
            {RARITY_OPTIONS.map((r) => (
              <option key={r} value={r}>{RARITY_LABELS[r]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading */}
      {isFetching && (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          <div className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin mr-3" />
          Chargement...
        </div>
      )}

      {/* Empty */}
      {!isFetching && offers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <svg className="h-10 w-10 mb-3 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 5h6" />
          </svg>
          <p className="text-sm">Aucun rapport disponible</p>
        </div>
      )}

      {/* Offer cards */}
      {!isFetching && offers.length > 0 && (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {offers.map((offer) => {
            const rarityColor = RARITY_COLORS[offer.maxRarity] ?? '#9ca3af';
            return (
              <div key={offer.offerId} className="retro-card p-4 flex flex-col gap-3">
                {/* Header: planet dot + coords + seller */}
                <div className="flex items-start gap-3">
                  <div className="shrink-0 mt-0.5">
                    <PlanetDot planetClassId={offer.planetClassId} size={40} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">
                        {resolvePlanetName(offer.planetClassId)}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        [{offer.galaxy}:{offer.system}:?]
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      par {offer.sellerUsername}
                    </div>
                  </div>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-1.5">
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{ color: rarityColor, backgroundColor: `${rarityColor}20` }}
                  >
                    {RARITY_LABELS[offer.maxRarity] ?? offer.maxRarity}
                  </span>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-cyan-500/15 text-cyan-400">
                    {offer.biomeCount} biome{offer.biomeCount > 1 ? 's' : ''}
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-medium',
                      offer.isComplete
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-amber-500/15 text-amber-400',
                    )}
                  >
                    {offer.isComplete ? 'Complet' : 'Partiel'}
                  </span>
                </div>

                {/* Price + known biomes */}
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Prix</span>
                    <span className="text-foreground">
                      {formatPrice(offer.priceMinerai, offer.priceSilicium, offer.priceHydrogene)}
                    </span>
                  </div>
                  {offer.knownBiomeCount > 0 && (
                    <div className="text-amber-400/80 text-[10px]">
                      {offer.knownBiomeCount} biome{offer.knownBiomeCount > 1 ? 's' : ''} deja connu{offer.knownBiomeCount > 1 ? 's' : ''}
                    </div>
                  )}
                </div>

                {/* Buy button */}
                <Button
                  variant="retro"
                  size="sm"
                  className="w-full mt-auto"
                  onClick={() => buyMutation.mutate({ planetId, offerId: offer.offerId })}
                  disabled={buyMutation.isPending}
                >
                  Acheter
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
