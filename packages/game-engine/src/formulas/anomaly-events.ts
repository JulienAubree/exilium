/**
 * Pure formulas for Anomaly V3 events.
 * Selection logic, tier mapping, and outcome application — all deterministic
 * once an RNG is injected.
 */

export type AnomalyEventTier = 'early' | 'mid' | 'deep';

export interface FleetEntry {
  count: number;
  hullPercent: number;
}

export interface AnomalyEventOutcomeInput {
  minerai?: number;
  silicium?: number;
  hydrogene?: number;
  exilium?: number;
  hullDelta?: number;
  shipsGain?: Record<string, number>;
  shipsLoss?: Record<string, number>;
}

export interface AnomalyEventLite {
  id: string;
  enabled: boolean;
  tier: AnomalyEventTier;
}

/**
 * Tier of an event slot located between combat at currentDepth and the
 * upcoming combat. We tag by upcoming combat depth so the difficulty curve
 * stays consistent.
 *
 * depth 1-7 → early, 8-14 → mid, 15-20 → deep.
 */
export function tierForDepth(upcomingDepth: number): AnomalyEventTier {
  if (upcomingDepth <= 7) return 'early';
  if (upcomingDepth <= 14) return 'mid';
  return 'deep';
}

/** Uniform pick from {2, 3, 4} given an RNG. Used for spacing between events. */
export function pickEventGap(rng: () => number): 2 | 3 | 4 {
  const r = Math.floor(rng() * 3);
  return (r === 0 ? 2 : r === 1 ? 3 : 4) as 2 | 3 | 4;
}

/**
 * Pick an event matching the tier, excluding seenIds and disabled events.
 * Returns null if no candidate exists (caller should fallback to combat).
 */
export function pickEventForTier<E extends AnomalyEventLite>(
  events: E[],
  tier: AnomalyEventTier,
  seenIds: Set<string>,
  rng: () => number,
): E | null {
  const candidates = events.filter(
    (e) => e.enabled && e.tier === tier && !seenIds.has(e.id),
  );
  if (candidates.length === 0) return null;
  const idx = Math.floor(rng() * candidates.length);
  return candidates[idx] ?? null;
}

export interface ApplyOutcomeResult {
  fleet: Record<string, FleetEntry>;
  /** Resource delta that should be added to anomaly loot accumulator (clamped at 0 sum). */
  lootDeltas: { minerai: number; silicium: number; hydrogene: number };
  /** Exilium delta applied to user balance (post-clamp at 0). */
  exiliumDelta: number;
}

/**
 * Apply an outcome to a fleet snapshot. Pure: returns the new fleet without
 * mutating the input. Clamping rules:
 *   - hullPercent ∈ [0.01, 1.0] (events alone never destroy ships)
 *   - ship gain merges into existing entries with weighted hull average
 *   - ship loss clamped at 0; entries reaching 0 are deleted
 */
export function applyOutcomeToFleet(
  fleet: Record<string, FleetEntry>,
  outcome: AnomalyEventOutcomeInput,
): ApplyOutcomeResult {
  const out: Record<string, FleetEntry> = {};
  // Deep copy + apply hull delta.
  for (const [shipId, entry] of Object.entries(fleet)) {
    const newHull = clamp(
      (entry.hullPercent ?? 1) + (outcome.hullDelta ?? 0),
      0.01,
      1.0,
    );
    out[shipId] = { count: entry.count, hullPercent: newHull };
  }

  // Apply ship gains (merge, weighted hull average — reinforcements at 100%).
  for (const [shipId, gain] of Object.entries(outcome.shipsGain ?? {})) {
    if (gain <= 0) continue;
    const existing = out[shipId];
    if (existing) {
      const totalCount = existing.count + gain;
      const weightedHull =
        (existing.count * existing.hullPercent + gain * 1.0) / totalCount;
      out[shipId] = { count: totalCount, hullPercent: weightedHull };
    } else {
      out[shipId] = { count: gain, hullPercent: 1.0 };
    }
  }

  // Apply ship losses (subtract, delete entries that hit 0).
  for (const [shipId, loss] of Object.entries(outcome.shipsLoss ?? {})) {
    if (loss <= 0) continue;
    const existing = out[shipId];
    if (!existing) continue;
    const newCount = Math.max(0, existing.count - loss);
    if (newCount === 0) {
      delete out[shipId];
    } else {
      out[shipId] = { count: newCount, hullPercent: existing.hullPercent };
    }
  }

  return {
    fleet: out,
    lootDeltas: {
      minerai: outcome.minerai ?? 0,
      silicium: outcome.silicium ?? 0,
      hydrogene: outcome.hydrogene ?? 0,
    },
    exiliumDelta: outcome.exilium ?? 0,
  };
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
