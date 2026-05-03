import { describe, it, expect } from 'vitest';
import { createModulesService } from '../modules.service.js';
import type { ModuleDefinitionLite } from '@exilium/game-engine';

// Mock DB stub : we only test pure logic (rollPerCombatDrop, rollPerRunFinalDrop).
// Real equip/unequip tested in E2E because they require a real flagship row.
const FAKE_POOL: ModuleDefinitionLite[] = [
  { id: 'c-c1', hullId: 'combat',     rarity: 'common', enabled: true, effect: { type: 'stat', stat: 'damage', value: 0.05 } },
  { id: 'c-c2', hullId: 'combat',     rarity: 'common', enabled: true, effect: { type: 'stat', stat: 'hull', value: 0.05 } },
  { id: 'c-r1', hullId: 'combat',     rarity: 'rare',   enabled: true, effect: { type: 'stat', stat: 'damage', value: 0.20 } },
  { id: 'c-e1', hullId: 'combat',     rarity: 'epic',   enabled: true, effect: { type: 'active', ability: 'repair', magnitude: 0.5 } },
  { id: 's-c1', hullId: 'scientific', rarity: 'common', enabled: true, effect: { type: 'stat', stat: 'shield', value: 0.05 } },
  { id: 'i-c1', hullId: 'industrial', rarity: 'common', enabled: true, effect: { type: 'stat', stat: 'cargo', value: 0.05 } },
];

function makeStubDb(pool: ModuleDefinitionLite[]) {
  // Minimal stub — only `select().from(moduleDefinitions).where(...)` is called by getPool
  return {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(pool.map((m) => ({
          id: m.id, hullId: m.hullId, rarity: m.rarity, enabled: m.enabled, effect: m.effect,
          name: m.id, description: '', image: '', createdAt: new Date(),
        }))),
      }),
    }),
  } as unknown as Parameters<typeof createModulesService>[0];
}

describe('rollPerCombatDrop', () => {
  it('30% : commun de la coque own (roll < 0.30)', async () => {
    const svc = createModulesService(makeStubDb(FAKE_POOL));
    let counter = 0;
    const rng = () => {
      const seq = [0.10, 0.50]; // first call = 0.10 (< 0.30 → own), second call = pick index
      return seq[counter++];
    };
    const result = await svc.rollPerCombatDrop({ flagshipHullId: 'combat', rng });
    expect(['c-c1', 'c-c2']).toContain(result);
  });

  it('5% : commun d\'autre coque (0.30 ≤ roll < 0.35)', async () => {
    const svc = createModulesService(makeStubDb(FAKE_POOL));
    let counter = 0;
    const rng = () => {
      const seq = [0.32, 0.99, 0.00]; // 0.32 → other coque, 0.99 → pick last in array (industrial), 0.00 → pick first
      return seq[counter++];
    };
    const result = await svc.rollPerCombatDrop({ flagshipHullId: 'combat', rng });
    expect(['s-c1', 'i-c1']).toContain(result);
  });

  it('65% : rien (roll >= 0.35)', async () => {
    const svc = createModulesService(makeStubDb(FAKE_POOL));
    const result = await svc.rollPerCombatDrop({ flagshipHullId: 'combat', rng: () => 0.50 });
    expect(result).toBeNull();
  });

  it('distribution sur 10000 rolls match les pourcentages cibles ±2%', async () => {
    const svc = createModulesService(makeStubDb(FAKE_POOL));
    let own = 0, other = 0, none = 0;
    for (let i = 0; i < 10000; i++) {
      const result = await svc.rollPerCombatDrop({ flagshipHullId: 'combat' });
      if (result === null) none++;
      else if (result.startsWith('c-')) own++;
      else other++;
    }
    expect(own).toBeGreaterThan(2800);   // ~3000 (30%)
    expect(own).toBeLessThan(3200);
    expect(other).toBeGreaterThan(350);  // ~500 (5%)
    expect(other).toBeLessThan(650);
    expect(none).toBeGreaterThan(6300);  // ~6500 (65%)
    expect(none).toBeLessThan(6700);
  });
});

describe('rollPerRunFinalDrop', () => {
  it('depth 1-3 : 1 commun', async () => {
    const svc = createModulesService(makeStubDb(FAKE_POOL));
    const result = await svc.rollPerRunFinalDrop({ flagshipHullId: 'combat', depth: 2, rng: () => 0 });
    expect(result.length).toBe(1);
    expect(['c-c1', 'c-c2']).toContain(result[0]);
  });

  it('depth 4-7 : 1 rare', async () => {
    const svc = createModulesService(makeStubDb(FAKE_POOL));
    const result = await svc.rollPerRunFinalDrop({ flagshipHullId: 'combat', depth: 5, rng: () => 0 });
    expect(result).toEqual(['c-r1']);
  });

  it('depth 13+ : 1 rare + 1 epic garanti', async () => {
    const svc = createModulesService(makeStubDb(FAKE_POOL));
    const result = await svc.rollPerRunFinalDrop({ flagshipHullId: 'combat', depth: 15, rng: () => 0 });
    expect(result).toEqual(['c-r1', 'c-e1']);
  });

  it('depth 8-12 : 1 rare, épique conditionné par 30%', async () => {
    const svc = createModulesService(makeStubDb(FAKE_POOL));
    // rng=0.10 < 0.30 → epic dropped
    let counter = 0;
    const rngWithEpic = () => [0, 0.10, 0][counter++]; // pick rare, roll for epic, pick epic
    const r1 = await svc.rollPerRunFinalDrop({ flagshipHullId: 'combat', depth: 10, rng: rngWithEpic });
    expect(r1.length).toBe(2);

    counter = 0;
    const rngNoEpic = () => [0, 0.50][counter++]; // pick rare, roll for epic (fail)
    const r2 = await svc.rollPerRunFinalDrop({ flagshipHullId: 'combat', depth: 10, rng: rngNoEpic });
    expect(r2.length).toBe(1);
  });
});
