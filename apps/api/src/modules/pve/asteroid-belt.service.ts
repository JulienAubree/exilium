import { eq, and, sql, lte, isNotNull } from 'drizzle-orm';
import { asteroidBelts, asteroidDeposits } from '@exilium/db';
import type { Database } from '@exilium/db';

const DEPOSITS_PER_BELT = { min: 3, max: 5 };

// Probability that each resource is present in a deposit
const PRESENCE_PROBABILITY = {
  8:  { minerai: 0.95, silicium: 0.90, hydrogene: 0.25 },
  16: { minerai: 0.60, silicium: 0.65, hydrogene: 0.90 },
} as const;

// Distribution weights (normalized to present resources)
const DISTRIBUTION_WEIGHTS = {
  8:  { minerai: 0.45, silicium: 0.45, hydrogene: 0.10 },
  16: { minerai: 0.25, silicium: 0.25, hydrogene: 0.50 },
} as const;

const QUANTITY_RANGE = {
  8:  { min: 20000, max: 40000 },
  16: { min: 40000, max: 80000 },
} as const;

type ResourceKey = 'minerai' | 'silicium' | 'hydrogene';
const ALL_RESOURCES: ResourceKey[] = ['minerai', 'silicium', 'hydrogene'];

function rollPresentResources(position: 8 | 16): ResourceKey[] {
  const probs = PRESENCE_PROBABILITY[position];
  let present: ResourceKey[];
  do {
    present = ALL_RESOURCES.filter(r => Math.random() < probs[r]);
  } while (present.length < 2);
  return present;
}

function distributeQuantity(
  totalQty: number,
  present: ResourceKey[],
  position: 8 | 16,
): Record<ResourceKey, number> {
  const weights = DISTRIBUTION_WEIGHTS[position];
  const totalWeight = present.reduce((sum, r) => sum + weights[r], 0);
  const result: Record<ResourceKey, number> = { minerai: 0, silicium: 0, hydrogene: 0 };
  for (const r of present) {
    result[r] = Math.floor(totalQty * weights[r] / totalWeight);
  }
  return result;
}

function randomQuantity(position: 8 | 16, centerLevel: number): number {
  const { min, max } = QUANTITY_RANGE[position];
  const levelMultiplier = 1 + 0.15 * (centerLevel - 1);
  const base = min + Math.random() * (max - min);
  return Math.floor(base * levelMultiplier);
}

function randomRegenDelay(): number {
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

      await this.generateDeposits(belt.id, position, 1);
      return belt;
    },

    async generateDeposits(beltId: string, position: 8 | 16, centerLevel: number) {
      const count = DEPOSITS_PER_BELT.min + Math.floor(Math.random() * (DEPOSITS_PER_BELT.max - DEPOSITS_PER_BELT.min + 1));
      const values = [];
      for (let i = 0; i < count; i++) {
        const totalQty = randomQuantity(position, centerLevel);
        const present = rollPresentResources(position);
        const dist = distributeQuantity(totalQty, present, position);
        values.push({
          beltId,
          mineraiTotal: String(dist.minerai),
          mineraiRemaining: String(dist.minerai),
          siliciumTotal: String(dist.silicium),
          siliciumRemaining: String(dist.silicium),
          hydrogeneTotal: String(dist.hydrogene),
          hydrogeneRemaining: String(dist.hydrogene),
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

    async generateDiscoveredDeposit(
      beltId: string,
      totalQuantity: number,
      composition: { minerai: number; silicium: number; hydrogene: number },
    ) {
      const mineraiTotal = Math.floor(totalQuantity * composition.minerai);
      const siliciumTotal = Math.floor(totalQuantity * composition.silicium);
      const hydrogeneTotal = totalQuantity - mineraiTotal - siliciumTotal;

      const [deposit] = await db
        .insert(asteroidDeposits)
        .values({
          beltId,
          mineraiTotal: String(mineraiTotal),
          mineraiRemaining: String(mineraiTotal),
          siliciumTotal: String(siliciumTotal),
          siliciumRemaining: String(siliciumTotal),
          hydrogeneTotal: String(hydrogeneTotal),
          hydrogeneRemaining: String(hydrogeneTotal),
        })
        .returning();
      return deposit;
    },

    async extractFromDeposit(
      depositId: string,
      loss: { minerai: number; silicium: number; hydrogene: number },
    ): Promise<{ minerai: number; silicium: number; hydrogene: number }> {
      const regenDelayMs = randomRegenDelay();
      const result = await db.execute(sql`
        WITH pre AS (
          SELECT id, minerai_remaining, silicium_remaining, hydrogene_remaining
          FROM asteroid_deposits
          WHERE id = ${depositId}
            AND (minerai_remaining + silicium_remaining + hydrogene_remaining) > 0
          FOR UPDATE
        )
        UPDATE asteroid_deposits d
        SET minerai_remaining = GREATEST(0, d.minerai_remaining - ${loss.minerai}),
            silicium_remaining = GREATEST(0, d.silicium_remaining - ${loss.silicium}),
            hydrogene_remaining = GREATEST(0, d.hydrogene_remaining - ${loss.hydrogene}),
            regenerates_at = CASE
              WHEN GREATEST(0, d.minerai_remaining - ${loss.minerai})
                 + GREATEST(0, d.silicium_remaining - ${loss.silicium})
                 + GREATEST(0, d.hydrogene_remaining - ${loss.hydrogene}) <= 0
              THEN NOW() + make_interval(secs => ${regenDelayMs / 1000})
              ELSE NULL
            END
        FROM pre
        WHERE d.id = pre.id
        RETURNING
          LEAST(pre.minerai_remaining::numeric, ${loss.minerai}) AS deducted_minerai,
          LEAST(pre.silicium_remaining::numeric, ${loss.silicium}) AS deducted_silicium,
          LEAST(pre.hydrogene_remaining::numeric, ${loss.hydrogene}) AS deducted_hydrogene
      `);

      if (result.length === 0) return { minerai: 0, silicium: 0, hydrogene: 0 };

      const row = result[0] as { deducted_minerai: string; deducted_silicium: string; deducted_hydrogene: string };
      return {
        minerai: Number(row.deducted_minerai),
        silicium: Number(row.deducted_silicium),
        hydrogene: Number(row.deducted_hydrogene),
      };
    },

    async regenerateDepletedDeposits() {
      const depleted = await db.select({
        deposit: asteroidDeposits,
        belt: asteroidBelts,
      })
        .from(asteroidDeposits)
        .innerJoin(asteroidBelts, eq(asteroidDeposits.beltId, asteroidBelts.id))
        .where(and(
          sql`${asteroidDeposits.mineraiRemaining} + ${asteroidDeposits.siliciumRemaining} + ${asteroidDeposits.hydrogeneRemaining} <= 0`,
          isNotNull(asteroidDeposits.regeneratesAt),
          lte(asteroidDeposits.regeneratesAt, new Date()),
        ));

      for (const { deposit, belt } of depleted) {
        const pos = belt.position as 8 | 16;
        const totalQty = randomQuantity(pos, 1);
        const present = rollPresentResources(pos);
        const dist = distributeQuantity(totalQty, present, pos);
        await db.update(asteroidDeposits)
          .set({
            mineraiTotal: String(dist.minerai),
            mineraiRemaining: String(dist.minerai),
            siliciumTotal: String(dist.silicium),
            siliciumRemaining: String(dist.silicium),
            hydrogeneTotal: String(dist.hydrogene),
            hydrogeneRemaining: String(dist.hydrogene),
            regeneratesAt: null,
          })
          .where(eq(asteroidDeposits.id, deposit.id));
      }
    },
  };
}
