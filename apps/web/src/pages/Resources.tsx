import { useOutletContext } from 'react-router';
import { Pickaxe, Database } from 'lucide-react';
import { trpc } from '@/trpc';
import { useResourceCounter } from '@/hooks/useResourceCounter';
import { usePlanetStore } from '@/stores/planet.store';
import { KpiTile } from '@/components/common/KpiTile';
import { MineraiIcon, SiliciumIcon, HydrogeneIcon, EnergieIcon } from '@/components/common/ResourceIcons';
import { getPlanetImageUrl } from '@/lib/assets';
import { BuildingsList } from './Buildings';

const RESOURCE_CATEGORY_IDS = [
  'building_extraction',
  'building_energie',
  'building_stockage',
];

const fmt = (n: number) => Number(n).toLocaleString('fr-FR');

export default function Resources() {
  const { planetId } = useOutletContext<{ planetId?: string; planetClassId?: string | null }>();
  const activePlanetId = usePlanetStore((s) => s.activePlanetId);
  const { data: planets } = trpc.planet.list.useQuery();
  const activePlanet = planets?.find((p) => p.id === (activePlanetId ?? planetId));

  const { data: resourceData } = trpc.resource.production.useQuery(
    { planetId: planetId! },
    { enabled: !!planetId },
  );

  const resources = useResourceCounter(
    resourceData
      ? {
          minerai: resourceData.minerai,
          silicium: resourceData.silicium,
          hydrogene: resourceData.hydrogene,
          resourcesUpdatedAt: resourceData.resourcesUpdatedAt,
          mineraiPerHour: resourceData.rates.mineraiPerHour,
          siliciumPerHour: resourceData.rates.siliciumPerHour,
          hydrogenePerHour: resourceData.rates.hydrogenePerHour,
          storageMineraiCapacity: resourceData.rates.storageMineraiCapacity,
          storageSiliciumCapacity: resourceData.rates.storageSiliciumCapacity,
          storageHydrogeneCapacity: resourceData.rates.storageHydrogeneCapacity,
        }
      : undefined,
  );

  const mineraiPerHour = resourceData?.rates.mineraiPerHour ?? 0;
  const siliciumPerHour = resourceData?.rates.siliciumPerHour ?? 0;
  const hydrogenePerHour = resourceData?.rates.hydrogenePerHour ?? 0;
  const energyBalance = resourceData
    ? resourceData.rates.energyProduced - resourceData.rates.energyConsumed
    : 0;

  const planetLabel = activePlanet
    ? `${activePlanet.name} [${activePlanet.galaxy}:${activePlanet.system}:${activePlanet.position}]`
    : null;

  const planetImage = activePlanet?.planetClassId && activePlanet.planetImageIndex != null
    ? getPlanetImageUrl(activePlanet.planetClassId, activePlanet.planetImageIndex, 'thumb')
    : null;

  return (
    <div className="space-y-4">
      {/* Hero banner */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0">
          {planetImage && (
            <img
              src={planetImage}
              alt=""
              className="h-full w-full object-cover opacity-50 blur-sm scale-110"
              decoding="async"
              fetchPriority="low"
              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-br from-amber-950/40 via-slate-950/70 to-emerald-950/40" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />

        <div className="relative px-5 pt-8 pb-6 lg:px-8 lg:pt-10 lg:pb-8">
          <div className="flex items-start gap-4 sm:gap-5">
            <div className="shrink-0 flex h-20 w-20 lg:h-24 lg:w-24 items-center justify-center rounded-full border-2 border-amber-500/30 bg-card/60 shadow-lg shadow-amber-500/10">
              <Pickaxe className="h-10 w-10 lg:h-11 lg:w-11 text-amber-400" />
            </div>

            <div className="flex-1 min-w-0 pt-1">
              <h1 className="text-xl lg:text-2xl font-bold text-foreground">Ressources</h1>
              {planetLabel && (
                <p className="text-sm text-muted-foreground mt-0.5">{planetLabel}</p>
              )}
              <p className="text-xs text-muted-foreground/70 mt-2 max-w-lg leading-relaxed hidden lg:block">
                Extraction (mines), production d&apos;énergie (centrale solaire) et stockage de la planète sélectionnée.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-4 px-4 pb-4 lg:px-6 lg:pb-6">
        {/* KPI tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiTile
            label="Minerai / h"
            value={fmt(mineraiPerHour)}
            color="text-minerai"
            icon={<MineraiIcon size={18} className="text-minerai" />}
          />
          <KpiTile
            label="Silicium / h"
            value={fmt(siliciumPerHour)}
            color="text-silicium"
            icon={<SiliciumIcon size={18} className="text-silicium" />}
          />
          <KpiTile
            label="Hydrogène / h"
            value={fmt(hydrogenePerHour)}
            color="text-hydrogene"
            icon={<HydrogeneIcon size={18} className="text-hydrogene" />}
          />
          <KpiTile
            label="Énergie nette"
            value={`${energyBalance >= 0 ? '+' : ''}${fmt(energyBalance)}`}
            color={energyBalance >= 0 ? 'text-energy' : 'text-destructive'}
            icon={<EnergieIcon size={18} className={energyBalance >= 0 ? 'text-energy' : 'text-destructive'} />}
          />
        </div>

        {/* Capacities mini-strip (storage hint) */}
        {resourceData && (
          <div className="grid grid-cols-3 gap-3 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-2 rounded-lg border border-border/30 bg-card/40 px-3 py-2">
              <Database className="h-3.5 w-3.5 text-minerai/70" />
              <span className="truncate">
                Stock minerai <span className="text-minerai font-mono">{fmt(Math.floor(resources.minerai))}</span> / {fmt(resourceData.rates.storageMineraiCapacity)}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border/30 bg-card/40 px-3 py-2">
              <Database className="h-3.5 w-3.5 text-silicium/70" />
              <span className="truncate">
                Stock silicium <span className="text-silicium font-mono">{fmt(Math.floor(resources.silicium))}</span> / {fmt(resourceData.rates.storageSiliciumCapacity)}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border/30 bg-card/40 px-3 py-2">
              <Database className="h-3.5 w-3.5 text-hydrogene/70" />
              <span className="truncate">
                Stock hydrogène <span className="text-hydrogene font-mono">{fmt(Math.floor(resources.hydrogene))}</span> / {fmt(resourceData.rates.storageHydrogeneCapacity)}
              </span>
            </div>
          </div>
        )}

        {/* Buildings list (extraction / énergie / stockage) */}
        <section className="glass-card p-4 lg:p-5">
          <BuildingsList
            title="Ressources"
            categoryIds={RESOURCE_CATEGORY_IDS}
            hideHeader
            containerClassName="space-y-4 lg:space-y-6"
          />
        </section>
      </div>

    </div>
  );
}
