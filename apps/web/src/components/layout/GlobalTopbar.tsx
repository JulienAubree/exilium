import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { useResourceCounter } from '@/hooks/useResourceCounter';
import { MineraiIcon, SiliciumIcon, HydrogeneIcon, EnergieIcon } from '@/components/common/ResourceIcons';
import { PlanetSelectorDropdown } from './topbar/PlanetSelectorDropdown';
import { ImportResourcesButton } from '@/components/resources/ImportResourcesButton';
import { cn } from '@/lib/utils';
import { trpc } from '@/trpc';
import { getVisibleSidebarPaths, type SidebarPath } from '@exilium/game-engine';
import { useSidebarNewItems } from './useSidebarNewItems';
import { TopBarActions } from './topbar/TopBarActions';
import { Zap } from 'lucide-react';
import {
  EmpireIcon,
  ResearchIcon,
  GalaxyIcon,
  MissionsIcon,
  MarketIcon,
  FleetIcon,
  AllianceIcon,
  RankingIcon,
  OverviewIcon,
  ResourcesIcon,
  BuildingsIcon,
  ShipyardIcon,
} from '@/lib/icons';

/** Onglets du mode focus planète — remplacent la nav des hubs dans la barre. */
const PLANET_TABS: { label: string; sub: string; visKey: SidebarPath; icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; end?: boolean }[] = [
  { label: "Vue d'ensemble", sub: '', visKey: '/', icon: OverviewIcon, end: true },
  { label: 'Ressources', sub: 'resources', visKey: '/resources', icon: ResourcesIcon },
  { label: 'Énergie', sub: 'energy', visKey: '/energy', icon: Zap as React.ComponentType<React.SVGProps<SVGSVGElement>> },
  { label: 'Infrastructures', sub: 'infrastructures', visKey: '/infrastructures', icon: BuildingsIcon },
  { label: 'Production', sub: 'production', visKey: '/production', icon: ShipyardIcon },
];

interface NavItem {
  label: string;
  path: SidebarPath;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  /** Le lien Empire reste actif dans le drill-down planète. */
  alsoActiveOn?: string;
}

/** Hubs (séparés par groupes) — l'ex-sidebar tient désormais sur une ligne. */
const NAV_GROUPS: NavItem[][] = [
  [
    { label: 'Empire', path: '/', icon: EmpireIcon, alsoActiveOn: '/planet/' },
    { label: 'Recherche', path: '/research', icon: ResearchIcon },
  ],
  [
    { label: 'Galaxie', path: '/galaxy', icon: GalaxyIcon },
    { label: 'Missions', path: '/missions', icon: MissionsIcon },
    { label: 'Marché', path: '/market', icon: MarketIcon },
  ],
  [{ label: 'Flotte', path: '/fleet', icon: FleetIcon }],
  [
    { label: 'Alliance', path: '/alliance', icon: AllianceIcon },
    { label: 'Classement', path: '/ranking', icon: RankingIcon },
  ],
];

/**
 * Barre de navigation principale desktop du shell « Empire-first » :
 * marque · hubs · actions transverses, sur une seule ligne. Remplace la
 * sidebar (supprimée) — le contenu prend toute la largeur. Le mobile
 * navigue via la BottomTabBar.
 */
