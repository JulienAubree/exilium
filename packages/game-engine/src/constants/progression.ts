/**
 * Phase multiplier — degressive curve for building/research costs and times.
 * Applied to levels 1-7, normal (1.0) from level 8+.
 * Makes early game significantly faster without affecting late game.
 */
export const PHASE_MULTIPLIER: Record<number, number> = {
  1: 0.35,
  2: 0.45,
  3: 0.55,
  4: 0.65,
  5: 0.78,
  6: 0.90,
  7: 0.95,
};

export function getPhaseMultiplier(level: number): number {
  return PHASE_MULTIPLIER[level] ?? 1.0;
}
