import { pgTable, uuid, varchar, text, boolean, timestamp, date, integer, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const changelogs = pgTable('changelogs', {
  id: uuid('id').primaryKey().defaultRandom(),
  date: date('date').notNull(),
  title: varchar('title', { length: 256 }).notNull(),
  content: text('content').notNull().default(''),
  published: boolean('published').notNull().default(false),
  commentCount: integer('comment_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const changelogComments = pgTable('changelog_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  changelogId: uuid('changelog_id').notNull().references(() => changelogs.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  isAdmin: boolean('is_admin').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('changelog_comments_changelog_idx').on(table.changelogId, table.createdAt),
]);
