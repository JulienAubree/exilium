export interface PrerequisiteItem {
  id: string;
  type: 'building' | 'research';
  requiredLevel: number;
  currentLevel: number;
  name: string;
}

interface PrerequisiteListProps {
  items: PrerequisiteItem[];
  missingOnly?: boolean;
}

export function PrerequisiteList({ items, missingOnly }: PrerequisiteListProps) {
  const filtered = missingOnly
    ? items.filter((item) => item.currentLevel < item.requiredLevel)
    : items;

  if (filtered.length === 0) return null;

  return (
    <div className="space-y-1">
      {filtered.map((item) => {
        const isMet = item.currentLevel >= item.requiredLevel;

        return (
          <div key={item.id} className="flex items-center gap-1.5 text-[11px]">
            {isMet ? (
              <>
                <span className="text-emerald-500">
                  ✓ {item.name} niveau {item.requiredLevel}
                </span>
                <span className="ml-auto text-[9px] text-slate-600">
                  ({item.currentLevel}/{item.requiredLevel})
                </span>
              </>
            ) : (
              <>
                <span className="text-red-500">
                  ✗ {item.name} niveau {item.requiredLevel}
                </span>
                <span className="ml-auto rounded bg-red-900/30 px-1.5 text-[9px] text-red-400">
                  ({item.currentLevel}/{item.requiredLevel})
                </span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function buildPrerequisiteItems(
  prerequisites: {
    buildings?: { buildingId: string; level: number }[];
    research?: { researchId: string; level: number }[];
  },
  buildingLevels: Record<string, number>,
  researchLevels: Record<string, number>,
  gameConfig: any,
): PrerequisiteItem[] {
  const buildingItems: PrerequisiteItem[] = (prerequisites.buildings ?? []).map(
    ({ buildingId, level }) => ({
      id: buildingId,
      type: 'building' as const,
      requiredLevel: level,
      currentLevel: buildingLevels[buildingId] ?? 0,
      name: gameConfig?.buildings?.[buildingId]?.name ?? buildingId,
    }),
  );

  const researchItems: PrerequisiteItem[] = (prerequisites.research ?? []).map(
    ({ researchId, level }) => ({
      id: researchId,
      type: 'research' as const,
      requiredLevel: level,
      currentLevel: researchLevels[researchId] ?? 0,
      name: gameConfig?.research?.[researchId]?.name ?? researchId,
    }),
  );

  return [...buildingItems, ...researchItems];
}
