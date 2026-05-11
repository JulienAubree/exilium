import { Clock, MapPin, Fuel, Package, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Timer } from '@/components/common/Timer';
import { cn } from '@/lib/utils';

const TIER_LABEL = {
  early: 'Initial',
  mid: 'Intermédiaire',
  deep: 'Profond',
} as const;

const TIER_COLOR = {
  early: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
  mid: 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10',
  deep: 'text-violet-300 border-violet-500/30 bg-violet-500/10',
} as const;

interface Props {
  mission: {
    id: string;
    sectorName: string;
    tier: 'early' | 'mid' | 'deep';
    totalSteps: number;
    estimatedDurationSeconds: number;
    briefing: string;
    expiresAt: string;
  };
  onEngage: () => void;
}

export function ExpeditionMissionCard({ mission, onEngage }: Props) {
  const expiresAt = new Date(mission.expiresAt);
  const durationMin = Math.round(mission.estimatedDurationSeconds / 60);

  return (
    <div className="retro-card border-border/40 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
          <h4 className="text-sm font-semibold truncate">{mission.sectorName}</h4>
        </div>
        <span
          className={cn(
            'shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wider',
            TIER_COLOR[mission.tier],
          )}
        >
          {TIER_LABEL[mission.tier]}
        </span>
      </div>

      <p className="text-xs text-muted-foreground italic line-clamp-3">
        « {mission.briefing} »
      </p>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <ArrowRight className="h-3 w-3" />
          <span>{mission.totalSteps} étape{mission.totalSteps > 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>~{durationMin} min</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="text-[11px] text-muted-foreground/70">
          Expire dans <Timer endTime={expiresAt} className="font-mono tabular-nums text-foreground/80" />
        </div>
        <Button size="sm" onClick={onEngage}>
          Engager une flotte
        </Button>
      </div>
    </div>
  );
}

interface InProgressProps {
  mission: {
    id: string;
    sectorName: string;
    tier: 'early' | 'mid' | 'deep';
    totalSteps: number;
    currentStep: number;
    status: string;
    fleetSnapshot: { ships: Array<{ shipId: string; count: number }>; totalCargo: number };
    fleetStatus: { shipsAlive?: Record<string, number> };
    outcomesAccumulated: {
      minerai: number; silicium: number; hydrogene: number; exilium: number;
    };
    pendingEventId: string | null;
    nextStepAt: string | null;
  };
  shipNames: Record<string, string>;
  onOpen: () => void;
}

export function ExpeditionInProgressCard({ mission, shipNames, onOpen }: InProgressProps) {
  const awaitingDecision = mission.status === 'awaiting_decision';

  const cargoUsed = mission.outcomesAccumulated.minerai
    + mission.outcomesAccumulated.silicium
    + mission.outcomesAccumulated.hydrogene;
  const cargoTotal = mission.fleetSnapshot.totalCargo;
  const cargoPct = cargoTotal > 0 ? Math.round((cargoUsed / cargoTotal) * 100) : 0;

  // Compte total de vaisseaux vivants + ratio survivants/engagés
  const initialShips = mission.fleetSnapshot.ships.reduce((acc, s) => acc + s.count, 0);
  const aliveShips = mission.fleetStatus.shipsAlive
    ? Object.values(mission.fleetStatus.shipsAlive).reduce((acc, n) => acc + n, 0)
    : initialShips;
  const lostShips = Math.max(0, initialShips - aliveShips);

  const fleetSummary = mission.fleetSnapshot.ships
    .map((s) => `${s.count}× ${shipNames[s.shipId] ?? s.shipId}`)
    .join(' · ');

  return (
    <div
      className={cn(
        'retro-card p-4 space-y-3 transition-colors',
        awaitingDecision
          ? 'border-amber-500/40 bg-amber-500/5'
          : 'border-border/40',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
          <h4 className="text-sm font-semibold truncate">{mission.sectorName}</h4>
          <span
            className={cn(
              'shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase',
              TIER_COLOR[mission.tier],
            )}
          >
            {TIER_LABEL[mission.tier]}
          </span>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          Étape {mission.currentStep + (awaitingDecision ? 1 : 0)} / {mission.totalSteps}
        </span>
      </div>

      <p className="text-xs text-muted-foreground line-clamp-1">{fleetSummary}</p>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-muted-foreground">Flotte</span>
            <span className={cn('tabular-nums', lostShips > 0 ? 'text-rose-300' : 'text-foreground/80')}>
              {aliveShips} vaisseau{aliveShips > 1 ? 'x' : ''}
              {lostShips > 0 && ` (−${lostShips})`}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-700',
                lostShips === 0 ? 'bg-emerald-400' : aliveShips / initialShips > 0.5 ? 'bg-amber-400' : 'bg-rose-400',
              )}
              style={{ width: `${initialShips > 0 ? Math.round((aliveShips / initialShips) * 100) : 0}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-muted-foreground">Soute</span>
            <span className="tabular-nums text-foreground/80">{cargoUsed} / {cargoTotal}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-700',
                cargoPct > 80 ? 'bg-amber-400' : 'bg-cyan-400',
              )}
              style={{ width: `${Math.min(100, cargoPct)}%` }}
            />
          </div>
        </div>
      </div>

      {awaitingDecision ? (
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-amber-500/20">
          <span className="text-xs text-amber-300 font-medium">⚠️ Décision requise</span>
          <Button size="sm" onClick={onOpen}>
            Résoudre l'événement
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-muted-foreground/70">
          {mission.nextStepAt ? (
            <span>
              Prochain événement dans{' '}
              <Timer endTime={new Date(mission.nextStepAt)} className="font-mono tabular-nums text-foreground/80" />
            </span>
          ) : (
            <span>En route…</span>
          )}
          <Button size="sm" variant="outline" onClick={onOpen}>
            Détails
          </Button>
        </div>
      )}
    </div>
  );
}
