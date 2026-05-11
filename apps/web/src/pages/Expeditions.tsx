import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Compass, Info, Loader2 } from 'lucide-react';
import { trpc } from '@/trpc';
import { useGameConfig } from '@/hooks/useGameConfig';
import { useToastStore } from '@/stores/toast.store';
import { CardGridSkeleton } from '@/components/common/PageSkeleton';
import { ExpeditionMissionCard, ExpeditionInProgressCard } from '@/components/expedition/ExpeditionMissionCard';
import { ExpeditionEventCard, type ExpeditionEvent } from '@/components/expedition/ExpeditionEventCard';
import { EngageFleetModal } from '@/components/expedition/EngageFleetModal';
import { Button } from '@/components/ui/button';

/**
 * Page dédiée aux Missions d'exploration en espace profond.
 * Accessible via /missions/expeditions, lien depuis /missions.
 */
export default function Expeditions() {
  const addToast = useToastStore((s) => s.addToast);
  const utils = trpc.useUtils();
  const { data: gameConfig } = useGameConfig();
  const { data, isLoading, refetch } = trpc.expedition.list.useQuery(undefined, {
    refetchInterval: 30_000, // poll passif tant qu'il n'y a pas de SSE dédié
  });
  const { data: content } = trpc.expeditionContent.get.useQuery();
  const { data: researchData } = trpc.research.list.useQuery();

  const [engageOpen, setEngageOpen] = useState<string | null>(null);
  const [resolvingMissionId, setResolvingMissionId] = useState<string | null>(null);
  const [resolutionToken] = useState(() => crypto.randomUUID());

  const missions = data?.missions ?? [];

  const available = missions.filter((m) => m.status === 'available');
  const inProgress = missions.filter((m) => m.status === 'engaged' || m.status === 'awaiting_decision');
  const awaitingDecision = missions.find((m) => m.status === 'awaiting_decision');

  // Maps utilitaires
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

  const researchNames = useMemo(() => {
    const out: Record<string, string> = {};
    const items = researchData?.items ?? [];
    for (const r of items) {
      out[r.id] = r.name ?? r.id;
    }
    return out;
  }, [researchData]);

  const userResearchLevels = useMemo(() => {
    const out: Record<string, number> = {};
    const items = researchData?.items ?? [];
    for (const r of items) {
      out[r.id] = r.currentLevel ?? 0;
    }
    return out;
  }, [researchData]);

  // Auto-ouverture de l'événement en attente si une mission y est
  useEffect(() => {
    if (awaitingDecision && !resolvingMissionId) {
      setResolvingMissionId(awaitingDecision.id);
    }
  }, [awaitingDecision?.id, resolvingMissionId]);

  const resolveMutation = trpc.expedition.resolveStep.useMutation({
    onSuccess: (res) => {
      addToast(res.resolutionText || 'Événement résolu', 'success');
      utils.expedition.list.invalidate();
      utils.planet.list.invalidate();
      setResolvingMissionId(null);
      refetch();
    },
    onError: (e) => {
      addToast(e.message ?? 'Résolution impossible', 'error');
    },
  });

  const resolvingMission = missions.find((m) => m.id === resolvingMissionId);
  const pendingEvent: ExpeditionEvent | null = useMemo(() => {
    if (!resolvingMission || !content || resolvingMission.status !== 'awaiting_decision') return null;
    const found = content.events.find((e) => e.id === resolvingMission.pendingEventId);
    return found ?? null;
  }, [resolvingMission, content]);

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
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/missions"
            className="p-1.5 rounded-md border border-border/30 hover:bg-card/60 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-cyan-300" />
            <h1 className="text-lg font-bold">Missions d'exploration en espace profond</h1>
          </div>
        </div>
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

      {/* Modal d'événement en cours */}
      {resolvingMission && pendingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-amber-500/40 bg-card/95 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] uppercase tracking-wider text-amber-300">
                {resolvingMission.sectorName} · Étape {resolvingMission.currentStep + 1} sur {resolvingMission.totalSteps}
              </span>
              <Button variant="outline" size="sm" onClick={() => setResolvingMissionId(null)}>
                Fermer
              </Button>
            </div>
            <ExpeditionEventCard
              event={pendingEvent}
              userResearch={userResearchLevels}
              shipsAlive={(resolvingMission.fleetStatus as any)?.shipsAlive ?? {}}
              shipRoles={shipRoles}
              shipNames={shipNames}
              researchNames={researchNames}
              loading={resolveMutation.isPending}
              onChoose={(choiceIndex) => {
                resolveMutation.mutate({
                  missionId: resolvingMission.id,
                  choiceIndex,
                  resolutionToken: crypto.randomUUID(),
                });
              }}
            />
          </div>
        </div>
      )}

      {/* Engage modal */}
      {engageMission && (
        <EngageFleetModal
          open
          onClose={() => setEngageOpen(null)}
          mission={engageMission as any}
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
                onOpen={() => setResolvingMissionId(m.id)}
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
                onEngage={() => setEngageOpen(m.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
