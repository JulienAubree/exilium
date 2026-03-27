import { pgTable, uuid, integer, varchar, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const exiliumLog = pgTable('exilium_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(),
  source: varchar('source', { length: 32 }).notNull(),
  details: jsonb('details'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('exilium_log_user_created_idx').on(table.userId, table.createdAt),
]);
