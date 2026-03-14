import { NavLink, useLocation } from 'react-router';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/ui.store';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useEffect } from 'react';
import {
  OverviewIcon,
  ResourcesIcon,
  BuildingsIcon,
  ResearchIcon,
  ShipyardIcon,
  DefenseIcon,
  FleetIcon,
  GalaxyIcon,
  MovementsIcon,
  MessagesIcon,
  RankingIcon,
  AllianceIcon,
  AllianceRankingIcon,
} from '@/lib/icons';

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

const sections: { title: string; items: NavItem[] }[] = [
  {
    title: 'Economie',
    items: [
      { label: "Vue d'ensemble", path: '/', icon: OverviewIcon },
      { label: 'Ressources', path: '/resources', icon: ResourcesIcon },
      { label: 'Bâtiments', path: '/buildings', icon: BuildingsIcon },
      { label: 'Recherche', path: '/research', icon: ResearchIcon },
    ],
  },
  {
    title: 'Militaire',
    items: [
      { label: 'Chantier spatial', path: '/shipyard', icon: ShipyardIcon },
      { label: 'Défense', path: '/defense', icon: DefenseIcon },
      { label: 'Flotte', path: '/fleet', icon: FleetIcon },
      { label: 'Galaxie', path: '/galaxy', icon: GalaxyIcon },
      { label: 'Mouvements', path: '/movements', icon: MovementsIcon },
    ],
  },
  {
    title: 'Social',
    items: [
      { label: 'Messages', path: '/messages', icon: MessagesIcon },
      { label: 'Classement', path: '/ranking', icon: RankingIcon },
      { label: 'Alliance', path: '/alliance', icon: AllianceIcon },
      { label: 'Classement Alliances', path: '/alliance-ranking', icon: AllianceRankingIcon },
    ],
  },
];

export function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const closeSidebar = useUIStore((s) => s.closeSidebar);
  const isMobile = useMediaQuery('(max-width: 767px)');
  const location = useLocation();

  // Auto-close on mobile navigation
  useEffect(() => {
    if (isMobile) closeSidebar();
  }, [location.pathname, isMobile, closeSidebar]);

  const sidebarContent = (
    <aside
      className={cn(
        'flex h-full w-56 flex-col border-r border-border/50 bg-card/80 backdrop-blur-sm',
        isMobile && 'fixed inset-y-0 left-0 z-50 animate-slide-in-left shadow-2xl',
      )}
    >
      <div className="flex h-14 items-center border-b border-border/50 px-4">
        <span className="text-lg font-bold text-primary glow-crystal">Stellar Empires</span>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {sections.map((section, idx) => (
          <div key={section.title}>
            {idx > 0 && <div className="mx-3 my-2 border-t border-border/30" />}
            <p className="mb-1 px-3 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    end={item.path === '/'}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                        isActive
                          ? 'border-l-2 border-primary bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                      )
                    }
                  >
                    <item.icon width={18} height={18} />
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );

  // Desktop: always visible
  if (!isMobile) return sidebarContent;

  // Mobile: overlay
  if (!sidebarOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={closeSidebar}
      />
      {sidebarContent}
    </>
  );
}
