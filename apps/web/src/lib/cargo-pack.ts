/**
 * Pick the minimum set of cargo ships from a planet's inventory to cover a needed cargo amount.
 *
 * Strategy: small ships first (lowest capacity per ship), so we don't over-allocate
 * when a single small ship is enough. If the inventory can't cover the need, we
 * return everything available and the caller decides how to cap the resources.
 */
export interface CargoPackResult {
  picked: Record<string, number>;
  coveredCargo: number;
}

export function packCargos(
  needed: number,
  available: Record<string, number>,
  shipStats: Record<string, { cargoCapacity: number }>,
): CargoPackResult {
  if (needed <= 0) {
    return { picked: {}, coveredCargo: 0 };
  }

  const candidates = Object.entries(available)
    .map(([id, count]) => ({ id, count, capacity: shipStats[id]?.cargoCapacity ?? 0 }))
    .filter((c) => c.count > 0 && c.capacity > 0)
    .sort((a, b) => a.capacity - b.capacity);

  const picked: Record<string, number> = {};
  let covered = 0;

  for (const c of candidates) {
    if (covered >= needed) break;
    const remaining = needed - covered;
    const required = Math.ceil(remaining / c.capacity);
    const take = Math.min(required, c.count);
    if (take > 0) {
      picked[c.id] = take;
      covered += take * c.capacity;
    }
  }

  return { picked, coveredCargo: covered };
}
