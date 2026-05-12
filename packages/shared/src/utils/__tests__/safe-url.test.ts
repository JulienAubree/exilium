import { describe, it, expect } from 'vitest';
import { safeLinkHref, safeImageSrc, safeInternalHref } from '../safe-url.js';

describe('safeLinkHref', () => {
  it('accepts http(s) URLs', () => {
    expect(safeLinkHref('https://example.com')).toBe('https://example.com');
    expect(safeLinkHref('http://example.com/path?q=1')).toBe('http://example.com/path?q=1');
  });

  it('accepts mailto:', () => {
    expect(safeLinkHref('mailto:hello@example.com')).toBe('mailto:hello@example.com');
  });

  it('accepts internal paths and anchors', () => {
    expect(safeLinkHref('/login')).toBe('/login');
    expect(safeLinkHref('/path/to/page')).toBe('/path/to/page');
    expect(safeLinkHref('#anchor')).toBe('#anchor');
  });

  it('trims surrounding whitespace', () => {
    expect(safeLinkHref('  /login  ')).toBe('/login');
  });

  it('rejects javascript:', () => {
    expect(safeLinkHref('javascript:alert(1)')).toBeNull();
    expect(safeLinkHref('JAVASCRIPT:alert(1)')).toBeNull();
    expect(safeLinkHref(' javascript:alert(1)')).toBeNull();
  });

  it('rejects data:', () => {
    expect(safeLinkHref('data:text/html,<script>alert(1)</script>')).toBeNull();
  });

  it('rejects vbscript:, file:, ftp:', () => {
    expect(safeLinkHref('vbscript:msgbox(1)')).toBeNull();
    expect(safeLinkHref('file:///etc/passwd')).toBeNull();
    expect(safeLinkHref('ftp://example.com')).toBeNull();
  });

  it('rejects protocol-relative URLs', () => {
    expect(safeLinkHref('//evil.com')).toBeNull();
  });

  it('rejects non-string / empty / oversized', () => {
    expect(safeLinkHref(null)).toBeNull();
    expect(safeLinkHref(undefined)).toBeNull();
    expect(safeLinkHref(42)).toBeNull();
    expect(safeLinkHref('')).toBeNull();
    expect(safeLinkHref('   ')).toBeNull();
    expect(safeLinkHref('a'.repeat(3000))).toBeNull();
  });

  it('rejects schemeless relative without /', () => {
    expect(safeLinkHref('login')).toBeNull();
    expect(safeLinkHref('./login')).toBeNull();
  });
});

describe('safeImageSrc', () => {
  it('accepts http(s)', () => {
    expect(safeImageSrc('https://cdn.example.com/img.png')).toBe('https://cdn.example.com/img.png');
  });

  it('accepts internal /assets paths', () => {
    expect(safeImageSrc('/assets/landing/hero.webp')).toBe('/assets/landing/hero.webp');
  });

  it('rejects mailto, javascript, data', () => {
    expect(safeImageSrc('mailto:x@y.z')).toBeNull();
    expect(safeImageSrc('javascript:alert(1)')).toBeNull();
    expect(safeImageSrc('data:image/png;base64,AAAA')).toBeNull();
  });

  it('rejects protocol-relative', () => {
    expect(safeImageSrc('//evil.com/img.png')).toBeNull();
  });
});

describe('safeInternalHref', () => {
  it('accepts /path and #anchor', () => {
    expect(safeInternalHref('/login')).toBe('/login');
    expect(safeInternalHref('#anchor')).toBe('#anchor');
  });

  it('rejects any absolute URL, even http', () => {
    expect(safeInternalHref('https://example.com')).toBeNull();
    expect(safeInternalHref('mailto:a@b.c')).toBeNull();
  });

  it('rejects protocol-relative', () => {
    expect(safeInternalHref('//evil.com')).toBeNull();
  });
});
