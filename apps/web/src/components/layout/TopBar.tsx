import { useLocation, useNavigate } from 'react-router';
import { useGameConfig } from '@/hooks/useGameConfig';
import { PlanetSelectorDropdown } from './topbar/PlanetSelectorDropdown';
import { TopBarActions } from './topbar/TopBarActions';

interface Planet {
  id: string;
  name: string;
  galaxy: number;
  system: number;
  position: number;
  planetClassId: string | null;
  planetImageIndex: number | null;
  status?: string;
}

/**
 * Mobile-only topbar. Affiche le sélecteur de planète sur les routes
 * /planet/* (drill-down), la marque ailleurs. Le pendant desktop est
 * GlobalTopbar ; le contexte planète vit dans PlanetLayout.
 */
export function TopBar({ planetId, planets }: { planetId: string | null; planets: Planet[] }) {
  useGameConfig();
  const location = useLocation();
  const navigate = useNavigate();
  const onPlanetRoute = location.pathname.startsWith('/planet/');

  return (
    <header className="sticky top-0 z-40 flex min-h-12 items-center justify-between border-b border-white/10 bg-card/80 backdrop-blur-md px-4 pt-[env(safe-area-inset-top)] lg:hidden">
      {onPlanetRoute ? (
        <PlanetSelectorDropdown
          planetId={planetId}
          planets={planets}
          onSelect={(id) => {
            const sub = location.pathname.split('/').slice(3).join('/');
            navigate(sub ? `/planet/${id}/${sub}` : `/planet/${id}`);
          }}
        />
      ) : (
        <span className="text-sm font-semibold text-foreground">Exilium</span>
      )}
      <TopBarActions />
    </header>
  );
}
