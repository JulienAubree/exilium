import { useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router';
import { ArrowLeft, Compass, Info } from 'lucide-react';
import { trpc } from '@/trpc';
import { useGameConfig } from '@/hooks/useGameConfig';
import { CardGridSkeleton } from '@/components/common/PageSkeleton';
import { ExpeditionMissionCard, ExpeditionInProgressCard } from '@/components/expedition/ExpeditionMissionCard';
import { EngageFleetModal } from '@/components/expedition/EngageFleetModal';

/**
 * Page d'aperçu des Missions d'exploration en espace profond.
 * Liste les offres disponibles + missions en cours.
 * Le détail / résolution d'événement se passe sur /missions/expeditions/:missionId.
 */
export default function Expeditions() {
  const navigate = useNavigate();
  // Récupère la planète courante du layout pour la pré-sélectionner dans
  // le modal d'engagement.
  const layoutContext = useOutletContext<{ planetId?: string } | null>();
  const currentPlanetId = layoutContext?.planetId;
  const { data: gameConfig } = useGameConfig();
  const { data, isLoading, refetch } = trpc.expedition.list.useQuery(undefined, {
    refetchInterval: 10_000,
  });
  const { data: content } = trpc.expeditionContent.get.useQuery();

  const [engageOpen, setEngageOpen] = useState<string | null>(null);

  const missions = data?.missions ?? [];
  const available = missions.filter((m) => m.status === 'available');
  const inProgress = missions.filter(
    (m) => m.status === 'engaged' || m.status === 'awaiting_decision' || m.status === 'returning',
  );

  const shipNames = useMemo(() => {
    if (!gameConfig?.ships) return {} as Record<string, string>;
    const out: Record<string, string> = {};
    for (const [id, def] of Object.entries(gameConfig.ships as Record<string, any>)) {
      out[id] = def.name ?? id;
    }
    return out;
  }, [gameConfig]);

  const shipRoles = useMemo(() => {
    if (!gameConfig?.ships) return {} as Record<string, string>;
    const out: Record<string, string> = {};
    for (const [id, def] of Object.entries(gameConfig.ships as Record<string, any>)) {
      if (def.role) out[id] = def.role;
    }
    return out;
  }, [gameConfig]);

  // Map sectorId → image url (uploadée admin)
  const sectorImages = useMemo(() => {
    const out: Record<string, string> = {};
    for (const s of content?.sectors ?? []) {
      if (s.imageRef) out[s.id] = s.imageRef;
    }
    return out;
  }, [content]);

  const engageMission = available.find((m) => m.id === engageOpen) ?? null;

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <div className="h-12 bg-card/30 animate-pulse rounded" />
        <CardGridSkeleton count={3} />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 lg:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/missions"
          className="p-1.5 rounded-md border border-border/30 hover:bg-card/60 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <Compass className="h-5 w-5 text-cyan-300" />
        <h1 className="text-lg font-bold">Missions d'exploration en espace profond</h1>
      </div>

      {/* Info banner */}
      <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
        <div className="flex items-start gap-2">
          <Info className="h-3.5 w-3.5 text-cyan-300 shrink-0 mt-0.5" />
          <span className="text-xs text-muted-foreground">
            Engagez une flotte dans un secteur narratif. La mission se déroule en plusieurs étapes,
            chacune avec un événement à choix. Vos vaisseaux sont indisponibles ailleurs pendant la durée du run.
            Récompenses limitées par la <span className="text-cyan-200">capacité de soute</span> de votre flotte.
          </span>
        </div>
      </div>

      {/* Engage modal */}
      {engageMission && (
        <EngageFleetModal
          open
          onClose={() => setEngageOpen(null)}
          mission={engageMission as any}
          defaultPlanetId={currentPlanetId}
          onEngaged={() => refetch()}
        />
      )}

      {/* Missions en cours */}
      {inProgress.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            En cours ({inProgress.length})
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {inProgress.map((m) => (
              <ExpeditionInProgressCard
                key={m.id}
                mission={m as any}
                shipNames={shipNames}
                shipRoles={shipRoles}
                sectorImage={sectorImages[m.sectorId]}
                onOpen={() => navigate(`/missions/expeditions/${m.id}`)}
                onTimerComplete={() => refetch()}
              />
            ))}
          </div>
        </section>
      )}

      {/* Offres disponibles */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Disponibles ({available.length}/3)
        </h2>
        {available.length === 0 ? (
          <div className="rounded-lg border border-border/30 bg-card/30 p-6 text-center text-sm text-muted-foreground">
            {missions.length === 0
              ? "Aucune offre pour le moment. Reviens plus tard — le pool se reconstitue automatiquement."
              : "Tu as engagé toutes les offres disponibles. Termine une mission pour en débloquer une nouvelle."}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {available.map((m) => (
              <ExpeditionMissionCard
                key={m.id}
                mission={m as any}
                sectorImage={sectorImages[m.sectorId]}
                onEngage={() => setEngageOpen(m.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
