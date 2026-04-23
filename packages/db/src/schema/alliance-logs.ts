import { index, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import type { AllianceLogPayload, AllianceLogType, AllianceLogVisibility } from '@exilium/shared';
import { alliances } from './alliances.js';

export const allianceLogs = pgTable('alliance_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  allianceId: uuid('alliance_id')
    .notNull()
    .references(() => alliances.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 64 }).$type<AllianceLogType>().notNull(),
  visibility: varchar('visibility', { length: 16 }).$type<AllianceLogVisibility>().notNull(),
  payload: jsonb('payload').$type<AllianceLogPayload>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('alliance_logs_alliance_created_idx').on(table.allianceId, table.createdAt),
]);
