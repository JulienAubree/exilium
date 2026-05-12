/**
 * URL allowlists for user/admin-controlled href and src attributes.
 *
 * Block `javascript:`, `data:`, `vbscript:`, `file:`, etc., so that a hostile
 * value can't execute code or exfiltrate when rendered by React (which does
 * NOT sanitize href/src on its own).
 *
 * Three categories:
 *   - link        : navigation. http/https/mailto, or an internal path/anchor.
 *   - imageSrc    : <img src>. http/https, or an internal /assets/... path.
 *   - internal    : strictly /... or #..., for items that must never leave
 *                   the app (e.g. nav).
 *
 * Each helper returns the original string when safe, or `null` when not —
 * callers decide whether to fall back to a default, drop the link, or render
 * the URL as plain text.
 */

function isAbsoluteUrl(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(value);
}

function tryParseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

const ALLOWED_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);
const ALLOWED_IMAGE_PROTOCOLS = new Set(['http:', 'https:']);

/** Validate any href that may be internal (/..., #...) or external. */
export function safeLinkHref(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 2048) return null;

  if (!isAbsoluteUrl(trimmed)) {
    // Internal — must start with `/` or `#`. Reject schemeless protocol-
    // relative URLs (`//evil.com`) which browsers happily resolve.
    if (trimmed.startsWith('//')) return null;
    if (trimmed.startsWith('/') || trimmed.startsWith('#')) return trimmed;
    return null;
  }

  const parsed = tryParseUrl(trimmed);
  if (!parsed) return null;
  return ALLOWED_LINK_PROTOCOLS.has(parsed.protocol) ? trimmed : null;
}

/** Validate an <img src> that may be a /assets/... path or http(s) URL. */
export function safeImageSrc(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 2048) return null;

  if (!isAbsoluteUrl(trimmed)) {
    if (trimmed.startsWith('//')) return null;
    if (trimmed.startsWith('/')) return trimmed;
    return null;
  }

  const parsed = tryParseUrl(trimmed);
  if (!parsed) return null;
  return ALLOWED_IMAGE_PROTOCOLS.has(parsed.protocol) ? trimmed : null;
}

/** Strictly internal — `/path` or `#anchor`, nothing else. */
export function safeInternalHref(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 2048) return null;
  if (trimmed.startsWith('//')) return null;
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return trimmed;
  return null;
}
