import { useEffect, useMemo } from 'react';
import { Outlet, useLocation } from 'react-router';
import { TopBar } from './TopBar';
import { ResourceBar } from './ResourceBar';
import { BottomTabBar } from './BottomTabBar';
import { GlobalTopbar } from './GlobalTopbar';
import { Toaster } from '@/components/ui/Toaster';
import { OfflineBanner } from '@/components/pwa/OfflineBanner';
import { AnnouncementBanner } from './AnnouncementBanner';
import { EmailVerificationBanner } from './EmailVerificationBanner';
import { ChatOverlay } from '@/components/chat/ChatOverlay';
import { FloatingFeedbackButton } from '@/components/feedback/FloatingFeedbackButton';
import { PanelManager } from '@/components/panels/PanelManager';
import { AbsenceSummaryModal } from '@/components/AbsenceSummaryModal';
import { trpc } from '@/trpc';
import { usePlanetStore } from '@/stores/planet.store';
import { useNotifications } from '@/hooks/useNotifications';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { HostileAlertBanner } from '@/components/fleet/HostileAlertBanner';

export function Layout() {
  const { data: planets } = trpc.planet.list.useQuery();
  const activePlanetId = usePlanetStore((s) => s.activePlanetId);
  const setActivePlanet = usePlanetStore((s) => s.setActivePlanet);
  const location = useLocation();

  // Trust localStorage activePlanetId while planet.list is loading
  // This avoids a query waterfall: dependent queries can fire immediately
  const resolvedPlanetId = planets
    ? (planets.find((p) => p.id === activePlanetId) ? activePlanetId : planets[0]?.id ?? null)
    : activePlanetId;

  useEffect(() => {
    if (resolvedPlanetId && resolvedPlanetId !== activePlanetId) {
      setActivePlanet(resolvedPlanetId);
    }
  }, [resolvedPlanetId, activePlanetId, setActivePlanet]);

  // (Le verrouillage colonisation vit désormais dans PlanetLayout.)
  const activePlanet = planets?.find((p) => p.id === resolvedPlanetId);
  const onPlanetRoute = location.pathname.startsWith('/planet/');

  useNotifications();
  useDocumentTitle();

  const { data: inboundFleets } = trpc.fleet.inbound.useQuery();
  const hostileFleets = useMemo(
    () => (inboundFleets ?? []).filter((f) => f.hostile),
    [inboundFleets],
  );

  return (
    <div className="flex h-viewport flex-col bg-background bg-stars text-foreground">
      {/* Skip-to-content for keyboard users — visible only when focused. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg"
      >
        Aller au contenu
      </a>

      {/* Main area — plus de sidebar : la nav vit dans GlobalTopbar (desktop)
          et BottomTabBar (mobile) */}
      <div className="flex flex-1 flex-col min-h-0">
        <TopBar planetId={resolvedPlanetId} planets={planets ?? []} />
        <OfflineBanner />
        <EmailVerificationBanner />
        <AnnouncementBanner />
        {onPlanetRoute && <ResourceBar planetId={resolvedPlanetId} />}
        <HostileAlertBanner hostileFleets={hostileFleets} fixed />

        {/* Page content — scrolls independently; the mobile BottomTabBar
            below is a flex sibling, so it is anchored naturally at the
            bottom of the viewport without position:fixed. */}
        <main id="main-content" className="flex-1 overflow-y-auto min-h-0">
          {/* Nav fantôme DANS le conteneur de scroll : les héros qui remontent
              en -mt-12 peignent leur atmosphère derrière elle (fusion). */}
          <GlobalTopbar />
          <div className="mx-auto w-full lg:max-w-7xl">
            <Outlet context={{ planetId: resolvedPlanetId, planetClassId: activePlanet?.planetClassId ?? null }} />
          </div>
        </main>

        {/* Mobile/tablet bottom navigation (flex sibling, not fixed) */}
        <BottomTabBar />
      </div>

      <PanelManager />
      <FloatingFeedbackButton />

      <ChatOverlay />
      <Toaster />
      <AbsenceSummaryModal />
    </div>
  );
}
