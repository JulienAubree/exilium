import { and, eq } from 'drizzle-orm';
import type { DbOrTx } from '../connection.js';
import { planets } from '../schema/planets.js';

/**
 * Retourne la planète appartenant à `userId` avec l'id `planetId`,
 * ou `null` si la planète n'existe pas ou n'appartient pas à cet user.
 *
 * Le caller décide quelle erreur tRPC lever (`NOT_FOUND`, `FORBIDDEN`…)
 * pour éviter de coupler `@exilium/db` à `@trpc/server`.
 */
export async function findOwnedPlanet(db: DbOrTx, userId: string, planetId: string) {
  const [planet] = await db
    .select()
    .from(planets)
    .where(and(eq(planets.id, planetId), eq(planets.userId, userId)))
    .limit(1);
  return planet ?? null;
}
