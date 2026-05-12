import { useMemo } from 'react';

/**
 * Transforme une liste d'entités `{ id, currentLevel }` (typiquement
 * retournée par `trpc.research.list` ou `trpc.building.list`) en
 * `Record<id, level>` accessible en O(1).
 *
 * Remplace le pattern répété dans ~8 pages :
 *   const levels = useMemo(() => {
 *     const out: Record<string, number> = {};
 *     for (const r of researchList ?? []) out[r.id] = r.currentLevel;
 *     return out;
 *   }, [researchList]);
 *
 * Usage :
 *   const { data: research } = trpc.research.list.useQuery();
 *   const levels = useLevelMap(research?.items);
 *   <span>Niv. {levels['planetaryExploration'] ?? 0}</span>
 */
export function useLevelMap<T extends { id: string; currentLevel: number }>(
  items: T[] | undefined | null,
): Record<string, number> {
  return useMemo(() => {
    if (!items) return {};
    const out: Record<string, number> = {};
    for (const item of items) out[item.id] = item.currentLevel;
    return out;
  }, [items]);
}
