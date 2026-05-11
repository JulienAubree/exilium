import { Clock, Compass, Package, Anchor, ArrowRight, AlertTriangle, ChevronRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Timer } from '@/components/common/Timer';
import { cn } from '@/lib/utils';

// ─── Style tokens par palier ────────────────────────────────────────────────

const TIER_LABEL = {
  early: 'Initial',
  mid: 'Intermédiaire',
  deep: 'Profond',
} as const;

const TIER_BADGE = {
  early: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
  mid: 'text-cyan-300 border-cyan-500/40 bg-cyan-500/10',
  deep: 'text-violet-300 border-violet-500/40 bg-violet-500/10',
} as const;

const TIER_HEADER_GRADIENT = {
  early: 'bg-gradient-to-br from-emerald-950/60 via-emerald-900/20 to-transparent',
  mid: 'bg-gradient-to-br from-cyan-950/60 via-cyan-900/20 to-transparent',
  deep: 'bg-gradient-to-br from-violet-950/60 via-violet-900/20 to-transparent',
} as const;

const TIER_GLOW = {
  early: 'shadow-[0_0_24px_-12px_rgba(52,211,153,0.5)] border-emerald-500/30',
  mid: 'shadow-[0_0_24px_-12px_rgba(34,211,238,0.5)] border-cyan-500/30',
  deep: 'shadow-[0_0_24px_-12px_rgba(167,139,250,0.5)] border-violet-500/30',
} as const;

const TIER_ICON_BG = {
  early: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30',
  mid: 'bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30',
  deep: 'bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30',
} as const;

const TIER_DOT = {
  early: 'bg-emerald-400',
  mid: 'bg-cyan-400',
  deep: 'bg-violet-400',
} as const;

// ─── Compteur d'étapes (dots) ───────────────────────────────────────────────

function StepDots({ current, total, tier }: { current: number; total: number; tier: 'early' | 'mid' | 'deep' }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }).map((_, i) => {
        const done = i < current;
        const active = i === current - 1;
        return (
          <div
            key={i}
            className={cn(
              'h-1.5 rounded-full transition-all',
              active ? 'w-4' : 'w-1.5',
              done ? TIER_DOT[tier] : 'bg-white/10',
              active && 'shadow-[0_0_8px_currentColor]',
            )}
          />
        );
      })}
    </div>
  );
}

// ─── Carte d'offre disponible ───────────────────────────────────────────────

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
  /** Image hero du secteur (path public, ex: /assets/expedition/sector-theta-7.webp) */
  sectorImage?: string;
  onEngage: () => void;
}

