import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { usePlanetStore } from '@/stores/planet.store';
import { reconcileActivePlanetUrl } from './activePlanetUrl.logic';

interface PlanetLike {
  id: string;
}

/**
 * Mirrors the active planet into the URL (`?planet=<id>`) so a planet view is
 * addressable — refresh, shared links and the Back button all preserve which
 * planet you are viewing (feedback R6/R7/R8). The zustand store stays the
 * source of truth read by the rest of the app; this hook only bridges it with
 * the URL in both directions. Mount once (in Layout), passing the player's
 * planets and the already-resolved active planet id.
 */
export function useActivePlanetUrl(planets: PlanetLike[] | undefined, resolvedId: string | null) {
  const [searchParams, setSearchParams] = useSearchParams();
  const setActivePlanet = usePlanetStore((s) => s.setActivePlanet);
  const urlPlanetId = searchParams.get('planet');

  const prevUrl = useRef<string | null>(urlPlanetId);
  const prevResolved = useRef<string | null>(resolvedId);
  const initialized = useRef(false);

  useEffect(() => {
    if (!planets) return; // wait for the planet list before touching the URL

    const isValidUrl = !!urlPlanetId && planets.some((p) => p.id === urlPlanetId);
    const action = reconcileActivePlanetUrl({
      urlPlanetId,
      resolvedId,
      prevUrl: prevUrl.current,
      prevResolved: prevResolved.current,
      isValidUrl,
      initialized: initialized.current,
    });

    initialized.current = true;
    prevUrl.current = urlPlanetId;
    prevResolved.current = resolvedId;

    if (action.type === 'set-store') {
      setActivePlanet(action.id);
    } else if (action.type === 'set-url') {
      const id = action.id;
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('planet', id);
          return next;
        },
        { replace: action.replace },
      );
    }
  }, [planets, urlPlanetId, resolvedId, setActivePlanet, setSearchParams]);
}
