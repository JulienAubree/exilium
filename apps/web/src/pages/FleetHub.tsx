import { NavLink, Outlet, useOutletContext } from 'react-router';
import { cn } from '@/lib/utils';
import { FleetIcon, FlagshipIcon } from '@/lib/icons';
import { Send, Radar, Anchor, FileText } from 'lucide-react';

interface HubTab {
  label: string;
  path: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  end?: boolean;
}

const TABS: HubTab[] = [
  { label: 'Dashboard', path: '/fleet', icon: FleetIcon, end: true },
  { label: 'Envoyer', path: '/fleet/send', icon: Send as HubTab['icon'] },
  { label: 'Mouvements', path: '/fleet/movements', icon: Radar as HubTab['icon'] },
  { label: 'Stationnées', path: '/fleet/stationed', icon: Anchor as HubTab['icon'] },
  { label: 'Vaisseau amiral', path: '/fleet/flagship', icon: FlagshipIcon },
  { label: 'Rapports', path: '/fleet/reports', icon: FileText as HubTab['icon'] },
];

/**
 * Hub Flotte : tout le parcours — armer, envoyer, suivre, débriefer — sous
 * une seule navigation interne (refonte IA, lot 1).
 * Relaie le contexte d'Outlet du Layout (planetId/planetClassId) aux pages.
 */
export default function FleetHub() {
  const ctx = useOutletContext<{ planetId?: string; planetClassId?: string | null }>();

  return (
    <div>
      <nav aria-label="Navigation flotte" className="border-b border-border/50 bg-card/40">
        <ul className="flex items-center gap-1 px-4 py-1.5 overflow-x-auto lg:px-6">
          {TABS.map((tab) => (
            <li key={tab.path} className="shrink-0">
              <NavLink
                to={tab.path}
                end={tab.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap',
                    isActive
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground border border-transparent',
                  )
                }
              >
                <tab.icon width={16} height={16} />
                <span>{tab.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <Outlet context={ctx} />
    </div>
  );
}
