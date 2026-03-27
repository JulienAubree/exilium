import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { createExiliumService, type ExiliumSource } from '../exilium.service.js';

// --- Helpers to build a mock DB ---

function createMockRow(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-1',
    balance: 0,
    totalEarned: 0,
    totalSpent: 0,
    lastDailyAt: null,
    dailyQuests: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createMockDb() {
  const rows: Record<string, ReturnType<typeof createMockRow>> = {};
  const logs: Array<{ userId: string; amount: number; source: string; details: unknown; createdAt: Date }> = [];

  // Build chainable query builder
  function chainable(result: unknown) {
    const chain: Record<string, unknown> = {};
    const methods = ['select', 'from', 'where', 'limit', 'insert', 'values', 'returning', 'update', 'set', 'orderBy', 'for'];
    for (const m of methods) {
      chain[m] = vi.fn(() => chain);
    }
    // Make it thenable so await works
    (chain as any).then = (resolve: (v: unknown) => void) => resolve(result);
    return chain;
  }

  // The mock tracks state and answers queries based on operation
  const db: any = {
    _rows: rows,
    _logs: logs,

    select: vi.fn().mockImplementation(() => {
      const chain: any = {};
      // Helper: resolve to current rows state
      const resolveRows = () => {
        const userId = Object.keys(rows)[0];
        const row = userId ? rows[userId] : undefined;
        return row ? [row] : [];
      };
      chain.from = vi.fn().mockImplementation(() => chain);
      chain.where = vi.fn().mockImplementation(() => {
        // After where, update .then and .for to resolve with row data
        chain.then = (resolve: any) => resolve(resolveRows());
        chain.for = vi.fn().mockImplementation(() => {
          chain.then = (resolve: any) => resolve(resolveRows());
          return chain;
        });
        return chain;
      });
      chain.limit = vi.fn().mockImplementation(() => {
        chain.then = (resolve: any) => resolve(resolveRows());
        return chain;
      });
      chain.orderBy = vi.fn().mockImplementation(() => {
        chain.then = (resolve: any) => resolve(resolveRows());
        return chain;
      });
      chain.for = vi.fn().mockImplementation(() => {
        chain.then = (resolve: any) => resolve(resolveRows());
        return chain;
      });
      chain.then = (resolve: any) => resolve([]);
      return chain;
    }),

    insert: vi.fn().mockImplementation((table: any) => {
      const chain: any = { _table: table };
      chain.values = vi.fn().mockImplementation((val: any) => {
        chain._values = val;
        return chain;
      });
      chain.returning = vi.fn().mockImplementation(() => {
        // Simulate insert into userExilium
        const val = chain._values;
        if (val?.userId) {
          const row = createMockRow({ userId: val.userId });
          rows[val.userId] = row;
          chain.then = (resolve: any) => resolve([row]);
        } else {
          // exiliumLog insert
          logs.push({
            userId: val.userId,
            amount: val.amount,
            source: val.source,
            details: val.details,
            createdAt: new Date(),
          });
          chain.then = (resolve: any) => resolve([val]);
        }
        return chain;
      });
      // For log inserts (no .returning())
      chain.then = (resolve: any) => {
        const val = chain._values;
        if (val) {
          logs.push({
            userId: val.userId,
            amount: val.amount,
            source: val.source,
            details: val.details,
            createdAt: new Date(),
          });
        }
        resolve(undefined);
      };
      return chain;
    }),

    update: vi.fn().mockImplementation(() => {
      const chain: any = {};
      chain.set = vi.fn().mockImplementation(() => chain);
      chain.where = vi.fn().mockImplementation(() => chain);
      chain.then = (resolve: any) => resolve(undefined);
      return chain;
    }),

    transaction: vi.fn().mockImplementation(async (fn: (tx: any) => Promise<void>) => {
      // Transaction uses a simplified tx that delegates to db
      await fn(db);
    }),
  };

  return db;
}

function createMockGameConfigService(overrides: Record<string, unknown> = {}) {
  return {
    getFullConfig: vi.fn().mockResolvedValue({
      universe: {
        exilium_drop_amount: 5,
        ...overrides,
      },
      categories: [],
      buildings: {},
      research: {},
      ships: {},
      defenses: {},
      production: {},
      planetTypes: [],
      pirateTemplates: [],
      tutorialQuests: [],
      bonuses: [],
      missions: {},
      labels: {},
    }),
  } as any;
}

describe('ExiliumService', () => {
  let db: ReturnType<typeof createMockDb>;
  let gameConfigService: ReturnType<typeof createMockGameConfigService>;
  let service: ReturnType<typeof createExiliumService>;

  beforeEach(() => {
    db = createMockDb();
    gameConfigService = createMockGameConfigService();
    service = createExiliumService(db, gameConfigService);
  });

  describe('getBalance', () => {
    it('retourne un solde de 0 pour un nouveau joueur', async () => {
      const result = await service.getBalance('user-1');
      expect(result.balance).toBe(0);
      expect(result.totalEarned).toBe(0);
      expect(result.totalSpent).toBe(0);
      expect(result.lastDailyAt).toBeNull();
    });

    it('retourne le solde existant si le joueur existe deja', async () => {
      db._rows['user-1'] = createMockRow({ balance: 42, totalEarned: 100, totalSpent: 58 });
      const result = await service.getBalance('user-1');
      expect(result.balance).toBe(42);
      expect(result.totalEarned).toBe(100);
      expect(result.totalSpent).toBe(58);
    });
  });

  describe('earn', () => {
    it('appelle db.transaction pour incrementer le solde', async () => {
      await service.earn('user-1', 10, 'daily_quest');
      expect(db.transaction).toHaveBeenCalledTimes(1);
    });

    it('refuse un montant negatif ou nul', async () => {
      await expect(service.earn('user-1', 0, 'daily_quest')).rejects.toThrow(TRPCError);
      await expect(service.earn('user-1', -5, 'daily_quest')).rejects.toThrow(TRPCError);
    });

    it('refuse un montant nul avec le bon message', async () => {
      await expect(service.earn('user-1', 0, 'admin')).rejects.toThrow('Le montant doit etre positif');
    });
  });

  describe('spend', () => {
    it('appelle db.transaction pour decrementer le solde', async () => {
      db._rows['user-1'] = createMockRow({ balance: 100 });
      await service.spend('user-1', 10, 'talent_unlock');
      expect(db.transaction).toHaveBeenCalledTimes(1);
    });

    it('refuse un montant negatif ou nul', async () => {
      await expect(service.spend('user-1', 0, 'talent_unlock')).rejects.toThrow(TRPCError);
      await expect(service.spend('user-1', -5, 'talent_unlock')).rejects.toThrow(TRPCError);
    });

    it('throw une erreur si le solde est insuffisant', async () => {
      db._rows['user-1'] = createMockRow({ balance: 5 });
      await expect(service.spend('user-1', 10, 'talent_unlock')).rejects.toThrow('Solde Exilium insuffisant');
    });
  });

  describe('tryDrop', () => {
    it('donne toujours un drop avec rate=1', async () => {
      gameConfigService = createMockGameConfigService({
        exilium_drop_rate_expedition: 1,
        exilium_drop_amount: 3,
      });
      service = createExiliumService(db, gameConfigService);

      const result = await service.tryDrop('user-1', 'expedition');
      expect(result.dropped).toBe(true);
      expect(result.amount).toBe(3);
    });

    it('ne donne jamais un drop avec rate=0', async () => {
      gameConfigService = createMockGameConfigService({
        exilium_drop_rate_pvp: 0,
      });
      service = createExiliumService(db, gameConfigService);

      const result = await service.tryDrop('user-1', 'pvp');
      expect(result.dropped).toBe(false);
      expect(result.amount).toBe(0);
    });
  });

  describe('getLog', () => {
    it('appelle la bonne requete avec limit par defaut', async () => {
      const result = await service.getLog('user-1');
      expect(db.select).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
