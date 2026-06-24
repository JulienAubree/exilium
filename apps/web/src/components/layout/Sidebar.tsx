import { useMemo } from 'react';
import { NavLink } from 'react-router';
import { cn } from '@/lib/utils';
import { getVisibleSidebarPaths, type SidebarPath } from '@exilium/game-engine';
import { trpc } from '@/trpc';
import { ShieldAlert, Crown } from 'lucide-react';
import { Timer } from '@/components/common/Timer';
import { ExiliumLogo } from '@/components/landing/ExiliumLogo';
import { useSidebarNewItems } from './useSidebarNewItems';
import {
  ResearchIcon,
  FleetIcon,
  GalaxyIcon,
  MarketIcon,
  MissionsIcon,
  EmpireIcon,
  OverviewIcon,
  ResourcesIcon,
  BuildingsIcon,
  ShipyardIcon,
} from '@/lib/icons';

interface NavItem {
  label: string;
  path: SidebarPath;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

const sections: { title: string; items: NavItem[] }[] = [
  {
    title: 'Planète',
    items: [
      { label: "Vue d'ensemble", path: '/', icon: OverviewIcon },
      { label: 'Ressources', path: '/resources', icon: ResourcesIcon },
      { label: 'Bâtiments', path: '/buildings', icon: BuildingsIcon },
      { label: 'Chantier', path: '/production', icon: ShipyardIcon },
    ],
  },
  {
    title: 'Empire',
    items: [
      { label: 'Colonies', path: '/empire', icon: EmpireIcon },
      { label: 'Politiques', path: '/politiques', icon: Crown as NavItem['icon'] },
      { label: 'Recherche', path: '/research', icon: ResearchIcon },
    ],
  },
  {
    title: 'Galaxie',
    items: [
      { label: 'Galaxie', path: '/galaxy', icon: GalaxyIcon },
      { label: 'Flotte', path: '/fleet', icon: FleetIcon },
      { label: 'Missions', path: '/missions', icon: MissionsIcon },
      { label: 'Marché', path: '/market', icon: MarketIcon },
    ],
  },
  // Alliance + Classement ont migré dans le menu profil (sous l'avatar) pour
  // raccourcir la sidebar — refonte IA « 1 menu, plus court ».
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
    <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-56 lg:flex-col border-r border-border/60 bg-gradient-to-b from-surface-raised/40 to-[hsl(220_50%_4%)]">
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

  // État au repos : l'identité de l'app (wordmark EXILIUM) ancre le coin
  // haut-gauche. Le niveau d'empire vit désormais dans l'en-tête Colonies
  // (refonte IA — fini le doublon « Empire Nv. » top-left + en-tête).
  return (
    <NavLink to="/" end className="flex h-12 shrink-0 items-center border-b border-border/60 px-4 hover:bg-accent transition-colors">
      <ExiliumLogo className="h-5 lg:h-6" />
    </NavLink>
  );
}
