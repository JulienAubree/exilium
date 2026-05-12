export type AssetCategory = 'buildings' | 'research' | 'ships' | 'defenses' | 'planets' | 'flagships' | 'avatars' | 'landing' | 'anomaly' | 'module' | 'expedition';

/** Convert camelCase ID to kebab-case filename */
export function toKebab(id: string): string {
  return id.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Allowlist for filesystem path segments built from user-controlled values
 * (entityId, hullId, planetClassId, planetType, slot keys). Only ASCII
 * letters/digits, dash and underscore — explicitly rejects empty strings,
 * `..`, `/`, `\\`, NUL, `%`-encoded sequences, and any other separator.
 *
 * Use this before passing a value to `path.join`/`path.resolve` when the
 * value will become a directory or file name.
 */
const SAFE_SEGMENT_RE = /^[a-zA-Z0-9_-]+$/;

export function isSafeAssetSegment(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && SAFE_SEGMENT_RE.test(value);
}

/**
 * Throwing variant — handy in API routes that already centralize their
 * error handling. The label is included in the error so callers can tell
 * which input failed without inspecting the value itself.
 */
export function assertSafeAssetSegment(value: unknown, label: string): asserts value is string {
  if (!isSafeAssetSegment(value)) {
    throw new Error(`Invalid asset segment for "${label}"`);
  }
}
