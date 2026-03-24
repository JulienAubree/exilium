import { describe, it, expect } from 'vitest';
import { calculateSpyReport, calculateDetectionChance } from './espionage.js';

describe('calculateSpyReport', () => {
  it('3 probes same tech → resources + fleet visible, not defenses', () => {
    const report = calculateSpyReport(3, 5, 5);
    expect(report.resources).toBe(true);
    expect(report.fleet).toBe(true);
    expect(report.defenses).toBe(false);
    expect(report.buildings).toBe(false);
    expect(report.research).toBe(false);
  });

  it('1 probe, defender +5 tech → nothing visible', () => {
    const report = calculateSpyReport(1, 0, 5);
    expect(report.resources).toBe(false);
    expect(report.fleet).toBe(false);
  });

  it('10 probes, attacker +3 tech → everything visible', () => {
    const report = calculateSpyReport(10, 8, 5);
    expect(report.resources).toBe(true);
    expect(report.fleet).toBe(true);
    expect(report.defenses).toBe(true);
    expect(report.buildings).toBe(true);
    expect(report.research).toBe(true);
  });

  it('5 probes same tech → resources + fleet + defenses', () => {
    const report = calculateSpyReport(5, 3, 3);
    expect(report.resources).toBe(true);
    expect(report.fleet).toBe(true);
    expect(report.defenses).toBe(true);
    expect(report.buildings).toBe(false);
  });
});

describe('calculateDetectionChance', () => {
  it('1 probe same tech → 2%', () => {
    expect(calculateDetectionChance(1, 5, 5)).toBe(2);
  });

  it('10 probes same tech → 20%', () => {
    expect(calculateDetectionChance(10, 5, 5)).toBe(20);
  });

  it('high attacker tech reduces detection', () => {
    expect(calculateDetectionChance(1, 15, 5)).toBe(0);
  });

  it('never exceeds 100', () => {
    expect(calculateDetectionChance(100, 0, 0)).toBe(100);
  });

  it('high defender tech increases detection', () => {
    expect(calculateDetectionChance(5, 2, 5)).toBe(22);
  });
});

describe('Parametric config', () => {
  it('calculateSpyReport with custom thresholds', () => {
    const result = calculateSpyReport(2, 0, 0, [1, 2, 3, 4, 5]);
    expect(result.resources).toBe(true);
    expect(result.fleet).toBe(true);
    expect(result.defenses).toBe(false);
  });

  it('calculateDetectionChance with custom multipliers', () => {
    const chance = calculateDetectionChance(1, 0, 0, { probeMultiplier: 10, techMultiplier: 4 });
    expect(chance).toBe(10);
  });
});
