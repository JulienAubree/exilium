import { pgTable, uuid, bigint } from 'drizzle-orm/pg-core';
import { planets } from './planets.js';

export const planetDefenses = pgTable('planet_defenses', {
  planetId: uuid('planet_id')
    .primaryKey()
    .references(() => planets.id, { onDelete: 'cascade' }),
  rocketLauncher: bigint('rocket_launcher', { mode: 'number' }).notNull().default(0),
  lightLaser: bigint('light_laser', { mode: 'number' }).notNull().default(0),
  heavyLaser: bigint('heavy_laser', { mode: 'number' }).notNull().default(0),
  electromagneticCannon: bigint('electromagnetic_cannon', { mode: 'number' }).notNull().default(0),
  plasmaTurret: bigint('plasma_turret', { mode: 'number' }).notNull().default(0),
});
