import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  ArrowLeft, Compass, MapPin, Clock, Fuel, Package, Anchor,
  Sparkles, AlertTriangle, CheckCircle2, XCircle, Skull, Coins, LogOut,
} from 'lucide-react';
import { trpc } from '@/trpc';
import { useGameConfig } from '@/hooks/useGameConfig';
import { useToastStore } from '@/stores/toast.store';
import { Timer } from '@/components/common/Timer';
import { CardGridSkeleton } from '@/components/common/PageSkeleton';
import { Button } from '@/components/ui/button';
import { ExiliumIcon } from '@/components/common/ExiliumIcon';
import { ExpeditionEventCard, type ExpeditionEvent } from '@/components/expedition/ExpeditionEventCard';
import { cn } from '@/lib/utils';

const TIER_LABEL = {
  early: 'Initial',
  mid: 'Intermédiaire',
  deep: 'Profond',
} as const;

const TIER_COLOR = {
  early: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  mid: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  deep: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
} as const;

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  engaged: { label: 'En route', color: 'text-cyan-300' },
  awaiting_decision: { label: 'Décision requise', color: 'text-amber-300' },
  completed: { label: 'Terminée', color: 'text-emerald-300' },
  failed: { label: 'Flotte perdue', color: 'text-rose-300' },
  expired: { label: 'Expirée', color: 'text-muted-foreground' },
};

/**
 * Page détail d'une expédition en espace profond. Pendant : affichage live
 * du run avec composition flotte, soute, journal narratif, et résolution
 * d'événement en attente. Après : récap final (succès ou échec).
 */
