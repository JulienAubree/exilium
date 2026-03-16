import { cn } from '@/lib/utils';
import { MineraiIcon, SiliciumIcon, HydrogeneIcon } from './ResourceIcons';

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
    <div className="flex flex-wrap gap-3 text-xs">
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
                ? `${(item.value - item.current).toLocaleString('fr-FR')} manquant`
                : undefined
            }
          >
            {item.icon}
            {item.value.toLocaleString('fr-FR')}
          </span>
        ) : null,
      )}
    </div>
  );
}
