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
  imageId: varchar('image_id', { length: 64 }),

  // Stats de base (alignées sur la frégate, modifiables par les talents)
  baseSpeed: integer('base_speed').notNull().default(10000),
  fuelConsumption: integer('fuel_consumption').notNull().default(75),
  cargoCapacity: integer('cargo_capacity').notNull().default(100),
  driveType: varchar('drive_type', { length: 32 }).notNull().default('impulse'),
  weapons: integer('weapons').notNull().default(12),
  shield: integer('shield').notNull().default(16),
  hull: integer('hull').notNull().default(30),
  baseArmor: integer('base_armor').notNull().default(2),
  shotCount: integer('shot_count').notNull().default(2),
  combatCategoryId: varchar('combat_category_id', { length: 32 }).notNull().default('medium'),

  // Etat
  status: varchar('status', { length: 16 }).notNull().default('active'),
  repairEndsAt: timestamp('repair_ends_at', { withTimezone: true }),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('flagships_user_id_idx').on(table.userId),
]);
