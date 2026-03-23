import { useState, useEffect } from 'react';
import { trpc } from '@/trpc';
import { Button } from '@/components/ui/button';
import { Timer } from '@/components/common/Timer';
import { EmptyState } from '@/components/common/EmptyState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { CardGridSkeleton } from '@/components/common/PageSkeleton';
import { PageHeader } from '@/components/common/PageHeader';
import { useGameConfig } from '@/hooks/useGameConfig';
import { MISSION_CONFIG } from '@/config/mission-config';
import { getShipName } from '@/lib/entity-names';
import { cn } from '@/lib/utils';

// ── Mission theming ──

const MISSION_STYLE: Record<string, { border: string; text: string; hex: string }> = {
  transport: { border: 'border-l-blue-500', text: 'text-blue-400', hex: '#3b82f6' },
  station:   { border: 'border-l-emerald-500', text: 'text-emerald-400', hex: '#10b981' },
  spy:       { border: 'border-l-violet-500', text: 'text-violet-400', hex: '#8b5cf6' },
  attack:    { border: 'border-l-red-500', text: 'text-red-400', hex: '#ef4444' },
  colonize:  { border: 'border-l-orange-500', text: 'text-orange-400', hex: '#f97316' },
  mine:      { border: 'border-l-amber-500', text: 'text-amber-400', hex: '#f59e0b' },
  pirate:    { border: 'border-l-rose-600', text: 'text-rose-400', hex: '#e11d48' },
  recycle:   { border: 'border-l-cyan-500', text: 'text-cyan-400', hex: '#06b6d4' },
};

