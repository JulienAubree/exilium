import { cn } from '@/lib/utils';

interface ResourceCostProps {
  metal: number;
  crystal: number;
  deuterium: number;
  currentMetal?: number;
  currentCrystal?: number;
  currentDeuterium?: number;
}

function ResourceIcon({ color }: { color: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" className="inline-block">
      <circle cx="5" cy="5" r="4" fill={color} opacity="0.8" />
    </svg>
  );
}

const RESOURCE_COLORS = {
  metal: '#8b9dc3',
  crystal: '#6ecfef',
  deuterium: '#4db8a4',
};

export function ResourceCost({
  metal,
  crystal,
  deuterium,
  currentMetal,
  currentCrystal,
  currentDeuterium,
}: ResourceCostProps) {
  const canAfford = (cost: number, current?: number) =>
    current === undefined || current >= cost;

  const items = [
    { name: 'Metal', value: metal, current: currentMetal, color: RESOURCE_COLORS.metal, textClass: 'text-metal' },
    { name: 'Cristal', value: crystal, current: currentCrystal, color: RESOURCE_COLORS.crystal, textClass: 'text-crystal' },
    { name: 'Deut', value: deuterium, current: currentDeuterium, color: RESOURCE_COLORS.deuterium, textClass: 'text-deuterium' },
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
