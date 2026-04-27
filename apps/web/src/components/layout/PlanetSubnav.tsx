import { useMemo } from 'react';
import { NavLink } from 'react-router';
import { Zap } from 'lucide-react';
import { getVisibleSidebarPaths, type SidebarPath } from '@exilium/game-engine';
import { trpc } from '@/trpc';
import { cn } from '@/lib/utils';
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

  return (
    <nav
      aria-label="Navigation planète"
      className="sticky top-14 z-30 hidden lg:block border-b border-white/10 bg-card/80 backdrop-blur-md"
    >
      <ul className="flex items-center gap-1 px-4 py-1.5 overflow-x-auto">
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
