import { useMemo } from 'react';
import { NavLink, useLocation } from 'react-router';
import { cn } from '@/lib/utils';
import { trpc } from '@/trpc';
import { getVisibleSidebarPaths, type SidebarPath } from '@exilium/game-engine';
import { useSidebarNewItems } from './useSidebarNewItems';
import { TopBarActions } from './topbar/TopBarActions';
import {
  EmpireIcon,
  ResearchIcon,
  GalaxyIcon,
  MissionsIcon,
  MarketIcon,
  FleetIcon,
  AllianceIcon,
  RankingIcon,
} from '@/lib/icons';

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

  return (
    <header className="sticky top-0 z-40 hidden lg:grid grid-cols-[1fr_auto_1fr] items-center h-12 border-b border-border bg-surface px-4 lg:px-6">
      <NavLink to="/" viewTransition className="justify-self-start text-base font-semibold text-primary shrink-0">
        Exilium
      </NavLink>

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

      <div className="justify-self-end shrink-0">
        <TopBarActions />
      </div>
    </header>
  );
}
