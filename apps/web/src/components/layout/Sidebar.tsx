import { useMemo } from 'react';
import { NavLink } from 'react-router';
import { cn } from '@/lib/utils';
import { getVisibleSidebarPaths, type SidebarPath } from '@exilium/game-engine';
import { trpc } from '@/trpc';
import { ShieldAlert, Crown } from 'lucide-react';
import { Timer } from '@/components/common/Timer';
import { useSidebarNewItems } from './useSidebarNewItems';
import {
  ResearchIcon,
  FleetIcon,
  GalaxyIcon,
  MarketIcon,
  MissionsIcon,
  RankingIcon,
  AllianceIcon,
  EmpireIcon,
} from '@/lib/icons';

interface NavItem {
  label: string;
  path: SidebarPath;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

const sections: { title: string; items: NavItem[] }[] = [
  {
    title: 'Empire',
    items: [
      { label: 'Empire', path: '/empire', icon: EmpireIcon },
      { label: 'Recherche', path: '/research', icon: ResearchIcon },
    ],
  },
  {
    title: 'Galaxie',
    items: [
      { label: 'Galaxie', path: '/galaxy', icon: GalaxyIcon },
      { label: 'Missions', path: '/missions', icon: MissionsIcon },
      { label: 'Marché', path: '/market', icon: MarketIcon },
    ],
  },
  {
    title: 'Flotte',
    items: [
      { label: 'Flotte', path: '/fleet', icon: FleetIcon },
    ],
  },
  {
    title: 'Social',
    items: [
      { label: 'Alliance', path: '/alliance', icon: AllianceIcon },
      { label: 'Classement', path: '/ranking', icon: RankingIcon },
    ],
  },
];

export function Sidebar() {
  const { data: tutorialData } = trpc.tutorial.getCurrent.useQuery();
  const { data: planets } = trpc.planet.list.useQuery();

  const isComplete = tutorialData?.isComplete ?? false;
  // TODO(api): prefer tutorial.getCurrent exposing chapter.order directly
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
  const { newPaths, markSeen } = useSidebarNewItems(visiblePaths);

  const renderedSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => visiblePaths.has(item.path)),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-56 lg:flex-col bg-surface border-r border-border/60">
      <SidebarPulse />
      <nav className="flex-1 overflow-y-auto p-2">
        {renderedSections.map((section, idx) => (
          <div key={section.title} className="sidebar-section-fade-in">
            {idx > 0 && <div className="mx-3 my-2 border-t border-border/30" />}
            <p className="mb-1 px-3 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const isNew = newPaths.has(item.path);
                return (
                  <li key={item.path} className={isNew ? 'sidebar-item-new' : undefined}>
                    <NavLink
                      viewTransition
                      to={item.path}
                      end={item.path === '/'}
                      onClick={() => markSeen(item.path)}
                      className={({ isActive }) =>
                        cn(
                          'relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                          isActive
                            ? 'border-l-2 border-primary bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                        )
                      }
                    >
                      <item.icon width={18} height={18} />
                      <span>{item.label}</span>
                      {isNew && (
                        <span
                          aria-label="Nouveau"
                          className="ml-auto h-1.5 w-1.5 rounded-full bg-primary text-primary"
                        />
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}


/**
 * Le pouls de l'empire — l'en-tête de la sidebar montre du jeu, pas un logo
 * (retour user 2026-06-11) : attaque entrante > prochaine flotte en approche >
 * niveau d'empire. h-12 + border-border/60 : la ligne court d'un seul tenant
 * avec la rangée ressources de la sous-nav.
 */
function SidebarPulse() {
  const { data: inbound } = trpc.fleet.inbound.useQuery(undefined, { refetchInterval: 60_000 });
  const { data: progression } = trpc.empireProgression.get.useQuery();

  const byArrival = [...(inbound ?? [])].sort(
    (a, b) => new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime(),
  );
  const hostile = byArrival.find((f) => f.hostile);
  const friendly = byArrival.find((f) => !f.hostile);

  if (hostile) {
    return (
      <NavLink to="/fleet" className="flex h-12 shrink-0 items-center gap-2 border-b border-border/60 px-4 text-destructive hover:bg-destructive/10 transition-colors">
        <ShieldAlert className="h-4 w-4 animate-pulse" />
        <span className="text-sm font-semibold">Attaque</span>
        <Timer endTime={new Date(hostile.arrivalTime)} className="ml-auto" />
      </NavLink>
    );
  }

  if (friendly) {
    return (
      <NavLink to="/fleet" className="flex h-12 shrink-0 items-center gap-2 border-b border-border/60 px-4 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
        <FleetIcon width={15} height={15} className="text-primary" />
        <span className="text-sm font-medium">Flotte</span>
        <Timer endTime={new Date(friendly.arrivalTime)} className="ml-auto" />
      </NavLink>
    );
  }

  const level = progression?.level;
  const xpPct =
    progression && progression.nextLevelXp != null
      ? Math.min(100, Math.round(((progression.xp - progression.currentLevelXp) / Math.max(1, progression.nextLevelXp - progression.currentLevelXp)) * 100))
      : null;

  return (
    <NavLink to="/progression" className="flex h-12 shrink-0 flex-col justify-center gap-1 border-b border-border/60 px-4 hover:bg-accent transition-colors">
      <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Crown className="h-3.5 w-3.5 text-energy" />
        {level != null ? `Empire Nv. ${level}` : 'Exilium'}
      </span>
      {xpPct != null && (
        <span className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <span className="block h-1 rounded-full bg-energy/70" style={{ width: `${xpPct}%` }} />
        </span>
      )}
    </NavLink>
  );
}
