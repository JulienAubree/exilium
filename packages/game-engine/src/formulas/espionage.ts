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
): SpyReportVisibility {
  const probInfo = probeCount - (defenderEspionageTech - attackerEspionageTech);
  return {
    resources: probInfo >= 1,
    fleet: probInfo >= 3,
    defenses: probInfo >= 5,
    buildings: probInfo >= 7,
    research: probInfo >= 9,
  };
}

export function calculateDetectionChance(
  probeCount: number,
  attackerEspionageTech: number,
  defenderEspionageTech: number,
): number {
  const chance = probeCount * 2 - (attackerEspionageTech - defenderEspionageTech) * 4;
  return Math.max(0, Math.min(100, chance));
}
