import { eq, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { userExilium, exiliumLog } from '@exilium/db';
import type { Database } from '@exilium/db';
import type { GameConfigService } from '../admin/game-config.service.js';

export type ExiliumSource =
  | 'daily_quest'
  | 'expedition'
  | 'pvp'
  | 'pve'
  | 'market'
  | 'recycling'
  | 'flagship_repair'
  | 'talent_unlock'
  | 'respec'
  | 'admin';

export function createExiliumService(db: Database, gameConfigService: GameConfigService) {

  async function getOrCreate(userId: string) {
    const [existing] = await db
      .select()
      .from(userExilium)
      .where(eq(userExilium.userId, userId))
      .limit(1);
    if (existing) return existing;

    const [created] = await db
      .insert(userExilium)
      .values({ userId })
      .returning();
    return created;
  }

  return {
    getOrCreate,

    async getBalance(userId: string) {
      const record = await getOrCreate(userId);
      return {
        balance: record.balance,
        totalEarned: record.totalEarned,
        totalSpent: record.totalSpent,
        lastDailyAt: record.lastDailyAt,
      };
    },

    async earn(userId: string, amount: number, source: ExiliumSource, details?: unknown) {
      if (amount <= 0) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Le montant doit etre positif' });

      await getOrCreate(userId);

      await db.transaction(async (tx) => {
        await tx
          .update(userExilium)
          .set({
            balance: sql`${userExilium.balance} + ${amount}`,
            totalEarned: sql`${userExilium.totalEarned} + ${amount}`,
            updatedAt: new Date(),
          })
          .where(eq(userExilium.userId, userId));

        await tx
          .insert(exiliumLog)
          .values({ userId, amount, source, details: details ?? null });
      });
    },

    async spend(userId: string, amount: number, source: ExiliumSource, details?: unknown) {
      if (amount <= 0) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Le montant doit etre positif' });

      await getOrCreate(userId);

      await db.transaction(async (tx) => {
        const [record] = await tx
          .select({ balance: userExilium.balance })
          .from(userExilium)
          .where(eq(userExilium.userId, userId))
          .for('update');

        if (!record || record.balance < amount) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Solde Exilium insuffisant (${record?.balance ?? 0} disponible, ${amount} requis)`,
          });
        }

        await tx
          .update(userExilium)
          .set({
            balance: sql`${userExilium.balance} - ${amount}`,
            totalSpent: sql`${userExilium.totalSpent} + ${amount}`,
            updatedAt: new Date(),
          })
          .where(eq(userExilium.userId, userId));

        await tx
          .insert(exiliumLog)
          .values({ userId, amount: -amount, source, details: details ?? null });
      });
    },

    async tryDrop(userId: string, source: ExiliumSource, details?: unknown) {
      const config = await gameConfigService.getFullConfig();
      const rateKey = `exilium_drop_rate_${source}` as string;
      const rate = Number(config.universe[rateKey]) || 0;
      const dropAmount = Number(config.universe['exilium_drop_amount']) || 1;

      if (Math.random() < rate) {
        await this.earn(userId, dropAmount, source, details);
        return { dropped: true, amount: dropAmount };
      }
      return { dropped: false, amount: 0 };
    },

    async getLog(userId: string, limit = 50) {
      return db
        .select()
        .from(exiliumLog)
        .where(eq(exiliumLog.userId, userId))
        .orderBy(sql`${exiliumLog.createdAt} DESC`)
        .limit(limit);
    },
  };
}
