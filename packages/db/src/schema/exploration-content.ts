import { pgTable, uuid, jsonb, timestamp } from 'drizzle-orm/pg-core';

/**
 * Singleton table — contenu administrable des missions d'exploration en
 * espace profond (secteurs narratifs + pool d'événements).
 *
 * Même pattern que `anomaly_content` : une seule ligne logique, JSONB
 * validé par Zod côté API. Édité via /admin/exploration-missions.
 *
 * Shape de `content` :
 *   {
 *     sectors: SectorEntry[],
 *     events:  ExplorationEvent[],
 *     killSwitch: boolean,
 *   }
 *
 * Validation Zod : cf. apps/api/src/modules/exploration-content/types.ts
 */
export const explorationContent = pgTable('exploration_content', {
  id: uuid('id').primaryKey().defaultRandom(),
  content: jsonb('content').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ExplorationContentRow = typeof explorationContent.$inferSelect;
