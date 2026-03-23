import { pgTable, varchar, text, integer, boolean, jsonb } from 'drizzle-orm/pg-core';

export const missionDefinitions = pgTable('mission_definitions', {
  id: varchar('id', { length: 64 }).primaryKey(),
  label: varchar('label', { length: 128 }).notNull(),
  hint: text('hint').notNull().default(''),
  buttonLabel: varchar('button_label', { length: 64 }).notNull().default(''),
  color: varchar('color', { length: 16 }).notNull().default('#888888'),
  sortOrder: integer('sort_order').notNull().default(0),
  dangerous: boolean('dangerous').notNull().default(false),
  requiredShipRoles: jsonb('required_ship_roles').$type<string[] | null>().default(null),
  exclusive: boolean('exclusive').notNull().default(false),
  recommendedShipRoles: jsonb('recommended_ship_roles').$type<string[] | null>().default(null),
  requiresPveMission: boolean('requires_pve_mission').notNull().default(false),
});
