/**
 * Calculate governance overextend and resulting penalties.
 *
 * @param colonyCount - Total planets owned (excluding homeworld)
 * @param governanceCapacity - 1 + Imperial Power Center level
 * @param harvestPenalties - Penalty per overextend step, e.g. [0.15, 0.35, 0.60]
 * @param constructionPenalties - Penalty per overextend step, e.g. [0.15, 0.35, 0.60]
 */
export function calculateGovernancePenalty(
  colonyCount: number,
  governanceCapacity: number,
  harvestPenalties: number[],
  constructionPenalties: number[],
): { overextend: number; harvestMalus: number; constructionMalus: number } {
  const overextend = Math.max(0, colonyCount - governanceCapacity);
  if (overextend === 0) {
    return { overextend: 0, harvestMalus: 0, constructionMalus: 0 };
  }

  // Clamp to the last defined penalty step
  const step = Math.min(overextend, harvestPenalties.length) - 1;
  return {
    overextend,
    harvestMalus: harvestPenalties[step] ?? harvestPenalties[harvestPenalties.length - 1] ?? 0,
    constructionMalus: constructionPenalties[step] ?? constructionPenalties[constructionPenalties.length - 1] ?? 0,
  };
}

/**
 * Calculate colonization difficulty factor from planet type and distance.
 * Lower factor = slower passive progress.
 */
export function calculateColonizationDifficulty(
  planetClassId: string,
  homeworldSystem: number,
  targetSystem: number,
  difficultyMap: Record<string, number>,
): number {
  const typeFactor = difficultyMap[planetClassId] ?? 0.7;
  const systemDistance = Math.abs(targetSystem - homeworldSystem);
  // Distance penalty: -2% per system hop, minimum 0.3
  const distanceFactor = Math.max(0.3, 1 - systemDistance * 0.02);
  return typeFactor * distanceFactor;
}
