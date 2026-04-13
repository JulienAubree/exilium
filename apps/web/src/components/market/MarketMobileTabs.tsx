import { cn } from '@/lib/utils';
import type { MarketView } from './MarketSidebar';

interface MarketMobileTabsProps {
  view: MarketView;
  onViewChange: (view: MarketView) => void;
}

const RESOURCE_SUB_TABS: { key: MarketView; label: string }[] = [
  { key: 'resource-buy', label: 'Acheter' },
  { key: 'resource-sell', label: 'Vendre' },
  { key: 'resource-my', label: 'Mes offres' },
];

const REPORT_SUB_TABS: { key: MarketView; label: string }[] = [
  { key: 'report-buy', label: 'Acheter' },
  { key: 'report-my', label: 'Mes rapports' },
];

export function MarketMobileTabs({ view, onViewChange }: MarketMobileTabsProps) {
  const isResources = view.startsWith('resource');

  const handleSectionChange = (section: 'resource' | 'report') => {
    if (section === 'resource' && !isResources) {
      onViewChange('resource-buy');
    } else if (section === 'report' && isResources) {
      onViewChange('report-buy');
    }
  };

  const subTabs = isResources ? RESOURCE_SUB_TABS : REPORT_SUB_TABS;

  return (
    <div>
      {/* Line 1: Section toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => handleSectionChange('resource')}
          className={cn(
            'flex-1 py-2 text-sm font-medium rounded-md transition-colors',
            isResources
              ? 'bg-primary/10 text-primary border border-primary/50'
              : 'text-muted-foreground border border-border',
          )}
        >
          Ressources
        </button>
        <button
          onClick={() => handleSectionChange('report')}
          className={cn(
            'flex-1 py-2 text-sm font-medium rounded-md transition-colors',
            !isResources
              ? 'bg-primary/10 text-primary border border-primary/50'
              : 'text-muted-foreground border border-border',
          )}
        >
          Rapports
        </button>
      </div>

      {/* Line 2: Contextual sub-tabs */}
      <div className="flex flex-wrap gap-2 mt-3">
        {subTabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onViewChange(key)}
            className={cn(
              'rounded-md border px-4 py-1.5 text-xs font-medium uppercase tracking-wider transition-all',
              view === key
                ? 'border-primary/50 text-primary bg-primary/10 shadow-[0_0_8px_rgba(103,212,232,0.15)]'
                : 'border-border text-muted-foreground hover:border-white/20 hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
