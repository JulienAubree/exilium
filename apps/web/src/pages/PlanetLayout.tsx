import { useEffect } from 'react';
import { Outlet, useNavigate, useParams, useLocation } from 'react-router';
import { trpc } from '@/trpc';
import { usePlanetStore } from '@/stores/planet.store';

/**
 * Drill-down planète du shell « Empire-first » : la planète est un détail
 * de l'Empire, adressable (/planet/:id). Tout le chrome (retour, sélecteur,
 * onglets, ressources) vit dans la GlobalTopbar en mode focus — ce layout
 * ne porte plus que la logique : sync du store, garde-fous, contexte.
 * Spec : docs/plans/2026-06-10-shell-empire-first.md
 */
export default function PlanetLayout() {
  const { planetId } = useParams<{ planetId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: planets } = trpc.planet.list.useQuery();
  const setActivePlanet = usePlanetStore((s) => s.setActivePlanet);

  const planet = planets?.find((p) => p.id === planetId);

  // L'URL est la source de vérité — on synchronise le store (sélecteur
  // mobile, pages hors drill-down) sur elle.
  useEffect(() => {
    if (planetId) setActivePlanet(planetId);
  }, [planetId, setActivePlanet]);

  // Planète inconnue (supprimée/abandonnée) → retour au home Empire.
  useEffect(() => {
    if (planets && planetId && !planets.find((p) => p.id === planetId)) {
      navigate('/', { replace: true });
    }
  }, [planets, planetId, navigate]);

  const isColonizing = planet?.status === 'colonizing';
  const atIndex = location.pathname === `/planet/${planetId}`;
  // En colonisation, seule la Vue d'ensemble (qui affiche la progression) est accessible.
  useEffect(() => {
    if (isColonizing && !atIndex) {
      navigate(`/planet/${planetId}`, { replace: true });
    }
  }, [isColonizing, atIndex, navigate, planetId]);

  return <Outlet context={{ planetId: planetId ?? null, planetClassId: planet?.planetClassId ?? null }} />;
}
