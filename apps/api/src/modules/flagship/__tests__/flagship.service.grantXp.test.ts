import { describe, it, expect, vi } from 'vitest';
import { createFlagshipService } from '../flagship.service.js';

function makeMockGameConfig() {
  return {
    getFullConfig: async () => ({
      universe: {
        flagship_max_level: 60,
      },
      hulls: {},
    }),
  };
}

function makeMockDb(selectResults: unknown[][], onUpdate?: (set: Record<string, unknown>) => void) {
  const queue = [...selectResults];
  const db: any = {
    transaction: async (cb: (tx: any) => Promise<any>) => cb(db),
    execute: vi.fn().mockResolvedValue([]),
    select: vi.fn().mockImplementation(() => {
      const chain: any = {};
      const result = queue.shift() ?? [];
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.for = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue(result);
      chain.then = (resolve: any) => resolve(result);
      return chain;
    }),
    update: vi.fn().mockImplementation(() => {
      const chain: any = {};
      chain.set = vi.fn().mockImplementation((data: Record<string, unknown>) => {
        if (onUpdate) onUpdate(data);
        return chain;
      });
      chain.where = vi.fn().mockResolvedValue(undefined);
      return chain;
    }),
  };
  return db;
}

function makeService(db: any) {
  return createFlagshipService(
    db,
    {} as any,  // exiliumService
    makeMockGameConfig() as any,
    {} as any,  // talentService (deprecated, optional)
    undefined,  // assetsDir
    {} as any,  // resourceService
    {} as any,  // reportService
  );
}

describe('flagshipService.grantXp', () => {
  it('grants 100 XP and reaches level 2', async () => {
    const flagship = { id: 'f1', xp: 0, level: 1 };
    let updateData: Record<string, unknown> = {};
    const db = makeMockDb([[flagship]], (data) => { updateData = data; });
    const result = await makeService(db).grantXp('user1', 100);
    expect(result.newXp).toBe(100);
    expect(result.newLevel).toBe(2);
    expect(result.oldLevel).toBe(1);
    expect(result.levelUp).toBe(true);
    expect(updateData.xp).toBe(100);
    expect(updateData.level).toBe(2);
  });

  it('returns no-op for amount = 0 (no DB call)', async () => {
    const db = makeMockDb([]);
    const result = await makeService(db).grantXp('user1', 0);
    expect(result.levelUp).toBe(false);
    expect(db.select).not.toHaveBeenCalled();
  });

  it('returns no-op for negative amount (defensive)', async () => {
    const db = makeMockDb([]);
    const result = await makeService(db).grantXp('user1', -50);
    expect(result.levelUp).toBe(false);
    expect(db.select).not.toHaveBeenCalled();
  });

  it('returns levelUp=false when amount keeps same level', async () => {
    const flagship = { id: 'f1', xp: 200, level: 2 };  // L2 = 100, L3 = 300
    const db = makeMockDb([[flagship]]);
    const result = await makeService(db).grantXp('user1', 50);  // 250 XP, still L2
    expect(result.newXp).toBe(250);
    expect(result.newLevel).toBe(2);
    expect(result.oldLevel).toBe(2);
    expect(result.levelUp).toBe(false);
  });

  it('caps at maxLevel 60 for huge XP grant', async () => {
    const flagship = { id: 'f1', xp: 0, level: 1 };
    const db = makeMockDb([[flagship]]);
    const result = await makeService(db).grantXp('user1', 9999999);
    expect(result.newLevel).toBe(60);
    expect(result.levelUp).toBe(true);
  });

  it('returns no-op when no flagship exists', async () => {
    const db = makeMockDb([[]]);  // empty result
    const result = await makeService(db).grantXp('user1', 100);
    expect(result.newXp).toBe(0);
    expect(result.levelUp).toBe(false);
  });
});
