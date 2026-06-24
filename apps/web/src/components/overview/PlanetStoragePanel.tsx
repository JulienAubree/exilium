import { Database } from 'lucide-react';
import { trpc } from '@/trpc';
import { cn } from '@/lib/utils';
import { MineraiIcon, SiliciumIcon, HydrogeneIcon } from '@/components/common/ResourceIcons';

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.floor(value));
}

function formatTimeToFull(hours: number): string {
  if (hours < 1) return `plein dans ${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `plein dans ${Math.round(hours)} h`;
  return `plein dans ${Math.round(hours / 24)} j`;
}

/**
 * Panneau stockage compact pour la Vue d'ensemble (refonte IA : « fusionner
 * Ressources dans Vue d'ensemble »). Reprend la projection « plein dans X j »
 * de l'ex-page /resources. Les mines (upgrade) vivent dans Bâtiments, les taux
 * dans la topbar — ici on ne garde que l'état des stocks.
 */
export function PlanetStoragePanel({ planetId }: { planetId?: string }) {
  const { data } = trpc.resource.production.useQuery({ planetId: planetId! }, { enabled: !!planetId });
  if (!data) return null;

  const rows = [
    { key: 'minerai', label: 'Minerai', Icon: MineraiIcon, color: 'text-minerai', fill: 'bg-minerai', current: data.minerai, capacity: data.rates.storageMineraiCapacity, perHour: data.rates.mineraiPerHour },
    { key: 'silicium', label: 'Silicium', Icon: SiliciumIcon, color: 'text-silicium', fill: 'bg-silicium', current: data.silicium, capacity: data.rates.storageSiliciumCapacity, perHour: data.rates.siliciumPerHour },
    { key: 'hydrogene', label: 'Hydrogène', Icon: HydrogeneIcon, color: 'text-hydrogene', fill: 'bg-hydrogene', current: data.hydrogene, capacity: data.rates.storageHydrogeneCapacity, perHour: data.rates.hydrogenePerHour },
  ];

  return (
    <div className="glass-card p-4">
      <div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Database className="h-3 w-3" />
        Stockage
      </div>
      <div className="space-y-2.5">
        {rows.map((row) => {
          const pct = row.capacity > 0 ? Math.min(100, (row.current / row.capacity) * 100) : 0;
          const full = row.capacity > 0 && row.current >= row.capacity;
          const hoursToFull = !full && row.perHour > 0 && row.capacity > 0 ? (row.capacity - row.current) / row.perHour : 0;
          return (
            <div key={row.key}>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <row.Icon size={13} className={row.color} />
                  <span className="text-muted-foreground">{row.label}</span>
                </span>
                <span className="tabular-nums text-muted-foreground">
                  <span className={cn('font-display font-semibold', row.color)}>{formatCompact(row.current)}</span>
                  {' / '}
                  {formatCompact(row.capacity)}
                  {full ? (
                    <span className="ml-2 font-medium text-amber-400">plein — prod. perdue</span>
                  ) : (
                    hoursToFull > 0 && <span className="ml-2 text-muted-foreground/70">{formatTimeToFull(hoursToFull)}</span>
                  )}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full transition-all', full ? 'animate-pulse bg-amber-400' : row.fill)}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
