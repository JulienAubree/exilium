import { pgTable, uuid, timestamp, text } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const notificationPreferences = pgTable('notification_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  toastDisabled: text('toast_disabled').array().notNull().default([]),
  pushDisabled: text('push_disabled').array().notNull().default([]),
  bellDisabled: text('bell_disabled').array().notNull().default([]),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
