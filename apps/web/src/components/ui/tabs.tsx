import { NavLink } from 'react-router';
import { cn } from '@/lib/utils';

export interface TabItem {
  label: string;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  /** Lien (NavLink) — exclusif avec onClick. */
  to?: string;
  end?: boolean;
  /** Onglet contrôlé — exclusif avec to. */
  active?: boolean;
  onClick?: () => void;
}

const TAB_BASE =
  'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors duration-fast ease-standard border';
const TAB_ACTIVE = 'bg-primary/15 text-primary border-primary/30';
const TAB_INACTIVE = 'text-muted-foreground hover:bg-accent hover:text-foreground border-transparent';

/**
 * Barre d'onglets du design system — utilisée par les hubs (Flotte),
 * Production, Classements et les futurs drill-downs. Une seule
 * implémentation pour les deux modes : navigation (to) ou contrôlé (active).
 */
export function TabBar({ items, ariaLabel, className }: {
  items: TabItem[];
  ariaLabel: string;
  className?: string;
}) {
  return (
    <nav aria-label={ariaLabel} className={cn('border-b border-border/50', className)}>
      <ul className="flex items-center gap-1 px-4 py-1.5 overflow-x-auto lg:px-6">
        {items.map((item) => (
          <li key={item.label} className="shrink-0">
            {item.to ? (
              <NavLink
                viewTransition
                to={item.to}
                end={item.end}
                className={({ isActive }) => cn(TAB_BASE, isActive ? TAB_ACTIVE : TAB_INACTIVE)}
              >
                {item.icon && <item.icon width={16} height={16} />}
                <span>{item.label}</span>
              </NavLink>
            ) : (
              <button
                type="button"
                onClick={item.onClick}
                className={cn(TAB_BASE, item.active ? TAB_ACTIVE : TAB_INACTIVE)}
              >
                {item.icon && <item.icon width={16} height={16} />}
                <span>{item.label}</span>
              </button>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
