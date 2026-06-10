import { Navigate, useLocation } from 'react-router';
import { trpc } from '@/trpc';
import { usePlanetStore } from '@/stores/planet.store';

/**
 * Compat shell « Empire-first » : les anciens chemins planète globaux
 * (/resources, /production…) redirigent vers le drill-down de la planète
 * active (querystring préservée — les chaînes /shipyard → /production?tab=…
 * continuent de fonctionner par rebond).
 */
export function RedirectToActivePlanet({ sub }: { sub?: string }) {
  const { data: planets } = trpc.planet.list.useQuery();
  const activePlanetId = usePlanetStore((s) => s.activePlanetId);
  const location = useLocation();

  const planetId =
    (planets?.find((p) => p.id === activePlanetId) ? activePlanetId : planets?.[0]?.id) ??
    activePlanetId;

  if (!planetId) return null; // planètes en cours de chargement, pas de store — attendre

  const target = sub ? `/planet/${planetId}/${sub}` : `/planet/${planetId}`;
  return <Navigate to={`${target}${location.search}`} replace />;
}
