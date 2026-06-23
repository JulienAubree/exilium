import { describe, it, expect } from 'vitest';
import { synthesizeFindings } from './findings.js';
import type { RunResult } from './recorder.js';

const makeResult = (policy: string, walls: RunResult['walls']): RunResult => ({
  policy,
  milestones: [],
  walls,
  events: 10,
});

describe('synthesizeFindings', () => {
  it('returns [] when there are no significant walls (< 4h)', () => {
    const results: RunResult[] = [
      makeResult('eco', [{ atSec: 100, waitH: 3.9, for: 'shipyard' }]),
      makeResult('optimal', [{ atSec: 100, waitH: 3.5, for: 'shipyard' }]),
    ];
    expect(synthesizeFindings(results)).toEqual([]);
  });

  it('returns findings for significant walls (>= 4h) in optimal run', () => {
    const results: RunResult[] = [
      makeResult('eco', []),
      makeResult('optimal', [
        { atSec: 3600 * 24, waitH: 8, for: 'shipyard' },
        { atSec: 3600 * 48, waitH: 5, for: 'researchLab' },
      ]),
    ];
    const findings = synthesizeFindings(results);
    expect(findings).toHaveLength(2);
    // sorted descending by waitH
    expect(findings[0].signature).toBe('wall:shipyard');
    expect(findings[0].title).toContain('shipyard');
    expect(findings[0].title).toContain('8');
    expect(findings[1].signature).toBe('wall:researchLab');
  });

  it('deduplicates walls for the same building, keeping the worst', () => {
    const results: RunResult[] = [
      makeResult('optimal', [
        { atSec: 3600 * 10, waitH: 6, for: 'shipyard' },
        { atSec: 3600 * 20, waitH: 12, for: 'shipyard' },
        { atSec: 3600 * 30, waitH: 4, for: 'shipyard' },
      ]),
    ];
    const findings = synthesizeFindings(results);
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toContain('12');
  });

  it('uses the optimal run, ignoring eco even if worse walls exist there', () => {
    const results: RunResult[] = [
      makeResult('eco', [{ atSec: 3600, waitH: 99, for: 'robotics' }]),
      makeResult('optimal', [{ atSec: 3600, waitH: 4, for: 'shipyard' }]),
    ];
    const findings = synthesizeFindings(results);
    // robotics from eco should NOT appear; only shipyard from optimal
    expect(findings.every((f) => f.signature !== 'wall:robotics')).toBe(true);
    expect(findings.some((f) => f.signature === 'wall:shipyard')).toBe(true);
  });

  it('falls back to the last result if no optimal policy found', () => {
    const results: RunResult[] = [
      makeResult('eco', [{ atSec: 3600, waitH: 7, for: 'researchLab' }]),
    ];
    const findings = synthesizeFindings(results);
    expect(findings).toHaveLength(1);
    expect(findings[0].signature).toBe('wall:researchLab');
  });

  it('description mentions the building, wait time, sim time, and automated finding', () => {
    const results: RunResult[] = [
      makeResult('optimal', [{ atSec: 3600 * 48, waitH: 10, for: 'shipyard' }]),
    ];
    const [f] = synthesizeFindings(results);
    expect(f.description).toMatch(/shipyard/i);
    expect(f.description).toMatch(/10/);
    expect(f.description).toMatch(/automatique|simulator|rythme/i);
    expect(f.description).toMatch(/aplatir|prérequis/i);
  });

  it('title is capped at 200 chars', () => {
    const longBuilding = 'a'.repeat(300);
    const results: RunResult[] = [
      makeResult('optimal', [{ atSec: 3600, waitH: 10, for: longBuilding }]),
    ];
    const [f] = synthesizeFindings(results);
    expect(f.title.length).toBeLessThanOrEqual(200);
  });
});
