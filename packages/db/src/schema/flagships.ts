import { pgTable, uuid, varchar, integer, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { planets } from './planets.js';

export const flagships = pgTable('flagships', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  planetId: uuid('planet_id')
    .notNull()
    .references(() => planets.id, { onDelete: 'set null' }),

  // Personnalisation
  name: varchar('name', { length: 32 }).notNull().default('Vaisseau amiral'),
  description: varchar('description', { length: 256 }).notNull().default(''),

  // Stats de base (modifiables par les talents Phase 2)
  baseSpeed: integer('base_speed').notNull().default(80000),
  fuelConsumption: integer('fuel_consumption').notNull().default(1),
  cargoCapacity: integer('cargo_capacity').notNull().default(150),
  driveType: varchar('drive_type', { length: 32 }).notNull().default('combustion'),
  weapons: integer('weapons').notNull().default(2),
  shield: integer('shield').notNull().default(4),
  hull: integer('hull').notNull().default(8),
  baseArmor: integer('base_armor').notNull().default(0),
  shotCount: integer('shot_count').notNull().default(1),
  combatCategoryId: varchar('combat_category_id', { length: 32 }).notNull().default('support'),

  // Etat
  status: varchar('status', { length: 16 }).notNull().default('active'),
  repairEndsAt: timestamp('repair_ends_at', { withTimezone: true }),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('flagships_user_id_idx').on(table.userId),
]);
