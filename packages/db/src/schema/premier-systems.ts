import { pgTable, uuid, varchar, smallint, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/** Où en est un système dans son cycle. */
export type PremierSystemState = 'held' | 'contested' | 'liberated';

/**
 * Les systèmes tenus par les Premiers — la première entité NPC persistée sur
 * la carte d'Exilium.
 *
 * Jusqu'ici, le PvE n'existait que sous forme de `pveMissions` éphémères : une
 * instance par joueur, posée à une coordonnée tirée au hasard, invisible pour
 * tous les autres. Un front tenu à plusieurs demande l'inverse — un objet de
 * monde, partagé, que chacun voit au même endroit et dans le même état.
 *
 * **Les planètes du capitaine ne sont pas listées ici.** Ce sont des lignes
 * `planets` ordinaires dont le `userId` est celui du capitaine (compte
 * `isNpc`) : le lien passe par les coordonnées et la propriété. C'est ce qui
 * fait que flottes, défenses, bouclier planétaire, combat et espionnage
 * fonctionnent sur les Premiers sans une ligne de code nouvelle.
 *
 * Le cycle :
 * ```
 *   held ──(garnison entamée)──> contested ──(garnison à zéro)──> liberated
 *     ^                                                              │
 *     └──────────────── returnsAt atteint ◀──── windowEndsAt ────────┘
 * ```
 * Le retour des Premiers n'est pas un échec de conception : c'est le moteur du
 * rendez-vous répétable, et ce qui empêche la carte de se « finir ».
 */
export const premierSystems = pgTable(
  'premier_systems',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    galaxy: smallint('galaxy').notNull(),
    system: smallint('system').notNull(),

    /** Le capitaine. Son `username` est le nom du domaine côté joueurs. */
    captainUserId: uuid('captain_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Palier de difficulté : compose la garnison et calibre la récompense. */
    tier: varchar('tier', { length: 16 }).notNull().default('normal'),

    state: varchar('state', { length: 16 }).notNull().default('held').$type<PremierSystemState>(),

    /** La garnison à plein. `Record<shipId, count>`. */
    garrison: jsonb('garrison').notNull().default({}).$type<Record<string, number>>(),

    /**
     * Ce qu'il en reste. Se vide assaut après assaut, sur le modèle éprouvé des
     * `asteroidDeposits` — c'est ce qui rend un siège jouable À PLUSIEURS
     * (trois amis qui frappent tour à tour font un travail cumulatif) et ce qui
     * donne un coût réel à la défaite.
     */
    garrisonRemaining: jsonb('garrison_remaining').notNull().default({}).$type<Record<string, number>>(),

    /** Ce que la libération ouvre : bonus d'empire, gisements exceptionnels. */
    reward: jsonb('reward').notNull().default({}).$type<Record<string, unknown>>(),

    liberatedAt: timestamp('liberated_at', { withTimezone: true }),
    /** Fin de la fenêtre : le système reste pris mais cesse de rapporter. */
    windowEndsAt: timestamp('window_ends_at', { withTimezone: true }),
    /** Retour des Premiers : l'état repasse à `held`, la garnison se recompose. */
    returnsAt: timestamp('returns_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('premier_systems_coords_uniques').on(t.galaxy, t.system),
    index('premier_systems_state_idx').on(t.state),
    index('premier_systems_returns_idx').on(t.returnsAt),
    index('premier_systems_captain_idx').on(t.captainUserId),
  ],
);
