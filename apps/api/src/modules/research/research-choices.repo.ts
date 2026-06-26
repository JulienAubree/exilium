/**
 * Accès au modèle `user_research_choices` — choix de fork exclusif par joueur.
 *
 * Interfaces consommées par T5 (tRPC) et T7 (UI arbre) :
 *   - loadChoices
 *   - chooseFork
 *   - isResearchLocked
 */
import { eq, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { type DbOrTx, userResearchChoices } from '@exilium/db';

export type ForkChoices = Record<string, { path: string; respecCount: number }>;

/**
 * Charge tous les choix de fork d'un utilisateur.
 *
 * @returns Map `forkId → { path, respecCount }`.
 */
export async function loadChoices(db: DbOrTx, userId: string): Promise<ForkChoices> {
  const rows = await db
    .select({
      forkId: userResearchChoices.forkId,
      chosenPath: userResearchChoices.chosenPath,
      respecCount: userResearchChoices.respecCount,
    })
    .from(userResearchChoices)
    .where(eq(userResearchChoices.userId, userId));

  return rows.reduce<ForkChoices>((acc, row) => {
    acc[row.forkId] = { path: row.chosenPath, respecCount: row.respecCount };
    return acc;
  }, {});
}

/**
 * Enregistre le choix d'un fork (insert uniquement).
 *
 * Rejette avec CONFLICT si le fork est déjà choisi pour cet utilisateur.
 */
export async function chooseFork(
  db: DbOrTx,
  userId: string,
  forkId: string,
  path: string,
): Promise<void> {
  // Check existing choice first to give a clear error message
  const [existing] = await db
    .select({ forkId: userResearchChoices.forkId })
    .from(userResearchChoices)
    .where(
      and(eq(userResearchChoices.userId, userId), eq(userResearchChoices.forkId, forkId)),
    )
    .limit(1);

  if (existing) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: `Fork déjà choisi : ${forkId}. Utilisez respecFork pour changer de voie.`,
    });
  }

  await db
    .insert(userResearchChoices)
    .values({ userId, forkId, chosenPath: path, respecCount: 0 });
}

/**
 * Détermine si une recherche est verrouillée pour ce joueur.
 *
 * Une recherche avec `forkId` est verrouillée si :
 * - Le fork n'a jamais été choisi (choices[forkId] absent)
 * - Ou le chemin choisi ne correspond pas à `def.forkPath`
 *
 * Une recherche sans `forkId` n'est jamais verrouillée.
 */
export function isResearchLocked(
  def: { forkId: string | null; forkPath: string | null },
  choices: ForkChoices,
): boolean {
  if (!def.forkId) return false;
  const choice = choices[def.forkId];
  if (!choice) return true; // fork jamais choisi → toutes les voies verrouillées
  return choice.path !== def.forkPath;
}
