import { cn } from '@/lib/utils';
import { Timer } from '@/components/common/Timer';
import { GameImage } from '@/components/common/GameImage';
import { MissionIcon, getMissionColor } from './MissionIcon';
import { useGameConfig } from '@/hooks/useGameConfig';
import { type Mission } from '@/config/mission-config';

// ── Types ──

export interface CompactMovement {
  id: string;
  mission: string;
  phase: string;
  arrivalTime: string; // ISO string
  originPlanetName?: string;
  targetGalaxy: number;
  targetSystem: number;
  targetPosition: number;
  ships: Record<string, number>;
}

export interface MovementCardCompactProps {
  movement: CompactMovement;
  shipNames: Record<string, string>;
}

// ── Phase styling ──

const PHASE_STYLE: Record<string, { classes: string; dot: string; pulse?: boolean }> = {
  outbound:    { classes: 'text-blue-300 bg-blue-500/10 border-blue-500/20',     dot: 'bg-blue-400',   pulse: true },
  prospecting: { classes: 'text-amber-300 bg-amber-500/10 border-amber-500/20',  dot: 'bg-amber-400',  pulse: true },
  mining:      { classes: 'text-amber-200 bg-amber-400/10 border-amber-400/20',  dot: 'bg-amber-300',  pulse: true },
  return:      { classes: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400' },
};

// ── Mission border colors (mirrors Movements.tsx MISSION_STYLE) ──

const MISSION_BORDER: Record<string, string> = {
  transport: 'border-l-blue-500',
  station:   'border-l-emerald-500',
  spy:       'border-l-violet-500',
  attack:    'border-l-red-500',
  colonize:  'border-l-orange-500',
  mine:      'border-l-amber-500',
  pirate:    'border-l-rose-600',
  recycle:   'border-l-cyan-500',
  trade:     'border-l-violet-400',
};

// ── Phase labels for compact display ──

const PHASE_LABELS: Record<string, string> = {
  outbound:    'Aller',
  prospecting: 'Prospec.',
  mining:      'Extraction',
  return:      'Retour',
  base:        'Base',
};

// ── Mining stepper phase keys ──

const MINE_PHASE_KEYS = ['outbound', 'prospecting', 'mining', 'return', 'base'] as const;
type MinePhaseKey = typeof MINE_PHASE_KEYS[number];

// ── Mining Stepper (compact version) ──

function MiningStepperCompact({ phase, hex }: { phase: string; hex: string }) {
  const currentIdx = MINE_PHASE_KEYS.indexOf(phase as MinePhaseKey);

  return (
    <div className="space-y-1">
      {/* Dots + lines */}
      <div className="flex items-center">
        {MINE_PHASE_KEYS.map((key, i) => {
          const isDone   = i < currentIdx;
          const isActive = i === currentIdx;
          const isFuture = i > currentIdx;

          return (
            <div key={key} className="flex items-center flex-1 last:flex-none">
              {/* Dot */}
              <div
                className={cn(
                  'w-3 h-3 rounded-full border flex-shrink-0 transition-colors',
                  isFuture && 'border-white/10 bg-transparent',
                )}
                style={{
                  ...(isDone   ? { background: `${hex}60`, border: 'none' } : {}),
                  ...(isActive ? { background: hex, border: 'none', boxShadow: `0 0 6px ${hex}80` } : {}),
                }}
              />
              {/* Connecting line */}
              {i < MINE_PHASE_KEYS.length - 1 && (
                <div className="flex-1 h-0.5 mx-0.5">
                  {isDone ? (
                    <div className="h-full rounded-full" style={{ background: `${hex}60` }} />
                  ) : (
                    <div className="h-full rounded-full bg-white/[0.06]" />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Labels */}
      <div className="flex">
        {MINE_PHASE_KEYS.map((key, i) => {
          const isDone   = i < currentIdx;
          const isActive = i === currentIdx;
          return (
            <div
              key={key}
              className={cn(
                'flex-1 last:flex-none',
                i === MINE_PHASE_KEYS.length - 1 && 'text-right',
              )}
            >
              <span
                className={cn(
                  'text-[9px] leading-none',
                  isDone   && 'text-muted-foreground/50',
                  !isDone && !isActive && 'text-muted-foreground/25',
                  isActive && 'font-semibold',
                )}
                style={isActive ? { color: hex } : {}}
              >
                {PHASE_LABELS[key] ?? key}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ──

export function MovementCardCompact({ movement, shipNames }: MovementCardCompactProps) {
  const { data: gameConfig } = useGameConfig();

  const mission    = movement.mission as Mission;
  const hex        = getMissionColor(mission) ?? '#888';
  const borderCls  = MISSION_BORDER[movement.mission] ?? 'border-l-blue-500';
  const pStyle     = PHASE_STYLE[movement.phase] ?? PHASE_STYLE.outbound;
  const phaseLabel = gameConfig?.labels?.[`phase.${movement.phase}`] ?? PHASE_LABELS[movement.phase] ?? movement.phase;
  const missionLabel = gameConfig?.missions?.[movement.mission]?.label ?? movement.mission;

  const isMine = movement.mission === 'mine';

  // Ships — filter to those with count > 0, cap display at 3
  const shipEntries = Object.entries(movement.ships).filter(([, count]) => count > 0);
  const visibleShips = shipEntries.slice(0, 3);
  const overflowCount = shipEntries.length - visibleShips.length;

  // Route
  const targetCoords = `[${movement.targetGalaxy}:${movement.targetSystem}:${movement.targetPosition}]`;
  const originLabel  = movement.originPlanetName ?? 'Planete';

  return (
    <div
      className={cn(
        'glass-card border-l-4 overflow-hidden',
        borderCls,
      )}
    >
      <div
        className="p-3 space-y-2"
        style={{ background: `linear-gradient(135deg, ${hex}08 0%, transparent 50%)` }}
      >
        {/* Header row: icon + mission label + phase badge + timer */}
        <div className="flex items-center gap-2 min-w-0">
          <MissionIcon mission={mission} size={14} className="flex-shrink-0" />

          <span
            className="text-xs font-semibold tracking-tight truncate"
            style={{ color: hex }}
          >
            {missionLabel}
          </span>

          <span
            className={cn(
              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold border flex-shrink-0',
              pStyle.classes,
            )}
          >
            <span
              className={cn(
                'w-1 h-1 rounded-full flex-shrink-0',
                pStyle.dot,
                pStyle.pulse && 'animate-pulse',
              )}
            />
            {phaseLabel}
          </span>

          <Timer
            endTime={new Date(movement.arrivalTime)}
            className="ml-auto flex-shrink-0"
          />
        </div>

        {/* Route */}
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground min-w-0">
          <span className="truncate">{originLabel}</span>
          <span className="flex-shrink-0 text-muted-foreground/40">→</span>
          <span className="flex-shrink-0 font-mono">{targetCoords}</span>
        </div>

        {/* Ships row + progress/stepper */}
        <div className="flex items-end justify-between gap-2">
          {/* Mini ship thumbnails */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {visibleShips.map(([shipId]) => (
              <GameImage
                key={shipId}
                category="ships"
                id={shipId}
                size="icon"
                alt={shipNames[shipId] ?? shipId}
                className="h-5 w-5 rounded-sm"
              />
            ))}
            {overflowCount > 0 && (
              <span className="text-[9px] text-muted-foreground/60 leading-none px-0.5">
                +{overflowCount}
              </span>
            )}
          </div>

          {/* Progress bar or mining stepper */}
          <div className="flex-1 min-w-0">
            {isMine ? (
              <MiningStepperCompact phase={movement.phase} hex={hex} />
            ) : (
              <div className="h-1 w-full rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-1 rounded-full transition-[width] duration-1000 ease-linear"
                  style={{ width: '50%', background: hex }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
