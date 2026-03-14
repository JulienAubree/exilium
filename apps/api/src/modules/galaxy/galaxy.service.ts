import { eq, and } from 'drizzle-orm';
import { planets, users, debrisFields } from '@ogame-clone/db';
import type { Database } from '@ogame-clone/db';

export function createGalaxyService(db: Database) {
  return {
    async getSystem(galaxy: number, system: number) {
      const systemPlanets = await db
        .select({
          position: planets.position,
          planetId: planets.id,
          planetName: planets.name,
          planetType: planets.planetType,
          userId: planets.userId,
          username: users.username,
        })
        .from(planets)
        .leftJoin(users, eq(users.id, planets.userId))
        .where(and(eq(planets.galaxy, galaxy), eq(planets.system, system)));

      const slots: (typeof systemPlanets[number] | null)[] = Array(15).fill(null);
      for (const planet of systemPlanets) {
        slots[planet.position - 1] = planet;
      }

      const debris = await db
        .select()
        .from(debrisFields)
        .where(
          and(
            eq(debrisFields.galaxy, galaxy),
            eq(debrisFields.system, system),
          ),
        );

      for (const d of debris) {
        const slot = slots[d.position - 1];
        if (slot) {
          (slot as any).debris = { metal: Number(d.metal), crystal: Number(d.crystal) };
        }
      }

      return { galaxy, system, slots };
    },
  };
}
