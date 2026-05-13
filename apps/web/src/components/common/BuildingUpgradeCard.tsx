import { ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResourceCost } from '@/components/common/ResourceCost';
import { Timer } from '@/components/common/Timer';
import { PrerequisiteList, buildPrerequisiteItems } from '@/components/common/PrerequisiteList';
import { CraftEtaBadge } from '@/components/common/CraftEtaBadge';
import { ClockIcon } from '@/components/icons/utility-icons';
import { formatDuration } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useGameConfig } from '@/hooks/useGameConfig';
import type { CraftRates } from '@/lib/craft-eta';

type GameConfigData = ReturnType<typeof useGameConfig>['data'];

type BuildingPrereq = { buildingId: string; level: number; currentLevel?: number };

interface BuildingUpgradeCardProps {
  currentLevel: number;
  nextLevelCost: { minerai: number; silicium: number; hydrogene: number };
  nextLevelTime: number;
  prerequisites: BuildingPrereq[];
  isUpgrading: boolean;
  upgradeEndTime: string | null;
  resources: { minerai: number; silicium: number; hydrogene: number };
  buildingLevels: Record<string, number>;
  isAnyUpgrading: boolean;
  upgradePending: boolean;
  cancelPending: boolean;
  gameConfig: GameConfigData;
  /** Production rates — when provided, displays a "Dispo dans ~Xh" ETA on cards
   *  whose cost exceeds the current resources. */
  rates?: CraftRates;
  onUpgrade: () => void;
  onCancel: () => void;
  onTimerComplete: () => void;
}

export function BuildingUpgradeCard({
  currentLevel,
  nextLevelCost,
  nextLevelTime,
  prerequisites,
  isUpgrading,
  upgradeEndTime,
  resources,
  buildingLevels,
  isAnyUpgrading,
  upgradePending,
  cancelPending,
  gameConfig,
  rates,
  onUpgrade,
  onCancel,
  onTimerComplete,
}: BuildingUpgradeCardProps) {
  const nextLevel = currentLevel + 1;
  const isConstruction = currentLevel === 0;

  const canAfford =
    resources.minerai >= nextLevelCost.minerai &&
    resources.silicium >= nextLevelCost.silicium &&
    resources.hydrogene >= nextLevelCost.hydrogene;

  const prereqsMet = prerequisites.every((p) => {
    const lvl = p.currentLevel ?? buildingLevels[p.buildingId] ?? 0;
    return lvl >= p.level;
  });

  // ── Currently upgrading: show timer + cancel ────────────────────────────
  if (isUpgrading && upgradeEndTime) {
    return (
      <div className="w-full sm:w-64 shrink-0 rounded-xl border border-amber-500/40 bg-black/30 backdrop-blur-sm p-3 space-y-2 shadow-lg shadow-amber-500/5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold">{isConstruction ? 'Construction en cours' : 'Amélioration en cours'}</span>
          <span className="text-[10px] font-mono text-muted-foreground">Niv. {currentLevel} → {nextLevel}</span>
        </div>
        <Timer
          endTime={new Date(upgradeEndTime)}
          totalDuration={nextLevelTime}
          onComplete={onTimerComplete}
        />
        <Button
          variant="outline"
          size="sm"
          className="w-full h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
          onClick={onCancel}
          disabled={cancelPending}
        >
          Annuler
        </Button>
      </div>
    );
  }

  // ── Not upgrading: show next-level cost + button ────────────────────────
  const missingPrereqs = !prereqsMet;

  return (
    <div
      className={cn(
        'w-full sm:w-64 shrink-0 rounded-xl border bg-black/30 backdrop-blur-sm p-3 space-y-2',
        canAfford && !missingPrereqs && !isAnyUpgrading
          ? 'border-primary/30 shadow-lg shadow-cyan-500/5'
          : 'border-white/10',
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{isConstruction ? 'Construction' : 'Amélioration'}</span>
        <span className="text-[10px] font-mono text-muted-foreground">Niv. {currentLevel} → {nextLevel}</span>
      </div>

      <ResourceCost
        minerai={nextLevelCost.minerai}
        silicium={nextLevelCost.silicium}
        hydrogene={nextLevelCost.hydrogene}
        currentMinerai={resources.minerai}
        currentSilicium={resources.silicium}
        currentHydrogene={resources.hydrogene}
      />

      <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground font-mono">
        <span className="inline-flex items-center gap-1">
          <ClockIcon className="h-3 w-3" />
          {formatDuration(nextLevelTime)}
        </span>
        {!canAfford && rates && (
          <CraftEtaBadge
            cost={nextLevelCost}
            stock={resources}
            rates={rates}
          />
        )}
      </div>

      {missingPrereqs ? (
        <PrerequisiteList
          items={buildPrerequisiteItems(
            { buildings: prerequisites },
            Object.fromEntries(prerequisites.map((p) => [p.buildingId, p.currentLevel ?? buildingLevels[p.buildingId] ?? 0])),
            {},
            gameConfig,
          )}
          missingOnly
        />
      ) : (
        <Button
          variant="retro"
          size="sm"
          className="w-full h-8 text-xs"
          onClick={onUpgrade}
          disabled={!canAfford || isAnyUpgrading || upgradePending}
        >
          <ArrowUp className="h-3 w-3 mr-1" />
          {isConstruction ? 'Construire' : 'Améliorer'}
        </Button>
      )}
    </div>
  );
}
