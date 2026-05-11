import { eq, and, gt, lt, sql, asc, desc } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import {
  explorationMissions,
  expeditionAnomalyCredits,
  planets,
  planetShips,
  userResearch,
  discoveredPositions,
  discoveredBiomes,
} from '@exilium/db';
import type { Database, DbOrTx } from '@exilium/db';
import {
  pickTierForResearchLevel,
  generateMissionAttributes,
  computeHydrogenCost,
  addResourceToOutcomes,
  pickExplorationEvent,
  validateRequirements,
  applyHullDelta,
  type ExpeditionTier,
  type ExpeditionConfigKeys,
  type ChoiceRequirement,
  type RequirementContext,
} from '@exilium/game-engine';
import type { GameConfigService } from '../admin/game-config.service.js';
import type { ExplorationContentService } from '../exploration-content/exploration-content.service.js';
import type {
  EventOutcome,
} from '../exploration-content/exploration-content.types.js';
import type { createExiliumService } from '../exilium/exilium.service.js';

/**
 * Service métier pour les Missions d'exploration en espace profond.
 *
 * Cf. spec docs/superpowers/specs/2026-05-11-deep-space-exploration-missions-design.md
 *
 * Concurrence : transactions DB + verrous row-level (FOR UPDATE) sur les
 * missions pour éviter les race conditions entre tick scheduler et
 * resolveStep concurrents.
 *
 * Idempotence : `last_resolution_token` empêche le double-traitement
 * d'un même choix (double-clic / replay).
 */

const ACTIVE_STATUSES = ['available', 'engaged', 'awaiting_decision'] as const;

// ── Types internes ────────────────────────────────────────────────────────

interface FleetSnapshotShip {
  shipId: string;
  count: number;
  role: string;
  cargoPerShip: number;
  massPerShip: number;
  hullPerShip: number;
}

interface FleetSnapshot {
  ships: FleetSnapshotShip[];
  totalCargo: number;
  totalMass: number;
  totalHull: number;
}

interface FleetStatus {
  shipsAlive: Record<string, number>;
  hullRatio: number;
}

interface OutcomesAccumulated {
  minerai: number;
  silicium: number;
  hydrogene: number;
  exilium: number;
  modules: Array<{ rarity: 'common' | 'rare' | 'epic'; count: number }>;
  biomeRevealsRequested: number;
  hullDeltaTotal: number;
  anomalyEngagementUnlocked: null | { tier: 1 | 2 | 3 };
}

interface StepLogEntry {
  step: number;
  eventId: string;
  choiceIndex: number;
  outcomeApplied: EventOutcome;
  overflowed?: { minerai?: number; silicium?: number; hydrogene?: number };
  combatResult?: { won: boolean; shipsLost: Record<string, number>; hullAfter: number };
  resolutionText: string;
  resolvedAt: string;
}

// ── Helpers locaux ────────────────────────────────────────────────────────

function readConfigKey(config: Awaited<ReturnType<GameConfigService['getFullConfig']>>, key: string, fallback: number): number {
  const value = config.universe[key];
  return value !== undefined ? Number(value) : fallback;
}

function buildConfigKeys(config: Awaited<ReturnType<GameConfigService['getFullConfig']>>): ExpeditionConfigKeys {
  return {
    stepDurationEarlySeconds: readConfigKey(config, 'expedition_step_duration_early_seconds', 600),
    stepDurationMidSeconds: readConfigKey(config, 'expedition_step_duration_mid_seconds', 1200),
    stepDurationDeepSeconds: readConfigKey(config, 'expedition_step_duration_deep_seconds', 1800),
    hydrogenBaseCostEarly: readConfigKey(config, 'expedition_hydrogen_base_cost_early', 200),
    hydrogenBaseCostMid: readConfigKey(config, 'expedition_hydrogen_base_cost_mid', 800),
    hydrogenBaseCostDeep: readConfigKey(config, 'expedition_hydrogen_base_cost_deep', 2400),
    hydrogenMassFactor: readConfigKey(config, 'expedition_hydrogen_mass_factor', 0.4),
    totalStepsEarlyMin: readConfigKey(config, 'expedition_total_steps_early_min', 1),
    totalStepsEarlyMax: readConfigKey(config, 'expedition_total_steps_early_max', 2),
    totalStepsMidMin: readConfigKey(config, 'expedition_total_steps_mid_min', 2),
    totalStepsMidMax: readConfigKey(config, 'expedition_total_steps_mid_max', 3),
    totalStepsDeepMin: readConfigKey(config, 'expedition_total_steps_deep_min', 3),
    totalStepsDeepMax: readConfigKey(config, 'expedition_total_steps_deep_max', 5),
  };
}

