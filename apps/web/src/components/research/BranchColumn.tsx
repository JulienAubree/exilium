/**
 * BranchColumn — affiche une branche de recherche avec ses tiers et forks.
 *
 * Reçoit les recherches déjà filtrées pour cette branche, les groupe par tier,
 * détecte les tiers-fork et délègue à ForkChoice / ResearchNode.
 */
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ForkChoice } from './ForkChoice';
import { ResearchNode } from './ResearchNode';
import type { BranchDef, ResearchItem, ForkChoices, TierGroup } from './research-tree.types';

interface BranchColumnProps {
  branch: BranchDef;
  items: ResearchItem[];
  forkChoices: ForkChoices;
  resources: { minerai: number; silicium: number; hydrogene: number };
  craftRates?: { mineraiPerHour: number; siliciumPerHour: number; hydrogenePerHour: number };
  isAnyResearching: boolean;
  buildingLevels: Record<string, number>;
  researchLevels: Record<string, number>;
  onStartSuccess: () => void;
  onDetailOpen: (id: string) => void;
}

/** Regroupe les items d'une branche par tier puis détecte les forks. */
function buildTierGroups(items: ResearchItem[]): Map<number, TierGroup> {
  // Tier → items (triés par forkPath pour cohérence)
  const tierMap = new Map<number, ResearchItem[]>();
  for (const item of items) {
    const tier = item.tier ?? 0;
    const list = tierMap.get(tier) ?? [];
    list.push(item);
    tierMap.set(tier, list);
  }

  const groups = new Map<number, TierGroup>();
  for (const [tier, tierItems] of tierMap.entries()) {
    // Si tous les items du tier ont un même forkId non-null → c'est un tier-fork
    const forkIds = [...new Set(tierItems.map((i) => i.forkId).filter(Boolean))];
    if (forkIds.length === 1 && tierItems.every((i) => i.forkId === forkIds[0])) {
      // Grouper par forkPath
      const paths: Record<string, ResearchItem[]> = {};
      for (const item of tierItems) {
        const p = item.forkPath ?? 'default';
        if (!paths[p]) paths[p] = [];
        paths[p].push(item);
      }
      groups.set(tier, { kind: 'fork', forkId: forkIds[0]!, paths });
    } else {
      groups.set(tier, { kind: 'linear', items: tierItems });
    }
  }
  return groups;
}

export function BranchColumn({
  branch,
  items,
  forkChoices,
  resources,
  craftRates,
  isAnyResearching,
  buildingLevels,
  researchLevels,
  onStartSuccess,
  onDetailOpen,
}: BranchColumnProps) {
  const tierGroups = useMemo(() => buildTierGroups(items), [items]);
  const sortedTiers = [...tierGroups.keys()].sort((a, b) => a - b);

  return (
    <div className="flex flex-col">
      {/* Branch header */}
      <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
        <span className="h-px flex-1 bg-border/50" />
        {branch.label}
        <span className="h-px flex-1 bg-border/50" />
      </h3>

      <div className="space-y-4">
        {sortedTiers.map((tier) => {
          const group = tierGroups.get(tier)!;

          return (
            <div key={tier} className="space-y-2">
              {/* Tier label */}
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded',
                    'bg-muted/40 text-muted-foreground',
                  )}
                >
                  Tier {tier}
                </span>
                <span className="h-px flex-1 bg-border/30" />
              </div>

              {group.kind === 'fork' ? (
                <ForkChoice
                  forkId={group.forkId}
                  paths={group.paths}
                  forkChoices={forkChoices}
                  resources={resources}
                  craftRates={craftRates}
                  isAnyResearching={isAnyResearching}
                  buildingLevels={buildingLevels}
                  researchLevels={researchLevels}
                  onStartSuccess={onStartSuccess}
                  onDetailOpen={onDetailOpen}
                />
              ) : (
                <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(160px,1fr))]">
                  {group.items.map((tech) => (
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
