export interface SpyReportVisibility {
  resources: boolean;
  fleet: boolean;
  defenses: boolean;
  buildings: boolean;
  research: boolean;
}

export function calculateSpyReport(
  probeCount: number,
  attackerEspionageTech: number,
  defenderEspionageTech: number,
  thresholds: number[] = [1, 3, 5, 7, 9],
): SpyReportVisibility {
  const probInfo = probeCount - (defenderEspionageTech - attackerEspionageTech);
  return {
    resources: probInfo >= thresholds[0],
    fleet: probInfo >= thresholds[1],
    defenses: probInfo >= thresholds[2],
    buildings: probInfo >= thresholds[3],
    research: probInfo >= thresholds[4],
  };
}

export function calculateDetectionChance(
  probeCount: number,
  attackerEspionageTech: number,
  defenderEspionageTech: number,
  config: { probeMultiplier: number; techMultiplier: number } = { probeMultiplier: 2, techMultiplier: 4 },
): number {
  const chance = probeCount * config.probeMultiplier - (attackerEspionageTech - defenderEspionageTech) * config.techMultiplier;
  return Math.max(0, Math.min(100, chance));
}