function buildShipRolesMap(config: Awaited<ReturnType<GameConfigService['getFullConfig']>>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [shipId, ship] of Object.entries(config.ships)) {
    if (ship.role) map[shipId] = ship.role;
  }
  return map;
}

function emptyOutcomes(): OutcomesAccumulated {
  return {
    minerai: 0,
    silicium: 0,
    hydrogene: 0,
    exilium: 0,
    modules: [],
    biomeRevealsRequested: 0,
    hullDeltaTotal: 0,
    anomalyEngagementUnlocked: null,
  };
}

// ── Factory ──────────────────────────────────────────────────────────────

export function createExplorationMissionService(
  db: Database,
  gameConfigService: GameConfigService,
  explorationContentService: ExplorationContentService,
  exiliumService?: ReturnType<typeof createExiliumService>,
) {
  /**
   * S'assure que le joueur a jusqu'à `expedition_max_active` offres
   * disponibles dans son pool. Skip si killSwitch ou si la techno
   * `planetaryExploration` n'est pas encore acquise.
   *
   * Appelé : à la connexion (middleware), à la fin d'une mission,
   * par le cron horaire de refill.
   */
  async function ensureAvailableMissions(userId: string): Promise<void> {
    const content = await explorationContentService.getContent();
    if (content.killSwitch) return;

    const config = await gameConfigService.getFullConfig();
    const maxActive = readConfigKey(config, 'expedition_max_active', 3);
    const offerExpirationHours = readConfigKey(config, 'expedition_offer_expiration_hours', 72);
    const requiredResearchLevel = readConfigKey(config, 'expedition_required_research_min_level', 1);

    // Gate technologique : la même recherche que l'exploration normale
    const [research] = await db
      .select({ planetaryExploration: userResearch.planetaryExploration })
      .from(userResearch)
      .where(eq(userResearch.userId, userId))
      .limit(1);
    if (!research || (research.planetaryExploration ?? 0) < requiredResearchLevel) return;

    // Compte les missions actives (available + engaged + awaiting_decision)
    const [{ count: activeCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(explorationMissions)
      .where(and(
        eq(explorationMissions.userId, userId),
        sql`${explorationMissions.status} IN ('available','engaged','awaiting_decision')`,
      ));
    if (Number(activeCount) >= maxActive) return;

    const slotsToFill = maxActive - Number(activeCount);
    if (slotsToFill <= 0) return;

    // Récupère les secteurs récemment servis au joueur (anti-répétition 7j)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const recentMissions = await db
      .select({ sectorId: explorationMissions.sectorId })
      .from(explorationMissions)
      .where(and(
        eq(explorationMissions.userId, userId),
        gt(explorationMissions.createdAt, sevenDaysAgo),
      ));
    const recentSectorIds = new Set(recentMissions.map((m) => m.sectorId));

    const configKeys = buildConfigKeys(config);
    const expiresAt = new Date(Date.now() + offerExpirationHours * 3600 * 1000);

    for (let i = 0; i < slotsToFill; i++) {
      const tier = pickTierForResearchLevel(research.planetaryExploration ?? 0, Math.random);

      // Pick d'un secteur du tier choisi, en évitant les récents si possible
      const sectorPool = content.sectors.filter((s) => s.enabled && s.tier === tier);
      if (sectorPool.length === 0) continue;
      const freshSectors = sectorPool.filter((s) => !recentSectorIds.has(s.id));
      const pool = freshSectors.length > 0 ? freshSectors : sectorPool;
      const sector = pool[Math.floor(Math.random() * pool.length)];

      const attrs = generateMissionAttributes(tier, configKeys, Math.random);

      await db.insert(explorationMissions).values({
        userId,
        sectorId: sector.id,
        sectorName: sector.name,
        tier,
        totalSteps: attrs.totalSteps,
        currentStep: 0,
        status: 'available',
        briefing: sector.briefingTemplate,
        hydrogenCost: 0, // recalculé à l'engagement avec la flotte choisie
        estimatedDurationSeconds: attrs.estimatedDurationSeconds,
        expiresAt,
        outcomesAccumulated: emptyOutcomes() as never,
      });

      // Marque le secteur comme servi pour éviter de re-tirer le même dans
      // la boucle de remplissage courante.
      recentSectorIds.add(sector.id);
    }
  }

  /**
   * Engage une mission `available` avec la flotte spécifiée. Décrément
   * atomique des vaisseaux sur la planète d'origine + hydrogène + snapshot
   * de la flotte.
   */
  async function engageMission(
    userId: string,
    missionId: string,
    ships: Record<string, number>,
    planetId: string,
  ): Promise<{ missionId: string; hydrogenCost: number; nextStepAt: Date }> {
    const config = await gameConfigService.getFullConfig();
    const shipRoles = buildShipRolesMap(config);
    const configKeys = buildConfigKeys(config);

    return await db.transaction(async (tx) => {
      // 1. Lock + valide la mission
      const [mission] = await tx
        .select()
        .from(explorationMissions)
        .where(and(
          eq(explorationMissions.id, missionId),
          eq(explorationMissions.userId, userId),
        ))
        .for('update')
        .limit(1);

      if (!mission) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Mission introuvable' });
      }
      if (mission.status !== 'available') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cette mission n\'est plus disponible' });
      }
      if (mission.expiresAt < new Date()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'L\'offre a expiré' });
      }

      // 2. Valide la planète d'origine appartient au joueur
      const [planet] = await tx
        .select({ id: planets.id, hydrogene: planets.hydrogene })
        .from(planets)
        .where(and(eq(planets.id, planetId), eq(planets.userId, userId)))
        .for('update')
        .limit(1);
      if (!planet) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Planète d\'origine invalide' });
      }

      // 3. Valide la flotte : au moins 1 explorateur, ships dispos sur la planète
      const [planetShipsRow] = await tx
        .select()
        .from(planetShips)
        .where(eq(planetShips.planetId, planetId))
        .for('update')
        .limit(1);
      if (!planetShipsRow) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Aucun vaisseau sur cette planète' });
      }

      const fleetSnapshot: FleetSnapshot = { ships: [], totalCargo: 0, totalMass: 0, totalHull: 0 };
      const shipsRecord = planetShipsRow as unknown as Record<string, number | string>;

      for (const [shipId, count] of Object.entries(ships)) {
        if (count <= 0) continue;
        const shipDef = config.ships[shipId];
        if (!shipDef) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `Vaisseau inconnu : ${shipId}` });
        }
        const available = Number(shipsRecord[shipId] ?? 0);
        if (available < count) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Pas assez de ${shipDef.name} disponibles (${available}/${count})`,
          });
        }
        const cargoPerShip = Number(shipDef.cargoCapacity ?? 0);
        const massPerShip = Number(shipDef.fuelConsumption ?? 1); // proxy de masse
        const hullPerShip = Number(shipDef.hull ?? 1);
        fleetSnapshot.ships.push({
          shipId,
          count,
          role: shipDef.role ?? 'unknown',
          cargoPerShip,
          massPerShip,
          hullPerShip,
        });
        fleetSnapshot.totalCargo += cargoPerShip * count;
        fleetSnapshot.totalMass += massPerShip * count;
        fleetSnapshot.totalHull += hullPerShip * count;
      }

      // Au moins 1 vaisseau d'exploration requis
      const explorerCount = fleetSnapshot.ships
        .filter((s) => s.role === 'exploration')
        .reduce((acc, s) => acc + s.count, 0);
      if (explorerCount === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Au moins un vaisseau d\'exploration est requis',
        });
      }

      // 4. Coût hydrogène
      const baseCost = (() => {
        if (mission.tier === 'deep') return configKeys.hydrogenBaseCostDeep;
        if (mission.tier === 'mid') return configKeys.hydrogenBaseCostMid;
        return configKeys.hydrogenBaseCostEarly;
      })();
      const hydrogenCost = computeHydrogenCost(baseCost, fleetSnapshot.totalMass, configKeys.hydrogenMassFactor);

      if (Number(planet.hydrogene) < hydrogenCost) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Hydrogène insuffisant (${Math.floor(Number(planet.hydrogene))}/${hydrogenCost})`,
        });
      }

      // 5. Décrément ships + hydrogène
      const shipsUpdate: Record<string, unknown> = {};
      for (const s of fleetSnapshot.ships) {
        shipsUpdate[s.shipId] = sql`${(planetShips as unknown as Record<string, unknown>)[s.shipId]} - ${s.count}`;
      }
      await tx.update(planetShips).set(shipsUpdate as never).where(eq(planetShips.planetId, planetId));

      await tx.update(planets).set({
        hydrogene: sql`${planets.hydrogene} - ${hydrogenCost}`,
      }).where(eq(planets.id, planetId));

      // 6. Engage la mission
      const stepDurationSeconds = mission.tier === 'deep'
        ? configKeys.stepDurationDeepSeconds
        : mission.tier === 'mid'
        ? configKeys.stepDurationMidSeconds
        : configKeys.stepDurationEarlySeconds;
      const now = new Date();
      const nextStepAt = new Date(now.getTime() + stepDurationSeconds * 1000);

      const fleetStatus: FleetStatus = {
        shipsAlive: Object.fromEntries(fleetSnapshot.ships.map((s) => [s.shipId, s.count])),
        hullRatio: 1.0,
      };

      await tx.update(explorationMissions).set({
        status: 'engaged',
        engagedAt: now,
        fleetSnapshot: fleetSnapshot as never,
        fleetOriginPlanetId: planetId,
        fleetStatus: fleetStatus as never,
        hydrogenCost,
        nextStepAt,
      }).where(eq(explorationMissions.id, missionId));

      return { missionId, hydrogenCost, nextStepAt };
    });
  }

  /**
   * Tick : avance une mission en attente. Verrouille la ligne, pick un
   * événement tier-pondéré, passe en `awaiting_decision`. No-op si la
   * mission n'est plus en `engaged` (race tolerated).
   */
  async function advanceMission(missionId: string): Promise<{ advanced: boolean }> {
    const content = await explorationContentService.getContent();

    return await db.transaction(async (tx) => {
      const [mission] = await tx
        .select()
        .from(explorationMissions)
        .where(eq(explorationMissions.id, missionId))
        .for('update')
        .limit(1);

      if (!mission || mission.status !== 'engaged') return { advanced: false };
      if (!mission.nextStepAt || mission.nextStepAt > new Date()) return { advanced: false };

      const seenIds = (mission.stepLog as StepLogEntry[]).map((s) => s.eventId);
      const event = pickExplorationEvent(content.events, mission.tier as ExpeditionTier, seenIds, Math.random);

      if (!event) {
        // Pool vide pour ce tier : on complète la mission directement (cas dégradé)
        console.warn(`[expedition] no event available for tier=${mission.tier} mission=${missionId} — auto-completing`);
        await tx.update(explorationMissions).set({
          status: 'completed',
          completedAt: new Date(),
        }).where(eq(explorationMissions.id, missionId));
        return { advanced: false };
      }

      await tx.update(explorationMissions).set({
        status: 'awaiting_decision',
        pendingEventId: event.id,
        nextStepAt: null,
      }).where(eq(explorationMissions.id, missionId));

      return { advanced: true };
    });
  }

  /**
   * Résout l'événement en attente avec le choix donné. Idempotent via
   * `resolutionToken` — si le même token est rejoué, retourne l'état
   * courant sans réappliquer.
   */
  async function resolveStep(
    userId: string,
    missionId: string,
    choiceIndex: number,
    resolutionToken: string,
  ): Promise<{ status: string; resolutionText: string; missionCompleted: boolean }> {
    const content = await explorationContentService.getContent();
    const config = await gameConfigService.getFullConfig();
    const shipRoles = buildShipRolesMap(config);
    const configKeys = buildConfigKeys(config);

    return await db.transaction(async (tx) => {
      const [mission] = await tx
        .select()
        .from(explorationMissions)
        .where(and(
          eq(explorationMissions.id, missionId),
          eq(explorationMissions.userId, userId),
        ))
        .for('update')
        .limit(1);

      if (!mission) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Mission introuvable' });
      }

      // Idempotence : si même token, retourne l'état actuel sans réappliquer
      if (mission.lastResolutionToken === resolutionToken) {
        const lastStep = (mission.stepLog as StepLogEntry[])[(mission.stepLog as StepLogEntry[]).length - 1];
        return {
          status: mission.status,
          resolutionText: lastStep?.resolutionText ?? '',
          missionCompleted: mission.status === 'completed' || mission.status === 'failed',
        };
      }

      if (mission.status !== 'awaiting_decision' || !mission.pendingEventId) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Aucune décision en attente' });
      }

      const event = content.events.find((e) => e.id === mission.pendingEventId);
      if (!event) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Événement introuvable dans le contenu admin' });
      }
      if (choiceIndex < 0 || choiceIndex >= event.choices.length) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Choix invalide' });
      }

      const choice = event.choices[choiceIndex];
      const fleetStatus = mission.fleetStatus as FleetStatus;

      // Validation des requirements (lit shipsAlive)
      const reqCtx: RequirementContext = {
        userResearch: await loadUserResearch(tx, userId),
        shipsAlive: fleetStatus.shipsAlive,
        shipRoles,
      };
      const check = validateRequirements(choice.requirements, reqCtx);

      let effectiveOutcome: EventOutcome;
      if (check.pass) {
        effectiveOutcome = choice.outcome;
      } else if (choice.failureOutcome) {
        effectiveOutcome = choice.failureOutcome;
      } else {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Choix verrouillé : ${check.failures.map((f) => f.reason).join(', ')}`,
        });
      }

      // Application de l'outcome
      const snapshot = mission.fleetSnapshot as FleetSnapshot;
      let outcomes = mission.outcomesAccumulated as OutcomesAccumulated;
      const overflowed: { minerai?: number; silicium?: number; hydrogene?: number } = {};

      // Ressources matérielles (clamp soute)
      for (const kind of ['minerai', 'silicium', 'hydrogene'] as const) {
        const amount = effectiveOutcome[kind] ?? 0;
        if (amount > 0) {
          const result = addResourceToOutcomes(
            { minerai: outcomes.minerai, silicium: outcomes.silicium, hydrogene: outcomes.hydrogene },
            snapshot.totalCargo,
            kind,
            amount,
          );
          outcomes = { ...outcomes, ...result.outcomes };
          if (result.overflowed > 0) overflowed[kind] = result.overflowed;
        } else if (amount < 0) {
          // Outcome négatif : on retire (jamais en dessous de 0)
          outcomes = { ...outcomes, [kind]: Math.max(0, outcomes[kind] + amount) };
        }
      }

      // Exilium (hors soute, crédité à completeMission)
      outcomes = { ...outcomes, exilium: outcomes.exilium + (effectiveOutcome.exilium ?? 0) };

      // Modules (queue)
      if (effectiveOutcome.moduleDrop) {
        outcomes = {
          ...outcomes,
          modules: [...outcomes.modules, { ...effectiveOutcome.moduleDrop }],
        };
      }

      // Biome reveal
      if (effectiveOutcome.bonusBiomeReveal && effectiveOutcome.bonusBiomeReveal > 0) {
        outcomes = {
          ...outcomes,
          biomeRevealsRequested: outcomes.biomeRevealsRequested + effectiveOutcome.bonusBiomeReveal,
        };
      }

      // Hull delta
      let newHullRatio = fleetStatus.hullRatio;
      if (effectiveOutcome.hullDelta) {
        newHullRatio = applyHullDelta(newHullRatio, effectiveOutcome.hullDelta);
        outcomes = { ...outcomes, hullDeltaTotal: outcomes.hullDeltaTotal + effectiveOutcome.hullDelta };
      }

      // Anomaly engagement unlock
      if (effectiveOutcome.unlockAnomalyEngagement) {
        outcomes = {
          ...outcomes,
          anomalyEngagementUnlocked: { tier: effectiveOutcome.unlockAnomalyEngagement.tier },
        };
      }

      // TriggerCombat — implémentation reportée à une phase ultérieure.
      // En V1, on log et on continue sans appliquer de pertes.
      if (effectiveOutcome.triggerCombat) {
        console.info(`[expedition] triggerCombat outcome ignored (not yet implemented) mission=${missionId} fp=${effectiveOutcome.triggerCombat.fp}`);
      }

      const updatedFleetStatus: FleetStatus = { ...fleetStatus, hullRatio: newHullRatio };

      // Step log
      const newStepEntry: StepLogEntry = {
        step: mission.currentStep + 1,
        eventId: event.id,
        choiceIndex,
        outcomeApplied: effectiveOutcome,
        ...(Object.keys(overflowed).length > 0 && { overflowed }),
        resolutionText: effectiveOutcome.resolutionText,
        resolvedAt: new Date().toISOString(),
      };
      const newStepLog = [...(mission.stepLog as StepLogEntry[]), newStepEntry];
      const newCurrentStep = mission.currentStep + 1;

      // Détermine si la mission se termine
      const isFinalStep = newCurrentStep >= mission.totalSteps;
      const hullCritical = newHullRatio < 0.05;
      const shouldFail = hullCritical; // (combat wipe sera ajouté quand triggerCombat sera implémenté)

      if (isFinalStep || shouldFail) {
        // Finalisation inline
        if (shouldFail) {
          await tx.update(explorationMissions).set({
            status: 'failed',
            currentStep: newCurrentStep,
            stepLog: newStepLog as never,
            outcomesAccumulated: outcomes as never,
            fleetStatus: updatedFleetStatus as never,
            lastResolutionToken: resolutionToken,
            completedAt: new Date(),
          }).where(eq(explorationMissions.id, missionId));
          // Ensure pool refill
          await ensureAvailableMissions(userId);
          return {
            status: 'failed',
            resolutionText: effectiveOutcome.resolutionText + ' La coque ne tient plus. Flotte perdue.',
            missionCompleted: true,
          };
        }
        // Succès final → completeMission inline (toujours dans la même tx)
        await completeMissionInTx(tx, missionId, userId, outcomes, newStepLog, updatedFleetStatus, mission, resolutionToken);
        return {
          status: 'completed',
          resolutionText: effectiveOutcome.resolutionText,
          missionCompleted: true,
        };
      }

      // Sinon, on programme le prochain step
      const stepDurationSeconds = mission.tier === 'deep'
        ? configKeys.stepDurationDeepSeconds
        : mission.tier === 'mid'
        ? configKeys.stepDurationMidSeconds
        : configKeys.stepDurationEarlySeconds;
      const nextStepAt = new Date(Date.now() + stepDurationSeconds * 1000);

      await tx.update(explorationMissions).set({
        status: 'engaged',
        pendingEventId: null,
        currentStep: newCurrentStep,
        stepLog: newStepLog as never,
        outcomesAccumulated: outcomes as never,
        fleetStatus: updatedFleetStatus as never,
        nextStepAt,
        lastResolutionToken: resolutionToken,
      }).where(eq(explorationMissions.id, missionId));

      return {
        status: 'engaged',
        resolutionText: effectiveOutcome.resolutionText,
        missionCompleted: false,
      };
    });
  }

  /**
   * Helper interne pour finaliser une mission réussie dans une tx ouverte.
   * Crédite les ressources, modules, exilium, biome reveals, anomaly credits.
   */
  async function completeMissionInTx(
    tx: DbOrTx,
    missionId: string,
    userId: string,
    outcomes: OutcomesAccumulated,
    stepLog: StepLogEntry[],
    fleetStatus: FleetStatus,
    mission: typeof explorationMissions.$inferSelect,
    resolutionToken: string,
  ): Promise<void> {
    // 1. Trouve la planète destination : origine si dispo, sinon homeworld
    let destinationPlanetId: string | null = mission.fleetOriginPlanetId;
    if (destinationPlanetId) {
      const [check] = await tx
        .select({ id: planets.id })
        .from(planets)
        .where(and(eq(planets.id, destinationPlanetId), eq(planets.userId, userId)))
        .limit(1);
      if (!check) destinationPlanetId = null;
    }
    if (!destinationPlanetId) {
      const [home] = await tx
        .select({ id: planets.id })
        .from(planets)
        .where(and(eq(planets.userId, userId), eq(planets.planetClassId, 'homeworld')))
        .limit(1);
      destinationPlanetId = home?.id ?? null;
    }

    // 2. Crédit ressources matérielles
    if (destinationPlanetId && (outcomes.minerai > 0 || outcomes.silicium > 0 || outcomes.hydrogene > 0)) {
      await tx.update(planets).set({
        minerai: sql`${planets.minerai} + ${outcomes.minerai}`,
        silicium: sql`${planets.silicium} + ${outcomes.silicium}`,
        hydrogene: sql`${planets.hydrogene} + ${outcomes.hydrogene}`,
      }).where(eq(planets.id, destinationPlanetId));
    }

    // 3. Retour des vaisseaux sur la planète destination (en respectant
    //    les pertes éventuelles — pour V1 pas de pertes car triggerCombat
    //    désactivé)
    if (destinationPlanetId) {
      const shipsIncrement: Record<string, unknown> = {};
      for (const [shipId, count] of Object.entries(fleetStatus.shipsAlive)) {
        if (count <= 0) continue;
        shipsIncrement[shipId] = sql`${(planetShips as unknown as Record<string, unknown>)[shipId]} + ${count}`;
      }
      if (Object.keys(shipsIncrement).length > 0) {
        await tx.update(planetShips).set(shipsIncrement as never).where(eq(planetShips.planetId, destinationPlanetId));
      }
    }

    // 4. Crédit Exilium
    if (outcomes.exilium > 0 && exiliumService) {
      try {
        await exiliumService.earn(userId, outcomes.exilium, 'pve', {
          source: 'expedition',
          missionId,
        });
      } catch (err) {
        console.warn('[expedition] exilium credit failed:', err);
      }
    }

    // 5. Bonus biome reveal — applique sur des positions découvertes
    //    n'ayant aucun biome révélé.
    if (outcomes.biomeRevealsRequested > 0) {
      try {
        await applyBonusBiomeReveals(tx, userId, outcomes.biomeRevealsRequested);
      } catch (err) {
        console.warn('[expedition] bonus biome reveal failed:', err);
      }
    }

    // 6. Crédit anomaly engagement unlocked
    if (outcomes.anomalyEngagementUnlocked) {
      await tx.insert(expeditionAnomalyCredits).values({
        userId,
        tier: outcomes.anomalyEngagementUnlocked.tier,
        sourceMissionId: missionId,
      });
    }

    // 7. Module drops — TODO : nécessite moduleService côté factory ;
    //    laissés dans outcomes_accumulated pour traçabilité ; consommation
    //    différée en Phase 1c quand on branche modulesService.

    // 8. Marque la mission complétée
    await tx.update(explorationMissions).set({
      status: 'completed',
      currentStep: mission.totalSteps,
      stepLog: stepLog as never,
      outcomesAccumulated: outcomes as never,
      fleetStatus: fleetStatus as never,
      lastResolutionToken: resolutionToken,
      completedAt: new Date(),
    }).where(eq(explorationMissions.id, missionId));

    // 9. Refill du pool (en dehors de la tx idéalement, mais OK ici car
    //    INSERT sont commutatifs)
    await ensureAvailableMissions(userId);
  }

  /**
   * Sélectionne N positions du joueur dans `discovered_positions` qui n'ont
   * encore aucun biome révélé, et y insère un biome aléatoire.
   * Si < N positions dispo, grant ce qu'on peut (le manque est mentionné
   * dans la narration du rapport).
   */
  async function applyBonusBiomeReveals(tx: DbOrTx, userId: string, count: number): Promise<void> {
    if (count <= 0) return;

    const candidates = await tx.execute(sql`
      SELECT dp.galaxy, dp.system, dp.position
        FROM discovered_positions dp
        LEFT JOIN discovered_biomes db
          ON db.user_id = dp.user_id
         AND db.galaxy = dp.galaxy
         AND db.system = dp.system
         AND db.position = dp.position
       WHERE dp.user_id = ${userId}
         AND db.biome_id IS NULL
       ORDER BY random()
       LIMIT ${count}
    `) as unknown as Array<{ galaxy: number; system: number; position: number }>;

    if (!candidates || candidates.length === 0) return;

    const config = await gameConfigService.getFullConfig();
    const biomes = config.biomes ?? [];
    if (biomes.length === 0) return;

    for (const c of candidates) {
      const biome = biomes[Math.floor(Math.random() * biomes.length)];
      await tx.insert(discoveredBiomes).values({
        userId,
        galaxy: c.galaxy,
        system: c.system,
        position: c.position,
        biomeId: biome.id,
      }).onConflictDoNothing();
    }
  }

  async function loadUserResearch(tx: DbOrTx, userId: string): Promise<Record<string, number>> {
    const [row] = await tx
      .select()
      .from(userResearch)
      .where(eq(userResearch.userId, userId))
      .limit(1);
    if (!row) return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(row)) {
      if (typeof v === 'number') out[k] = v;
    }
    return out;
  }

  /**
   * Tick global : avance toutes les missions dont `next_step_at` est passé.
   * Appelé toutes les 60s par le cron.
   */
  async function tickPendingMissions(now: Date = new Date()): Promise<{ advanced: number }> {
    const pending = await db
      .select({ id: explorationMissions.id })
      .from(explorationMissions)
      .where(and(
        eq(explorationMissions.status, 'engaged'),
        lt(explorationMissions.nextStepAt, now),
      ))
      .orderBy(asc(explorationMissions.nextStepAt))
      .limit(50);

    let advanced = 0;
    for (const m of pending) {
      try {
        const result = await advanceMission(m.id);
        if (result.advanced) advanced++;
      } catch (err) {
        console.warn(`[expedition] advanceMission failed for ${m.id}:`, err);
      }
    }
    return { advanced };
  }

  /**
   * Cron : passe les offres `available` arrivées à expiration en `expired`.
   */
  async function purgeExpiredOffers(now: Date = new Date()): Promise<{ expired: number }> {
    const result = await db
      .update(explorationMissions)
      .set({ status: 'expired' })
      .where(and(
        eq(explorationMissions.status, 'available'),
        lt(explorationMissions.expiresAt, now),
      ))
      .returning({ id: explorationMissions.id });
    return { expired: result.length };
  }

  /**
   * Cron : missions `awaiting_decision` depuis plus de N jours → choix
   * "neutre" par défaut (1er choix sans requirements / 1er choix). Évite
   * que la flotte reste figée éternellement.
   */
  async function timeoutAwaitingDecisions(now: Date = new Date()): Promise<{ timedOut: number }> {
    const config = await gameConfigService.getFullConfig();
    const timeoutHours = readConfigKey(config, 'expedition_awaiting_decision_timeout_hours', 168);
    const threshold = new Date(now.getTime() - timeoutHours * 3600 * 1000);

    const stale = await db
      .select({
        id: explorationMissions.id,
        userId: explorationMissions.userId,
        pendingEventId: explorationMissions.pendingEventId,
      })
      .from(explorationMissions)
      .where(and(
        eq(explorationMissions.status, 'awaiting_decision'),
        lt(explorationMissions.engagedAt, threshold),
      ))
      .limit(50);

    let timedOut = 0;
    const content = await explorationContentService.getContent();
    for (const m of stale) {
      if (!m.pendingEventId) continue;
      const event = content.events.find((e) => e.id === m.pendingEventId);
      if (!event) continue;

      // Choisit le premier choix neutre / sans requirement
      const neutralIdx = event.choices.findIndex(
        (c) => c.tone === 'neutral' && (c.requirements?.length ?? 0) === 0,
      );
      const fallbackIdx = neutralIdx >= 0 ? neutralIdx : 0;
      const token = crypto.randomUUID();
      try {
        await resolveStep(m.userId, m.id, fallbackIdx, token);
        timedOut++;
      } catch (err) {
        console.warn(`[expedition] timeout-resolve failed for ${m.id}:`, err);
      }
    }
    return { timedOut };
  }

  /** Liste les missions actives du joueur (incluant les available). */
  async function listForUser(userId: string) {
    return db
      .select()
      .from(explorationMissions)
      .where(and(
        eq(explorationMissions.userId, userId),
        sql`${explorationMissions.status} IN ('available','engaged','awaiting_decision')`,
      ))
      .orderBy(desc(explorationMissions.createdAt));
  }

  /** Récupère le détail complet d'une mission appartenant au joueur. */
  async function getDetail(userId: string, missionId: string) {
    const [mission] = await db
      .select()
      .from(explorationMissions)
      .where(and(
        eq(explorationMissions.id, missionId),
        eq(explorationMissions.userId, userId),
      ))
      .limit(1);
    return mission ?? null;
  }

  return {
    ensureAvailableMissions,
    engageMission,
    advanceMission,
    resolveStep,
    tickPendingMissions,
    purgeExpiredOffers,
    timeoutAwaitingDecisions,
    listForUser,
    getDetail,
  };
}

export type ExplorationMissionService = ReturnType<typeof createExplorationMissionService>;
