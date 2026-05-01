import { describe, it, expect } from 'vitest';
import {
  tierForDepth,
  pickEventGap,
  pickEventForTier,
  applyOutcomeToFleet,
  type AnomalyEventLite,
  type FleetEntry,
} from './anomaly-events.js';

describe('tierForDepth', () => {
  it('maps 1-7 to early', () => {
    for (let d = 1; d <= 7; d++) expect(tierForDepth(d)).toBe('early');
  });
  it('maps 8-14 to mid', () => {
    for (let d = 8; d <= 14; d++) expect(tierForDepth(d)).toBe('mid');
  });
  it('maps 15-20 to deep', () => {
    for (let d = 15; d <= 20; d++) expect(tierForDepth(d)).toBe('deep');
  });
});

describe('pickEventGap', () => {
  it('returns only 2, 3, or 4', () => {
    for (let i = 0; i < 100; i++) {
      const r = Math.random();
      const gap = pickEventGap(() => r);
      expect([2, 3, 4]).toContain(gap);
    }
  });
  it('distributes uniformly across {2,3,4}', () => {
    const counts = { 2: 0, 3: 0, 4: 0 } as Record<number, number>;
    for (let i = 0; i < 9000; i++) {
      const gap = pickEventGap(Math.random);
      counts[gap]++;
    }
    // Each bucket ~3000 ± 200 (loose sanity check on uniform distribution).
    expect(counts[2]).toBeGreaterThan(2700);
    expect(counts[3]).toBeGreaterThan(2700);
    expect(counts[4]).toBeGreaterThan(2700);
  });
});

describe('pickEventForTier', () => {
  const events: AnomalyEventLite[] = [
    { id: 'a', enabled: true, tier: 'early' },
    { id: 'b', enabled: true, tier: 'early' },
    { id: 'c', enabled: false, tier: 'early' },
    { id: 'd', enabled: true, tier: 'mid' },
    { id: 'e', enabled: true, tier: 'deep' },
  ];

  it('returns an event matching the tier', () => {
    const pick = pickEventForTier(events, 'mid', new Set(), () => 0);
    expect(pick?.id).toBe('d');
  });

  it('excludes disabled events', () => {
    const pick = pickEventForTier(events, 'early', new Set(['a', 'b']), () => 0);
    expect(pick).toBeNull();
  });

  it('excludes already-seen ids', () => {
    const pick = pickEventForTier(events, 'early', new Set(['a']), () => 0);
    expect(pick?.id).toBe('b');
  });

  it('returns null when no candidate', () => {
    const pick = pickEventForTier(events, 'deep', new Set(['e']), () => 0);
    expect(pick).toBeNull();
  });
});

describe('applyOutcomeToFleet', () => {
  const baseFleet: Record<string, FleetEntry> = {
    fighter: { count: 50, hullPercent: 0.8 },
    cruiser: { count: 10, hullPercent: 0.5 },
  };

  it('applies hullDelta uniformly with clamp [0.01, 1]', () => {
    const r = applyOutcomeToFleet(baseFleet, { hullDelta: 0.3 });
    expect(r.fleet.fleeting).toBeUndefined();
    expect(r.fleet.fighter.hullPercent).toBeCloseTo(1.0); // 0.8 + 0.3 → clamp 1
    expect(r.fleet.cruiser.hullPercent).toBeCloseTo(0.8); // 0.5 + 0.3
  });

  it('clamps hull at 0.01 minimum (never destroys via event)', () => {
    const r = applyOutcomeToFleet(baseFleet, { hullDelta: -1 });
    expect(r.fleet.fighter.hullPercent).toBe(0.01);
    expect(r.fleet.cruiser.hullPercent).toBe(0.01);
    expect(r.fleet.fighter.count).toBe(50); // count unchanged
  });

  it('merges shipsGain with weighted hull average', () => {
    const r = applyOutcomeToFleet(baseFleet, { shipsGain: { fighter: 50 } });
    expect(r.fleet.fighter.count).toBe(100);
    // (50*0.8 + 50*1.0) / 100 = 0.9
    expect(r.fleet.fighter.hullPercent).toBeCloseTo(0.9);
  });

  it('adds new ship entries from shipsGain at 100% hull', () => {
    const r = applyOutcomeToFleet(baseFleet, { shipsGain: { destroyer: 5 } });
    expect(r.fleet.destroyer).toEqual({ count: 5, hullPercent: 1.0 });
  });

  it('subtracts shipsLoss and deletes entries reaching 0', () => {
    const r = applyOutcomeToFleet(baseFleet, { shipsLoss: { cruiser: 10 } });
    expect(r.fleet.cruiser).toBeUndefined();
    expect(r.fleet.fighter.count).toBe(50);
  });

  it('clamps shipsLoss at 0 (no negative count)', () => {
    const r = applyOutcomeToFleet(baseFleet, { shipsLoss: { fighter: 1000 } });
    expect(r.fleet.fighter).toBeUndefined();
  });

  it('returns lootDeltas and exiliumDelta as-is for the caller to clamp', () => {
    const r = applyOutcomeToFleet(baseFleet, {
      minerai: 1000,
      silicium: -200,
      hydrogene: 0,
      exilium: 5,
    });
    expect(r.lootDeltas).toEqual({ minerai: 1000, silicium: -200, hydrogene: 0 });
    expect(r.exiliumDelta).toBe(5);
  });

  it('does not mutate the input fleet', () => {
    const before = JSON.stringify(baseFleet);
    applyOutcomeToFleet(baseFleet, { hullDelta: 0.5, shipsGain: { fighter: 10 } });
    expect(JSON.stringify(baseFleet)).toBe(before);
  });
});
