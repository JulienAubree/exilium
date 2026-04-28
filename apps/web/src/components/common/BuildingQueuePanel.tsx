import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Timer } from '@/components/common/Timer';
import { BuildingsIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';

type UpgradingBuilding = {
  id: string;
  name: string;
  currentLevel: number;
  nextLevelTime: number;
  upgradeEndTime: string | null;
};

interface BuildingQueuePanelProps {
  upgradingBuilding: UpgradingBuilding | null;
  onTimerComplete: () => void;
  onCancel: () => void;
  cancelPending?: boolean;
  /** Optional click handler to open the building details when the user taps the panel header. */
  onOpenDetail?: () => void;
  /** Optional speed reduction percentage to show as a badge (e.g. robotics building_time bonus). */
  speedReductionPercent?: number;
}

/**
 * Compact, collapsible "construction queue" panel matching the visual language
 * of the research queue (ResearchActivePanel). Designed to live inside a
 * facility hero so the page header carries the live state without a separate
 * tall card below it.
 */
export function BuildingQueuePanel({
  upgradingBuilding,
  onTimerComplete,
  onCancel,
  cancelPending = false,
  onOpenDetail,
  speedReductionPercent,
}: BuildingQueuePanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    if (!upgradingBuilding?.upgradeEndTime) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [upgradingBuilding?.upgradeEndTime]);

  let progressPercent = 0;
  if (upgradingBuilding?.upgradeEndTime) {
    const end = new Date(upgradingBuilding.upgradeEndTime).getTime();
    const totalMs = upgradingBuilding.nextLevelTime * 1000;
    const start = end - totalMs;
    progressPercent = Math.max(0, Math.min(100, ((nowTick - start) / totalMs) * 100));
  }

  return (
    <div
      className={cn(
        'mt-4 rounded-xl border bg-black/30 backdrop-blur-sm overflow-hidden transition-colors',
        expanded ? 'border-amber-500/40 shadow-lg shadow-amber-500/5' : 'border-white/10',
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-white/[0.03] transition-colors"
        aria-expanded={expanded}
      >
        <div className="relative shrink-0">
          <BuildingsIcon width={18} height={18} className="text-amber-400" />
          {upgradingBuilding && (
            <span className="absolute -top-1 -right-1 inline-flex h-2 w-2 rounded-full bg-amber-400 shadow shadow-amber-400/40 animate-pulse" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 text-xs">
            {upgradingBuilding ? (
              <span className="font-semibold text-foreground truncate">
                {upgradingBuilding.name}{' '}
                <span className="text-muted-foreground font-normal">
                  Niv. {upgradingBuilding.currentLevel + 1}
                </span>
              </span>
            ) : (
              <span className="text-muted-foreground italic">Aucune construction en cours</span>
            )}
            {speedReductionPercent != null && speedReductionPercent > 0 && (
              <span className="ml-auto rounded bg-emerald-500/15 border border-emerald-500/40 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400 shrink-0">
                −{speedReductionPercent}% vitesse
              </span>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-[width] duration-500 ease-linear',
                  upgradingBuilding ? 'bg-gradient-to-r from-amber-500 to-amber-300' : 'bg-white/10',
                )}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {upgradingBuilding?.upgradeEndTime && (
              <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                fin {new Date(upgradingBuilding.upgradeEndTime).toLocaleString('fr-FR', {
                  hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit',
                })}
              </span>
            )}
          </div>
        </div>

        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
      </button>

      {expanded && upgradingBuilding && upgradingBuilding.upgradeEndTime && (
        <div className="border-t border-white/5 px-3.5 py-3 space-y-2">
          <div className="rounded-lg bg-white/5 border-l-2 border-l-amber-400 px-3 py-2 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDetail?.();
                }}
                className="font-medium text-left hover:text-amber-300 transition-colors"
                disabled={!onOpenDetail}
              >
                {upgradingBuilding.name}{' '}
                <span className="text-muted-foreground">
                  Niv. {upgradingBuilding.currentLevel + 1}
                </span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel();
                }}
                disabled={cancelPending}
                className="text-xs text-destructive hover:text-destructive/80 font-medium"
              >
                Annuler
              </button>
            </div>
            <Timer
              endTime={new Date(upgradingBuilding.upgradeEndTime)}
              totalDuration={upgradingBuilding.nextLevelTime}
              onComplete={onTimerComplete}
            />
          </div>
        </div>
      )}
    </div>
  );
}
