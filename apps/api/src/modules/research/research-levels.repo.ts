/**
 * Helpers d'accès au modèle en lignes `user_research_levels`.
 * Lot 1 Task 2 — remplace l'accès direct aux colonnes de `user_research`.
 */
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { type DbOrTx, userResearchLevels } from '@exilium/db';

/**
 * Charge l'ensemble des niveaux de recherche d'un utilisateur.
 *
 * @returns Map `researchId → level`. Un user sans lignes (ou une recherche
 * absente) doit être traité comme niveau 0 par l'appelant.
 */
export async function loadResearchLevels(
  db: DbOrTx,
  userId: string,
): Promise<Record<string, number>> {
  const rows = await db
    .select({
      researchId: userResearchLevels.researchId,
      level: userResearchLevels.level,
    })
    .from(userResearchLevels)
    .where(eq(userResearchLevels.userId, userId));

  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.researchId] = row.level;
    return acc;
  }, {});
}

/**
 * Incrémente le niveau d'une recherche (upsert).
 *
 * - Première invocation : insère `level = 1`.
 * - Invocations suivantes : `level = level + 1`.
 *
 * @returns Le nouveau niveau après l'upsert.
 */
export async function bumpResearchLevel(
  db: DbOrTx,
  userId: string,
  researchId: string,
): Promise<number> {
  const [row] = await db
    .insert(userResearchLevels)
    .values({ userId, researchId, level: 1 })
    .onConflictDoUpdate({
      target: [userResearchLevels.userId, userResearchLevels.researchId],
      set: {
        level: sql`${userResearchLevels.level} + 1`,
      },
    })
    .returning({ level: userResearchLevels.level });

  if (!row) {
    throw new Error(
      `bumpResearchLevel: upsert n'a retourné aucune ligne (userId=${userId}, researchId=${researchId})`,
    );
  }

  return row.level;
}
