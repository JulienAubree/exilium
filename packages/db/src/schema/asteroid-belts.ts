import { pgTable, uuid, smallint, varchar, numeric, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';

export const asteroidBelts = pgTable('asteroid_belts', {
  id: uuid('id').primaryKey().defaultRandom(),
  galaxy: smallint('galaxy').notNull(),
  system: smallint('system').notNull(),
  position: smallint('position').notNull(),  // 8 or 16
}, (table) => [
  uniqueIndex('unique_belt_coords').on(table.galaxy, table.system, table.position),
]);

export const asteroidDeposits = pgTable('asteroid_deposits', {
  id: uuid('id').primaryKey().defaultRandom(),
  beltId: uuid('belt_id').notNull().references(() => asteroidBelts.id, { onDelete: 'cascade' }),
  resourceType: varchar('resource_type', { length: 32 }).notNull(),  // 'minerai' | 'silicium' | 'hydrogene'
  totalQuantity: numeric('total_quantity', { precision: 20, scale: 2 }).notNull(),
  remainingQuantity: numeric('remaining_quantity', { precision: 20, scale: 2 }).notNull(),
  regeneratesAt: timestamp('regenerates_at', { withTimezone: true }),  // set when depleted
}, (table) => [
  index('deposits_belt_remaining_idx').on(table.beltId, table.remainingQuantity),
]);
