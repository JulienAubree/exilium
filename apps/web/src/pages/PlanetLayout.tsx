import { useEffect } from 'react';
import { Outlet, useNavigate, useParams, useLocation, Link } from 'react-router';
import { ArrowLeft, Zap, AlertTriangle } from 'lucide-react';
import { trpc } from '@/trpc';
import { usePlanetStore } from '@/stores/planet.store';
import { useResourceCounter } from '@/hooks/useResourceCounter';
import { getVisibleSidebarPaths, type SidebarPath } from '@exilium/game-engine';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { TabBar, type TabItem } from '@/components/ui/tabs';
import { MineraiIcon, SiliciumIcon, HydrogeneIcon, EnergieIcon } from '@/components/common/ResourceIcons';
import { PlanetSelectorDropdown } from '@/components/layout/topbar/PlanetSelectorDropdown';
import { ImportResourcesButton } from '@/components/resources/ImportResourcesButton';
import {
  OverviewIcon,
  ResourcesIcon,
  BuildingsIcon,
  ShipyardIcon,
} from '@/lib/icons';

/** Onglet → clé de visibilité historique (divulgation progressive du tutoriel). */
const PLANET_TABS: { label: string; sub: string; visKey: SidebarPath; icon: TabItem['icon']; end?: boolean }[] = [
  { label: "Vue d'ensemble", sub: '', visKey: '/', icon: OverviewIcon, end: true },
  { label: 'Ressources', sub: 'resources', visKey: '/resources', icon: ResourcesIcon },
  { label: 'Énergie', sub: 'energy', visKey: '/energy', icon: Zap as TabItem['icon'] },
  { label: 'Infrastructures', sub: 'infrastructures', visKey: '/infrastructures', icon: BuildingsIcon },
  { label: 'Production', sub: 'production', visKey: '/production', icon: ShipyardIcon },
];

function ResourceBadge({ value, colorClass, icon, capacity, warning }: {
  value: number;
  colorClass: string;
  icon: React.ReactNode;
  capacity?: number;
  warning?: string;
}) {
  const overCap = capacity != null && value > capacity;
  return (
    <div className="flex items-center gap-1.5">
      <span className={colorClass}>{icon}</span>
      <span
        className={cn('text-sm font-semibold tabular-nums', overCap ? 'text-amber-400' : colorClass)}
        title={warning ?? (overCap ? 'Stock au-delà de la capacité (production à l\'arrêt)' : undefined)}
      >
        {value.toLocaleString('fr-FR')}
      </span>
      {warning && <AlertTriangle className="h-3 w-3 text-red-400 animate-pulse" />}
    </div>
  );
}

/**
 * Drill-down planète du shell « Empire-first » : la planète n'est plus un
 * monde parallèle mais un détail de l'Empire, adressable (/planet/:id).
 * En-tête : retour Empire + sélecteur + ressources ; puis onglets.
 * Spec : docs/plans/2026-06-10-shell-empire-first.md
 */
export default function PlanetLayout() {
  const { planetId } = useParams<{ planetId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: planets } = trpc.planet.list.useQuery();
  const setActivePlanet = usePlanetStore((s) => s.setActivePlanet);

  const planet = planets?.find((p) => p.id === planetId);

  // L'URL est la source de vérité — on synchronise le store (sélecteur
  // mobile, pages hors drill-down) sur elle.
  useEffect(() => {
    if (planetId) setActivePlanet(planetId);
  }, [planetId, setActivePlanet]);

  // Planète inconnue (supprimée/abandonnée) → retour au home Empire.
  useEffect(() => {
    if (planets && planetId && !planets.find((p) => p.id === planetId)) {
      navigate('/', { replace: true });
    }
  }, [planets, planetId, navigate]);

  const isColonizing = planet?.status === 'colonizing';
  const atIndex = location.pathname === `/planet/${planetId}`;
  // En colonisation, seule la Vue d'ensemble (qui affiche la progression) est accessible.
  useEffect(() => {
    if (isColonizing && !atIndex) {
      navigate(`/planet/${planetId}`, { replace: true });
    }
  }, [isColonizing, atIndex, navigate, planetId]);

  const { data: tutorialData } = trpc.tutorial.getCurrent.useQuery();
  const isComplete = tutorialData?.isComplete ?? false;
  const parsedChapter = tutorialData?.chapter
    ? Number.parseInt(tutorialData.chapter.id.replace('chapter_', ''), 10)
    : NaN;
  const chapterOrder = Number.isFinite(parsedChapter) ? parsedChapter : (isComplete ? 4 : 1);
  const colonyCount = planets?.length ?? 1;
  const visiblePaths = useMemo(
    () => getVisibleSidebarPaths({ chapterOrder, isComplete, colonyCount }),
    [chapterOrder, isComplete, colonyCount],
  );

  const { data: resourceData } = trpc.resource.production.useQuery(
    { planetId: planetId! },
    { enabled: !!planetId && !isColonizing, refetchInterval: 300_000 },
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

  const tabs: TabItem[] = PLANET_TABS
    .filter((t) => visiblePaths.has(t.visKey))
    .map((t) => ({
      label: t.label,
      icon: t.icon,
      to: t.sub ? `/planet/${planetId}/${t.sub}` : `/planet/${planetId}`,
      end: t.end,
    }));

  return (
    <div>
      {/* En-tête planète : retour + sélecteur + ressources (desktop) */}
      <div className="sticky top-0 lg:top-12 z-30 border-b border-border bg-surface">
        <div className="flex items-center justify-between gap-3 px-4 py-1.5 lg:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/"
              viewTransition
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors duration-fast"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Empire</span>
            </Link>
            <PlanetSelectorDropdown
              planetId={planetId ?? null}
              planets={planets ?? []}
              onSelect={(id) => {
                const sub = location.pathname.split('/').slice(3).join('/');
                navigate(sub ? `/planet/${id}/${sub}` : `/planet/${id}`);
              }}
            />
          </div>
          {!isColonizing && (
            <div className="hidden lg:flex items-center gap-5">
              <ResourceBadge
                value={resources.minerai}
                colorClass="text-minerai"
                icon={<MineraiIcon size={14} />}
                capacity={resourceData?.rates.storageMineraiCapacity}
              />
              <ResourceBadge
                value={resources.silicium}
                colorClass="text-silicium"
                icon={<SiliciumIcon size={14} />}
                capacity={resourceData?.rates.storageSiliciumCapacity}
              />
              <ResourceBadge
                value={resources.hydrogene}
                colorClass="text-hydrogene"
                icon={<HydrogeneIcon size={14} />}
                capacity={resourceData?.rates.storageHydrogeneCapacity}
              />
              <ResourceBadge
                value={energyBalance}
                colorClass={energyBalance >= 0 ? 'text-energy' : 'text-destructive'}
                icon={<EnergieIcon size={14} />}
                warning={brownout ? `Production des mines à ${100 - brownoutPct}% — déficit de ${Math.abs(energyBalance).toLocaleString('fr-FR')} d'énergie.` : undefined}
              />
              {planetId && <ImportResourcesButton targetPlanetId={planetId} size="sm" />}
            </div>
          )}
        </div>
        {!isColonizing && tabs.length > 0 && (
          <TabBar items={tabs} ariaLabel="Navigation planète" className="border-b-0" />
        )}
      </div>

      <Outlet context={{ planetId: planetId ?? null, planetClassId: planet?.planetClassId ?? null }} />
    </div>
  );
}
