import { pgTable, uuid, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * Politiques d'empire actives par joueur (chantier Empire §5.2).
 * `active`     : { axisId: postureId } — postures non-neutres en vigueur.
 * `switchedAt` : { axisId: ISO } — dernier changement par axe (cooldown).
 * Spec : docs/plans/2026-06-21-edits-politiques-empire.md
 */
export const empirePolicies = pgTable('empire_policies', {
  userId: uuid('user_id')
    .primaryKey()
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  active: jsonb('active').notNull().default({}),
  switchedAt: jsonb('switched_at').notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
