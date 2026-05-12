import { useState } from 'react';
import { trpc } from '@/trpc';
import { Button } from '@/components/ui/button';
import { useToastStore } from '@/stores/toast.store';
import { cn } from '@/lib/utils';
import {
  RESOURCE_COLORS,
  RESOURCE_BORDER_ACTIVE,
  RESOURCE_LABELS,
} from './market-constants';

interface ResourceSellProps {
  planetId: string;
  commissionPercent: number;
}

export function ResourceSell({ planetId, commissionPercent }: ResourceSellProps) {
  const utils = trpc.useUtils();
  const addToast = useToastStore((s) => s.addToast);

  const [sellResource, setSellResource] = useState<'minerai' | 'silicium' | 'hydrogene'>('minerai');
  const [sellQuantity, setSellQuantity] = useState(0);
  const [sellPriceMinerai, setSellPriceMinerai] = useState(0);
  const [sellPriceSilicium, setSellPriceSilicium] = useState(0);
  const [sellPriceHydrogene, setSellPriceHydrogene] = useState(0);

  const createOfferMutation = trpc.market.createOffer.useMutation({
    onSuccess: () => {
      addToast('Offre créée !');
      utils.market.myOffers.invalidate();
      utils.resource.production.invalidate();
      setSellQuantity(0);
      setSellPriceMinerai(0);
      setSellPriceSilicium(0);
      setSellPriceHydrogene(0);
    },
    onError: (err) => addToast(err.message, 'error'),
  });

  const handleCreateOffer = () => {
    if (!planetId) return;
    createOfferMutation.mutate({
      planetId,
      resourceType: sellResource,
      quantity: sellQuantity,
      priceMinerai: sellPriceMinerai,
      priceSilicium: sellPriceSilicium,
      priceHydrogene: sellPriceHydrogene,
    });
  };

  return (
    <div className="max-w-lg space-y-5">
      {/* Resource select */}
      <div>
        <label className="text-xs text-muted-foreground mb-2 block uppercase tracking-wider">Ressource à vendre</label>
        <div className="flex gap-2">
          {(['minerai', 'silicium', 'hydrogene'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setSellResource(r)}
              className={cn(
                'flex-1 rounded-md border px-3 py-2.5 text-sm font-medium transition-all',
                sellResource === r
                  ? cn(RESOURCE_COLORS[r], RESOURCE_BORDER_ACTIVE[r], 'bg-white/5')
                  : 'border-border text-muted-foreground hover:border-white/20 hover:text-foreground',
              )}
            >
              {RESOURCE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Quantity */}
      <div>
        <label className="text-xs text-muted-foreground mb-2 block uppercase tracking-wider">Quantite</label>
        <input
          type="number"
          min={1}
          value={sellQuantity || ''}
          onChange={(e) => setSellQuantity(Math.max(0, Number(e.target.value) || 0))}
          className="w-full rounded-md border border-border bg-muted/50 px-3 py-2.5 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors"
          placeholder="10000"
        />
      </div>

      {/* Price */}
      <div>
        <label className="text-xs text-muted-foreground mb-2 block uppercase tracking-wider">Prix demande</label>
        <div className="grid grid-cols-3 gap-3">
          {([
            { key: 'minerai' as const, value: sellPriceMinerai, setter: setSellPriceMinerai },
            { key: 'silicium' as const, value: sellPriceSilicium, setter: setSellPriceSilicium },
            { key: 'hydrogene' as const, value: sellPriceHydrogene, setter: setSellPriceHydrogene },
          ]).map(({ key, value, setter }) => (
            <div key={key}>
              <div className={cn('text-[10px] mb-1.5 font-medium uppercase tracking-wider', RESOURCE_COLORS[key])}>
                {RESOURCE_LABELS[key]}
              </div>
              <input
                type="number"
                min={0}
                value={value || ''}
                onChange={(e) => setter(Math.max(0, Number(e.target.value) || 0))}
                className="w-full rounded-md border border-border bg-muted/50 px-3 py-2.5 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Commission preview */}
      {sellQuantity > 0 && (
        <div className="rounded-md border border-primary/20 bg-primary/5 p-4 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Quantite en vente</span>
            <span className="text-foreground">{sellQuantity.toLocaleString('fr-FR')} {RESOURCE_LABELS[sellResource]}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Commission ({commissionPercent}%)</span>
            <span className="text-destructive">{Math.ceil(sellQuantity * commissionPercent / 100).toLocaleString('fr-FR')} {RESOURCE_LABELS[sellResource]}</span>
          </div>
          <div className="border-t border-white/10 pt-1 flex justify-between font-medium">
            <span className="text-muted-foreground">Total preleve</span>
            <span className="text-foreground">{(sellQuantity + Math.ceil(sellQuantity * commissionPercent / 100)).toLocaleString('fr-FR')} {RESOURCE_LABELS[sellResource]}</span>
          </div>
        </div>
      )}

      <Button
        variant="retro"
        className="w-full"
        onClick={handleCreateOffer}
        disabled={
          createOfferMutation.isPending ||
          sellQuantity <= 0 ||
          (sellPriceMinerai <= 0 && sellPriceSilicium <= 0 && sellPriceHydrogene <= 0)
        }
      >
        Mettre en vente
      </Button>
    </div>
  );
}
