import { eq, and, sql, lte, isNotNull } from 'drizzle-orm';
import { asteroidBelts, asteroidDeposits } from '@ogame-clone/db';
import type { Database } from '@ogame-clone/db';

const DEPOSITS_PER_BELT = { min: 3, max: 5 };

// Position 8: smaller, mostly minerai/silicium
// Position 16: larger, more hydrogene
const DEPOSIT_CONFIG = {
  8: {
    resourceWeights: { minerai: 0.45, silicium: 0.45, hydrogene: 0.1 },
    quantityRange: { min: 20000, max: 40000 },
  },
  16: {
    resourceWeights: { minerai: 0.25, silicium: 0.25, hydrogene: 0.5 },
    quantityRange: { min: 40000, max: 80000 },
  },
} as const;

function pickResourceType(position: 8 | 16): 'minerai' | 'silicium' | 'hydrogene' {
  const weights = DEPOSIT_CONFIG[position].resourceWeights;
  const rand = Math.random();
  if (rand < weights.minerai) return 'minerai';
  if (rand < weights.minerai + weights.silicium) return 'silicium';
  return 'hydrogene';
}

function randomQuantity(position: 8 | 16, centerLevel: number): number {
  const { min, max } = DEPOSIT_CONFIG[position].quantityRange;
  const levelMultiplier = 1 + 0.15 * (centerLevel - 1);
  const base = min + Math.random() * (max - min);
  return Math.floor(base * levelMultiplier);
}

function randomRegenDelay(): number {
  // 4-8 hours in ms
  return (4 + Math.random() * 4) * 60 * 60 * 1000;
}

export function createAsteroidBeltService(db: Database) {
  return {
    async getOrCreateBelt(galaxy: number, system: number, position: 8 | 16) {
      const existing = await db.select().from(asteroidBelts)
        .where(and(
          eq(asteroidBelts.galaxy, galaxy),
          eq(asteroidBelts.system, system),
          eq(asteroidBelts.position, position),
        ))
        .limit(1);

      if (existing.length > 0) return existing[0];

      const [belt] = await db.insert(asteroidBelts).values({
        galaxy, system, position,
      }).onConflictDoNothing().returning();

      // If conflict (race condition), fetch again
      if (!belt) {
        const [found] = await db.select().from(asteroidBelts)
          .where(and(
            eq(asteroidBelts.galaxy, galaxy),
            eq(asteroidBelts.system, system),
            eq(asteroidBelts.position, position),
          ))
          .limit(1);
        return found;
      }

      // Generate initial deposits
      await this.generateDeposits(belt.id, position, 1);
      return belt;
    },

    async generateDeposits(beltId: string, position: 8 | 16, centerLevel: number) {
      const count = DEPOSITS_PER_BELT.min + Math.floor(Math.random() * (DEPOSITS_PER_BELT.max - DEPOSITS_PER_BELT.min + 1));
      const values = [];
      for (let i = 0; i < count; i++) {
        const qty = randomQuantity(position, centerLevel);
        values.push({
          beltId,
          resourceType: pickResourceType(position),
          totalQuantity: String(qty),
          remainingQuantity: String(qty),
        });
      }
      await db.insert(asteroidDeposits).values(values);
    },

    async getDeposits(beltId: string) {
      return db.select().from(asteroidDeposits)
        .where(eq(asteroidDeposits.beltId, beltId));
    },

    async getSystemDeposits(galaxy: number, system: number) {
      const belts = await db.select().from(asteroidBelts)
        .where(and(
          eq(asteroidBelts.galaxy, galaxy),
          eq(asteroidBelts.system, system),
        ));

      const result: Record<number, typeof asteroidDeposits.$inferSelect[]> = {};
      for (const belt of belts) {
        result[belt.position] = await this.getDeposits(belt.id);
      }
      return result;
    },

    async extractFromDeposit(depositId: string, amount: number): Promise<number> {
      const regenDelayMs = randomRegenDelay();
      const result = await db.execute(sql`
        UPDATE asteroid_deposits
        SET remaining_quantity = GREATEST(0, remaining_quantity - ${amount}),
            regenerates_at = CASE
              WHEN remaining_quantity - ${amount} <= 0
              THEN NOW() + make_interval(secs => ${regenDelayMs / 1000})
              ELSE NULL
            END
        WHERE id = ${depositId}
          AND remaining_quantity > 0
        RETURNING remaining_quantity,
          (remaining_quantity + ${amount} - GREATEST(0, remaining_quantity)) as extracted
      `);

      if (result.length === 0) return 0;
      return Number(result[0].extracted);
    },

    async regenerateDepletedDeposits() {
      const depleted = await db.select({
        deposit: asteroidDeposits,
        belt: asteroidBelts,
      })
        .from(asteroidDeposits)
        .innerJoin(asteroidBelts, eq(asteroidDeposits.beltId, asteroidBelts.id))
        .where(and(
          lte(asteroidDeposits.remainingQuantity, '0'),
          isNotNull(asteroidDeposits.regeneratesAt),
          lte(asteroidDeposits.regeneratesAt, new Date()),
        ));

      for (const { deposit, belt } of depleted) {
        const pos = belt.position as 8 | 16;
        const qty = randomQuantity(pos, 1);
        await db.update(asteroidDeposits)
          .set({
            resourceType: pickResourceType(pos),
            totalQuantity: String(qty),
            remainingQuantity: String(qty),
            regeneratesAt: null,
          })
          .where(eq(asteroidDeposits.id, deposit.id));
      }
    },
  };
}
