import { eq } from 'drizzle-orm';
import type { DbOrTx } from '../connection.js';
import { userResearch } from '../schema/user-research.js';

/**
 * Charge les niveaux de recherche d'un user sous forme de map `{ [researchId]: level }`.
 * Retourne `{}` si l'user n'a pas encore de ligne dans `user_research`.
 */
export async function getUserResearchLevels(
  db: DbOrTx,
  userId: string,
): Promise<Record<string, number>> {
  const [research] = await db
    .select()
    .from(userResearch)
    .where(eq(userResearch.userId, userId))
    .limit(1);
  if (!research) return {};
  const levels: Record<string, number> = {};
  for (const [key, value] of Object.entries(research)) {
    if (key !== 'userId' && typeof value === 'number') levels[key] = value;
  }
  return levels;
}
