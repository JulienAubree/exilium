/**
 * Helpers for estimating "how long until I can afford this craft" based on
 * the planet's current resource stock and production rates.
 */

export interface CraftCost {
  minerai: number;
  silicium: number;
  hydrogene: number;
}

export interface CraftStock {
  minerai: number;
  silicium: number;
  hydrogene: number;
}

export interface CraftRates {
  mineraiPerHour: number;
  siliciumPerHour: number;
  hydrogenePerHour: number;
}

/**
 * Hours needed to accumulate the missing resources for `cost` given the
 * current `stock` and production `rates`.
 *
 * Returns:
 * - `null` if already affordable (no resource is missing)
 * - `Infinity` if a missing resource has zero or negative production —
 *   the player cannot reach the cost without changing something
 * - a positive number of hours otherwise (max across the three resources)
 */
export function calculateCraftEtaHours(
  cost: CraftCost,
  stock: CraftStock,
  rates: CraftRates,
): number | null {
  const missingM = Math.max(0, cost.minerai - stock.minerai);
  const missingS = Math.max(0, cost.silicium - stock.silicium);
  const missingH = Math.max(0, cost.hydrogene - stock.hydrogene);

  if (missingM === 0 && missingS === 0 && missingH === 0) return null;

  const etaFor = (missing: number, ratePerHour: number): number => {
    if (missing === 0) return 0;
    if (ratePerHour <= 0) return Infinity;
    return missing / ratePerHour;
  };

  return Math.max(
    etaFor(missingM, rates.mineraiPerHour),
    etaFor(missingS, rates.siliciumPerHour),
    etaFor(missingH, rates.hydrogenePerHour),
  );
}
