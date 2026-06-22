import { describe, it, expect } from 'vitest';
import { reconcileActivePlanetUrl } from './activePlanetUrl.logic';

const base = {
  urlPlanetId: null as string | null,
  resolvedId: null as string | null,
  prevUrl: null as string | null,
  prevResolved: null as string | null,
  isValidUrl: false,
  initialized: true,
};

describe('reconcileActivePlanetUrl', () => {
  describe('first load (not initialized)', () => {
    it('a valid ?planet from a shared/refreshed link drives the store', () => {
      expect(
        reconcileActivePlanetUrl({
          ...base,
          initialized: false,
          urlPlanetId: 'B',
          resolvedId: 'A',
          isValidUrl: true,
        }),
      ).toEqual({ type: 'set-store', id: 'B' });
    });

    it('no param → seed the URL from the resolved planet (replace)', () => {
      expect(
        reconcileActivePlanetUrl({ ...base, initialized: false, urlPlanetId: null, resolvedId: 'A' }),
      ).toEqual({ type: 'set-url', id: 'A', replace: true });
    });

    it('an invalid/foreign param is overwritten with the resolved planet (replace)', () => {
      expect(
        reconcileActivePlanetUrl({
          ...base,
          initialized: false,
          urlPlanetId: 'ZZZ',
          resolvedId: 'A',
          isValidUrl: false,
        }),
      ).toEqual({ type: 'set-url', id: 'A', replace: true });
    });

    it('valid param already matching the resolved planet → noop', () => {
      expect(
        reconcileActivePlanetUrl({
          ...base,
          initialized: false,
          urlPlanetId: 'A',
          resolvedId: 'A',
          isValidUrl: true,
        }),
      ).toEqual({ type: 'noop' });
    });
  });

  describe('steady state', () => {
    it('Back/forward changed the URL → drive the store', () => {
      expect(
        reconcileActivePlanetUrl({
          ...base,
          urlPlanetId: 'A',
          prevUrl: 'B',
          resolvedId: 'B',
          prevResolved: 'B',
          isValidUrl: true,
        }),
      ).toEqual({ type: 'set-store', id: 'A' });
    });

    it('the picker changed the active planet → mirror to URL with history (push)', () => {
      expect(
        reconcileActivePlanetUrl({
          ...base,
          urlPlanetId: 'A',
          prevUrl: 'A',
          resolvedId: 'B',
          prevResolved: 'A',
          isValidUrl: true,
        }),
      ).toEqual({ type: 'set-url', id: 'B', replace: false });
    });

    it('navigation dropped the param → re-add it (replace)', () => {
      expect(
        reconcileActivePlanetUrl({
          ...base,
          urlPlanetId: null,
          prevUrl: 'A',
          resolvedId: 'A',
          prevResolved: 'A',
          isValidUrl: false,
        }),
      ).toEqual({ type: 'set-url', id: 'A', replace: true });
    });

    it('URL already mirrors the resolved planet → noop (no echo)', () => {
      expect(
        reconcileActivePlanetUrl({
          ...base,
          urlPlanetId: 'B',
          prevUrl: 'A',
          resolvedId: 'B',
          prevResolved: 'B',
          isValidUrl: true,
        }),
      ).toEqual({ type: 'noop' });
    });

    it('nothing changed → noop', () => {
      expect(
        reconcileActivePlanetUrl({
          ...base,
          urlPlanetId: 'A',
          prevUrl: 'A',
          resolvedId: 'A',
          prevResolved: 'A',
          isValidUrl: true,
        }),
      ).toEqual({ type: 'noop' });
    });
  });
});
