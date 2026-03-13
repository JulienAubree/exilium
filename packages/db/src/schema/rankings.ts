import { pgTable, uuid, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const rankings = pgTable('rankings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  totalPoints: integer('total_points').notNull().default(0),
  rank: integer('rank').notNull().default(0),
  calculatedAt: timestamp('calculated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('rankings_rank_idx').on(table.rank),
]);
