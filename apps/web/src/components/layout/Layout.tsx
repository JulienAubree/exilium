import { useEffect, useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { TopBar } from './TopBar';
import { ResourceBar } from './ResourceBar';
import { Sidebar } from './Sidebar';
import { BottomTabBar } from './BottomTabBar';
import { PlanetSubnav } from './PlanetSubnav';
import { Toaster } from '@/components/ui/Toaster';
import { UpdatePrompt } from '@/components/pwa/UpdatePrompt';
import { OfflineBanner } from '@/components/pwa/OfflineBanner';
import { AnnouncementBanner } from './AnnouncementBanner';
import { EmailVerificationBanner } from './EmailVerificationBanner';
import { ChatOverlay } from '@/components/chat/ChatOverlay';
import { FloatingFeedbackButton } from '@/components/feedback/FloatingFeedbackButton';
import { trpc } from '@/trpc';
import { usePlanetStore } from '@/stores/planet.store';
import { useNotifications } from '@/hooks/useNotifications';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { HostileAlertBanner } from '@/components/fleet/HostileAlertBanner';

// Pages that are planet-specific and should redirect when the active planet
// is being colonized.  Empire-wide pages (/empire, /fleet, etc.) are NOT
// redirected — only pages that operate on a single planet.
const PLANET_PAGES = ['/', '/resources', '/infrastructures', '/energy', '/shipyard', '/command-center', '/defense'];

export function Layout() {
  const { data: planets } = trpc.planet.list.useQuery();
  const activePlanetId = usePlanetStore((s) => s.activePlanetId);
  const setActivePlanet = usePlanetStore((s) => s.setActivePlanet);
  const location = useLocation();
  const navigate = useNavigate();

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

  // Redirect planet-specific pages to Overview when active planet is colonizing.
  // Overview itself handles the ColonizationProgress display.
  const activePlanet = planets?.find((p) => p.id === resolvedPlanetId);
  useEffect(() => {
    if (
      activePlanet?.status === 'colonizing' &&
      PLANET_PAGES.includes(location.pathname) &&
      location.pathname !== '/'
    ) {
      navigate('/', { replace: true });
    }
  }, [activePlanet?.status, location.pathname, navigate]);

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

      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main area */}
      <div className="flex flex-1 flex-col min-h-0 lg:ml-56">
        <TopBar planetId={resolvedPlanetId} planets={planets ?? []} />
        <OfflineBanner />
        <EmailVerificationBanner />
        <AnnouncementBanner />
        <ResourceBar planetId={resolvedPlanetId} />
        <PlanetSubnav />
        <HostileAlertBanner hostileFleets={hostileFleets} fixed />

        {/* Page content — scrolls independently; the mobile BottomTabBar
            below is a flex sibling, so it is anchored naturally at the
            bottom of the viewport without position:fixed. */}
        <main id="main-content" className="flex-1 overflow-y-auto min-h-0">
          <div className="mx-auto lg:max-w-6xl">
            <Outlet context={{ planetId: resolvedPlanetId, planetClassId: activePlanet?.planetClassId ?? null }} />
          </div>
        </main>

        {/* Mobile/tablet bottom navigation (flex sibling, not fixed) */}
        <BottomTabBar />
      </div>

      <FloatingFeedbackButton />

      <ChatOverlay />
      <Toaster />
      <UpdatePrompt />
    </div>
  );
}
