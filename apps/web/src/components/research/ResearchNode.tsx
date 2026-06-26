/**
 * ResearchNode — carte de recherche individuelle réutilisable dans la vue arbre.
 *
 * Gère les états : locked (fork non choisi / mauvaise voie / prérequis),
 * available, in-progress (timer), max.
 * Réutilise l'art et les composants existants de Research.tsx.
 */
import { trpc } from '@/trpc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GameImage } from '@/components/common/GameImage';
import { ResourceCost } from '@/components/common/ResourceCost';
import { CraftEtaBadge } from '@/components/common/CraftEtaBadge';
import { Timer } from '@/components/common/Timer';
import { ClockIcon } from '@/components/icons/utility-icons';
import { PrerequisiteList, buildPrerequisiteItems } from '@/components/common/PrerequisiteList';
import { useGameConfig } from '@/hooks/useGameConfig';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/lib/format';
import { Lock } from 'lucide-react';
import type { ResearchItem } from './research-tree.types';

interface ResearchNodeProps {
  tech: ResearchItem;
  resources: { minerai: number; silicium: number; hydrogene: number };
  craftRates?: { mineraiPerHour: number; siliciumPerHour: number; hydrogenePerHour: number };
  isAnyResearching: boolean;
  buildingLevels: Record<string, number>;
  researchLevels: Record<string, number>;
  /** Verrouillé par un fork non choisi ou une mauvaise voie. */
  locked: boolean;
  onStartSuccess: () => void;
  onDetailOpen: (id: string) => void;
}

export function ResearchNode({
  tech,
  resources,
  craftRates,
  isAnyResearching,
  buildingLevels,
  researchLevels,
  locked,
  onStartSuccess,
  onDetailOpen,
}: ResearchNodeProps) {
  const { data: gameConfig } = useGameConfig();
  const utils = trpc.useUtils();

  const startMutation = trpc.research.start.useMutation({
    onSuccess: () => {
      utils.research.list.invalidate();
      utils.planet.empire.invalidate();
      utils.tutorial.getCurrent.invalidate();
      onStartSuccess();
    },
  });

  const canAfford =
    resources.minerai >= tech.nextLevelCost.minerai &&
    resources.silicium >= tech.nextLevelCost.silicium &&
    resources.hydrogene >= tech.nextLevelCost.hydrogene;

  const isMaxed = tech.maxLevel != null && tech.currentLevel >= tech.maxLevel;

  // Determine lock reason for tooltip-like label
  const lockReason = locked
    ? tech.forkId
      ? 'Voie non choisie'
      : 'Prérequis manquants'
    : !tech.prerequisitesMet
      ? 'Prérequis manquants'
      : null;

  return (
    <button
      onClick={() => onDetailOpen(tech.id)}
      className={cn(
        'retro-card relative text-left cursor-pointer overflow-hidden flex flex-col w-full',
        (locked || !tech.prerequisitesMet) && 'opacity-60',
      )}
    >
      {/* Lock badge */}
      {lockReason && (
        <span className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded bg-black/60 border border-border/50 px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
          <Lock className="h-2.5 w-2.5" />
          {lockReason}
        </span>
      )}

      {/* Art */}
      <div className="relative h-[100px] overflow-hidden">
        <GameImage
          category="research"
          id={tech.id}
          size="full"
          alt={tech.name}
          className="w-full h-full object-cover"
        />
        <span className="absolute top-2 right-2 bg-emerald-700 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
          Niv. {tech.currentLevel}
          {tech.maxLevel != null && `/${tech.maxLevel}`}
        </span>
      </div>

      {/* Body */}
      <div className="p-2 flex flex-col flex-1 gap-1">
        <div className="text-[12px] font-semibold text-foreground truncate">{tech.name}</div>

        <div className="flex-1" />

        {tech.isResearching && tech.researchEndTime ? (
          <Timer
            endTime={new Date(tech.researchEndTime)}
            totalDuration={tech.nextLevelTime}
            onComplete={() => {
              utils.research.list.invalidate();
              utils.tutorial.getCurrent.invalidate();
            }}
          />
        ) : isMaxed ? (
          <Badge variant="secondary" className="text-xs self-start">
            Maximum
          </Badge>
        ) : locked ? (
          /* Locked by fork — just show the lock badge already rendered above, no cost */
          <span className="text-xs text-muted-foreground italic">Déverrouillez la voie</span>
        ) : (
          <>
            <ResourceCost
              minerai={tech.nextLevelCost.minerai}
              silicium={tech.nextLevelCost.silicium}
              hydrogene={tech.nextLevelCost.hydrogene}
              currentMinerai={resources.minerai}
              currentSilicium={resources.silicium}
              currentHydrogene={resources.hydrogene}
            />
            <div className="text-xs text-muted-foreground font-mono flex items-center gap-1">
              <ClockIcon className="h-2.5 w-2.5" />
              {formatDuration(tech.nextLevelTime)}
            </div>
            {craftRates && !canAfford && tech.prerequisitesMet && (
              <CraftEtaBadge
                cost={tech.nextLevelCost}
                stock={{
                  minerai: resources.minerai,
                  silicium: resources.silicium,
                  hydrogene: resources.hydrogene,
                }}
                rates={craftRates}
              />
            )}
            {!tech.prerequisitesMet ? (
              <PrerequisiteList
                items={buildPrerequisiteItems(
                  gameConfig?.research[tech.id]?.prerequisites ?? {},
                  buildingLevels,
                  researchLevels,
                  gameConfig,
                )}
                missingOnly
              />
            ) : (
              <Button
                size="sm"
                className="w-full text-xs py-0.5 h-7"
                onClick={(e) => {
                  e.stopPropagation();
                  startMutation.mutate({ researchId: tech.id as any });
                }}
                disabled={
                  !canAfford || isAnyResearching || startMutation.isPending || locked
                }
              >
                Rechercher
              </Button>
            )}
          </>
        )}
      </div>
    </button>
  );
}
