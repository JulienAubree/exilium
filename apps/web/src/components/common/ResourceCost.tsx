import { cn } from '@/lib/utils';

interface ResourceCostProps {
  minerai: number;
  silicium: number;
  hydrogene: number;
  currentMinerai?: number;
  currentSilicium?: number;
  currentHydrogene?: number;
}

function ResourceIcon({ color }: { color: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" className="inline-block">
      <circle cx="5" cy="5" r="4" fill={color} opacity="0.8" />
    </svg>
  );
}

const RESOURCE_COLORS = {
  minerai: '#8b9dc3',
  silicium: '#6ecfef',
  hydrogene: '#4db8a4',
};

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
    { name: 'Minerai', value: minerai, current: currentMinerai, color: RESOURCE_COLORS.minerai, textClass: 'text-minerai' },
    { name: 'Silicium', value: silicium, current: currentSilicium, color: RESOURCE_COLORS.silicium, textClass: 'text-silicium' },
    { name: 'H\u2082', value: hydrogene, current: currentHydrogene, color: RESOURCE_COLORS.hydrogene, textClass: 'text-hydrogene' },
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
            <ResourceIcon color={item.color} />
            {item.value.toLocaleString('fr-FR')}
          </span>
        ) : null,
      )}
    </div>
  );
}
