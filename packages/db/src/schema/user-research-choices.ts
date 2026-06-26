import { pgTable, uuid, varchar, smallint, primaryKey } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const userResearchChoices = pgTable('user_research_choices', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  forkId: varchar('fork_id', { length: 64 }).notNull(),
  chosenPath: varchar('chosen_path', { length: 32 }).notNull(),
  respecCount: smallint('respec_count').notNull().default(0),
}, (t) => [primaryKey({ columns: [t.userId, t.forkId] })]);
