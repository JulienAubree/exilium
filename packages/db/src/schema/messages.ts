import { pgTable, uuid, varchar, text, boolean, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const messageTypeEnum = pgEnum('message_type', ['system', 'colonization', 'player', 'espionage', 'combat', 'alliance']);

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  senderId: uuid('sender_id').references(() => users.id, { onDelete: 'set null' }),
  recipientId: uuid('recipient_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: messageTypeEnum('type').notNull().default('system'),
  subject: varchar('subject', { length: 255 }).notNull(),
  body: text('body').notNull(),
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('messages_recipient_idx').on(table.recipientId, table.createdAt),
]);
