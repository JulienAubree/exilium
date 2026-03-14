import { pgTable, uuid, smallint, numeric, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const debrisFields = pgTable('debris_fields', {
  id: uuid('id').primaryKey().defaultRandom(),
  galaxy: smallint('galaxy').notNull(),
  system: smallint('system').notNull(),
  position: smallint('position').notNull(),
  metal: numeric('metal', { precision: 20, scale: 2 }).notNull().default('0'),
  crystal: numeric('crystal', { precision: 20, scale: 2 }).notNull().default('0'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('debris_fields_coords_idx').on(table.galaxy, table.system, table.position),
]);
