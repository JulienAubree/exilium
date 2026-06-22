export type PlanetUrlAction =
  | { type: 'set-store'; id: string }
  | { type: 'set-url'; id: string; replace: boolean }
  | { type: 'noop' };

/**
 * Pure decision for keeping the active planet and the `?planet=<id>` URL param
 * in sync, without feedback loops. Kept import-free so the (tricky) branching
 * can be unit-tested in isolation, away from React/router/store.
 *
 * Rules:
 * - First run (`!initialized`): a valid `?planet` from a refreshed/shared link
 *   wins and drives the store; otherwise seed the URL from the resolved planet
 *   (replace — no spurious history entry; also overwrites an invalid param).
 * - Steady state: act on whichever side changed. A URL change (Back/forward or
 *   a pasted link) drives the store; a resolved-planet change (the picker)
 *   mirrors to the URL with a new history entry so Back returns to it. If
 *   navigation dropped the param, re-add it (replace) so every view stays
 *   addressable.
 */
export function reconcileActivePlanetUrl(args: {
  urlPlanetId: string | null;
  resolvedId: string | null;
  prevUrl: string | null;
  prevResolved: string | null;
  isValidUrl: boolean;
  initialized: boolean;
}): PlanetUrlAction {
  const { urlPlanetId, resolvedId, prevUrl, prevResolved, isValidUrl, initialized } = args;

  if (!initialized) {
    if (isValidUrl && urlPlanetId !== resolvedId) return { type: 'set-store', id: urlPlanetId! };
    if (resolvedId && resolvedId !== urlPlanetId) return { type: 'set-url', id: resolvedId, replace: true };
    return { type: 'noop' };
  }

  const urlChanged = urlPlanetId !== prevUrl;
  const resolvedChanged = resolvedId !== prevResolved;

  if (urlChanged && isValidUrl && urlPlanetId !== resolvedId) {
    return { type: 'set-store', id: urlPlanetId! };
  }
  if (!urlPlanetId && resolvedId) {
    return { type: 'set-url', id: resolvedId, replace: true };
  }
  if (resolvedChanged && resolvedId && resolvedId !== urlPlanetId) {
    return { type: 'set-url', id: resolvedId, replace: false };
  }
  return { type: 'noop' };
}
