import { useEffect } from 'react';
import { Outlet, useNavigate, useParams, useLocation } from 'react-router';
import { Zap } from 'lucide-react';
import { trpc } from '@/trpc';
import { usePlanetStore } from '@/stores/planet.store';
import { getVisibleSidebarPaths, type SidebarPath } from '@exilium/game-engine';
import { useMemo } from 'react';
import { TabBar, type TabItem } from '@/components/ui/tabs';
import {
  OverviewIcon,
  ResourcesIcon,
  BuildingsIcon,
  ShipyardIcon,
} from '@/lib/icons';

/** Onglet → clé de visibilité historique (divulgation progressive du tutoriel). */
const PLANET_TABS: { label: string; sub: string; visKey: SidebarPath; icon: TabItem['icon']; end?: boolean }[] = [
  { label: "Vue d'ensemble", sub: '', visKey: '/', icon: OverviewIcon, end: true },
  { label: 'Ressources', sub: 'resources', visKey: '/resources', icon: ResourcesIcon },
  { label: 'Énergie', sub: 'energy', visKey: '/energy', icon: Zap as TabItem['icon'] },
  { label: 'Infrastructures', sub: 'infrastructures', visKey: '/infrastructures', icon: BuildingsIcon },
  { label: 'Production', sub: 'production', visKey: '/production', icon: ShipyardIcon },
];

/**
 * Drill-down planète du shell « Empire-first » : la planète n'est plus un
 * monde parallèle mais un détail de l'Empire, adressable (/planet/:id).
 * En-tête : retour Empire + sélecteur + ressources ; puis onglets.
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

  const { data: tutorialData } = trpc.tutorial.getCurrent.useQuery();
  const isComplete = tutorialData?.isComplete ?? false;
  const parsedChapter = tutorialData?.chapter
    ? Number.parseInt(tutorialData.chapter.id.replace('chapter_', ''), 10)
    : NaN;
  const chapterOrder = Number.isFinite(parsedChapter) ? parsedChapter : (isComplete ? 4 : 1);
  const colonyCount = planets?.length ?? 1;
  const visiblePaths = useMemo(
    () => getVisibleSidebarPaths({ chapterOrder, isComplete, colonyCount }),
    [chapterOrder, isComplete, colonyCount],
  );

  const tabs: TabItem[] = PLANET_TABS
    .filter((t) => visiblePaths.has(t.visKey))
    .map((t) => ({
      label: t.label,
      icon: t.icon,
      to: t.sub ? `/planet/${planetId}/${t.sub}` : `/planet/${planetId}`,
      end: t.end,
    }));

  return (
    <div>
      {/* Onglets seuls — le contexte (retour, sélecteur, ressources) vit
          désormais dans la GlobalTopbar : une seule barre. */}
      <div className="sticky top-0 lg:top-12 z-30 border-b border-border bg-surface">
        {!isColonizing && tabs.length > 0 && (
          <TabBar items={tabs} ariaLabel="Navigation planète" className="border-b-0" />
        )}
      </div>

      <Outlet context={{ planetId: planetId ?? null, planetClassId: planet?.planetClassId ?? null }} />
    </div>
  );
}
