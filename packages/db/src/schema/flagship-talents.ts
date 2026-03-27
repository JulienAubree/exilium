import { pgTable, uuid, varchar, smallint, primaryKey, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { flagships } from './flagships.js';

export const flagshipTalents = pgTable('flagship_talents', {
  flagshipId: uuid('flagship_id')
    .notNull()
    .references(() => flagships.id, { onDelete: 'cascade' }),
  talentId: varchar('talent_id', { length: 64 }).notNull(),
  currentRank: smallint('current_rank').notNull().default(0),
}, (table) => [
  primaryKey({ columns: [table.flagshipId, table.talentId] }),
  check('check_rank_positive', sql`${table.currentRank} >= 0`),
]);
