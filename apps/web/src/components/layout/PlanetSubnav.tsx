import { AlertTriangle } from 'lucide-react';
import { trpc } from '@/trpc';
import { usePlanetStore } from '@/stores/planet.store';
import { useResourceCounter } from '@/hooks/useResourceCounter';
import { cn } from '@/lib/utils';
import { MineraiIcon, SiliciumIcon, HydrogeneIcon, EnergieIcon } from '@/components/common/ResourceIcons';
import { PlanetSelectorDropdown } from './topbar/PlanetSelectorDropdown';
import { TopBarActions } from './topbar/TopBarActions';
import { ImportResourcesButton } from '@/components/resources/ImportResourcesButton';

function ResourceBadge({ label, value, glowClass, colorClass, icon, capacity, warning }: {
  label: string;
  value: number;
  glowClass: string;
  colorClass: string;
  icon?: React.ReactNode;
  capacity?: number;
  warning?: string;
}) {
  const overCap = capacity != null && value > capacity;
  return (
    <div className="flex items-center gap-2">
      {icon && <span className={colorClass}>{icon}</span>}
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          'font-display text-sm font-semibold tabular-nums',
          overCap ? 'text-amber-400' : colorClass,
          overCap ? '' : glowClass,
        )}
        title={warning ?? (overCap ? 'Stock au-delà de la capacité (production à l\'arrêt)' : undefined)}
      >
        {value.toLocaleString('fr-FR')}
      </span>
      {warning && <AlertTriangle className="h-3 w-3 text-red-400 animate-pulse" />}
    </div>
  );
}

/**
 * Topbar planète (desktop) : sélecteur de planète + badges de ressources
 * (montant du stock) + actions de compte.
 *
 * Refonte IA « 1 seul menu » : la navigation planète (Vue d'ensemble /
 * Ressources / Énergie / Bâtiments / Chantier) vit désormais dans la SIDEBAR
 * (section « Planète »). On a supprimé la rangée d'onglets qui faisait doublon
 * avec la sidebar — il ne reste qu'une seule barre en haut (les ressources).
 */
export function PlanetSubnav() {
  const { data: planets } = trpc.planet.list.useQuery();
  const activePlanetId = usePlanetStore((s) => s.activePlanetId);
  const setActivePlanet = usePlanetStore((s) => s.setActivePlanet);

  const { data: resourceData } = trpc.resource.production.useQuery(
    { planetId: activePlanetId! },
    { enabled: !!activePlanetId, refetchInterval: 300_000 },
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

  const energyBalance = resourceData
    ? resourceData.rates.energyProduced - resourceData.rates.energyConsumed
    : 0;
  const productionFactor = resourceData?.rates.productionFactor ?? 1;
  const brownout = productionFactor < 0.999;
  const brownoutPct = Math.round((1 - productionFactor) * 100);

  return (
    <section
      aria-label="Bloc planète"
      className="sticky top-0 z-40 hidden lg:block border-b border-border bg-surface"
    >
      {/* Sélecteur de planète + ressources (stock) + actions — h-12 aligné sur
          l'en-tête de la sidebar (jonction continue), calé sur le conteneur
          central (max-w-screen-2xl). */}
      <div className="mx-auto flex h-12 w-full items-center justify-between gap-4 px-4 lg:max-w-screen-2xl lg:px-6">
        <div className="flex items-center gap-6 min-w-0">
          <PlanetSelectorDropdown
            planetId={activePlanetId}
            planets={planets ?? []}
            onSelect={setActivePlanet}
          />

          <div className="flex items-center gap-5">
            <ResourceBadge
              label="Minerai"
              value={resources.minerai}
              glowClass=""
              colorClass="text-minerai"
              icon={<MineraiIcon size={14} />}
              capacity={resourceData?.rates.storageMineraiCapacity}
            />
            <ResourceBadge
              label="Silicium"
              value={resources.silicium}
              glowClass=""
              colorClass="text-silicium"
              icon={<SiliciumIcon size={14} />}
              capacity={resourceData?.rates.storageSiliciumCapacity}
            />
            <ResourceBadge
              label="Hydrogène"
              value={resources.hydrogene}
              glowClass=""
              colorClass="text-hydrogene"
              icon={<HydrogeneIcon size={14} />}
              capacity={resourceData?.rates.storageHydrogeneCapacity}
            />
            <ResourceBadge
              label="Énergie"
              value={energyBalance}
              glowClass=""
              colorClass={energyBalance >= 0 ? 'text-energy' : 'text-destructive'}
              icon={<EnergieIcon size={14} />}
              warning={brownout ? `Production des mines à ${100 - brownoutPct}% — déficit de ${Math.abs(energyBalance).toLocaleString('fr-FR')} d'énergie.` : undefined}
            />
            {activePlanetId && (
              <ImportResourcesButton targetPlanetId={activePlanetId} size="sm" />
            )}
          </div>
        </div>

        <TopBarActions />
      </div>
    </section>
  );
}
