import { pgTable, uuid, timestamp, pgEnum, uniqueIndex, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

export const friendshipStatusEnum = pgEnum('friendship_status', ['pending', 'accepted']);

export const friendships = pgTable('friendships', {
  id: uuid('id').primaryKey().defaultRandom(),
  requesterId: uuid('requester_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  addresseeId: uuid('addressee_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: friendshipStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('friendships_pair_idx').on(table.requesterId, table.addresseeId),
  index('friendships_addressee_idx').on(table.addresseeId),
  check('friendships_no_self', sql`${table.requesterId} != ${table.addresseeId}`),
]);