export function ExpeditionMissionCard({ mission, sectorImage, onEngage }: Props) {
  const expiresAt = new Date(mission.expiresAt);
  const durationMin = Math.round(mission.estimatedDurationSeconds / 60);

  return (
    <div className={cn(
      'glass-card overflow-hidden border transition-all hover:scale-[1.01]',
      TIER_GLOW[mission.tier],
    )}>
      {/* Header avec image hero (si dispo) ou gradient palier */}
      <div className={cn(
        'relative px-4 py-3 border-b border-white/5 overflow-hidden',
        !sectorImage && TIER_HEADER_GRADIENT[mission.tier],
      )}>
        {sectorImage && (
          <>
            <img
              src={sectorImage}
              alt={mission.sectorName}
              className="absolute inset-0 h-full w-full object-cover opacity-60"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-card/95 via-card/70 to-card/40" />
          </>
        )}
        <div className="relative flex items-center gap-3">
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg shrink-0 backdrop-blur-sm', TIER_ICON_BG[mission.tier])}>
            <Compass className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold truncate">{mission.sectorName}</h4>
            <span className={cn(
              'inline-block mt-0.5 px-1.5 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider backdrop-blur-sm',
              TIER_BADGE[mission.tier],
            )}>
              {TIER_LABEL[mission.tier]}
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <p className="text-xs text-muted-foreground italic leading-relaxed line-clamp-3">
          « {mission.briefing} »
        </p>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="flex items-center gap-1.5 text-xs">
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">
              <span className="text-foreground/80 font-semibold tabular-nums">{mission.totalSteps}</span> étape{mission.totalSteps > 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">
              ~<span className="text-foreground/80 font-semibold tabular-nums">{durationMin}</span> min
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-white/5 bg-background/30">
        <div className="text-[11px] text-muted-foreground/70">
          Expire dans <Timer endTime={expiresAt} className="font-mono tabular-nums text-foreground/80" />
        </div>
        <Button size="sm" onClick={onEngage} className="gap-1">
          Engager
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── Carte de mission en cours ──────────────────────────────────────────────

interface InProgressProps {
  mission: {
    id: string;
    sectorName: string;
    tier: 'early' | 'mid' | 'deep';
    totalSteps: number;
    currentStep: number;
    status: string;
    fleetSnapshot: { ships: Array<{ shipId: string; count: number; role?: string }>; totalCargo: number };
    fleetStatus: { shipsAlive?: Record<string, number> };
    outcomesAccumulated: {
      minerai: number; silicium: number; hydrogene: number; exilium: number;
    };
    pendingEventId: string | null;
    nextStepAt: string | null;
    returnAt: string | null;
  };
  shipNames: Record<string, string>;
  shipRoles?: Record<string, string>;
  /** Image hero du secteur (path public). */
  sectorImage?: string;
  onOpen: () => void;
  /** Appelé quand le timer affiché atteint zéro (pour déclencher un refetch). */
  onTimerComplete?: () => void;
}

export function ExpeditionInProgressCard({ mission, shipNames, shipRoles = {}, sectorImage, onOpen, onTimerComplete }: InProgressProps) {
  const awaitingDecision = mission.status === 'awaiting_decision';
  const returning = mission.status === 'returning';

  const cargoUsed = mission.outcomesAccumulated.minerai
    + mission.outcomesAccumulated.silicium
    + mission.outcomesAccumulated.hydrogene;
  const cargoTotal = mission.fleetSnapshot.totalCargo;
  const cargoPct = cargoTotal > 0 ? Math.round((cargoUsed / cargoTotal) * 100) : 0;

  const initialShips = mission.fleetSnapshot.ships.reduce((acc, s) => acc + s.count, 0);
  const aliveShips = mission.fleetStatus.shipsAlive
    ? Object.values(mission.fleetStatus.shipsAlive).reduce((acc, n) => acc + n, 0)
    : initialShips;
  const lostShips = Math.max(0, initialShips - aliveShips);
  const fleetPct = initialShips > 0 ? Math.round((aliveShips / initialShips) * 100) : 0;

  const stepDisplay = mission.currentStep + (awaitingDecision ? 1 : 0);
  const fmt = (n: number) => n.toLocaleString('fr-FR');

  return (
    <div
      className={cn(
        'glass-card overflow-hidden border transition-all',
        awaitingDecision
          ? 'border-amber-500/50 shadow-[0_0_24px_-8px_rgba(251,191,36,0.4)]'
          : returning
          ? 'border-cyan-400/40 shadow-[0_0_24px_-12px_rgba(34,211,238,0.4)]'
          : TIER_GLOW[mission.tier],
      )}
    >
      {/* Header avec image hero (si dispo) ou gradient palier */}
      <div className={cn(
        'relative px-4 py-3 border-b border-white/5 overflow-hidden',
        !sectorImage && (
          awaitingDecision
            ? 'bg-gradient-to-br from-amber-950/40 via-amber-900/10 to-transparent'
            : returning
            ? 'bg-gradient-to-br from-cyan-950/40 via-cyan-900/10 to-transparent'
            : TIER_HEADER_GRADIENT[mission.tier]
        ),
      )}>
        {sectorImage && (
          <>
            <img
              src={sectorImage}
              alt={mission.sectorName}
              className="absolute inset-0 h-full w-full object-cover opacity-60"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
            <div className={cn(
              'absolute inset-0',
              awaitingDecision
                ? 'bg-gradient-to-r from-card/95 via-card/70 to-amber-950/30'
                : returning
                ? 'bg-gradient-to-r from-card/95 via-card/70 to-cyan-950/30'
                : 'bg-gradient-to-r from-card/95 via-card/70 to-card/40',
            )} />
          </>
        )}
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg shrink-0 backdrop-blur-sm',
              awaitingDecision
                ? 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30 animate-pulse'
                : returning
                ? 'bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/30'
                : TIER_ICON_BG[mission.tier],
            )}>
              {awaitingDecision ? <AlertTriangle className="h-5 w-5" /> : <Compass className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-bold truncate">{mission.sectorName}</h4>
                <span className={cn(
                  'shrink-0 px-1.5 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider backdrop-blur-sm',
                  TIER_BADGE[mission.tier],
                )}>
                  {TIER_LABEL[mission.tier]}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  Étape {stepDisplay} / {mission.totalSteps}
                </span>
                <StepDots current={stepDisplay} total={mission.totalSteps} tier={mission.tier} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Composition flotte en chips */}
      <div className="px-4 pt-3">
        <div className="flex flex-wrap gap-1.5">
          {mission.fleetSnapshot.ships.map((s) => {
            const role = s.role ?? shipRoles[s.shipId];
            const alive = mission.fleetStatus.shipsAlive?.[s.shipId] ?? s.count;
            const isExplorer = role === 'exploration';
            const lost = s.count - alive;
            return (
              <span
                key={s.shipId}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px]',
                  isExplorer
                    ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                    : 'border-white/10 bg-white/[0.03] text-foreground/70',
                  lost > 0 && 'opacity-70',
                )}
              >
                <span className="font-mono tabular-nums font-semibold">{alive}</span>
                <span className="text-muted-foreground/80">×</span>
                <span>{shipNames[s.shipId] ?? s.shipId}</span>
                {lost > 0 && <span className="text-rose-300 ml-0.5">−{lost}</span>}
              </span>
            );
          })}
        </div>
      </div>

      {/* Stats : flotte + soute */}
      <div className="px-4 py-3 grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Anchor className="h-3 w-3" />
              Flotte
            </span>
            <span className={cn('tabular-nums font-semibold', lostShips > 0 ? 'text-rose-300' : 'text-foreground/90')}>
              {fmt(aliveShips)} {aliveShips > 1 ? 'vaisseaux' : 'vaisseau'}
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-700',
                lostShips === 0
                  ? 'bg-gradient-to-r from-emerald-500/50 to-emerald-400'
                  : fleetPct > 50
                  ? 'bg-gradient-to-r from-amber-500/50 to-amber-400'
                  : 'bg-gradient-to-r from-rose-500/50 to-rose-400',
              )}
              style={{ width: `${fleetPct}%` }}
            />
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Package className="h-3 w-3" />
              Soute
            </span>
            <span className="tabular-nums font-semibold text-foreground/90">
              {fmt(cargoUsed)} <span className="text-muted-foreground/70">/ {fmt(cargoTotal)}</span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-700',
                cargoPct > 80
                  ? 'bg-gradient-to-r from-amber-500/50 to-amber-400'
                  : cargoPct > 0
                  ? 'bg-gradient-to-r from-cyan-500/50 to-cyan-400'
                  : 'bg-white/10',
              )}
              style={{ width: `${Math.min(100, cargoPct)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        className={cn(
          'flex items-center justify-between gap-3 px-4 py-2.5 border-t',
          awaitingDecision
            ? 'border-amber-500/20 bg-gradient-to-r from-amber-500/5 to-transparent'
            : returning
            ? 'border-cyan-400/20 bg-gradient-to-r from-cyan-500/5 to-transparent'
            : 'border-white/5 bg-background/30',
        )}
      >
        {awaitingDecision ? (
          <>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
              </span>
              <span className="text-xs text-amber-300 font-semibold">Décision requise</span>
            </div>
            <Button size="sm" onClick={onOpen} className="gap-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30">
              Résoudre
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : returning ? (
          <>
            <div className="flex items-center gap-1.5 text-xs">
              <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
              {mission.returnAt && new Date(mission.returnAt).getTime() > Date.now() ? (
                <span className="text-cyan-200">
                  Arrivée dans{' '}
                  <Timer
                    endTime={new Date(mission.returnAt)}
                    className="font-mono tabular-nums text-foreground/90 font-semibold"
                    onComplete={onTimerComplete}
                  />
                </span>
              ) : (
                <span className="text-cyan-200 flex items-center gap-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-300 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-300" />
                  </span>
                  Arrivée imminente…
                </span>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={onOpen} className="gap-1">
              Détails
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {mission.nextStepAt && new Date(mission.nextStepAt).getTime() > Date.now() ? (
                <span>
                  Prochain événement dans{' '}
                  <Timer
                    endTime={new Date(mission.nextStepAt)}
                    className="font-mono tabular-nums text-foreground/90 font-semibold"
                    onComplete={onTimerComplete}
                  />
                </span>
              ) : (
                <span className="text-cyan-200 flex items-center gap-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-300 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-300" />
                  </span>
                  Événement imminent…
                </span>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={onOpen} className="gap-1">
              Détails
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
