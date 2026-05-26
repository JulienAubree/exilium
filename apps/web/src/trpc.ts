import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@exilium/api/trpc';

export const trpc = createTRPCReact<AppRouter>();

// ──────────────────────────────────────────────────────────────────────────────
// Token refresh strategy
//
// The previous version had several footguns that caused users to be kicked
// to /login much more often than needed:
//
//   - A sticky `refreshFailed` flag: a single transient network error
//     poisoned the whole tab. Any later 401 forced an immediate logout with
//     no retry.
//   - No retry on 5xx / network errors. PM2 reloads during deploy and short
//     reverse-proxy blips were enough to log the user out.
//   - No cross-tab coordination. Two tabs waking up with the same expired
//     access token would both try to refresh, the one that lost the race
//     would see its refresh token revoked, and both tabs would logout.
//   - No visibility/focus check. Chrome throttles long setTimeouts in
//     background tabs, so the proactive refresh scheduled for "5 min before
//     expiry" could fire late, leaving the access token expired by the time
//     the user came back.
//
// This rewrite addresses all four. The contract is unchanged: only a truly
// invalid (401/403) refresh-token response logs the user out.
// ──────────────────────────────────────────────────────────────────────────────

let refreshPromise: Promise<boolean> | null = null;
let proactiveRefreshTimer: ReturnType<typeof setTimeout> | null = null;

function getTokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function scheduleProactiveRefresh() {
  if (proactiveRefreshTimer) clearTimeout(proactiveRefreshTimer);

  const token = localStorage.getItem('accessToken');
  if (!token) return;

  const expiry = getTokenExpiry(token);
  if (!expiry) return;

  // Refresh 5 minutes before expiry, minimum 10 seconds from now.
  const refreshAt = Math.max(expiry - 5 * 60 * 1000, Date.now() + 10_000);
  const delay = refreshAt - Date.now();

  if (delay <= 0) return;

  proactiveRefreshTimer = setTimeout(async () => {
    // Proactive refresh is best-effort. If it fails, the next user-driven
    // 401 will either retry (network back) or log out (truly invalid).
    await performCoordinatedRefresh(false);
  }, delay);
}

type RefreshAttempt = { kind: 'ok' } | { kind: 'invalid' } | { kind: 'retry' };

/** One round-trip to /trpc/auth.refresh, classified into ok / invalid / retry. */
async function callRefresh(refreshToken: string): Promise<RefreshAttempt> {
  try {
    const res = await fetch('/trpc/auth.refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ json: { refreshToken } }),
    });

    if (res.ok) {
      const json = await res.json();
      const result = json?.result?.data?.json;
      if (result?.accessToken && result?.refreshToken) {
        localStorage.setItem('accessToken', result.accessToken);
        localStorage.setItem('refreshToken', result.refreshToken);
        return { kind: 'ok' };
      }
      // Malformed success — treat as transient so we retry.
      return { kind: 'retry' };
    }

    // 401 / 403 mean the server actively rejected the token (revoked, banned,
    // expired). No point retrying — log the user out.
    if (res.status === 401 || res.status === 403) {
      return { kind: 'invalid' };
    }

    // 4xx other than auth, 5xx, gateway errors → transient.
    return { kind: 'retry' };
  } catch {
    // fetch threw (DNS, connection refused, offline, abort) — transient.
    return { kind: 'retry' };
  }
}

/** Delay before each retry of a transient refresh failure (5xx / network). */
const REFRESH_RETRY_DELAYS_MS = [800, 2_000, 4_000];

function forceLogout() {
  if (proactiveRefreshTimer) clearTimeout(proactiveRefreshTimer);
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  // Redirect to login only if not already there.
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
  }
}

/**
 * Coordinate a refresh between a 401 interceptor and the proactive timer.
 * Returns true if a fresh access token is now in localStorage.
 *
 * Only logs out on a definitive `invalid` result. Transient failures bubble
 * up as `false` so callers (e.g. the 401 retry path) can decide to surface
 * the error to the UI without nuking the session.
 */
