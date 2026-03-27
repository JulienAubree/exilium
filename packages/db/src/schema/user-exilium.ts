import { pgTable, uuid, integer, timestamp, jsonb, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

export const userExilium = pgTable('user_exilium', {
  userId: uuid('user_id')
    .primaryKey()
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  balance: integer('balance').notNull().default(0),
  totalEarned: integer('total_earned').notNull().default(0),
  totalSpent: integer('total_spent').notNull().default(0),
  lastDailyAt: timestamp('last_daily_at', { withTimezone: true }),
  dailyQuests: jsonb('daily_quests'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('check_balance_positive', sql`${table.balance} >= 0`),
]);
