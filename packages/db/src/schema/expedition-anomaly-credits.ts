import { pgTable, uuid, smallint, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { explorationMissions } from './exploration-missions.js';

/**
 * Crédits d'engagement anomalie offerts par l'événement passerelle
 * "Signal d'anomalie" lors d'une mission d'exploration en espace profond.
 *
 * Lifecycle : créé à `completeMission` si l'event-passerelle a été déclenché.
 * Consommé par `anomaly.engage` qui décrémente un crédit dispo (consumed_at=NOW)
 * et offre l'engagement gratuit du palier correspondant.
 */
export const expeditionAnomalyCredits = pgTable('expedition_anomaly_credits', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  /** 1, 2 ou 3 — palier anomalie sur lequel le crédit est valide. */
  tier: smallint('tier').notNull(),
  sourceMissionId: uuid('source_mission_id')
    .references(() => explorationMissions.id, { onDelete: 'set null' }),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ExpeditionAnomalyCreditRow = typeof expeditionAnomalyCredits.$inferSelect;
