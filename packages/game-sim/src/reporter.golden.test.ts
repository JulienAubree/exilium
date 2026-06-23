// packages/game-sim/src/reporter.golden.test.ts
import { describe, it, expect } from 'vitest';
import { runAll } from './run.js';
import { renderReport } from './reporter.js';

/** Strip the date line so timestamp differences don't break the determinism check. */
function normalize(report: string): string {
  return report.replace(/^- Date : .+$/m, '- Date : <normalized>');
}

describe('rapport multi-profils', () => {
  it('contient les colonnes eco et optimal et est déterministe', () => {
    const a = normalize(renderReport(runAll()));
    const b = normalize(renderReport(runAll()));
    expect(a).toBe(b);                       // déterminisme (hors horodatage)
    expect(a.includes('| eco |') || a.includes('eco')).toBe(true);
    expect(a).toContain('optimal');
    expect(a).toContain('Temps jusqu\'au jalon');
  });
});
