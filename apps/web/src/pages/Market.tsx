import { useState } from 'react';
import { useOutletContext, useSearchParams, Link } from 'react-router';
import { trpc } from '@/trpc';
import { useGameConfig } from '@/hooks/useGameConfig';
import { PageHeader } from '@/components/common/PageHeader';
import { MarketSidebar, type MarketView, MARKET_VIEWS } from '@/components/market/MarketSidebar';
import { MarketMobileTabs } from '@/components/market/MarketMobileTabs';
import { ResourceBuy } from '@/components/market/ResourceBuy';
import { ResourceSell } from '@/components/market/ResourceSell';
import { ResourceMyOffers } from '@/components/market/ResourceMyOffers';
import { MarketReportsBuy } from '@/components/market/MarketReportsBuy';
import { MarketReportsInventory } from '@/components/market/MarketReportsInventory';

export default function Market() {
  const { planetId } = useOutletContext<{ planetId?: string }>();
  const { data: gameConfig } = useGameConfig();
  const [searchParams] = useSearchParams();
  const initialView = searchParams.get('view');
  const [view, setView] = useState<MarketView>(
    initialView && MARKET_VIEWS.includes(initialView as MarketView)
      ? (initialView as MarketView)
      : 'resource-buy',
  );

  const commissionPercent = Number(gameConfig?.universe?.market_commission_percent) || 5;

  const { data: buildings } = trpc.building.list.useQuery(
    { planetId: planetId! },
    { enabled: !!planetId },
  );
  const marketLevel = buildings?.find((b) => b.id === 'galacticMarket')?.currentLevel ?? 0;

  return (
    <div className="space-y-4 p-4 lg:space-y-6 lg:p-6">
      <PageHeader title="Marche Galactique" />

      {buildings && marketLevel < 1 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <svg className="h-12 w-12 mb-4 text-muted-foreground/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <p className="text-sm text-muted-foreground mb-2">
            Avant de pouvoir acceder au marche, veuillez construire le <span className="text-foreground font-semibold">Marche Galactique</span>.
          </p>
          <Link to="/buildings" className="text-xs text-primary hover:underline">
            Aller aux batiments
          </Link>
        </div>
      ) : (
        <div className="flex">
          {/* Desktop sidebar */}
          <div className="hidden lg:block">
            <MarketSidebar view={view} onViewChange={setView} />
          </div>

          <div className="flex-1 min-w-0">
            {/* Mobile tabs */}
            <div className="lg:hidden mb-4">
              <MarketMobileTabs view={view} onViewChange={setView} />
            </div>

            {/* Content */}
            <div className="glass-card p-4 lg:p-5">
              {view === 'resource-buy' && planetId && <ResourceBuy planetId={planetId} />}
              {view === 'resource-sell' && planetId && <ResourceSell planetId={planetId} commissionPercent={commissionPercent} />}
              {view === 'resource-my' && planetId && <ResourceMyOffers planetId={planetId} />}
              {view === 'report-buy' && planetId && <MarketReportsBuy planetId={planetId} />}
              {view === 'report-my' && planetId && <MarketReportsInventory planetId={planetId} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
