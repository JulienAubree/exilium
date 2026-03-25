import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useOutletContext } from 'react-router';
import { trpc } from '@/trpc';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/PageHeader';
import { useGameConfig } from '@/hooks/useGameConfig';
import { useToastStore } from '@/stores/toast.store';
import { cn } from '@/lib/utils';

const RESOURCE_COLORS: Record<string, string> = {
  minerai: 'text-orange-400',
  silicium: 'text-emerald-400',
  hydrogene: 'text-blue-400',
};

const RESOURCE_LABELS: Record<string, string> = {
  minerai: 'Minerai',
  silicium: 'Silicium',
  hydrogene: 'Hydrogène',
};

type Tab = 'buy' | 'sell' | 'my';

export default function Market() {
  const { planetId } = useOutletContext<{ planetId?: string }>();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const addToast = useToastStore((s) => s.addToast);
  const { data: gameConfig } = useGameConfig();
  const [tab, setTab] = useState<Tab>('buy');
  const [resourceFilter, setResourceFilter] = useState<string | undefined>(undefined);

  // Sell form state
  const [sellResource, setSellResource] = useState<'minerai' | 'silicium' | 'hydrogene'>('minerai');
  const [sellQuantity, setSellQuantity] = useState(0);
  const [sellPriceMinerai, setSellPriceMinerai] = useState(0);
  const [sellPriceSilicium, setSellPriceSilicium] = useState(0);
  const [sellPriceHydrogene, setSellPriceHydrogene] = useState(0);

  const commissionPercent = Number(gameConfig?.universe?.market_commission_percent) || 5;

  // Queries
  const { data: offersData, isFetching: offersLoading } = trpc.market.list.useQuery(
    { planetId: planetId!, resourceType: resourceFilter as any },
    { enabled: !!planetId && tab === 'buy' },
  );
  const { data: myOffers } = trpc.market.myOffers.useQuery(
    undefined,
    { enabled: tab === 'my' },
  );

  // Mutations
  const createOfferMutation = trpc.market.createOffer.useMutation({
    onSuccess: () => {
      addToast('Offre créée !');
      utils.market.myOffers.invalidate();
      utils.resource.production.invalidate();
      setSellQuantity(0);
      setSellPriceMinerai(0);
      setSellPriceSilicium(0);
      setSellPriceHydrogene(0);
      setTab('my');
    },
    onError: (err) => addToast(err.message, 'error'),
  });

  const cancelOfferMutation = trpc.market.cancelOffer.useMutation({
    onSuccess: () => {
      addToast('Offre annulée');
      utils.market.myOffers.invalidate();
      utils.resource.production.invalidate();
    },
    onError: (err) => addToast(err.message, 'error'),
  });

  const reserveMutation = trpc.market.reserveOffer.useMutation({
    onSuccess: (data) => {
      addToast('Offre réservée ! Envoyez votre flotte.');
      const { sellerPlanet, offer } = data;
      navigate(`/fleet?mission=trade&galaxy=${sellerPlanet.galaxy}&system=${sellerPlanet.system}&position=${sellerPlanet.position}&tradeId=${offer.id}&cargoMi=${offer.totalPayment.minerai}&cargoSi=${offer.totalPayment.silicium}&cargoH2=${offer.totalPayment.hydrogene}`);
    },
    onError: (err) => addToast(err.message, 'error'),
  });

  const cancelReservationMutation = trpc.market.cancelReservation.useMutation({
    onSuccess: () => {
      addToast('Réservation annulée');
      utils.market.myOffers.invalidate();
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

  const handleBuy = (offerId: string) => {
    if (!planetId) return;
    reserveMutation.mutate({ planetId, offerId });
  };

  const formatPrice = (mi: number, si: number, h2: number) => {
    const parts: string[] = [];
    if (mi > 0) parts.push(`${mi.toLocaleString('fr-FR')} Mi`);
    if (si > 0) parts.push(`${si.toLocaleString('fr-FR')} Si`);
    if (h2 > 0) parts.push(`${h2.toLocaleString('fr-FR')} H2`);
    return parts.join(' + ') || '0';
  };

  const STATUS_STYLES: Record<string, string> = {
    active: 'bg-emerald-500/20 text-emerald-400',
    reserved: 'bg-amber-500/20 text-amber-400',
    sold: 'bg-blue-500/20 text-blue-400',
    expired: 'bg-red-500/20 text-red-400',
    cancelled: 'bg-white/10 text-muted-foreground',
  };

  const STATUS_LABELS: Record<string, string> = {
    active: 'Active',
    reserved: 'Réservée',
    sold: 'Vendue',
    expired: 'Expirée',
    cancelled: 'Annulée',
  };

  return (
    <div className="space-y-4 p-4 lg:space-y-6 lg:p-6">
      <PageHeader title="Marché Galactique" />

      {/* Tabs */}
      <div className="flex gap-0">
        {([
          { key: 'buy' as Tab, label: 'Acheter' },
          { key: 'sell' as Tab, label: 'Vendre' },
          { key: 'my' as Tab, label: 'Mes offres' },
        ]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'px-5 py-2.5 text-sm font-medium rounded-t-lg transition-colors',
              tab === key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Buy tab */}
      {tab === 'buy' && (
        <section className="glass-card p-4">
          {/* Resource filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setResourceFilter(undefined)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm transition-colors',
                !resourceFilter ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent',
              )}
            >
              Tout
            </button>
            {(['minerai', 'silicium', 'hydrogene'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setResourceFilter(r)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-sm transition-colors',
                  resourceFilter === r ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent',
                )}
              >
                {RESOURCE_LABELS[r]}
              </button>
            ))}
          </div>

          {/* Offers table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left py-2 px-2">Ressource</th>
                  <th className="text-right py-2 px-2">Quantité</th>
                  <th className="text-right py-2 px-2">Prix</th>
                  <th className="text-right py-2 px-2">Commission</th>
                  <th className="text-center py-2 px-2">Coords</th>
                  <th className="text-center py-2 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {offersLoading && (
                  <tr><td colSpan={6} className="text-center py-4 text-muted-foreground">Chargement...</td></tr>
                )}
                {!offersLoading && (!offersData?.offers || offersData.offers.length === 0) && (
                  <tr><td colSpan={6} className="text-center py-4 text-muted-foreground">Aucune offre disponible</td></tr>
                )}
                {offersData?.offers.map((offer) => {
                  const commMi = offer.priceMinerai > 0 ? Math.ceil(offer.priceMinerai * commissionPercent / 100) : 0;
                  const commSi = offer.priceSilicium > 0 ? Math.ceil(offer.priceSilicium * commissionPercent / 100) : 0;
                  const commH2 = offer.priceHydrogene > 0 ? Math.ceil(offer.priceHydrogene * commissionPercent / 100) : 0;
                  return (
                    <tr key={offer.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                      <td className={cn('py-2 px-2 font-medium', RESOURCE_COLORS[offer.resourceType])}>
                        {RESOURCE_LABELS[offer.resourceType]}
                      </td>
                      <td className="text-right py-2 px-2">{offer.quantity.toLocaleString('fr-FR')}</td>
                      <td className="text-right py-2 px-2">{formatPrice(offer.priceMinerai, offer.priceSilicium, offer.priceHydrogene)}</td>
                      <td className="text-right py-2 px-2 text-muted-foreground">{formatPrice(commMi, commSi, commH2)}</td>
                      <td className="text-center py-2 px-2 text-muted-foreground">
                        [{offer.sellerCoords.galaxy}:{offer.sellerCoords.system}:{offer.sellerCoords.position}]
                      </td>
                      <td className="text-center py-2 px-2">
                        <Button
                          size="sm"
                          onClick={() => handleBuy(offer.id)}
                          disabled={reserveMutation.isPending}
                        >
                          Acheter
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Sell tab */}
      {tab === 'sell' && (
        <section className="glass-card p-4 max-w-lg">
          <div className="space-y-4">
            {/* Resource select */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Ressource à vendre</label>
              <div className="flex gap-2">
                {(['minerai', 'silicium', 'hydrogene'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setSellResource(r)}
                    className={cn(
                      'flex-1 rounded px-3 py-2 text-sm font-medium transition-colors',
                      sellResource === r
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {RESOURCE_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Quantité</label>
              <input
                type="number"
                min={1}
                value={sellQuantity || ''}
                onChange={(e) => setSellQuantity(Math.max(0, Number(e.target.value) || 0))}
                className="w-full rounded bg-muted px-3 py-2 text-sm"
                placeholder="10000"
              />
            </div>

            {/* Price */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Prix demandé</label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <div className="text-[10px] text-orange-400 mb-1">Minerai</div>
                  <input
                    type="number"
                    min={0}
                    value={sellPriceMinerai || ''}
                    onChange={(e) => setSellPriceMinerai(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full rounded bg-muted px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <div className="text-[10px] text-emerald-400 mb-1">Silicium</div>
                  <input
                    type="number"
                    min={0}
                    value={sellPriceSilicium || ''}
                    onChange={(e) => setSellPriceSilicium(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full rounded bg-muted px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <div className="text-[10px] text-blue-400 mb-1">Hydrogène</div>
                  <input
                    type="number"
                    min={0}
                    value={sellPriceHydrogene || ''}
                    onChange={(e) => setSellPriceHydrogene(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full rounded bg-muted px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Commission preview */}
            {(sellPriceMinerai > 0 || sellPriceSilicium > 0 || sellPriceHydrogene > 0) && (
              <div className="rounded border border-border p-3 text-xs text-muted-foreground">
                <div>Commission ({commissionPercent}%) payée par l'acheteur :</div>
                <div className="text-foreground mt-1">
                  {formatPrice(
                    sellPriceMinerai > 0 ? Math.ceil(sellPriceMinerai * commissionPercent / 100) : 0,
                    sellPriceSilicium > 0 ? Math.ceil(sellPriceSilicium * commissionPercent / 100) : 0,
                    sellPriceHydrogene > 0 ? Math.ceil(sellPriceHydrogene * commissionPercent / 100) : 0,
                  )}
                </div>
              </div>
            )}

            <Button
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
        </section>
      )}

      {/* My offers tab */}
      {tab === 'my' && (
        <section className="glass-card p-4">
          <div className="space-y-2">
            {!myOffers || myOffers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune offre.</p>
            ) : (
              myOffers.map((offer) => (
                <div key={offer.id} className="flex items-center justify-between rounded border border-border p-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn('font-medium', RESOURCE_COLORS[offer.resourceType])}>
                        {Number(offer.quantity).toLocaleString('fr-FR')} {RESOURCE_LABELS[offer.resourceType]}
                      </span>
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', STATUS_STYLES[offer.status])}>
                        {STATUS_LABELS[offer.status]}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Prix : {formatPrice(offer.priceMinerai, offer.priceSilicium, offer.priceHydrogene)}
                    </div>
                  </div>
                  {offer.status === 'active' && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => cancelOfferMutation.mutate({ offerId: offer.id })}
                      disabled={cancelOfferMutation.isPending}
                    >
                      Annuler
                    </Button>
                  )}
                  {offer.status === 'reserved' && !offer.fleetEventId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => cancelReservationMutation.mutate({ offerId: offer.id })}
                      disabled={cancelReservationMutation.isPending}
                    >
                      Annuler réservation
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
}
