import { pgTable, uuid, varchar, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { flagships } from './flagships.js';

export const flagshipCooldowns = pgTable('flagship_cooldowns', {
  flagshipId: uuid('flagship_id')
    .notNull()
    .references(() => flagships.id, { onDelete: 'cascade' }),
  talentId: varchar('talent_id', { length: 64 }).notNull(),
  activatedAt: timestamp('activated_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  cooldownEnds: timestamp('cooldown_ends', { withTimezone: true }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.flagshipId, table.talentId] }),
]);
