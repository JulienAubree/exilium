import { useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Zap, Database, Swords } from 'lucide-react';
import { cn } from '@/lib/utils';

type Severity = 'critical' | 'warning';

interface Alert {
  id: string;
  severity: Severity;
  icon: ReactNode;
  message: string;
  to?: string;
}

/** Sous-ensemble structurel de `resource.production` dont les alertes ont besoin. */
export interface OverviewAlertData {
  minerai: number;
  silicium: number;
  hydrogene: number;
  rates: {
    mineraiPerHour: number;
    siliciumPerHour: number;
    hydrogenePerHour: number;
    storageMineraiCapacity: number;
    storageSiliciumCapacity: number;
    storageHydrogeneCapacity: number;
    energyProduced: number;
    energyConsumed: number;
  };
}

const SEV_STYLE: Record<Severity, string> = {
  critical: 'border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15',
};

function formatDuration(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} j`;
}

/**
 * Calcule les signaux qui « demandent l'attention » du joueur à partir de
 * données déjà chargées par l'Overview — ces infos existaient mais étaient
 * enterrées dans les onglets dédiés (Énergie, Ressources). On les remonte.
 */
function computeAlerts(data: OverviewAlertData | undefined, hostileCount: number): Alert[] {
  const alerts: Alert[] = [];

  if (hostileCount > 0) {
    alerts.push({
      id: 'attack',
      severity: 'critical',
      icon: <Swords className="h-4 w-4" />,
      message: hostileCount > 1 ? `${hostileCount} flottes hostiles en approche` : 'Flotte hostile en approche',
      to: '/fleet/movements',
    });
  }

  if (!data) return alerts;
  const r = data.rates;

  if (r.energyConsumed > r.energyProduced) {
    alerts.push({
      id: 'energy',
      severity: 'warning',
      icon: <Zap className="h-4 w-4" />,
      message: 'Déficit énergétique — production des mines réduite',
      to: '/energy',
    });
  }

  const resources = [
    { key: 'minerai', label: 'Minerai', value: data.minerai, cap: r.storageMineraiCapacity, rate: r.mineraiPerHour },
    { key: 'silicium', label: 'Silicium', value: data.silicium, cap: r.storageSiliciumCapacity, rate: r.siliciumPerHour },
    { key: 'hydrogene', label: 'Hydrogène', value: data.hydrogene, cap: r.storageHydrogeneCapacity, rate: r.hydrogenePerHour },
  ];
  for (const x of resources) {
    if (x.cap <= 0) continue;
    if (x.value >= x.cap) {
      alerts.push({
        id: `full-${x.key}`,
        severity: 'warning',
        icon: <Database className="h-4 w-4" />,
        message: `Stockage ${x.label} plein — production perdue`,
        to: '/resources',
      });
    } else if (x.rate > 0) {
      const hoursToFull = (x.cap - x.value) / x.rate;
      if (hoursToFull <= 24) {
        alerts.push({
          id: `near-${x.key}`,
          severity: 'warning',
          icon: <Database className="h-4 w-4" />,
          message: `Stockage ${x.label} plein dans ~${formatDuration(hoursToFull)}`,
          to: '/resources',
        });
      }
    }
  }

  return alerts;
}

/**
 * Bandeau « cockpit » en tête de l'Overview : ce qui demande l'attention du
 * joueur, au coup d'œil. Ne rend rien si tout va bien.
 */
export function OverviewAlerts({ data, hostileCount }: { data?: OverviewAlertData; hostileCount: number }) {
  const navigate = useNavigate();
  const alerts = useMemo(() => computeAlerts(data, hostileCount), [data, hostileCount]);
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {alerts.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={a.to ? () => navigate(a.to!) : undefined}
          className={cn(
            'flex min-h-[44px] w-full items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-left text-sm font-medium transition-colors',
            SEV_STYLE[a.severity],
            !a.to && 'cursor-default',
          )}
        >
          <span className="shrink-0">{a.icon}</span>
          <span className="flex-1">{a.message}</span>
          {a.to && <span className="shrink-0 text-xs opacity-60">→</span>}
        </button>
      ))}
    </div>
  );
}
