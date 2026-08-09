import { eq, and, sql, lte, isNotNull } from 'drizzle-orm';
import { asteroidBelts, asteroidDeposits } from '@exilium/db';
import type { Database } from '@exilium/db';

const DEPOSITS_PER_BELT = { min: 3, max: 5 };

type ResourceKey = 'minerai' | 'silicium' | 'hydrogene';
const ALL_RESOURCES: ResourceKey[] = ['minerai', 'silicium', 'hydrogene'];

/** Ce qu'une position de ceinture produit. */
export interface BeltProfile {
  /** Probabilité de présence de chaque ressource dans un gisement. */
  presence: Record<ResourceKey, number>;
  /** Poids de répartition, normalisés sur les ressources présentes. */
  weights: Record<ResourceKey, number>;
  /** Fourchette de quantité totale d'un gisement. */
  quantity: { min: number; max: number };
}

/**
 * Profils par défaut — les valeurs historiques des positions 8 et 16.
 *
 * ⚠️ Elles étaient codées en dur, et la position typée littéralement `8 | 16` :
 * déplacer ou ajouter une ceinture demandait de modifier ce fichier, pas la
 * config. Or la carte neuve a besoin de ceintures ailleurs — notamment des
 * gisements riches dans les systèmes tenus par les Premiers. Les profils
 * viennent donc désormais de `universe_config.belt_profiles`, et ceux-ci ne
 * servent plus que de repli.
 */
const PROFILS_PAR_DEFAUT: Record<string, BeltProfile> = {
  8: {
    presence: { minerai: 0.95, silicium: 0.90, hydrogene: 0.25 },
    weights: { minerai: 0.45, silicium: 0.45, hydrogene: 0.10 },
    quantity: { min: 20000, max: 40000 },
  },
  16: {
    presence: { minerai: 0.60, silicium: 0.65, hydrogene: 0.90 },
    weights: { minerai: 0.25, silicium: 0.25, hydrogene: 0.50 },
    quantity: { min: 40000, max: 80000 },
  },
};

/** Repli d'ultime recours : une ceinture équilibrée, jamais vide. */
const PROFIL_NEUTRE: BeltProfile = {
  presence: { minerai: 0.8, silicium: 0.8, hydrogene: 0.5 },
  weights: { minerai: 0.4, silicium: 0.4, hydrogene: 0.2 },
  quantity: { min: 20000, max: 40000 },
};

function rollPresentResources(profil: BeltProfile): ResourceKey[] {
  let present: ResourceKey[];
  do {
    present = ALL_RESOURCES.filter(r => Math.random() < profil.presence[r]);
  } while (present.length < 2);
  return present;
}

function distributeQuantity(
  totalQty: number,
  present: ResourceKey[],
  profil: BeltProfile,
): Record<ResourceKey, number> {
  const totalWeight = present.reduce((sum, r) => sum + profil.weights[r], 0);
  const result: Record<ResourceKey, number> = { minerai: 0, silicium: 0, hydrogene: 0 };
  for (const r of present) {
    result[r] = Math.floor(totalQty * profil.weights[r] / totalWeight);
  }
  return result;
}

function randomQuantity(profil: BeltProfile, centerLevel: number): number {
  const { min, max } = profil.quantity;
  const levelMultiplier = 1 + 0.15 * (centerLevel - 1);
  const base = min + Math.random() * (max - min);
  return Math.floor(base * levelMultiplier);
}

function randomRegenDelay(): number {
  return (4 + Math.random() * 4) * 60 * 60 * 1000;
}

interface GameConfigLike {
  getFullConfig(): Promise<{ universe: Record<string, unknown> }>;
}

export function createAsteroidBeltService(db: Database, gameConfigService?: GameConfigLike) {
  /** Profil d'une position : config d'abord, valeurs historiques ensuite. */
  async function profilDe(position: number): Promise<BeltProfile> {
    if (gameConfigService) {
      const config = await gameConfigService.getFullConfig();
      const profils = config.universe.belt_profiles as Record<string, BeltProfile> | undefined;
      const p = profils?.[String(position)];
      if (p?.presence && p?.weights && p?.quantity) return p;
    }
    return PROFILS_PAR_DEFAUT[String(position)] ?? PROFIL_NEUTRE;
  }

  return {
    async getOrCreateBelt(galaxy: number, system: number, position: number) {
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

    async generateDeposits(beltId: string, position: number, centerLevel: number) {
      const profil = await profilDe(position);
      const count = DEPOSITS_PER_BELT.min + Math.floor(Math.random() * (DEPOSITS_PER_BELT.max - DEPOSITS_PER_BELT.min + 1));
      const values = [];
      for (let i = 0; i < count; i++) {
        const totalQty = randomQuantity(profil, centerLevel);
        const present = rollPresentResources(profil);
        const dist = distributeQuantity(totalQty, present, profil);
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
        const profil = await profilDe(belt.position);
        const totalQty = randomQuantity(profil, 1);
        const present = rollPresentResources(profil);
        const dist = distributeQuantity(totalQty, present, profil);
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
