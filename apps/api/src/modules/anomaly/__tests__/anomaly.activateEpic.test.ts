import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { createAnomalyService } from '../anomaly.service.js';
import type { ModuleDefinitionLite } from '@exilium/game-engine';

/**
 * Tests for activateEpic — the most error-prone code in the V1 modules
 * integration. Covers:
 *  1. Immediate `repair` mutates fleet hullPercent (clamped at 1)
 *  2. Pending `overcharge` persists on `pendingEpicEffect`, charge consumed
 *  3. `skip` advances depth + resets to combat node + clears nextEventId (C3a)
 *  4. `skip` at currentDepth = MAX_DEPTH - 1 rejected without consuming charge (C3c)
 *  5. No charges available → BAD_REQUEST
 *  6. No active anomaly → BAD_REQUEST
 *  7. No epic equipped in current hull → BAD_REQUEST
 *  8. Snapshot semantics: epic from snapshot, not from live loadout (I1)
 *
 * The DB is a thin queue-based stub : each invocation of select() returns the
 * next batch from a FIFO queue, so we can script the exact rows the service
 * should observe across its 3 reads (flagship lock, anomaly lock, module pool).
 */

type FleetEntry = { count: number; hullPercent: number };

interface FlagshipMockRow {
  id: string;
  userId: string;
  hullId: string | null;
  status: string;
  epicChargesCurrent: number;
  epicChargesMax: number;
  moduleLoadout: Record<string, { epic?: string | null; rare?: string[]; common?: string[] }>;
}

interface AnomalyMockRow {
  id: string;
  userId: string;
  status: string;
  currentDepth: number;
  fleet: Record<string, FleetEntry>;
  equippedModules: Record<string, { epic?: string | null; rare?: string[]; common?: string[] }>;
  nextNodeType: 'combat' | 'event';
  nextEventId: string | null;
  pendingEpicEffect: { ability: string; magnitude: number } | null;
}

interface MockState {
  flagship: FlagshipMockRow | null;
  anomaly: AnomalyMockRow | null;
  modulePool: ModuleDefinitionLite[];
  /** Captured updates so tests can assert on them. */
  flagshipUpdates: Record<string, unknown>[];
  anomalyUpdates: Record<string, unknown>[];
  /** Queue of [rows] to return per select() invocation, in order. */
  selectQueue: unknown[][];
}