const PHASE_STYLE: Record<string, { label: string; classes: string; dot: string; pulse?: boolean }> = {
  outbound:    { label: 'En route', classes: 'text-blue-300 bg-blue-500/10 border-blue-500/20', dot: 'bg-blue-400', pulse: true },
  prospecting: { label: 'Prospection', classes: 'text-amber-300 bg-amber-500/10 border-amber-500/20', dot: 'bg-amber-400', pulse: true },
  mining:      { label: 'Extraction', classes: 'text-amber-200 bg-amber-400/10 border-amber-400/20', dot: 'bg-amber-300', pulse: true },
  return:      { label: 'Retour', classes: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400' },
};

const fmt = (n: number) => n.toLocaleString('fr-FR');

// ── Progress hook (updates every second) ──

function useProgress(departure: string, arrival: string) {
  const [pct, setPct] = useState(() => {
    const total = new Date(arrival).getTime() - new Date(departure).getTime();
    const elapsed = Date.now() - new Date(departure).getTime();
    return total > 0 ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : 100;
  });

  useEffect(() => {
    const dep = new Date(departure).getTime();
    const arr = new Date(arrival).getTime();
    const tick = () => {
      const total = arr - dep;
      const elapsed = Date.now() - dep;
      setPct(total > 0 ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : 100);
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [departure, arrival]);

  return pct;
}

// ── Movement Card ──

interface MovementEvent {
  id: string;
  originPlanetId: string;
  targetGalaxy: number;
  targetSystem: number;
  targetPosition: number;
  mission: string;
  phase: string;
  departureTime: string;
  arrivalTime: string;
  mineraiCargo: string | number;
  siliciumCargo: string | number;
  hydrogeneCargo: string | number;
  ships: unknown;
}

function MovementCard({
  event,
  originPlanet,
  gameConfig,
  onRecall,
  recallingId,
  onTimerComplete,
}: {
  event: MovementEvent;
  originPlanet?: { name: string; galaxy: number; system: number; position: number };
  gameConfig: any;
  onRecall: (id: string) => void;
  recallingId: string | null;
  onTimerComplete: () => void;
}) {
  const progress = useProgress(event.departureTime, event.arrivalTime);
  const ships = event.ships as Record<string, number>;
  const shipEntries = Object.entries(ships).filter(([, v]) => v > 0);
  const shipCount = shipEntries.reduce((sum, [, n]) => sum + n, 0);

  const targetCoords = `[${event.targetGalaxy}:${event.targetSystem}:${event.targetPosition}]`;
  const originCoords = originPlanet
    ? `[${originPlanet.galaxy}:${originPlanet.system}:${originPlanet.position}]`
    : '';
  const originLabel = originPlanet?.name ?? 'Planete';

  const canRecall = ['outbound', 'prospecting', 'mining'].includes(event.phase);
  const isReturn = event.phase === 'return';

  const mStyle = MISSION_STYLE[event.mission] ?? MISSION_STYLE.transport;
  const pStyle = PHASE_STYLE[event.phase] ?? PHASE_STYLE.outbound;
  const missionLabel = MISSION_CONFIG[event.mission as keyof typeof MISSION_CONFIG]?.label ?? event.mission;

  const minerai = Number(event.mineraiCargo);
  const silicium = Number(event.siliciumCargo);
  const hydrogene = Number(event.hydrogeneCargo);
  const hasCargo = minerai > 0 || silicium > 0 || hydrogene > 0;
  const totalCargo = minerai + silicium + hydrogene;

  const fromLabel = isReturn ? targetCoords : `${originLabel} ${originCoords}`;
  const toLabel = isReturn ? `${originLabel} ${originCoords}` : targetCoords;

  return (
    <div className={cn('glass-card border-l-4 overflow-hidden', mStyle.border)}>
      <div
        className="relative p-4 space-y-3"
        style={{ background: `linear-gradient(135deg, ${mStyle.hex}08 0%, transparent 50%)` }}
      >
        {/* Header: Mission + Phase + Timer */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className={cn('text-base font-bold tracking-tight', mStyle.text)}>
              {missionLabel}
            </span>
            <span className={cn(
              'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border',
              pStyle.classes,
            )}>
              <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', pStyle.dot, pStyle.pulse && 'animate-pulse')} />
              {pStyle.label}
            </span>
          </div>
          <Timer
            endTime={new Date(event.arrivalTime)}
            onComplete={onTimerComplete}
          />
        </div>

        {/* Route + Progress */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-foreground font-medium truncate">{fromLabel}</span>
            <svg width="24" height="10" viewBox="0 0 24 10" className="flex-shrink-0 opacity-40">
              <line x1="0" y1="5" x2="17" y2="5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" />
              <polyline points="15,2 19,5 15,8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            <span className="text-foreground font-medium truncate">{toLabel}</span>
          </div>

          {/* Progress bar with glowing marker */}
          <div className="relative h-1.5">
            <div className="absolute inset-0 rounded-full bg-white/[0.04]" />
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ease-linear"
              style={{
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${mStyle.hex}30, ${mStyle.hex})`,
              }}
            />
            {progress > 0 && progress < 100 && (
              <div
                className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full transition-[left] duration-1000 ease-linear"
                style={{
                  left: `calc(${progress}% - 5px)`,
                  background: mStyle.hex,
                  boxShadow: `0 0 10px ${mStyle.hex}90, 0 0 3px ${mStyle.hex}`,
                }}
              />
            )}
          </div>
        </div>

        {/* Ships */}
        <div className="flex flex-wrap gap-1.5 items-center">
          {shipEntries.map(([id, count]) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-[11px]"
            >
              <span className="text-foreground font-semibold">{count}&times;</span>
              <span className="text-muted-foreground">{getShipName(id, gameConfig)}</span>
            </span>
          ))}
          {shipCount > 1 && (
            <span className="text-[10px] text-muted-foreground/50 ml-1">
              ({shipCount} vaisseaux)
            </span>
          )}
        </div>

        {/* Cargo */}
        {hasCargo && (
          <div className="flex items-center gap-3 text-xs">
            <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-semibold">
              Cargo
            </span>
            <div className="flex gap-3">
              {minerai > 0 && (
                <span className="text-minerai">
                  <span className="font-semibold">{fmt(minerai)}</span>
                  <span className="opacity-50 ml-0.5 text-[10px]">M</span>
                </span>
              )}
              {silicium > 0 && (
                <span className="text-silicium">
                  <span className="font-semibold">{fmt(silicium)}</span>
                  <span className="opacity-50 ml-0.5 text-[10px]">S</span>
                </span>
              )}
              {hydrogene > 0 && (
                <span className="text-hydrogene">
                  <span className="font-semibold">{fmt(hydrogene)}</span>
                  <span className="opacity-50 ml-0.5 text-[10px]">H</span>
                </span>
              )}
            </div>
            <span className="text-muted-foreground/30 text-[10px]">
              ({fmt(totalCargo)} total)
            </span>
          </div>
        )}

        {/* Recall */}
        {canRecall && (
          <div className="flex justify-end pt-0.5">
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:border-destructive/50 text-xs h-7"
              onClick={() => onRecall(event.id)}
              disabled={recallingId === event.id}
            >
              Rappeler
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ──

export default function Movements() {
  const utils = trpc.useUtils();
  const [recallConfirm, setRecallConfirm] = useState<string | null>(null);
  const { data: gameConfig } = useGameConfig();
  const { data: movements, isLoading } = trpc.fleet.movements.useQuery();
  const { data: planets } = trpc.planet.list.useQuery();

  const recallMutation = trpc.fleet.recall.useMutation({
    onSuccess: () => {
      utils.fleet.movements.invalidate();
      setRecallConfirm(null);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 lg:space-y-6 lg:p-6">
        <PageHeader title="Mouvements" />
        <CardGridSkeleton count={3} />
      </div>
    );
  }

  const sorted = movements
    ? [...movements].sort((a, b) => new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime())
    : [];

  const recallingEvent = recallConfirm ? sorted.find((m) => m.id === recallConfirm) : null;
  const recallingLabel = recallingEvent
    ? (MISSION_CONFIG[recallingEvent.mission as keyof typeof MISSION_CONFIG]?.label ?? recallingEvent.mission)
    : '';
  const recallingCoords = recallingEvent
    ? `[${recallingEvent.targetGalaxy}:${recallingEvent.targetSystem}:${recallingEvent.targetPosition}]`
    : '';

  return (
    <div className="space-y-4 p-4 lg:space-y-6 lg:p-6">
      <PageHeader title="Mouvements" />

      {sorted.length === 0 ? (
        <EmptyState
          title="Aucun mouvement en cours"
          description="Envoyez une flotte depuis la page Flotte pour voir vos mouvements ici."
        />
      ) : (
        <div className="space-y-4 lg:max-w-4xl lg:mx-auto">
          <div className="text-xs text-muted-foreground/60">
            {sorted.length} mouvement{sorted.length > 1 ? 's' : ''} en cours
          </div>

          {sorted.map((event) => {
            const origin = planets?.find((p) => p.id === event.originPlanetId);
            return (
              <MovementCard
                key={event.id}
                event={event as unknown as MovementEvent}
                originPlanet={origin ? { name: origin.name, galaxy: origin.galaxy, system: origin.system, position: origin.position } : undefined}
                gameConfig={gameConfig}
                onRecall={setRecallConfirm}
                recallingId={recallConfirm}
                onTimerComplete={() => utils.fleet.movements.invalidate()}
              />
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!recallConfirm}
        onConfirm={() => {
          if (recallConfirm) recallMutation.mutate({ fleetEventId: recallConfirm });
        }}
        onCancel={() => setRecallConfirm(null)}
        title="Rappeler la flotte ?"
        description={`Votre flotte en mission ${recallingLabel} vers ${recallingCoords} fera demi-tour et retournera sur sa planete d'origine.`}
        variant="destructive"
        confirmLabel="Rappeler"
      />
    </div>
  );
}
