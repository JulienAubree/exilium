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

// `HULL_IDS` / `HullId` / `DefaultHullId` ont ete retires : c etait un doublon
// fige de la cle DB `universe_config.hulls`, qui est la source vivante (lue par
// flagship.service.ts). Aucun consommateur.