export function GlobalTopbar() {
  const location = useLocation();
  const navigate = useNavigate();
  // Contexte planète : sur /planet/:id, la barre intègre retour + sélecteur
  // + ressources — une seule barre, plus d'étage empilé.
  const planetMatch = location.pathname.match(/^\/planet\/([0-9a-f-]{36})/);
  const contextPlanetId = planetMatch?.[1] ?? null;
  // Nav « fantôme » : transparente posée sur l'atmosphère du héro, elle ne
  // devient une surface qu'au scroll (lisibilité). Le scroll vit sur <main>.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = document.getElementById('main-content');
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 8);
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [location.pathname]);
  const { data: tutorialData } = trpc.tutorial.getCurrent.useQuery();
  const { data: planets } = trpc.planet.list.useQuery();

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
  const { newPaths, markSeen } = useSidebarNewItems(visiblePaths);

  const groups = NAV_GROUPS.map((g) => g.filter((item) => visiblePaths.has(item.path))).filter(
    (g) => g.length > 0,
  );

  const { data: resourceData } = trpc.resource.production.useQuery(
    { planetId: contextPlanetId! },
    { enabled: !!contextPlanetId, refetchInterval: 300_000 },
  );
  const liveResources = useResourceCounter(
    contextPlanetId && resourceData
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

  const switchPlanet = (id: string) => {
    const sub = location.pathname.split('/').slice(3).join('/');
    navigate(sub ? `/planet/${id}/${sub}` : `/planet/${id}`);
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-40 hidden lg:grid grid-cols-[1fr_auto_1fr] items-center h-12 px-4 lg:px-6 border-b transition-colors duration-base ease-standard',
        scrolled ? 'border-border bg-surface' : 'border-transparent bg-transparent',
      )}
    >
      {contextPlanetId ? (
        <div className="justify-self-start flex min-w-0 items-center gap-1.5">
          <NavLink
            to="/"
            viewTransition
            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors duration-fast"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden xl:inline">Empire</span>
          </NavLink>
          <PlanetSelectorDropdown
            planetId={contextPlanetId}
            planets={planets ?? []}
            onSelect={switchPlanet}
          />
        </div>
      ) : (
        <NavLink to="/" viewTransition className="justify-self-start text-base font-semibold text-primary shrink-0">
          Exilium
        </NavLink>
      )}

      {contextPlanetId ? (
        <nav aria-label="Navigation planète" className="justify-self-center flex min-w-0 items-center gap-0.5 overflow-x-auto">
          {PLANET_TABS.filter((t) => visiblePaths.has(t.visKey)).map((t) => (
            <NavLink
              key={t.sub}
              to={t.sub ? `/planet/${contextPlanetId}/${t.sub}` : `/planet/${contextPlanetId}`}
              end={t.end}
              viewTransition
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors duration-fast ease-standard',
                  isActive
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )
              }
            >
              <t.icon width={16} height={16} />
              <span className="hidden lg:inline">{t.label}</span>
            </NavLink>
          ))}
        </nav>
      ) : (
      <nav aria-label="Navigation principale" className="justify-self-center flex min-w-0 items-center overflow-x-auto">
        {groups.map((group, gi) => (
          <ul key={gi} className={cn('flex items-center gap-0.5', gi > 0 && 'ml-3 border-l border-border-strong/50 pl-3')}>
            {group.map((item) => {
              const active =
                item.path === '/'
                  ? location.pathname === '/' || (item.alsoActiveOn && location.pathname.startsWith(item.alsoActiveOn))
                  : location.pathname.startsWith(item.path);
              const isNew = newPaths.has(item.path);
              return (
                <li key={item.path} className="shrink-0">
                  <NavLink
                    to={item.path}
                    viewTransition
                    onClick={() => markSeen(item.path)}
                    className={cn(
                      'relative flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors duration-fast ease-standard',
                      active
                        ? 'bg-primary/15 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <item.icon width={16} height={16} />
                    <span className="hidden xl:inline">{item.label}</span>
                    {isNew && (
                      <span
                        aria-label="Nouveau"
                        className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary"
                      />
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        ))}
      </nav>
      )}

      <div className="justify-self-end flex shrink-0 items-center gap-3">
        {contextPlanetId && resourceData && (
          <div className="hidden xl:flex items-center gap-3 tabular-nums">
            <span className="flex items-center gap-1 text-sm font-semibold text-minerai"><MineraiIcon size={13} />{liveResources.minerai.toLocaleString('fr-FR')}</span>
            <span className="flex items-center gap-1 text-sm font-semibold text-silicium"><SiliciumIcon size={13} />{liveResources.silicium.toLocaleString('fr-FR')}</span>
            <span className="flex items-center gap-1 text-sm font-semibold text-hydrogene"><HydrogeneIcon size={13} />{liveResources.hydrogene.toLocaleString('fr-FR')}</span>
            <span className={cn('flex items-center gap-1 text-sm font-semibold', energyBalance >= 0 ? 'text-energy' : 'text-destructive')}><EnergieIcon size={13} />{energyBalance.toLocaleString('fr-FR')}</span>
            <ImportResourcesButton targetPlanetId={contextPlanetId} size="sm" />
          </div>
        )}
        <TopBarActions />
      </div>
    </header>
  );
}
