/**
 * Pure geometry helpers for the galaxy system view.
 *
 * No React, no DOM, no imports — safe to unit test in isolation (when we have tests).
 *
 * Angle convention: 0° points east (positive X). Because this helper is
 * intended for SVG consumers (Y axis grows downward), positive angles rotate
 * CLOCKWISE on screen — i.e. 90° is south, 180° is west, 270° is north.
 * Pick this convention and do not flip it later or everything will mirror.
 */

/**
 * Deterministic hash → angle in [0, 360) for a given orbital slot.
 *
 * Same (galaxy, system, position) MUST always return the same angle.
 * Uses a small Math.imul-based integer mix (xorshift-flavored).
 *
 * IMPORTANT: Stable across deploys — do not change without a migration plan,
 * otherwise every existing system will visually shuffle its planets.
 *
 * @param galaxy   integer galaxy coordinate (e.g. 1..N), 1-based
 * @param system   integer system coordinate (e.g. 1..499), 1-based
 * @param position integer slot position (e.g. 1..16), 1-based
 */
export function slotAngle(galaxy: number, system: number, position: number): number {
  let h = Math.imul(galaxy | 0, 0x27d4eb2d) ^ 0x9e3779b9;
  h = Math.imul(h ^ (system | 0), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h ^ (position | 0), 0xc2b2ae35);
  h ^= h >>> 16;
  // Force unsigned, then map to [0, 360).
  const u = h >>> 0;
  return (u % 36000) / 100;
}

/**
 * Deterministic 32-bit mixer that returns a value in [0, 1).
 *
 * Same `(seed, i)` MUST always return the same number. Useful for reproducible
 * jitter in decorative SVG (debris rings, asteroid fields, etc.) where we want
 * stable visuals across re-renders but variety across instances via `seed`.
 *
 * Not cryptographic. Not a PRNG stream — pass distinct `i` values for each
 * sample you need from the same `seed`.
 */
export function hash01(seed: number, i: number): number {
  let h = Math.imul(seed | 0, 0x27d4eb2d) ^ 0x9e3779b9;
  h = Math.imul(h ^ (i | 0), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return ((h >>> 0) % 1_000_000) / 1_000_000;
}
