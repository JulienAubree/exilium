import { eq, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

/**
 * Helpers Drizzle pour factoriser les patterns de filtre répétés à
 * travers les services API. Permet d'éviter la duplication systémique
 * `eq(table.userId, userId)` (218 occurrences dans la codebase).
 *
 * Usage :
 *   await db.select().from(planets).where(byUser(planets.userId, userId));
 *   await db.update(anomalies)
 *     .set({ status: 'completed' })
 *     .where(and(byUser(anomalies.userId, userId), eq(anomalies.id, id)));
 */

/**
 * Filtre sur l'ownership user. Équivalent à `eq(column, userId)` mais
 * explicite sur l'intention. Préfère cette forme aux nouveaux services.
 */
export function byUser(column: PgColumn<any, any, any>, userId: string): SQL {
  return eq(column, userId);
}

/**
 * Filtre sur un ID de ligne. Équivalent à `eq(column, id)` mais
 * explicite. Utile dans les conditions composées.
 */
export function byId(column: PgColumn<any, any, any>, id: string): SQL {
  return eq(column, id);
}