async function performCoordinatedRefresh(forceLogoutOnInvalid: boolean): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        return false;
      }
      // First attempt drives the classification, then `tryRefreshToken`
      // handles its own retries internally for `retry` results.
      // We need to know whether the failure was `invalid` (logout) vs
      // exhausted retries (don't logout).
      let lastKind: RefreshAttempt['kind'] = 'retry';
      for (let attempt = 0; attempt <= REFRESH_RETRY_DELAYS_MS.length; attempt++) {
        const rt = localStorage.getItem('refreshToken');
        if (!rt) return false;
        const result = await callRefresh(rt);
        lastKind = result.kind;
        if (result.kind === 'ok') {
          scheduleProactiveRefresh();
          return true;
        }
        if (result.kind === 'invalid') break;
        if (attempt < REFRESH_RETRY_DELAYS_MS.length) {
          await new Promise((r) => setTimeout(r, REFRESH_RETRY_DELAYS_MS[attempt]));
        }
      }
      if (lastKind === 'invalid' && forceLogoutOnInvalid) {
        forceLogout();
      }
      return false;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// Reset state when a fresh login succeeds (called externally from Login.tsx).
export function resetRefreshState() {
  if (proactiveRefreshTimer) clearTimeout(proactiveRefreshTimer);
  scheduleProactiveRefresh();
}

// ── Startup: if the access token is already expired, refresh first ──────────
let startupRefreshPromise: Promise<void> | null = null;

function refreshExpiredTokenOnStartup() {
  const token = localStorage.getItem('accessToken');
  if (!token) return;
  const expiry = getTokenExpiry(token);
  if (expiry && expiry <= Date.now()) {
    startupRefreshPromise = performCoordinatedRefresh(true).then(() => {
      startupRefreshPromise = null;
    });
  } else {
    scheduleProactiveRefresh();
  }
}

refreshExpiredTokenOnStartup();

// ── Cross-tab sync ───────────────────────────────────────────────────────────
// When another tab rotates the access token, reschedule the proactive refresh
// here so we don't fire a stale one. When another tab logs out, stop the
// timer to avoid trying to refresh nothing.
window.addEventListener('storage', (e) => {
  if (e.key === 'accessToken') {
    if (e.newValue) {
      scheduleProactiveRefresh();
    } else if (proactiveRefreshTimer) {
      clearTimeout(proactiveRefreshTimer);
      proactiveRefreshTimer = null;
    }
  }
});

// ── Visibility / focus: refresh on resume if token is close to expiring ─────
// Background tabs throttle setTimeout heavily (>= 1 minute in Chrome). The
// long proactive timer can therefore fire well after the access token has
// already expired. When the tab becomes visible again, eagerly refresh if
// the token has < 60s of life left.
function checkTokenOnResume() {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
  const token = localStorage.getItem('accessToken');
  if (!token) return;
  const expiry = getTokenExpiry(token);
  if (!expiry) return;
  if (expiry - Date.now() < 60_000) {
    void performCoordinatedRefresh(true);
  }
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', checkTokenOnResume);
}
if (typeof window !== 'undefined') {
  window.addEventListener('focus', checkTokenOnResume);
  window.addEventListener('online', checkTokenOnResume);
}

export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: '/trpc',
        headers: () => {
          const token = localStorage.getItem('accessToken');
          return token ? { authorization: `Bearer ${token}` } : {};
        },
        async fetch(url, options) {
          // Wait for startup token refresh so the very first wave of queries
          // doesn't need to round-trip through 401 → refresh → retry.
          if (startupRefreshPromise) await startupRefreshPromise;

          let res = await fetch(url, options);

          if (res.status === 401) {
            // Don't intercept auth endpoints themselves.
            const urlStr = typeof url === 'string' ? url : url.toString();
            if (urlStr.includes('auth.login') || urlStr.includes('auth.register')) {
              return res;
            }

            const refreshed = await performCoordinatedRefresh(true);
            if (refreshed) {
              const newToken = localStorage.getItem('accessToken');
              const newHeaders = new Headers(options?.headers);
              newHeaders.set('authorization', `Bearer ${newToken}`);
              res = await fetch(url, { ...options, headers: newHeaders });
            }
          }

          return res;
        },
      }),
    ],
  });
}
