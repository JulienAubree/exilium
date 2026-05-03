import { pgTable, uuid, varchar, smallint, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { flagships } from './flagships.js';
import { moduleDefinitions } from './module-definitions.js';

export const flagshipModuleInventory = pgTable('flagship_module_inventory', {
  flagshipId:  uuid('flagship_id').notNull().references(() => flagships.id, { onDelete: 'cascade' }),
  moduleId:    varchar('module_id', { length: 64 }).notNull().references(() => moduleDefinitions.id, { onDelete: 'cascade' }),
  count:       smallint('count').notNull().default(1),
  acquiredAt:  timestamp('acquired_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.flagshipId, table.moduleId] }),
}));

export type FlagshipModuleInventoryRow = typeof flagshipModuleInventory.$inferSelect;
