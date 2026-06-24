import { cn } from '@/lib/utils';
import { MineraiIcon, SiliciumIcon, HydrogeneIcon } from './ResourceIcons';

/** Coût compact pour la cohérence d'affichage : 1010046 → « 1.0M », 252511 → « 252.5k ». */
function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.round(value));
}

interface ResourceCostProps {
  minerai: number;
  silicium: number;
  hydrogene: number;
  currentMinerai?: number;
  currentSilicium?: number;
  currentHydrogene?: number;
}

export function ResourceCost({
  minerai,
  silicium,
  hydrogene,
  currentMinerai,
  currentSilicium,
  currentHydrogene,
}: ResourceCostProps) {
  const canAfford = (cost: number, current?: number) =>
    current === undefined || current >= cost;

  const items = [
    { name: 'Minerai', value: minerai, current: currentMinerai, icon: <MineraiIcon size={12} />, textClass: 'text-minerai' },
    { name: 'Silicium', value: silicium, current: currentSilicium, icon: <SiliciumIcon size={12} />, textClass: 'text-silicium' },
    { name: 'H\u2082', value: hydrogene, current: currentHydrogene, icon: <HydrogeneIcon size={12} />, textClass: 'text-hydrogene' },
  ];

  return (
    <div className="flex flex-wrap gap-3 text-xs tabular-nums">
      {items.map((item) =>
        item.value > 0 ? (
          <span
            key={item.name}
            className={cn(
              'flex items-center gap-1',
              canAfford(item.value, item.current) ? item.textClass : 'text-destructive',
            )}
            title={
              !canAfford(item.value, item.current) && item.current !== undefined
                ? `${item.value.toLocaleString('fr-FR')} · ${(item.value - item.current).toLocaleString('fr-FR')} manquant`
                : item.value.toLocaleString('fr-FR')
            }
          >
            {item.icon}
            {formatCompact(item.value)}
          </span>
        ) : null,
      )}
    </div>
  );
}