export default function ExpeditionRun() {
  const { missionId } = useParams<{ missionId: string }>();
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);
  const utils = trpc.useUtils();
  const { data: gameConfig } = useGameConfig();
  const { data: researchData } = trpc.research.list.useQuery();
  const { data: content } = trpc.expeditionContent.get.useQuery();

  const { data: mission, isLoading, refetch } = trpc.expedition.getDetail.useQuery(
    { missionId: missionId! },
    { enabled: !!missionId, refetchInterval: 15_000 },
  );

  const shipNames = useMemo(() => {
    const out: Record<string, string> = {};
    if (!gameConfig?.ships) return out;
    for (const [id, def] of Object.entries(gameConfig.ships as Record<string, any>)) {
      out[id] = def.name ?? id;
    }
    return out;
  }, [gameConfig]);

  const shipRoles = useMemo(() => {
    const out: Record<string, string> = {};
    if (!gameConfig?.ships) return out;
    for (const [id, def] of Object.entries(gameConfig.ships as Record<string, any>)) {
      if (def.role) out[id] = def.role;
    }
    return out;
  }, [gameConfig]);

  const researchNames = useMemo(() => {
    const out: Record<string, string> = {};
    for (const r of researchData?.items ?? []) out[r.id] = r.name ?? r.id;
    return out;
  }, [researchData]);

  const userResearchLevels = useMemo(() => {
    const out: Record<string, number> = {};
    for (const r of researchData?.items ?? []) out[r.id] = r.currentLevel ?? 0;
    return out;
  }, [researchData]);

  const [eventOpen, setEventOpen] = useState(false);

  // Auto-ouvre l'événement quand la mission est en attente de décision
  useEffect(() => {
    if (mission?.status === 'awaiting_decision') setEventOpen(true);
  }, [mission?.status]);

  const resolveMutation = trpc.expedition.resolveStep.useMutation({
    onSuccess: (res) => {
      addToast(res.resolutionText || 'Événement résolu', 'success');
      utils.expedition.list.invalidate();
      utils.expedition.getDetail.invalidate({ missionId: missionId! });
      utils.planet.list.invalidate();
      setEventOpen(false);
      refetch();
    },
    onError: (e) => {
      addToast(e.message ?? 'Résolution impossible', 'error');
    },
  });

  const retreatMutation = trpc.expedition.retreat.useMutation({
    onSuccess: (res) => {
      addToast(res.resolutionText || 'Flotte rappelée', 'success');
      utils.expedition.list.invalidate();
      utils.expedition.getDetail.invalidate({ missionId: missionId! });
      utils.planet.list.invalidate();
      refetch();
    },
    onError: (e) => {
      addToast(e.message ?? 'Rappel impossible', 'error');
    },
  });

  const handleRetreat = () => {
    if (!missionId) return;
    const confirmed = window.confirm(
      'Rappeler la flotte ?\n\nLa flotte rentre immédiatement à la planète d\'origine avec ' +
      'ce qui est dans la soute. Les étapes restantes ne seront pas explorées.',
    );
    if (!confirmed) return;
    retreatMutation.mutate({ missionId });
  };

  const pendingEvent: ExpeditionEvent | null = useMemo(() => {
    if (!mission || !content || mission.status !== 'awaiting_decision') return null;
    return content.events.find((e) => e.id === mission.pendingEventId) ?? null;
  }, [mission, content]);

  if (isLoading || !mission) {
    return (
      <div className="space-y-4 p-4">
        <div className="h-12 bg-card/30 animate-pulse rounded" />
        <CardGridSkeleton count={2} />
      </div>
    );
  }

  const tier = mission.tier as keyof typeof TIER_LABEL;
  const snapshot = mission.fleetSnapshot as {
    ships: Array<{ shipId: string; count: number; role: string; cargoPerShip: number; massPerShip: number; hullPerShip: number }>;
    totalCargo: number;
    totalMass: number;
    totalHull: number;
  } | null;
  const fleetStatus = mission.fleetStatus as { shipsAlive?: Record<string, number> };
  const outcomes = mission.outcomesAccumulated as {
    minerai: number; silicium: number; hydrogene: number; exilium: number;
    modules: Array<{ rarity: 'common' | 'rare' | 'epic'; count: number }>;
    biomeRevealsRequested: number;
    anomalyEngagementUnlocked: null | { tier: 1 | 2 | 3 };
  };
  const stepLog = mission.stepLog as Array<{
    step: number; eventId: string; choiceIndex: number;
    resolutionText: string; resolvedAt: string;
    overflowed?: { minerai?: number; silicium?: number; hydrogene?: number };
  }>;

  const cargoUsed = outcomes.minerai + outcomes.silicium + outcomes.hydrogene;
  const cargoTotal = snapshot?.totalCargo ?? 0;
  const cargoPct = cargoTotal > 0 ? (cargoUsed / cargoTotal) * 100 : 0;

  const initialShipCount = snapshot?.ships.reduce((acc, s) => acc + s.count, 0) ?? 0;
  const aliveShipCount = fleetStatus.shipsAlive
    ? Object.values(fleetStatus.shipsAlive).reduce((acc, n) => acc + n, 0)
    : initialShipCount;
  const lostShipCount = Math.max(0, initialShipCount - aliveShipCount);

  const statusInfo = STATUS_LABEL[mission.status] ?? { label: mission.status, color: 'text-muted-foreground' };
  const isFinal = mission.status === 'completed' || mission.status === 'failed' || mission.status === 'expired';

  return (
    <div className="space-y-4 p-4 lg:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/missions/expeditions"
          className="p-1.5 rounded-md border border-border/30 hover:bg-card/60 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <Compass className="h-5 w-5 text-cyan-300" />
        <h1 className="text-lg font-bold flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          {mission.sectorName}
          <span className={cn('ml-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wider', TIER_COLOR[tier])}>
            {TIER_LABEL[tier]}
          </span>
        </h1>
      </div>

      {/* Status bar */}
      <div className="rounded-lg border border-border/40 bg-card/40 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={cn('text-sm font-semibold', statusInfo.color)}>{statusInfo.label}</span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-sm tabular-nums">
            Étape {mission.currentStep + (mission.status === 'awaiting_decision' ? 1 : 0)} / {mission.totalSteps}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {mission.status === 'engaged' && mission.nextStepAt && (
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Prochain événement dans{' '}
              <Timer endTime={new Date(mission.nextStepAt)} className="font-mono tabular-nums text-foreground/80" onComplete={() => refetch()} />
            </div>
          )}
          {mission.status === 'awaiting_decision' && (
            <Button size="sm" onClick={() => setEventOpen(true)}>
              <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
              Résoudre l'événement
            </Button>
          )}
          {mission.status === 'engaged' && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleRetreat}
              disabled={retreatMutation.isPending}
              title="Rentrer immédiatement avec ce qui est dans la soute"
            >
              <LogOut className="h-3.5 w-3.5 mr-1.5" />
              {retreatMutation.isPending ? 'Rappel…' : 'Rappeler la flotte'}
            </Button>
          )}
        </div>
      </div>

      {/* Briefing */}
      <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
        <p className="text-xs text-muted-foreground italic">« {mission.briefing} »</p>
      </div>

      {/* Grille principale */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Composition flotte */}
        <div className="rounded-lg border border-border/40 bg-card/40 p-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Anchor className="h-3.5 w-3.5" />
            Composition de la flotte
          </h3>
          {snapshot ? (
            <>
              <div className="space-y-1.5">
                {snapshot.ships.map((s) => {
                  const alive = fleetStatus.shipsAlive?.[s.shipId] ?? s.count;
                  const lost = s.count - alive;
                  return (
                    <div key={s.shipId} className="flex items-center justify-between text-sm">
                      <span className={cn(s.role === 'exploration' && 'text-cyan-300')}>
                        {shipNames[s.shipId] ?? s.shipId}
                      </span>
                      <span className={cn('tabular-nums', lost > 0 ? 'text-rose-300' : 'text-foreground/80')}>
                        {alive} / {s.count}
                        {lost > 0 && <span className="ml-1 text-[10px]">(−{lost})</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="pt-2 border-t border-border/20 text-xs text-muted-foreground flex justify-between">
                <span>Total : <span className="text-foreground/80 tabular-nums">{aliveShipCount} vaisseaux</span></span>
                {lostShipCount > 0 && <span className="text-rose-300">−{lostShipCount} perdus</span>}
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground italic">Flotte non engagée.</p>
          )}
        </div>

        {/* Soute / butin */}
        <div className="rounded-lg border border-border/40 bg-card/40 p-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Package className="h-3.5 w-3.5" />
            Butin embarqué
          </h3>
          <div>
            <div className="flex items-center justify-between mb-1 text-xs">
              <span className="text-muted-foreground">Soute</span>
              <span className="tabular-nums text-foreground/80">{cargoUsed} / {cargoTotal}</span>
            </div>
            <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-[width] duration-700',
                  cargoPct > 80 ? 'bg-amber-400' : 'bg-cyan-400',
                )}
                style={{ width: `${Math.min(100, cargoPct)}%` }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-muted-foreground">Minerai</p>
              <p className="font-mono tabular-nums text-minerai">{outcomes.minerai.toLocaleString('fr-FR')}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Silicium</p>
              <p className="font-mono tabular-nums text-silicium">{outcomes.silicium.toLocaleString('fr-FR')}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Hydrogène</p>
              <p className="font-mono tabular-nums text-hydrogene">{outcomes.hydrogene.toLocaleString('fr-FR')}</p>
            </div>
            <div>
              <p className="text-muted-foreground flex items-center gap-1"><ExiliumIcon className="h-3 w-3" /> Exilium</p>
              <p className="font-mono tabular-nums text-purple-300">{outcomes.exilium}</p>
            </div>
          </div>
          {(outcomes.modules.length > 0 || outcomes.biomeRevealsRequested > 0 || outcomes.anomalyEngagementUnlocked) && (
            <div className="pt-2 border-t border-border/20 space-y-1 text-xs">
              {outcomes.modules.map((m, i) => (
                <div key={i} className="flex items-center gap-1.5 text-violet-300">
                  <Package className="h-3 w-3" />
                  {m.count}× module {m.rarity}
                </div>
              ))}
              {outcomes.biomeRevealsRequested > 0 && (
                <div className="flex items-center gap-1.5 text-cyan-300">
                  <Sparkles className="h-3 w-3" />
                  {outcomes.biomeRevealsRequested} biome{outcomes.biomeRevealsRequested > 1 ? 's' : ''} à révéler
                </div>
              )}
              {outcomes.anomalyEngagementUnlocked && (
                <div className="flex items-center gap-1.5 text-violet-300">
                  <Sparkles className="h-3 w-3" />
                  Crédit anomalie palier {outcomes.anomalyEngagementUnlocked.tier}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Journal de bord */}
      <div className="rounded-lg border border-border/40 bg-card/40 p-4 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5" />
          Journal de bord
        </h3>
        {stepLog.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            {mission.status === 'engaged'
              ? "La flotte est en route. Aucun événement enregistré pour l'instant."
              : "Aucun événement résolu."}
          </p>
        ) : (
          <div className="space-y-2.5">
            {stepLog.map((entry) => {
              const eventDef = content?.events.find((e) => e.id === entry.eventId);
              const choice = eventDef?.choices[entry.choiceIndex];
              return (
                <div key={entry.step} className="rounded border border-border/30 bg-background/30 p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground/80 font-semibold">
                      Étape {entry.step} — {eventDef?.title ?? entry.eventId}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(entry.resolvedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                  {choice && (
                    <p className="text-muted-foreground">
                      Choix : <span className="text-foreground/80">« {choice.label} »</span>
                    </p>
                  )}
                  <p className="text-muted-foreground italic">{entry.resolutionText}</p>
                  {entry.overflowed && Object.values(entry.overflowed).some((v) => (v ?? 0) > 0) && (
                    <p className="text-[11px] text-amber-300">
                      Soute pleine — pertes :{' '}
                      {entry.overflowed.minerai ? `${entry.overflowed.minerai} M ` : ''}
                      {entry.overflowed.silicium ? `${entry.overflowed.silicium} S ` : ''}
                      {entry.overflowed.hydrogene ? `${entry.overflowed.hydrogene} H` : ''}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Récap final */}
      {isFinal && (
        <div
          className={cn(
            'rounded-lg border p-4',
            mission.status === 'completed'
              ? 'border-emerald-500/40 bg-emerald-500/5'
              : mission.status === 'failed'
              ? 'border-rose-500/40 bg-rose-500/5'
              : 'border-border/40 bg-card/40',
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            {mission.status === 'completed' && <CheckCircle2 className="h-5 w-5 text-emerald-300" />}
            {mission.status === 'failed' && <Skull className="h-5 w-5 text-rose-300" />}
            {mission.status === 'expired' && <XCircle className="h-5 w-5 text-muted-foreground" />}
            <h3 className="text-sm font-semibold">
              {mission.status === 'completed' && 'Mission terminée avec succès'}
              {mission.status === 'failed' && 'Flotte perdue dans l\'espace profond'}
              {mission.status === 'expired' && 'Mission expirée'}
            </h3>
          </div>
          {mission.completedAt && (
            <p className="text-xs text-muted-foreground">
              {new Date(mission.completedAt).toLocaleString('fr-FR')}
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => navigate('/missions/expeditions')}
          >
            Retour aux missions
          </Button>
        </div>
      )}

      {/* Modal d'événement */}
      {eventOpen && pendingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-amber-500/40 bg-card/95 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] uppercase tracking-wider text-amber-300">
                {mission.sectorName} · Étape {mission.currentStep + 1} sur {mission.totalSteps}
              </span>
              <Button variant="outline" size="sm" onClick={() => setEventOpen(false)}>
                Fermer
              </Button>
            </div>
            <ExpeditionEventCard
              event={pendingEvent}
              userResearch={userResearchLevels}
              shipsAlive={fleetStatus.shipsAlive ?? {}}
              shipRoles={shipRoles}
              shipNames={shipNames}
              researchNames={researchNames}
              loading={resolveMutation.isPending}
              onChoose={(choiceIndex) => {
                resolveMutation.mutate({
                  missionId: mission.id,
                  choiceIndex,
                  resolutionToken: crypto.randomUUID(),
                });
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
