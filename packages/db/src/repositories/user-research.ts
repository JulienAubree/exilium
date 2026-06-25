import { eq } from 'drizzle-orm';
import type { DbOrTx } from '../connection.js';
import { userResearchLevels } from '../schema/user-research-levels.js';

/**
 * Charge les niveaux de recherche d'un user sous forme de map `{ [researchId]: level }`.
 *
 * Lit le modèle EN LIGNES `user_research_levels` (Lot 2 — re-pointage des
 * lecteurs ; remplace l'ancien accès à la table large `user_research`).
 * Retourne `{}` si l'user n'a aucune ligne. Une recherche absente vaut 0 — à
 * traiter par l'appelant via `?? 0`.
 */
export async function getUserResearchLevels(
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

  const levels: Record<string, number> = {};
  for (const row of rows) levels[row.researchId] = row.level;
  return levels;
}

/**
 * Variante BULK : tous les users d'un coup, regroupés par `userId`.
 *
 * Pour les lectures de masse (tick de production, classement) — une seule
 * requête au lieu de N. Un user absent de la map n'a aucune recherche (= 0).
 */
export async function getAllUserResearchLevels(
  db: DbOrTx,
): Promise<Map<string, Record<string, number>>> {
  const rows = await db
    .select({
      userId: userResearchLevels.userId,
      researchId: userResearchLevels.researchId,
      level: userResearchLevels.level,
    })
    .from(userResearchLevels);

  const byUser = new Map<string, Record<string, number>>();
  for (const row of rows) {
    let levels = byUser.get(row.userId);
    if (!levels) {
      levels = {};
      byUser.set(row.userId, levels);
    }
    levels[row.researchId] = row.level;
  }
  return byUser;
}
