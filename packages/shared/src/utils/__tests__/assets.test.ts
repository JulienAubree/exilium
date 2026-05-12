import { describe, it, expect } from 'vitest';
import { isSafeAssetSegment, assertSafeAssetSegment, toKebab } from '../assets.js';

describe('isSafeAssetSegment', () => {
  it('accepts plain alphanum + dash + underscore', () => {
    expect(isSafeAssetSegment('minerai')).toBe(true);
    expect(isSafeAssetSegment('flagship-cruiser')).toBe(true);
    expect(isSafeAssetSegment('depth_1')).toBe(true);
    expect(isSafeAssetSegment('Sector-7')).toBe(true);
    expect(isSafeAssetSegment('a')).toBe(true);
  });

  it('rejects path separators', () => {
    expect(isSafeAssetSegment('foo/bar')).toBe(false);
    expect(isSafeAssetSegment('foo\\bar')).toBe(false);
    expect(isSafeAssetSegment('/abs')).toBe(false);
  });

  it('rejects parent-directory traversal', () => {
    expect(isSafeAssetSegment('..')).toBe(false);
    expect(isSafeAssetSegment('../etc')).toBe(false);
    expect(isSafeAssetSegment('foo/..')).toBe(false);
  });

  it('rejects URL-encoded sneak attempts', () => {
    expect(isSafeAssetSegment('%2e%2e')).toBe(false);
    expect(isSafeAssetSegment('foo%2fbar')).toBe(false);
  });

  it('rejects NUL and whitespace', () => {
    expect(isSafeAssetSegment('foo\0bar')).toBe(false);
    expect(isSafeAssetSegment('foo bar')).toBe(false);
    expect(isSafeAssetSegment('  ')).toBe(false);
  });

  it('rejects empty and non-string', () => {
    expect(isSafeAssetSegment('')).toBe(false);
    expect(isSafeAssetSegment(null)).toBe(false);
    expect(isSafeAssetSegment(undefined)).toBe(false);
    expect(isSafeAssetSegment(42)).toBe(false);
  });
});

describe('assertSafeAssetSegment', () => {
  it('passes for valid', () => {
    expect(() => assertSafeAssetSegment('foo', 'x')).not.toThrow();
  });

  it('throws on invalid, includes label', () => {
    expect(() => assertSafeAssetSegment('../etc', 'entityId')).toThrow(/entityId/);
  });
});

describe('toKebab', () => {
  it('converts camelCase', () => {
    expect(toKebab('flagshipCruiser')).toBe('flagship-cruiser');
    expect(toKebab('mineraiMine')).toBe('minerai-mine');
    expect(toKebab('XCom')).toBe('xcom');
  });
});
