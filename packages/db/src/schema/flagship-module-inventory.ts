import { pgTable, uuid, varchar, smallint, timestamp, primaryKey, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { flagships } from './flagships.js';
import { moduleDefinitions } from './module-definitions.js';

export const flagshipModuleInventory = pgTable('flagship_module_inventory', {
  flagshipId:  uuid('flagship_id').notNull().references(() => flagships.id, { onDelete: 'cascade' }),
  moduleId:    varchar('module_id', { length: 64 }).notNull().references(() => moduleDefinitions.id, { onDelete: 'cascade' }),
  count:       smallint('count').notNull().default(1),
  acquiredAt:  timestamp('acquired_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.flagshipId, table.moduleId] }),
  check('check_count_positive', sql`${table.count} > 0`),
]);

export type FlagshipModuleInventoryRow = typeof flagshipModuleInventory.$inferSelect;
