import { byUser } from './db-helpers.js';
import { empirePolicies } from '@exilium/db';
import { policyEffects, neutralPolicyEffects } from '@exilium/game-engine';
import type { PolicyEffects } from '@exilium/game-engine';
import type { Database } from '@exilium/db';

/**
 * Effets globaux des politiques d'empire actives d'un joueur.
 * Renvoie le neutre si aucune politique — branché sur les sites de prod,
 * temps de construction, gains d'exilium et slots de flotte.
 */
export async function getPolicyEffects(db: Database, userId: string): Promise<PolicyEffects> {
  const [row] = await db
    .select({ active: empirePolicies.active })
    .from(empirePolicies)
    .where(byUser(empirePolicies.userId, userId))
    .limit(1);
  if (!row) return neutralPolicyEffects();
  return policyEffects(row.active as Record<string, string>);
}
