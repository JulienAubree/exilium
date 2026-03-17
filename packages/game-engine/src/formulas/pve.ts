/**
 * Base extraction per prospector, scales with Mission Center level.
 * Formula: 2000 + 800 * (centerLevel - 1)
 */
export function baseExtraction(centerLevel: number): number {
  return 2000 + 800 * (centerLevel - 1);
}

/**
 * Total resources extracted for a mining trip.
 * Capped by: 10 prospectors max, fleet cargo capacity, deposit remaining.
 */
export function totalExtracted(
  centerLevel: number,
  nbProspectors: number,
  fleetCargoCapacity: number,
  depositRemaining: number,
): number {
  const effectiveProspectors = Math.min(nbProspectors, 10);
  const extracted = baseExtraction(centerLevel) * effectiveProspectors;
  return Math.min(extracted, fleetCargoCapacity, depositRemaining);
}

/**
 * Extraction duration in minutes at the belt.
 * Formula: max(5, 16 - centerLevel)
 */
export function extractionDuration(centerLevel: number): number {
  return Math.max(5, 16 - centerLevel);
}

/**
 * Visible pool size based on Mission Center level.
 */
export function poolSize(centerLevel: number): number {
  if (centerLevel <= 2) return 3;
  if (centerLevel <= 4) return 4;
  if (centerLevel <= 6) return 5;
  return 6;
}

/**
 * Max accumulated missions (2x pool size).
 */
export function accumulationCap(centerLevel: number): number {
  return poolSize(centerLevel) * 2;
}
