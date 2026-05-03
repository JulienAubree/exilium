import { pgTable, varchar, text, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const moduleDefinitions = pgTable('module_definitions', {
  id:          varchar('id', { length: 64 }).primaryKey(),
  hullId:      varchar('hull_id', { length: 32 }).notNull(),
  rarity:      varchar('rarity', { length: 16 }).notNull(),
  name:        varchar('name', { length: 80 }).notNull(),
  description: text('description').notNull(),
  image:       varchar('image', { length: 500 }).notNull().default(''),
  enabled:     boolean('enabled').notNull().default(true),
  effect:      jsonb('effect').notNull(),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ModuleDefinitionRow = typeof moduleDefinitions.$inferSelect;
