import { Button } from '@/components/ui/button';
import { ResourceCost } from '@/components/common/ResourceCost';
import { CraftEtaBadge } from '@/components/common/CraftEtaBadge';
import { QuantityStepper } from '@/components/common/QuantityStepper';
import { GameImage } from '@/components/common/GameImage';
import { PrerequisiteList, buildPrerequisiteItems } from '@/components/common/PrerequisiteList';
import { ClockIcon } from '@/components/icons/utility-icons';
import { formatDuration } from '@/lib/format';
import type { CraftRates } from '@/lib/craft-eta';
import { cn } from '@/lib/utils';
import { useGameConfig } from '@/hooks/useGameConfig';

type GameConfigData = ReturnType<typeof useGameConfig>['data'];

type Ship = {
  id: string;
  name: string;
  count: number;
  timePerUnit: number;
  cost: { minerai: number; silicium: number; hydrogene: number };
  prerequisitesMet: boolean;
};

interface ShipCardProps {
  ship: Ship;
  quantity: number;
  maxAffordable: number;
  canAfford: boolean;
  highlighted: boolean;
  resources: { minerai: number; silicium: number; hydrogene: number };
  rates?: CraftRates;
  gameConfig: GameConfigData;
  buildingLevels: Record<string, number>;
  researchLevels: Record<string, number>;
  buildPending: boolean;
  onQuantityChange: (value: number) => void;
  onBuild: () => void;
  onOpenDetail: () => void;
}

export function ShipCard({
  ship,
  quantity,
  maxAffordable,
  canAfford,
  highlighted,
  resources,
  rates,
  gameConfig,
  buildingLevels,
  researchLevels,
  buildPending,
  onQuantityChange,
  onBuild,
  onOpenDetail,
}: ShipCardProps) {
  return (
    <button
      type="button"
      onClick={onOpenDetail}
      className={cn(
        'retro-card relative text-left cursor-pointer overflow-hidden flex flex-col',
        !ship.prerequisitesMet && 'opacity-50',
        highlighted && 'ring-2 ring-amber-500/60 shadow-lg shadow-amber-500/10',
      )}
    >
      {highlighted && (
        <span className="absolute top-2 right-2 z-10 rounded bg-amber-500/20 border border-amber-500/50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-400">
          Objectif
        </span>
      )}
      <div className="relative h-[130px] overflow-hidden">
        <GameImage
          category="ships"
          id={ship.id}
          size="full"
          alt={ship.name}
          className="w-full h-full object-cover"
        />
        <span className="absolute top-2 right-2 bg-slate-700/80 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
          x{ship.count}
        </span>
      </div>

      <div className="p-3 flex flex-col flex-1 gap-1.5">
        <div className="text-[13px] font-semibold text-foreground truncate">{ship.name}</div>
        <div className="flex-1" />

        <ResourceCost
          minerai={ship.cost.minerai}
          silicium={ship.cost.silicium}
          hydrogene={ship.cost.hydrogene}
          currentMinerai={resources.minerai}
          currentSilicium={resources.silicium}
          currentHydrogene={resources.hydrogene}
        />
        <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
          <ClockIcon className="h-3 w-3" />
          {formatDuration(ship.timePerUnit)}
        </div>
        {rates && !canAfford && ship.prerequisitesMet && (
          <CraftEtaBadge cost={ship.cost} stock={resources} rates={rates} quantity={quantity} />
        )}
        {!ship.prerequisitesMet ? (
          <PrerequisiteList
            items={buildPrerequisiteItems(
              gameConfig?.ships[ship.id]?.prerequisites ?? {},
              buildingLevels,
              researchLevels,
              gameConfig,
            )}
            missingOnly
          />
        ) : (
          <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
            <QuantityStepper value={quantity} onChange={onQuantityChange} max={maxAffordable} />
            <Button
              variant="retro"
              size="sm"
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                onBuild();
              }}
              disabled={!canAfford || buildPending}
            >
              Construire
            </Button>
          </div>
        )}
      </div>
    </button>
  );
}
