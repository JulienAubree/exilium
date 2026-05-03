import { describe, it, expect, vi } from 'vitest';
import { createModulesService } from '../modules.service.js';
import { parseLoadout, type ModuleDefinitionLite } from '@exilium/game-engine';
import { hullSlotSchema, moduleLoadoutSchema } from '../modules.types.js';

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

// ─── C1 / I5 : equip → engage → unequip cycle ───────────────────────────────
//
// Regression test for the sparse-array bug : equipping into a non-leftmost
// slot (e.g. rare[2]) used to produce `[<empty>, <empty>, "id"]` which
// JSON.stringify rendered as `[null, null, "id"]` — but the schema rejected
// it on read, silently wiping the loadout. The fix : fixed-length arrays
// with explicit `null` placeholders, padded both on read (legacy rows) and
// on write (new equip/unequip).
//
// The test below uses a thin FIFO-queue mock-DB (same pattern as
// anomaly.activateEpic.test.ts) so we can script the exact rows the service
// observes across each select() call.

describe('equip → unequip cycle (C1 sparse-array fix)', () => {
  type Loadout = Record<string, { epic: string | null; rare: (string | null)[]; common: (string | null)[] }>;

  interface State {
    /** Mutable copy of the flagship row (updated by the service's `update`). */
    flagship: {
      id: string;
      userId: string;
      status: string;
      moduleLoadout: unknown;
      epicChargesCurrent: number;
      epicChargesMax: number;
    };
    /** Queue of rows returned by successive select() invocations, in order. */
    selectQueue: unknown[][];
    /** Captured `update().set(...)` payloads. */
    loadoutUpdates: Array<Record<string, unknown>>;
  }

  function buildMockDb(state: State) {
    const db: any = {
      select: vi.fn().mockImplementation(() => {
        const chain: any = {};
        const respond = () => state.selectQueue.shift() ?? [];
        const attachThen = (t: any) => {
          t.then = (resolve: any) => resolve(respond());
        };
        chain.from = vi.fn().mockImplementation(() => chain);
        chain.innerJoin = vi.fn().mockImplementation(() => chain);
        chain.where = vi.fn().mockImplementation(() => {
          attachThen(chain);
          chain.for = vi.fn().mockImplementation(() => {
            attachThen(chain);
            chain.limit = vi.fn().mockImplementation(() => {
              attachThen(chain);
              return chain;
            });
            return chain;
          });
          chain.limit = vi.fn().mockImplementation(() => {
            attachThen(chain);
            return chain;
          });
          chain.orderBy = vi.fn().mockImplementation(() => {
            attachThen(chain);
            chain.limit = vi.fn().mockImplementation(() => {
              attachThen(chain);
              return chain;
            });
            return chain;
          });
          return chain;
        });
        attachThen(chain);
        return chain;
      }),

      update: vi.fn().mockImplementation(() => {
        const chain: any = {};
        let payload: Record<string, unknown> = {};
        chain.set = vi.fn().mockImplementation((data: Record<string, unknown>) => {
          payload = data;
          return chain;
        });
        chain.where = vi.fn().mockImplementation(() => {
          state.loadoutUpdates.push(payload);
          if ('moduleLoadout' in payload) state.flagship.moduleLoadout = payload.moduleLoadout;
          if ('epicChargesMax' in payload) state.flagship.epicChargesMax = Number(payload.epicChargesMax);
          chain.then = (resolve: any) => resolve(undefined);
          return chain;
        });
        chain.then = (resolve: any) => resolve(undefined);
        return chain;
      }),

      transaction: vi.fn().mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(db)),
    };
    return db as Parameters<typeof createModulesService>[0];
  }

  /** Helper : queue the 4 rows the equip flow reads, in order :
   *  flagship → moduleDef → inventory → pool. */
  function queueEquipReads(state: State, moduleDef: { id: string; hullId: string; rarity: string }) {
    state.selectQueue.push(
      [state.flagship],
      [{
        id: moduleDef.id, hullId: moduleDef.hullId, rarity: moduleDef.rarity,
        enabled: true, effect: { type: 'stat', stat: 'damage', value: 0.20 },
        name: moduleDef.id, description: '', image: '', createdAt: new Date(),
      }],
      [{ count: 1 }],
      // Pool : minimal, just the equipped module so getMaxCharges/parseLoadout work.
      [{
        id: moduleDef.id, hullId: moduleDef.hullId, rarity: moduleDef.rarity,
        enabled: true, effect: { type: 'stat', stat: 'damage', value: 0.20 },
        name: moduleDef.id, description: '', image: '', createdAt: new Date(),
      }],
    );
  }

  /** Helper : queue the 2 rows the unequip flow reads, in order :
   *  flagship → pool. */
  function queueUnequipReads(state: State) {
    state.selectQueue.push(
      [state.flagship],
      [], // pool — empty is fine for getMaxCharges (returns baseline 1).
    );
  }

  it('équipe à rare[2] (slot non-leftmost) et reparse correctement (C1 repro)', async () => {
    const state: State = {
      flagship: {
        id: 'fs1', userId: 'u1', status: 'active',
        moduleLoadout: {}, epicChargesCurrent: 1, epicChargesMax: 1,
      },
      selectQueue: [],
      loadoutUpdates: [],
    };
    queueEquipReads(state, { id: 'c-r1', hullId: 'combat', rarity: 'rare' });
    const svc = createModulesService(buildMockDb(state));

    // Equip the rare module at rare[2] — the index that used to break.
    const result = await svc.equip('u1', { hullId: 'combat', slotType: 'rare', slotIndex: 2, moduleId: 'c-r1' });

    // The persisted loadout must roundtrip through the (stricter) schema.
    const loadout = result.loadout as Loadout;
    expect(moduleLoadoutSchema.safeParse(loadout).success).toBe(true);

    const slot = loadout.combat;
    expect(slot.rare).toEqual([null, null, 'c-r1']);
    expect(slot.common).toEqual([null, null, null, null, null]);
    expect(slot.epic).toBeNull();

    // Engine must resolve the equipped module from index 2.
    const parsed = parseLoadout(loadout, 'combat', FAKE_POOL);
    expect(parsed.equipped.map((m) => m.id)).toEqual(['c-r1']);
  });

  it('unequip remplace par null sans compresser les autres slots', async () => {
    // Pre-seed a loadout with two rares at indices 0 and 2 (not 1).
    const state: State = {
      flagship: {
        id: 'fs1', userId: 'u1', status: 'active',
        moduleLoadout: { combat: { epic: null, rare: ['c-r1', null, 'c-r1'], common: [null, null, null, null, null] } },
        epicChargesCurrent: 1, epicChargesMax: 1,
      },
      selectQueue: [],
      loadoutUpdates: [],
    };
    queueUnequipReads(state);
    const svc = createModulesService(buildMockDb(state));

    const result = await svc.unequip('u1', { hullId: 'combat', slotType: 'rare', slotIndex: 0 });

    const loadout = result.loadout as Loadout;
    // Index 2 preserved, no compaction. Index 0 is now null.
    expect(loadout.combat.rare).toEqual([null, null, 'c-r1']);
    // Schema still validates — no sparse holes.
    expect(moduleLoadoutSchema.safeParse(loadout).success).toBe(true);
  });

  it('hullSlotSchema rejette les longueurs incorrectes (defensive)', () => {
    // Length-3 + length-5 are enforced strictly. Any legacy short array
    // that slips past the pad-on-read coercion would fail the contract,
    // which is precisely the failure mode we want to catch on write.
    const bad = { epic: null, rare: ['x'], common: ['y'] };
    expect(hullSlotSchema.safeParse(bad).success).toBe(false);

    const good = { epic: null, rare: [null, null, 'x'], common: [null, null, null, null, 'y'] };
    expect(hullSlotSchema.safeParse(good).success).toBe(true);
  });
});
