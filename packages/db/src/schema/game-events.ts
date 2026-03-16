import { pgTable, uuid, text, jsonb, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { planets } from './planets.js';

export const gameEvents = pgTable('game_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  planetId: uuid('planet_id').references(() => planets.id, { onDelete: 'set null' }),
  type: text('type').notNull(),
  payload: jsonb('payload').notNull().default({}),
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('game_events_user_read_date_idx').on(table.userId, table.read, table.createdAt),
  index('game_events_planet_date_idx').on(table.planetId, table.createdAt),
]);
