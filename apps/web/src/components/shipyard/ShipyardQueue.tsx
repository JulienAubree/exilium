import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Timer } from '@/components/common/Timer';
import { cn } from '@/lib/utils';
import { getShipName } from '@/lib/entity-names';
import { useGameConfig } from '@/hooks/useGameConfig';

type GameConfigData = ReturnType<typeof useGameConfig>['data'];

type QueueEntry = {
  id: string;
  itemId: string;
  status: 'active' | 'queued' | string;
  quantity: number;
  completedCount?: number | null;
  startTime: string | Date;
  endTime?: string | Date | null;
};

type ShipRef = { id: string; timePerUnit: number };

interface ShipyardQueueProps {
  queue: QueueEntry[];
  ships: ShipRef[];
  gameConfig: GameConfigData;
  onTimerComplete: () => void;
  onReduce: (batchId: string) => void;
  onCancel: (batchId: string) => void;
  reducePending: boolean;
  cancelPending: boolean;
}

export function ShipyardQueue({
  queue,
  ships,
  gameConfig,
  onTimerComplete,
  onReduce,
  onCancel,
  reducePending,
  cancelPending,
}: ShipyardQueueProps) {
  const [expanded, setExpanded] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());

  // Tick every second so the collapsed-state progress bar animates smoothly.
  useEffect(() => {
    if (queue.length === 0) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [queue.length]);

  if (queue.length === 0) return null;

  const activeEntries = queue.filter((e) => e.status === 'active');
  const parallelSlots = activeEntries.length;
  const totalUnits = queue.reduce((sum, e) => sum + (e.quantity - (e.completedCount ?? 0)), 0);

  // ── Queue end ETA ──────────────────────────────────────────────────────
  let queueEndTime: Date | null = null;
  let totalMs = 0;
  const queuedItems = queue.filter((e) => e.status === 'queued');
  const totalQueuedUnits = queuedItems.reduce((sum, e) => sum + (e.quantity - (e.completedCount ?? 0)), 0);
  let longestActiveMs = 0;
  for (const item of activeEntries) {
    const remaining = item.quantity - (item.completedCount ?? 0);
    if (item.endTime) {
      const unitDurationMs = new Date(item.endTime).getTime() - new Date(item.startTime).getTime();
      const itemMs = (new Date(item.endTime).getTime() - nowTick) + unitDurationMs * (remaining - 1);
      if (itemMs > longestActiveMs) longestActiveMs = itemMs;
    }
  }
  totalMs = longestActiveMs;
  if (totalQueuedUnits > 0 && parallelSlots > 0) {
    const sampleShip = ships.find((s) => s.id === queuedItems[0]?.itemId);
    if (sampleShip) {
      totalMs += Math.ceil(totalQueuedUnits / Math.max(1, parallelSlots)) * sampleShip.timePerUnit * 1000;
    }
  }
  if (totalMs > 0) queueEndTime = new Date(nowTick + totalMs);

  // ── Current unit progress (for the collapsed progress bar) ─────────────
  // Pick the soonest-finishing active entry so the bar reflects the next completion.
  let progressPercent = 0;
  let soonest: QueueEntry | null = null;
  let soonestEnd = Infinity;
  for (const item of activeEntries) {
    if (!item.endTime) continue;
    const end = new Date(item.endTime).getTime();
    if (end < soonestEnd) {
      soonestEnd = end;
      soonest = item;
    }
  }
  if (soonest?.endTime) {
    const start = new Date(soonest.startTime).getTime();
    const end = new Date(soonest.endTime).getTime();
    progressPercent = Math.max(0, Math.min(100, ((nowTick - start) / (end - start)) * 100));
  }

  const soonestName = soonest ? getShipName(soonest.itemId, gameConfig) : null;

  return (
    <div
      className={cn(
        'mt-4 rounded-xl border bg-black/30 backdrop-blur-sm overflow-hidden transition-colors',
        expanded ? 'border-cyan-500/40 shadow-lg shadow-cyan-500/5' : 'border-white/10',
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-white/[0.03] transition-colors"
        aria-expanded={expanded}
      >
        <div className="relative shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-400">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          {parallelSlots > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex h-2 w-2 rounded-full bg-cyan-400 shadow shadow-cyan-400/40 animate-pulse" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 text-xs">
            <span className="font-semibold text-foreground">
              {totalUnits} vaisseau{totalUnits > 1 ? 'x' : ''} en construction
            </span>
            {soonestName && (
              <span className="text-muted-foreground truncate hidden sm:inline">
                · prochain : <span className="text-foreground/80">{soonestName}</span>
              </span>
            )}
            {parallelSlots > 1 && (
              <span className="ml-auto rounded bg-cyan-500/20 border border-cyan-500/40 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-400">
                x{parallelSlots}
              </span>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-cyan-300 transition-[width] duration-500 ease-linear"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {queueEndTime && (
              <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                fin {queueEndTime.toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
              </span>
            )}
          </div>
        </div>

        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn('shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-white/5 px-3.5 py-3 space-y-2.5">
          {queue.map((item) => {
            const name = getShipName(item.itemId, gameConfig);
            const remaining = item.quantity - (item.completedCount ?? 0);
            return (
              <div
                key={item.id}
                className={cn(
                  'space-y-1 border-l-2 pl-3',
                  item.status === 'active' ? 'border-l-cyan-400' : 'border-l-white/20',
                )}
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {remaining}x {name}
                    {item.status === 'active' && parallelSlots > 1 && (
                      <span className="ml-1.5 text-[10px] text-cyan-400 font-normal">(slot actif)</span>
                    )}
                  </span>
                  <div className="flex items-center gap-1">
                    {remaining > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => onReduce(item.id)}
                        disabled={reducePending}
                      >
                        -1
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={() => onCancel(item.id)}
                      disabled={cancelPending}
                    >
                      Annuler
                    </Button>
                  </div>
                </div>
                {item.status === 'active' && item.endTime && (
                  <Timer
                    endTime={new Date(item.endTime)}
                    totalDuration={Math.floor((new Date(item.endTime).getTime() - new Date(item.startTime).getTime()) / 1000)}
                    onComplete={onTimerComplete}
                  />
                )}
                {item.status === 'queued' && (
                  <span className="text-xs text-muted-foreground">En attente</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
