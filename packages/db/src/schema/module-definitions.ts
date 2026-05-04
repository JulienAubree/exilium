import { sql } from 'drizzle-orm';
import { pgTable, varchar, text, boolean, jsonb, timestamp, index } from 'drizzle-orm/pg-core';

export const moduleDefinitions = pgTable('module_definitions', {
  id:          varchar('id', { length: 64 }).primaryKey(),
  hullId:      varchar('hull_id', { length: 32 }).notNull(),
  rarity:      varchar('rarity', { length: 16 }).notNull(),
  /** V7-WeaponProfiles : 'passive' (existing stat/conditional/active modules)
   *  or 'weapon' (apporte un weaponProfile au flagship pendant le combat). */
  kind:        varchar('kind', { length: 16 }).notNull().default('passive'),
  name:        varchar('name', { length: 80 }).notNull(),
  description: text('description').notNull(),
  image:       varchar('image', { length: 500 }).notNull().default(''),
  enabled:     boolean('enabled').notNull().default(true),
  effect:      jsonb('effect').notNull(),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // Partial index that already exists in 0068_modules_init.sql — declared
  // here so Drizzle introspection / future migrations stay aligned.
  index('idx_modules_hull_rarity').on(table.hullId, table.rarity).where(sql`enabled = true`),
  // V7-WeaponProfiles : extended index including kind pour les requêtes
  // par hull+rareté+kind (lookup pool weapon modules d'un hull).
  index('idx_modules_hull_rarity_kind').on(table.hullId, table.rarity, table.kind).where(sql`enabled = true`),
]);

export type ModuleDefinitionRow = typeof moduleDefinitions.$inferSelect;
