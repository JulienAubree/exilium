import { cn } from '@/lib/utils';

export type MarketView =
  | 'resource-buy'
  | 'resource-sell'
  | 'resource-my'
  | 'report-buy'
  | 'report-my';

export const MARKET_VIEWS: MarketView[] = [
  'resource-buy', 'resource-sell', 'resource-my', 'report-buy', 'report-my',
];

interface MarketSidebarProps {
  view: MarketView;
  onViewChange: (view: MarketView) => void;
}

const RESOURCE_ITEMS: { key: MarketView; label: string }[] = [
  { key: 'resource-buy', label: 'Acheter' },
  { key: 'resource-sell', label: 'Vendre' },
  { key: 'resource-my', label: 'Mes offres' },
];

const REPORT_ITEMS: { key: MarketView; label: string }[] = [
  { key: 'report-buy', label: 'Acheter' },
  { key: 'report-my', label: 'Mes rapports' },
];

export function MarketSidebar({ view, onViewChange }: MarketSidebarProps) {
  return (
    <aside className="w-[180px] flex-shrink-0 bg-black/30 border-r border-cyan-500/10 py-2">
      {/* Resources section */}
      <div className="text-[10px] uppercase tracking-wider px-4 pt-4 pb-1 text-orange-400/70">
        Ressources
      </div>
      {RESOURCE_ITEMS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onViewChange(key)}
          className={cn(
            'block w-full text-left px-4 py-2.5 text-sm transition-colors border-l-2',
            view === key
              ? 'bg-cyan-500/10 text-primary border-primary'
              : 'text-muted-foreground hover:bg-white/5 border-transparent',
          )}
        >
          {label}
        </button>
      ))}

      {/* Separator */}
      <div className="border-t border-white/10 mx-4 my-2" />

      {/* Reports section */}
      <div className="text-[10px] uppercase tracking-wider px-4 pt-4 pb-1 text-purple-400/70">
        Rapports
      </div>
      {REPORT_ITEMS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onViewChange(key)}
          className={cn(
            'block w-full text-left px-4 py-2.5 text-sm transition-colors border-l-2',
            view === key
              ? 'bg-cyan-500/10 text-primary border-primary'
              : 'text-muted-foreground hover:bg-white/5 border-transparent',
          )}
        >
          {label}
        </button>
      ))}
    </aside>
  );
}
