import { describe, it, expect } from 'vitest';
import { renderReport } from './reporter.js';

describe('renderReport', () => {
  it('rend un tableau temps-jusqu\'au-jalon déterministe', () => {
    const md = renderReport([{ policy: 'eco', milestones: [{ id: 'firstMine', timeSec: 45 }], walls: [], events: 3 }]);
    expect(md).toContain('| firstMine |');
    expect(md).toContain('eco');
    expect(md).toContain('45 s'); // formatage du temps
  });
});
