import { pgTable, uuid, integer, bigint, varchar, jsonb, timestamp, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

/**
 * Progression d'empire : XP cumulée + niveau (remplace le bâtiment
 * « Centre de Pouvoir Impérial » — les ex-détenteurs ont reçu le niveau
 * équivalent à leur capacité via la migration 0095).
 */
export const empireProgression = pgTable('empire_progression', {
  userId: uuid('user_id')
    .primaryKey()
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  xp: bigint('xp', { mode: 'number' }).notNull().default(0),
  level: integer('level').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('check_empire_xp_positive', sql`${table.xp} >= 0`),
]);

export const empireXpLog = pgTable('empire_xp_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(),
  source: varchar('source', { length: 32 }).notNull(),
  details: jsonb('details'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('empire_xp_log_user_created_idx').on(table.userId, table.createdAt),
]);
