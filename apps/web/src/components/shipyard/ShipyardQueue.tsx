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
  if (queue.length === 0) return null;

  const activeEntries = queue.filter((e) => e.status === 'active');
  const parallelSlots = activeEntries.length;

  let queueEndTime: Date | null = null;
  let totalMs = 0;
  const queuedItems = queue.filter((e) => e.status === 'queued');
  const totalQueuedUnits = queuedItems.reduce((sum, e) => sum + (e.quantity - (e.completedCount ?? 0)), 0);
  let longestActiveMs = 0;
  for (const item of activeEntries) {
    const remaining = item.quantity - (item.completedCount ?? 0);
    if (item.endTime) {
      const unitDurationMs = new Date(item.endTime).getTime() - new Date(item.startTime).getTime();
      const itemMs = (new Date(item.endTime).getTime() - Date.now()) + unitDurationMs * (remaining - 1);
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
  if (totalMs > 0) queueEndTime = new Date(Date.now() + totalMs);

  return (
    <section className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <h2 className="text-base font-semibold">File de construction</h2>
          {parallelSlots > 1 && (
            <span className="rounded bg-cyan-500/20 border border-cyan-500/50 px-2 py-0.5 text-[10px] font-semibold text-cyan-400">
              x{parallelSlots} parallele
            </span>
          )}
        </div>
        {queueEndTime && (
          <span className="text-xs text-muted-foreground">
            Fin : {queueEndTime.toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {queue.map((item) => {
          const name = getShipName(item.itemId, gameConfig);
          const remaining = item.quantity - (item.completedCount ?? 0);
          return (
            <div
              key={item.id}
              className={cn(
                'space-y-1 border-l-4 pl-3',
                item.status === 'active' ? 'border-l-orange-500' : 'border-l-muted-foreground/30',
              )}
            >
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {remaining}x {name}
                  {item.status === 'active' && parallelSlots > 1 && (
                    <span className="ml-1.5 text-[10px] text-orange-400 font-normal">(slot actif)</span>
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
    </section>
  );
}
