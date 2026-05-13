import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { MineraiIcon, SiliciumIcon, HydrogeneIcon, EnergieIcon } from '@/components/common/ResourceIcons';
import { useResourceCounter } from '@/hooks/useResourceCounter';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { trpc } from '@/trpc';
import { ImportResourcesButton } from '@/components/resources/ImportResourcesButton';

interface ResourceBarProps {
  planetId: string | null;
}

export function ResourceBar({ planetId }: ResourceBarProps) {
  const [detailOpen, setDetailOpen] = useState(false);

  // Resources stay live via the client-side ticker + SSE invalidation on
  // events that change the production rate (building-done, fleet-arrived,
  // fleet-returned, market-offer-sold). Long-interval poll is a safety net
  // for silent SSE disconnects.
  const { data } = trpc.resource.production.useQuery(
    { planetId: planetId! },
    { enabled: !!planetId, refetchInterval: 300_000 },
  );

  const resources = useResourceCounter(
    data
      ? {
          minerai: data.minerai,
          silicium: data.silicium,
          hydrogene: data.hydrogene,
          resourcesUpdatedAt: data.resourcesUpdatedAt,
          mineraiPerHour: data.rates.mineraiPerHour,
          siliciumPerHour: data.rates.siliciumPerHour,
          hydrogenePerHour: data.rates.hydrogenePerHour,
          storageMineraiCapacity: data.rates.storageMineraiCapacity,
          storageSiliciumCapacity: data.rates.storageSiliciumCapacity,
          storageHydrogeneCapacity: data.rates.storageHydrogeneCapacity,
        }
      : undefined,
  );

  const energyBalance = data ? data.rates.energyProduced - data.rates.energyConsumed : 0;
  const productionFactor = data?.rates.productionFactor ?? 1;
  const brownout = productionFactor < 0.999;
  const brownoutPct = Math.round((1 - productionFactor) * 100);

  return (
    <>
      <div
        className="sticky top-[calc(3rem+env(safe-area-inset-top))] z-30 flex h-11 cursor-pointer items-center justify-around border-b border-white/5 bg-card/80 backdrop-blur-md px-3 lg:hidden"
        onClick={() => setDetailOpen(!detailOpen)}
      >
        <ResourceCounter icon={<MineraiIcon size={14} className="text-minerai" />} value={resources.minerai} colorClass="text-minerai" capacity={data?.rates.storageMineraiCapacity} />
        <ResourceCounter icon={<SiliciumIcon size={14} className="text-silicium" />} value={resources.silicium} colorClass="text-silicium" capacity={data?.rates.storageSiliciumCapacity} />
        <ResourceCounter icon={<HydrogeneIcon size={14} className="text-hydrogene" />} value={resources.hydrogene} colorClass="text-hydrogene" capacity={data?.rates.storageHydrogeneCapacity} />
        <ResourceCounter
          icon={<EnergieIcon size={14} className="text-energy" />}
          value={energyBalance}
          colorClass={energyBalance < 0 ? 'text-red-400' : 'text-energy'}
          warning={brownout ? `Production à ${100 - brownoutPct}% — déficit énergétique de ${Math.abs(energyBalance).toLocaleString('fr-FR')} (touche le détail).` : undefined}
        />
      </div>

      {detailOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setDetailOpen(false)}>
          <div className="absolute top-[calc(5.75rem+env(safe-area-inset-top))] left-0 right-0 animate-slide-down-sheet border-b border-white/10 bg-card/95 backdrop-blur-lg p-4" style={{ maxHeight: '50vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="space-y-3 text-sm">
              <DetailRow label="Minerai" value={resources.minerai} perHour={data?.rates.mineraiPerHour ?? 0} capacity={data?.rates.storageMineraiCapacity ?? 0} colorClass="text-minerai" />
              <DetailRow label="Silicium" value={resources.silicium} perHour={data?.rates.siliciumPerHour ?? 0} capacity={data?.rates.storageSiliciumCapacity ?? 0} colorClass="text-silicium" />
              <DetailRow label="Hydrogène" value={resources.hydrogene} perHour={data?.rates.hydrogenePerHour ?? 0} capacity={data?.rates.storageHydrogeneCapacity ?? 0} colorClass="text-hydrogene" />
              <div className="flex items-center justify-between border-t border-white/5 pt-2">
                <span className={brownout ? 'text-red-400 inline-flex items-center gap-1' : 'text-energy'}>
                  {brownout && <AlertTriangle className="h-3 w-3" />} Énergie
                </span>
                <span className={cn('tabular-nums', brownout ? 'text-red-400' : 'text-energy')}>
                  {data?.rates.energyProduced ?? 0} / {data?.rates.energyConsumed ?? 0}
                </span>
              </div>
              {brownout && (
                <div className="rounded-md border border-red-500/40 bg-red-950/30 px-2 py-1.5 text-[11px] text-red-200">
                  Déficit énergétique : production des mines réduite à {100 - brownoutPct}%. Construis un Centre énergétique ou réduis ta conso.
                </div>
              )}
              {planetId && (
                <div className="flex justify-end border-t border-white/5 pt-2">
                  <ImportResourcesButton targetPlanetId={planetId} size="sm" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ResourceCounter({ icon, value, colorClass, suffix, capacity, warning }: { icon: React.ReactNode; value: number; colorClass: string; suffix?: string; capacity?: number; warning?: string }) {
  const overCap = capacity != null && value > capacity;
  return (
    <div className="flex items-center gap-1">
      {icon}
      <span
        className={cn('text-sm font-medium tabular-nums', overCap ? 'text-amber-400' : colorClass)}
        title={warning ?? (overCap ? 'Stock au-delà de la capacité (production à l’arrêt)' : undefined)}
      >
        {formatNumber(Math.floor(value))}{suffix}
      </span>
      {warning && <AlertTriangle className="h-3 w-3 text-red-400 animate-pulse" />}
    </div>
  );
}

function DetailRow({ label, value, perHour, capacity, colorClass }: { label: string; value: number; perHour: number; capacity: number; colorClass: string }) {
  const overCap = value > capacity;
  return (
    <div className="flex items-center justify-between">
      <span className={colorClass}>{label}</span>
      <div className="flex gap-3 tabular-nums text-muted-foreground">
        <span
          title={overCap ? 'Stock au-delà de la capacité (production à l’arrêt)' : undefined}
        >
          <span className={overCap ? 'text-amber-400' : undefined}>
            {formatNumber(Math.floor(value))}
          </span>
          {' / '}
          {formatNumber(capacity)}
        </span>
        <span className="text-foreground">+{formatNumber(Math.round(perHour))}/h</span>
      </div>
    </div>
  );
}
