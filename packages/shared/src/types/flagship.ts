/**
 * Default hull id used when a flagship row is missing the column or when a
 * caller needs a sensible fallback. Standardised across the stack so the API
 * and the web app agree — historically the API fell back to `'combat'` while
 * the web fell back to `'industrial'`, which left scaling and snapshot
 * lookups inconsistent.
 *
 * Player-visible default → keep as `'industrial'` (matches the existing web
 * fallback). Changing this value is a breaking change for any persisted
 * snapshot that omitted hullId.
 */
export const DEFAULT_HULL_ID = 'industrial' as const;
export type DefaultHullId = typeof DEFAULT_HULL_ID;

/** Ordered list of hull ids understood by the game-engine + admin. */
export const HULL_IDS = ['combat', 'scientific', 'industrial'] as const;
export type HullId = (typeof HULL_IDS)[number];
