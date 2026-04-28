import { useMemo } from 'react';
import { NavLink } from 'react-router';
import { ChevronRight, Zap } from 'lucide-react';
import { getVisibleSidebarPaths, type SidebarPath } from '@exilium/game-engine';
import { trpc } from '@/trpc';
import { usePlanetStore } from '@/stores/planet.store';
import { cn } from '@/lib/utils';
import { getPlanetImageUrl } from '@/lib/assets';
import {
  OverviewIcon,
  ResourcesIcon,
  BuildingsIcon,
  ShipyardIcon,
  CommandCenterIcon,
  DefenseIcon,
} from '@/lib/icons';

interface PlanetNavItem {
  label: string;
  path: SidebarPath;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  end?: boolean;
}

const PLANET_NAV_ITEMS: PlanetNavItem[] = [
  { label: "Vue d'ensemble", path: '/', icon: OverviewIcon, end: true },
  { label: 'Ressources', path: '/resources', icon: ResourcesIcon },
  { label: 'Infrastructures', path: '/infrastructures', icon: BuildingsIcon },
  { label: 'Énergie', path: '/energy', icon: Zap as React.ComponentType<React.SVGProps<SVGSVGElement>> },
  { label: 'Chantier spatial', path: '/shipyard', icon: ShipyardIcon },
  { label: 'Centre de commandement', path: '/command-center', icon: CommandCenterIcon },
  { label: 'Défense', path: '/defense', icon: DefenseIcon },
];

/**
 * Sticky planet-scoped navigation displayed under the topbar. Lists the pages
 * that act on the currently selected planet (overview, resources,
 * infrastructures, energy, shipyard, command-center, defense). The empire-wide
 * navigation stays in the left Sidebar.
 */
export function PlanetSubnav() {
  const { data: tutorialData } = trpc.tutorial.getCurrent.useQuery();
  const { data: planets } = trpc.planet.list.useQuery();
  const activePlanetId = usePlanetStore((s) => s.activePlanetId);

  const isComplete = tutorialData?.isComplete ?? false;
  const parsedChapter = tutorialData?.chapter
    ? Number.parseInt(tutorialData.chapter.id.replace('chapter_', ''), 10)
    : NaN;
  const chapterOrder = Number.isFinite(parsedChapter)
    ? parsedChapter
    : (isComplete ? 4 : 1);
  const colonyCount = planets?.length ?? 1;

  const visiblePaths = useMemo(
    () => getVisibleSidebarPaths({ chapterOrder, isComplete, colonyCount }),
    [chapterOrder, isComplete, colonyCount],
  );

  const items = PLANET_NAV_ITEMS.filter((item) => visiblePaths.has(item.path));
  if (items.length === 0) return null;

  const activePlanet = planets?.find((p) => p.id === activePlanetId);

  return (
    <nav
      aria-label="Navigation planète"
      className="sticky top-14 z-30 hidden lg:block border-b border-primary/15 bg-gradient-to-r from-primary/[0.06] via-card/80 to-card/80 backdrop-blur-md"
    >
      <ul className="flex items-center gap-1 px-4 py-1.5 overflow-x-auto">
        {activePlanet && (
          <>
            <li className="shrink-0 flex items-center gap-2 pl-1 pr-3 py-1">
              {activePlanet.planetClassId && activePlanet.planetImageIndex != null ? (
                <img
                  src={getPlanetImageUrl(activePlanet.planetClassId, activePlanet.planetImageIndex, 'icon')}
                  alt=""
                  className="h-6 w-6 rounded-full object-cover ring-1 ring-primary/40 shadow-[0_0_8px_-2px_hsl(var(--accent-glow))]"
                />
              ) : (
                <span className="h-6 w-6 rounded-full bg-primary/30 inline-block ring-1 ring-primary/40" />
              )}
              <span className="flex flex-col leading-tight">
                <span className="text-sm font-semibold text-foreground">{activePlanet.name}</span>
                <span className="text-[10px] font-mono text-primary/70">
                  [{activePlanet.galaxy}:{activePlanet.system}:{activePlanet.position}]
                </span>
              </span>
            </li>
            <li aria-hidden="true" className="shrink-0">
              <ChevronRight className="h-4 w-4 text-primary/40" />
            </li>
          </>
        )}
        {items.map((item) => (
          <li key={item.path} className="shrink-0">
            <NavLink
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap',
                  isActive
                    ? 'bg-primary/15 text-primary border border-primary/30 shadow-[0_0_12px_-4px_hsl(var(--accent-glow))]'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground border border-transparent',
                )
              }
            >
              <item.icon width={16} height={16} />
              <span>{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
