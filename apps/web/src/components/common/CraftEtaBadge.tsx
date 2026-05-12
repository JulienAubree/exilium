import { Hourglass } from 'lucide-react';
import {
  calculateCraftEtaHours,
  type CraftCost,
  type CraftStock,
  type CraftRates,
} from '@/lib/craft-eta';
import { formatHoursMinutes } from '@/lib/format';
import { cn } from '@/lib/utils';

interface CraftEtaBadgeProps {
  cost: CraftCost;
  stock: CraftStock;
  rates: CraftRates;
  /** Batch multiplier — e.g. ship quantity in the shipyard. Defaults to 1. */
  quantity?: number;
  /** Optional extra Tailwind classes. */
  className?: string;
}

/**
 * Discreet inline badge that tells the player how long until they can afford
 * a craft (research, building upgrade, ship batch). Renders nothing when the
 * resources are already available — the build button itself signals that.
 *
 * Visually: matches the "duration" line already shown next to costs (font
 * mono, 10px, hourglass icon, muted by default; destructive tint when the
 * production is too low to ever reach the cost).
 */
export function CraftEtaBadge({ cost, stock, rates, quantity = 1, className }: CraftEtaBadgeProps) {
  const totalCost: CraftCost = {
    minerai: cost.minerai * quantity,
    silicium: cost.silicium * quantity,
    hydrogene: cost.hydrogene * quantity,
  };

  const etaHours = calculateCraftEtaHours(totalCost, stock, rates);

  // Already affordable — let the build button do the talking.
  if (etaHours === null) return null;

  if (etaHours === Infinity) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 font-mono text-[10px] text-destructive/80',
          className,
        )}
        title="Production insuffisante pour atteindre ce coût avec les rates actuels"
      >
        <Hourglass className="h-3 w-3" />
        Production insuffisante
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground',
        className,
      )}
      title="Temps estimé pour accumuler les ressources manquantes au taux de production actuel"
    >
      <Hourglass className="h-3 w-3" />
      Dispo dans ~{formatHoursMinutes(etaHours)}
    </span>
  );
}
