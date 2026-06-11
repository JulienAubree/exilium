import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router';
import { cn } from '@/lib/utils';
import { CardGridSkeleton } from '@/components/common/PageSkeleton';
import { ShipyardIcon, DefenseIcon } from '@/lib/icons';

const Shipyard = lazy(() => import('./Shipyard'));
const Defense = lazy(() => import('./Defense'));

type ProductionTab = 'vaisseaux' | 'defenses';

const TABS: { id: ProductionTab; label: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }[] = [
  { id: 'vaisseaux', label: 'Vaisseaux', icon: ShipyardIcon },
  { id: 'defenses', label: 'Défenses', icon: DefenseIcon },
];

/** Anciennes URLs (?tab=utilitaires / ?tab=combat) : le chantier fusionné. */
const LEGACY_TABS: Record<string, ProductionTab> = { utilitaires: 'vaisseaux', combat: 'vaisseaux' };

/**
 * Page Production : Vaisseaux (le Chantier spatial fusionné, catalogue
 * complet par rôles) + Défenses (l'Arsenal).
 * L'onglet vit dans ?tab= pour que les anciennes URLs redirigées tombent juste.
 */
export default function Production() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const tabParam = (rawTab && LEGACY_TABS[rawTab]) || rawTab;
  const tab: ProductionTab = TABS.some((t) => t.id === tabParam) ? (tabParam as ProductionTab) : 'vaisseaux';

  return (
    <div>
      <nav aria-label="Navigation production" className="border-b border-border/50 bg-card/40">
        <ul className="flex items-center gap-1 px-4 py-1.5 overflow-x-auto lg:px-6">
          {TABS.map((t) => (
            <li key={t.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setSearchParams({ tab: t.id }, { replace: true })}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap',
                  tab === t.id
                    ? 'bg-primary/15 text-primary border border-primary/30'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground border border-transparent',
                )}
              >
                <t.icon width={16} height={16} />
                <span>{t.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <Suspense fallback={<div className="p-4 lg:p-6"><CardGridSkeleton count={4} /></div>}>
        {tab === 'vaisseaux' && <Shipyard />}
        {tab === 'defenses' && <Defense />}
      </Suspense>
    </div>
  );
}