function buildMockDb(state: MockState) {
  const db: any = {
    _state: state,

    select: vi.fn().mockImplementation(() => {
      const chain: any = {};
      const resolveNext = () => state.selectQueue.shift() ?? [];
      // Drizzle chains terminate on .limit() (most common) or via implicit await
      // through .from().where(). We attach .then on every link so any await works.
      const attachThen = (target: any) => {
        target.then = (resolve: any) => resolve(resolveNext());
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
      chain.for = vi.fn().mockImplementation(() => {
        attachThen(chain);
        return chain;
      });
      chain.limit = vi.fn().mockImplementation(() => {
        attachThen(chain);
        return chain;
      });
      attachThen(chain);
      return chain;
    }),

    update: vi.fn().mockImplementation((table: any) => {
      const chain: any = { _table: table };
      let updateData: Record<string, unknown> = {};
      chain.set = vi.fn().mockImplementation((data: Record<string, unknown>) => {
        updateData = data;
        return chain;
      });
      chain.where = vi.fn().mockImplementation(() => {
        // Heuristic : route by drizzle Symbol-described table name. Fall back
        // to inspecting the keys of updateData (epicChargesCurrent → flagship,
        // currentDepth/fleet/pendingEpicEffect → anomaly).
        const tableName = (table?.[Symbol.for('drizzle:Name')] as string) ?? '';
        if (tableName.includes('flagship') || 'epicChargesCurrent' in updateData) {
          state.flagshipUpdates.push(updateData);
          if (state.flagship && 'epicChargesCurrent' in updateData) {
            // Decrement was wrapped in sql`...` — for our purposes just
            // record that the flagship was updated. Tests assert on the
            // captured payload, not on a refreshed row read.
          }
        } else {
          state.anomalyUpdates.push(updateData);
        }
        chain.then = (resolve: any) => resolve(undefined);
        return chain;
      });
      chain.then = (resolve: any) => resolve(undefined);
      return chain;
    }),

    insert: vi.fn().mockImplementation(() => {
      const chain: any = {};
      chain.values = vi.fn().mockImplementation(() => chain);
      chain.onConflictDoUpdate = vi.fn().mockImplementation(() => chain);
      chain.returning = vi.fn().mockImplementation(() => {
        chain.then = (resolve: any) => resolve([{}]);
        return chain;
      });
      chain.then = (resolve: any) => resolve(undefined);
      return chain;
    }),

    execute: vi.fn().mockResolvedValue(undefined),

    transaction: vi.fn().mockImplementation(async (fn: (tx: any) => Promise<any>) => {
      // Pass `db` itself as the tx — it has all the same methods. The service
      // also passes `tx as unknown as Database` to subroutines, so a circular
      // reference would be needed if the inner code did anything different.
      return await fn(db);
    }),
  };
  return db;
}

function buildModulesService(pool: ModuleDefinitionLite[]) {
  return {
    _getPool: vi.fn().mockResolvedValue(pool),
    _SLOT_TYPES: ['epic', 'rare', 'common'] as const,
    listAll: vi.fn(),
    getInventory: vi.fn(),
    getLoadout: vi.fn(),
    equip: vi.fn(),
    unequip: vi.fn(),
    rollPerCombatDrop: vi.fn(),
    rollPerRunFinalDrop: vi.fn(),
    grantModule: vi.fn(),
    adminUpsert: vi.fn(),
    adminDelete: vi.fn(),
  } as any;
}

function buildStubs() {
  return {
    gameConfigService: { getFullConfig: vi.fn().mockResolvedValue({ universe: {}, ships: {}, defenses: {}, bonuses: [] }) } as any,
    exiliumService: {} as any,
    flagshipService: {} as any,
    reportService: {} as any,
    anomalyContentService: {} as any,
  };
}

const POOL: ModuleDefinitionLite[] = [
  { id: 'epic-repair', hullId: 'combat', rarity: 'epic', enabled: true, effect: { type: 'active', ability: 'repair', magnitude: 0.5 } },
  { id: 'epic-overcharge', hullId: 'combat', rarity: 'epic', enabled: true, effect: { type: 'active', ability: 'overcharge', magnitude: 1.0 } },
  { id: 'epic-skip', hullId: 'combat', rarity: 'epic', enabled: true, effect: { type: 'active', ability: 'skip', magnitude: 1.0 } },
];

const ANOMALY_MAX_DEPTH = 20;

function makeFlagship(overrides: Partial<FlagshipMockRow> = {}): FlagshipMockRow {
  return {
    id: 'flagship-1',
    userId: 'user-1',
    hullId: 'combat',
    status: 'in_mission',
    epicChargesCurrent: 1,
    epicChargesMax: 2,
    moduleLoadout: { combat: { epic: 'epic-repair', rare: [], common: [] } },
    ...overrides,
  };
}

function makeAnomaly(overrides: Partial<AnomalyMockRow> = {}): AnomalyMockRow {
  return {
    id: 'anomaly-1',
    userId: 'user-1',
    status: 'active',
    currentDepth: 5,
    fleet: { flagship: { count: 1, hullPercent: 0.6 }, interceptor: { count: 10, hullPercent: 0.4 } },
    equippedModules: { combat: { epic: 'epic-repair', rare: [], common: [] } },
    nextNodeType: 'combat',
    nextEventId: null,
    pendingEpicEffect: null,
    ...overrides,
  };
}

describe('activateEpic', () => {
  let state: MockState;
  let db: any;
  let modulesService: any;
  let service: ReturnType<typeof createAnomalyService>;

  beforeEach(() => {
    state = {
      flagship: null,
      anomaly: null,
      modulePool: POOL,
      flagshipUpdates: [],
      anomalyUpdates: [],
      selectQueue: [],
    };
    db = buildMockDb(state);
    modulesService = buildModulesService(POOL);
    const stubs = buildStubs();
    service = createAnomalyService(
      db,
      stubs.gameConfigService,
      stubs.exiliumService,
      stubs.flagshipService,
      stubs.reportService,
      stubs.anomalyContentService,
      modulesService,
      // V9 Boss — stub minimal pour les tests legacy ne touchant pas aux boss.
      // V9.2 — getPool / pickBossForDepth sont désormais async (read content table).
      {
        getPool: async () => [],
        getPoolSync: () => [],
        invalidateCache: () => {},
        isBossDepth: () => false,
        pickBossForDepth: async () => null,
      } as never,
    );
  });

  it('1. immediate repair: boosts fleet hullPercent by magnitude, clamped at 1', async () => {
    const flagship = makeFlagship({ moduleLoadout: { combat: { epic: 'epic-repair', rare: [], common: [] } } });
    const anomaly = makeAnomaly({
      equippedModules: { combat: { epic: 'epic-repair', rare: [], common: [] } },
      fleet: { flagship: { count: 1, hullPercent: 0.6 }, interceptor: { count: 5, hullPercent: 0.4 } },
    });
    state.selectQueue.push([flagship], [anomaly]);

    const result = await service.activateEpic('user-1', 'combat');

    expect(result.ability).toBe('repair');
    expect(result.applied).toBe('immediate');
    expect(result.remainingCharges).toBe(0);

    // Charge consumed
    expect(state.flagshipUpdates.length).toBe(1);
    expect(state.flagshipUpdates[0]).toHaveProperty('epicChargesCurrent');

    // Fleet mutated : 0.6 + 0.5 = 1.0 (clamped); 0.4 + 0.5 = 0.9
    expect(state.anomalyUpdates.length).toBe(1);
    const updatedFleet = state.anomalyUpdates[0].fleet as Record<string, FleetEntry>;
    expect(updatedFleet.flagship.hullPercent).toBe(1);   // clamped
    expect(updatedFleet.interceptor.hullPercent).toBeCloseTo(0.9);
    expect(state.anomalyUpdates[0].pendingEpicEffect).toBeNull();
  });

  it('2. pending overcharge: persists on pendingEpicEffect, charge consumed', async () => {
    const flagship = makeFlagship({ moduleLoadout: { combat: { epic: 'epic-overcharge', rare: [], common: [] } } });
    const anomaly = makeAnomaly({ equippedModules: { combat: { epic: 'epic-overcharge', rare: [], common: [] } } });
    state.selectQueue.push([flagship], [anomaly]);

    const result = await service.activateEpic('user-1', 'combat');

    expect(result.ability).toBe('overcharge');
    expect(result.applied).toBe('pending');
    expect(result.remainingCharges).toBe(0);

    expect(state.flagshipUpdates.length).toBe(1);
    expect(state.anomalyUpdates.length).toBe(1);
    expect(state.anomalyUpdates[0].pendingEpicEffect).toEqual({ ability: 'overcharge', magnitude: 1.0 });
  });

  it('3. skip: advances depth, resets to combat node, clears nextEventId (C3a)', async () => {
    const flagship = makeFlagship({ moduleLoadout: { combat: { epic: 'epic-skip', rare: [], common: [] } } });
    const anomaly = makeAnomaly({
      equippedModules: { combat: { epic: 'epic-skip', rare: [], common: [] } },
      currentDepth: 5,
      // The bug : if user uses skip while sitting on a pending event, that
      // event must be cleared so they don't get wedged on next advance().
      nextNodeType: 'event',
      nextEventId: 'evt-mystery',
    });
    state.selectQueue.push([flagship], [anomaly]);

    await service.activateEpic('user-1', 'combat');

    expect(state.anomalyUpdates.length).toBe(1);
    const upd = state.anomalyUpdates[0];
    expect(upd.currentDepth).toBe(6);                  // depth bumped
    expect(upd.nextNodeType).toBe('combat');           // C3a : reset to combat
    expect(upd.nextEventId).toBeNull();                // C3a : event cleared
    expect(upd.nextEnemyFleet).toBeNull();             // preview cleared (regen on next advance)
    expect(upd.nextEnemyFp).toBeNull();
    expect(upd.pendingEpicEffect).toBeNull();
    expect(upd.nextNodeAt).toBeInstanceOf(Date);       // ready immediately
  });

  it('4. skip at currentDepth = MAX_DEPTH - 1 rejected, charge NOT consumed (C3c)', async () => {
    const flagship = makeFlagship({ moduleLoadout: { combat: { epic: 'epic-skip', rare: [], common: [] } } });
    const anomaly = makeAnomaly({
      equippedModules: { combat: { epic: 'epic-skip', rare: [], common: [] } },
      currentDepth: ANOMALY_MAX_DEPTH - 1,  // Skip would push to MAX_DEPTH = exploit
    });
    state.selectQueue.push([flagship], [anomaly]);

    await expect(service.activateEpic('user-1', 'combat')).rejects.toThrow(/dernier saut/i);

    // Critical : charge NOT consumed, anomaly NOT updated.
    expect(state.flagshipUpdates.length).toBe(0);
    expect(state.anomalyUpdates.length).toBe(0);
  });

  it('5. no charges available → BAD_REQUEST', async () => {
    const flagship = makeFlagship({ epicChargesCurrent: 0 });
    state.selectQueue.push([flagship]);

    await expect(service.activateEpic('user-1', 'combat')).rejects.toThrow(TRPCError);
    await expect(
      (async () => {
        state.selectQueue.push([flagship]);
        await service.activateEpic('user-1', 'combat');
      })(),
    ).rejects.toThrow(/charge/i);
  });

  it('6. no active anomaly → BAD_REQUEST', async () => {
    const flagship = makeFlagship();
    state.selectQueue.push([flagship], []); // anomaly query returns empty

    await expect(service.activateEpic('user-1', 'combat')).rejects.toThrow(/anomalie active/i);
  });

  it('7. no epic equipped in current hull → BAD_REQUEST', async () => {
    const flagship = makeFlagship();
    const anomaly = makeAnomaly({
      // Snapshot has empty epic for combat hull
      equippedModules: { combat: { epic: null, rare: [], common: [] } },
    });
    state.selectQueue.push([flagship], [anomaly]);

    await expect(service.activateEpic('user-1', 'combat')).rejects.toThrow(/épique/i);
  });

  it('8. snapshot semantics: epic resolved from active.equippedModules, NOT from live flagship.moduleLoadout (I1)', async () => {
    // Live flagship has overcharge — but the snapshot taken at engage has
    // repair. The service MUST use the snapshot.
    const flagship = makeFlagship({
      moduleLoadout: { combat: { epic: 'epic-overcharge', rare: [], common: [] } },
    });
    const anomaly = makeAnomaly({
      equippedModules: { combat: { epic: 'epic-repair', rare: [], common: [] } },
    });
    state.selectQueue.push([flagship], [anomaly]);

    const result = await service.activateEpic('user-1', 'combat');

    // If the service read live loadout, this would be 'overcharge' (pending).
    // If it correctly reads the snapshot, it's 'repair' (immediate).
    expect(result.ability).toBe('repair');
    expect(result.applied).toBe('immediate');
  });
});
