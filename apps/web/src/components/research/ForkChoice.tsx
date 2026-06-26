/**
 * ForkChoice — rendu d'un tier de fork avec ses deux voies côte à côte.
 *
 * Comportements :
 * - Aucun choix → les deux voies affichent « Choisir cette voie » (→ chooseFork).
 * - Choix fait → voie active normale, voie adverse grisée + bouton « Respec ».
 * - showAction=false → rendu cards seulement, sans contrôle choose/respec
 *   (utilisé pour les tiers supérieurs d'un fork multi-tier comme defense_doctrine).
 */
import { useState } from 'react';
import { trpc } from '@/trpc';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useGameConfig } from '@/hooks/useGameConfig';
import { RespecDialog } from './RespecDialog';
import { ResearchNode } from './ResearchNode';
import type { ResearchItem, ForkChoices } from './research-tree.types';

interface ForkChoiceProps {
  forkId: string;
  /** Toutes les recherches du fork groupées par voie. */
  paths: Record<string, ResearchItem[]>;
  forkChoices: ForkChoices;
  resources: { minerai: number; silicium: number; hydrogene: number };
  craftRates?: { mineraiPerHour: number; siliciumPerHour: number; hydrogenePerHour: number };
  isAnyResearching: boolean;
  buildingLevels: Record<string, number>;
  researchLevels: Record<string, number>;
  onStartSuccess: () => void;
  onDetailOpen: (id: string) => void;
  /** Si false, masque les boutons Choisir/Respec (fork déjà contrôlé à un tier inférieur). */
  showAction?: boolean;
}

export function ForkChoice({
  forkId,
  paths,
  forkChoices,
  resources,
  craftRates,
  isAnyResearching,
  buildingLevels,
  researchLevels,
  onStartSuccess,
  onDetailOpen,
  showAction = true,
}: ForkChoiceProps) {
  const utils = trpc.useUtils();
  const { data: gameConfig } = useGameConfig();
  const [respecTarget, setRespecTarget] = useState<{
    currentPath: string;
    newPath: string;
  } | null>(null);

  const chooseForkMutation = trpc.research.chooseFork.useMutation({
    onSuccess: () => {
      utils.research.list.invalidate();
    },
  });

  const choice = forkChoices[forkId];
  const chosenPath = choice?.path ?? null;

  const pathEntries = Object.entries(paths);
  // All items across both paths (for reset list in RespecDialog)
  const allForkItems = pathEntries.flatMap(([, items]) => items);

  // Resolve fork + path labels from ui_labels seed
  const forkLabel = gameConfig?.labels[`research.fork.${forkId}`] ?? forkId;

  return (
    <>
      {/* Fork header */}
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border/50 border-dashed" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-card px-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">
            {forkLabel}
          </span>
        </div>
      </div>

      {/* Two paths side by side — stacked on mobile, two-column at lg+ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {pathEntries.map(([pathId, items]) => {
          const isChosen = chosenPath === pathId;
          const isOtherChosen = chosenPath !== null && !isChosen;
          const isUndecided = chosenPath === null;

          const pathLabel =
            gameConfig?.labels[`research.fork.${forkId}.${pathId}`] ?? pathId;

          return (
            <div
              key={pathId}
              className={cn(
                'rounded-lg border p-2 transition-all',
                isChosen && 'border-primary/40 bg-primary/5',
                isOtherChosen && 'border-border/30 opacity-50',
                isUndecided && 'border-border/50 bg-card/30',
              )}
            >
              {/* Path label */}
              <div className="mb-2 flex items-center justify-between px-1">
                <span
                  className={cn(
                    'text-xs font-bold uppercase tracking-wider',
                    isChosen ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {pathLabel}
                </span>
                {isChosen && (
                  <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
                    Actif
                  </span>
                )}
              </div>

              {/* Research nodes in this path */}
              <div className="space-y-2">
                {items.map((tech) => (
                  <ResearchNode
                    key={tech.id}
                    tech={tech}
                    resources={resources}
                    craftRates={craftRates}
                    isAnyResearching={isAnyResearching}
                    buildingLevels={buildingLevels}
                    researchLevels={researchLevels}
                    locked={tech.locked}
                    onStartSuccess={onStartSuccess}
                    onDetailOpen={onDetailOpen}
                  />
                ))}
              </div>

              {/* Fork action button — only at the first (lowest) tier of this fork */}
              {showAction && (
                <div className="mt-2 px-1">
                  {isUndecided && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs"
                      onClick={() => chooseForkMutation.mutate({ forkId, path: pathId })}
                      disabled={chooseForkMutation.isPending}
                    >
                      {chooseForkMutation.isPending ? 'En cours…' : 'Choisir cette voie'}
                    </Button>
                  )}
                  {isOtherChosen && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                      onClick={() =>
                        setRespecTarget({ currentPath: chosenPath!, newPath: pathId })
                      }
                    >
                      Respec
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Respec confirmation dialog */}
      {respecTarget && (
        <RespecDialog
          open={true}
          onClose={() => setRespecTarget(null)}
          forkId={forkId}
          currentPath={respecTarget.currentPath}
          newPath={respecTarget.newPath}
          forkItems={allForkItems}
          forkChoices={forkChoices}
          onSuccess={() => setRespecTarget(null)}
        />
      )}
    </>
  );
}
