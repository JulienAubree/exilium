import { pgTable, uuid, smallint, numeric, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';

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
  mineraiTotal: numeric('minerai_total', { precision: 20, scale: 2 }).notNull().default('0'),
  mineraiRemaining: numeric('minerai_remaining', { precision: 20, scale: 2 }).notNull().default('0'),
  siliciumTotal: numeric('silicium_total', { precision: 20, scale: 2 }).notNull().default('0'),
  siliciumRemaining: numeric('silicium_remaining', { precision: 20, scale: 2 }).notNull().default('0'),
  hydrogeneTotal: numeric('hydrogene_total', { precision: 20, scale: 2 }).notNull().default('0'),
  hydrogeneRemaining: numeric('hydrogene_remaining', { precision: 20, scale: 2 }).notNull().default('0'),
  regeneratesAt: timestamp('regenerates_at', { withTimezone: true }),
}, (table) => [
  index('deposits_belt_idx').on(table.beltId),
]);
