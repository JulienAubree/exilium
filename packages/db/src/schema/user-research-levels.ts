import { pgTable, uuid, varchar, smallint, primaryKey } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * Stockage normalisé des niveaux de recherche (modèle "en lignes").
 * Remplace à terme la table large `user_research` (1 colonne / recherche).
 * Migration Lot 1 — additive : user_research est conservée pendant la transition.
 */
export const userResearchLevels = pgTable(
  'user_research_levels',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    researchId: varchar('research_id', { length: 64 }).notNull(),
    level: smallint('level').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.researchId] })],
);
