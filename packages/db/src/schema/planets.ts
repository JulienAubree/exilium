import { pgTable, uuid, varchar, smallint, integer, numeric, timestamp, uniqueIndex, pgEnum, boolean } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { planetTypes } from './game-config.js';

export const planetTypeEnum = pgEnum('planet_type', ['planet', 'moon']);

export const planets = pgTable('planets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 64 }).notNull().default('Homeworld'),
  renamed: boolean('renamed').notNull().default(false),
  galaxy: smallint('galaxy').notNull(),
  system: smallint('system').notNull(),
  position: smallint('position').notNull(),
  planetType: planetTypeEnum('planet_type').notNull().default('planet'),
  planetClassId: varchar('planet_class_id', { length: 64 }).references(() => planetTypes.id, { onDelete: 'set null' }),
  diameter: integer('diameter').notNull(),
  maxFields: integer('max_fields').notNull(),
  minTemp: smallint('min_temp').notNull(),
  maxTemp: smallint('max_temp').notNull(),

  // Resources
  minerai: numeric('minerai', { precision: 20, scale: 2 }).notNull().default('500'),
  silicium: numeric('silicium', { precision: 20, scale: 2 }).notNull().default('500'),
  hydrogene: numeric('hydrogene', { precision: 20, scale: 2 }).notNull().default('0'),
  resourcesUpdatedAt: timestamp('resources_updated_at', { withTimezone: true }).notNull().defaultNow(),

  // Building levels (inline)
  mineraiMineLevel: smallint('minerai_mine_level').notNull().default(0),
  siliciumMineLevel: smallint('silicium_mine_level').notNull().default(0),
  hydrogeneSynthLevel: smallint('hydrogene_synth_level').notNull().default(0),
  solarPlantLevel: smallint('solar_plant_level').notNull().default(0),
  roboticsLevel: smallint('robotics_level').notNull().default(0),
  shipyardLevel: smallint('shipyard_level').notNull().default(0),
  researchLabLevel: smallint('research_lab_level').notNull().default(0),
  storageMineraiLevel: smallint('storage_minerai_level').notNull().default(0),
  storageSiliciumLevel: smallint('storage_silicium_level').notNull().default(0),
  storageHydrogeneLevel: smallint('storage_hydrogene_level').notNull().default(0),

  // Production percentages (0-100, step 10)
  mineraiMinePercent: smallint('minerai_mine_percent').notNull().default(100),
  siliciumMinePercent: smallint('silicium_mine_percent').notNull().default(100),
  hydrogeneSynthPercent: smallint('hydrogene_synth_percent').notNull().default(100),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('unique_coordinates').on(table.galaxy, table.system, table.position, table.planetType),
]);
