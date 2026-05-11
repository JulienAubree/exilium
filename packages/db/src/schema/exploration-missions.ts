import { pgTable, uuid, varchar, integer, jsonb, text, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';
import { planets } from './planets.js';

/**
 * Missions d'exploration en espace profond — instances par joueur.
 *
 * Cf. spec docs/superpowers/specs/2026-05-11-deep-space-exploration-missions-design.md
 *
 * `fleet_snapshot` est figé à l'engagement, jamais modifié après.
 * `fleet_status` est mis à jour par les combats (hull / ships perdus).
 * Validation des gates lit `fleet_status.shipsAlive` (vaisseaux morts ne
 * comptent jamais).
 */
export const explorationMissions = pgTable('exploration_missions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  /** Référence secteur dans le contenu admin + snapshot pour affichage stable. */
  sectorId: varchar('sector_id', { length: 64 }).notNull(),
  sectorName: varchar('sector_name', { length: 120 }).notNull(),

  /** 'early' | 'mid' | 'deep' */
  tier: varchar('tier', { length: 16 }).notNull(),

  totalSteps: integer('total_steps').notNull(),
  currentStep: integer('current_step').notNull().default(0),

  /**
   * Cycle de vie :
   *   available           → offre dispo dans le pool du joueur
   *   engaged             → run actif, en attente du prochain tick
   *   awaiting_decision   → événement présent au joueur, attend choix
   *   returning           → tous les events résolus / rappel ordonné,
   *                          flotte en chemin du retour (jusqu'à return_at)
   *   completed           → flotte rentrée, butin crédité
   *   failed              → flotte perdue (combat wipe), aucune récompense
   *   expired             → offre non engagée arrivée à expiration
   */
  status: varchar('status', { length: 24 }).notNull().default('available'),

  /**
   * Flotte engagée, FIGÉE à l'engagement.
   * Shape :
   *   {
   *     ships: [{ shipId, count, role, cargoPerShip, massPerShip, hullPerShip }],
   *     totalCargo: number,
   *     totalMass: number,
   *     totalHull: number,
   *   }
   */
  fleetSnapshot: jsonb('fleet_snapshot'),

  /** Planète d'origine — null si la planète a été perdue depuis. */
  fleetOriginPlanetId: uuid('fleet_origin_planet_id')
    .references(() => planets.id, { onDelete: 'set null' }),

  /**
   * État courant de la flotte (LIVE). Shape :
   *   { shipsAlive: { shipId: count }, hullRatio: float [0..1] }
   */
  fleetStatus: jsonb('fleet_status').notNull().default(sql`'{}'::jsonb`),

  /** Événement en attente de décision (si status='awaiting_decision'). */
  pendingEventId: varchar('pending_event_id', { length: 64 }),

  /**
   * Cumul des effets appliqués pendant le run.
   * Crédité au joueur SEULEMENT à completeMission (pas en cours de run).
   * Shape :
   *   {
   *     minerai, silicium, hydrogene, exilium: number,
   *     modules: Array<{ rarity, count }>,
   *     biomeRevealsRequested: number,
   *     hullDeltaTotal: number,
   *     anomalyEngagementUnlocked: null | { tier: 1|2|3 },
   *   }
   */
  outcomesAccumulated: jsonb('outcomes_accumulated').notNull().default(sql`'{"minerai":0,"silicium":0,"hydrogene":0,"exilium":0,"modules":[],"biomeRevealsRequested":0,"hullDeltaTotal":0,"anomalyEngagementUnlocked":null}'::jsonb`),

  /** Historique typé des steps résolus. Shape : StepLogEntry[]. */
  stepLog: jsonb('step_log').notNull().default(sql`'[]'::jsonb`),

  briefing: text('briefing').notNull(),
  hydrogenCost: integer('hydrogen_cost').notNull().default(0),
  estimatedDurationSeconds: integer('estimated_duration_seconds').notNull(),
  nextStepAt: timestamp('next_step_at', { withTimezone: true }),

  /** Date d'arrivée de la flotte sur la planète d'origine (status='returning'). */
  returnAt: timestamp('return_at', { withTimezone: true }),

  /** Token idempotence resolveStep, généré côté client à chaque tentative. */
  lastResolutionToken: uuid('last_resolution_token'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  engagedAt: timestamp('engaged_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (table) => [
  index('exp_missions_user_status_idx').on(table.userId, table.status),
]);

export type ExplorationMissionRow = typeof explorationMissions.$inferSelect;
export type ExplorationMissionInsert = typeof explorationMissions.$inferInsert;
