import { pgTable, uuid, bigint } from 'drizzle-orm/pg-core';
import { planets } from './planets.js';

export const planetShips = pgTable('planet_ships', {
  planetId: uuid('planet_id')
    .primaryKey()
    .references(() => planets.id, { onDelete: 'cascade' }),
  smallCargo: bigint('small_cargo', { mode: 'number' }).notNull().default(0),
  largeCargo: bigint('large_cargo', { mode: 'number' }).notNull().default(0),
  interceptor: bigint('interceptor', { mode: 'number' }).notNull().default(0),
  frigate: bigint('frigate', { mode: 'number' }).notNull().default(0),
  cruiser: bigint('cruiser', { mode: 'number' }).notNull().default(0),
  battlecruiser: bigint('battlecruiser', { mode: 'number' }).notNull().default(0),
  espionageProbe: bigint('espionage_probe', { mode: 'number' }).notNull().default(0),
  colonyShip: bigint('colony_ship', { mode: 'number' }).notNull().default(0),
  recycler: bigint('recycler', { mode: 'number' }).notNull().default(0),
  prospector: bigint('prospector', { mode: 'number' }).notNull().default(0),
  recuperateur: bigint('recuperateur', { mode: 'number' }).notNull().default(0),
  solarSatellite: bigint('solar_satellite', { mode: 'number' }).notNull().default(0),
  explorer: bigint('explorer', { mode: 'number' }).notNull().default(0),
});
