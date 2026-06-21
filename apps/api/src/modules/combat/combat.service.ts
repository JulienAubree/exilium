import { TRPCError } from '@trpc/server';
import {
  simulateCombat,
  buildCombatConfig,
  calculateShieldCapacity,
  COMBAT_CATEGORIES,
} from '@exilium/game-engine';
import type { CombatInput, CombatResult, WeaponProfile } from '@exilium/game-engine';
import type { Database } from '@exilium/db';
import type { GameConfigService } from '../admin/game-config.service.js';
import {
  buildShipCombatConfigs,
  buildShipCosts,
  getCombatMultipliers,
} from '../fleet/fleet.types.js';

// ── Inputs / outputs ──

export interface SimulateInput {
  attackerShips: Record<string, number>;
  defenderShips: Record<string, number>;
  defenderDefenses: Record<string, number>;
  /** Niveau du bouclier planétaire défenseur (0 = aucun). */
  defenderShieldLevel: number;
  /** Niveau de recherche combat uniforme du défenseur (armes/bouclier/blindage). */
  defenderTechLevel: number;
  /** Nombre de simulations à moyenner (le combat a du RNG sur le ciblage). */
  runs: number;
}

export interface SimulateResult {
  runs: number;
  hasDefenders: boolean;
  winRate: number;
  drawRate: number;
  lossRate: number;
  avgRounds: number;
  avgDebris: { minerai: number; silicium: number };
  attacker: {
    avgLosses: Record<string, number>;
    avgSurvivors: Record<string, number>;
    /** Fraction des simulations où le vaisseau amiral est tombé. */
    flagshipLossChance: number;
  };
  defender: {
    avgLosses: Record<string, number>;
  };
  multipliers: {
    attacker: { weapons: number; shielding: number; armor: number };
    defender: { weapons: number; shielding: number; armor: number };
  };
}

export interface CodexWeapon {
  damage: number;
  shots: number;
  targetCategory: string;
  rafale?: { category: string; count: number };
  chainKill: boolean;
}

export interface CodexUnit {
  id: string;
  name: string;
  kind: 'ship' | 'defense';
  categoryId: string;
  shield: number;
  hull: number;
  armor: number;
  weapons: CodexWeapon[];
}

export interface CodexResult {
  categories: { id: string; name: string; targetable: boolean; targetOrder: number }[];
  units: CodexUnit[];
}

// ── Helpers ──

const MAX_RUNS = 500;
const DEFAULT_RUNS = 200;

/** Garde uniquement les ids connus avec un effectif strictement positif. */
function sanitizeUnits(
  units: Record<string, number> | undefined,
  allowed: Set<string>,
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!units) return out;
  for (const [id, n] of Object.entries(units)) {
    const count = Math.floor(Number(n) || 0);
    if (allowed.has(id) && count > 0) out[id] = count;
  }
  return out;
}

/** Knuth multiplicative hash — seeds bien dispersés pour mulberry32. */
function seedFor(i: number): number {
  return ((i + 1) * 2654435761) >>> 0;
}

export interface AggregatedRuns {
  winRate: number;
  drawRate: number;
  lossRate: number;
  avgRounds: number;
  avgDebris: { minerai: number; silicium: number };
  attacker: {
    avgLosses: Record<string, number>;
    avgSurvivors: Record<string, number>;
    flagshipLossChance: number;
  };
  defender: { avgLosses: Record<string, number> };
}

/**
 * Agrège N résultats de combat en moyennes / taux. Pure et testable :
 * `runs` = `results.length`. Les pertes sont moyennées sur tous les runs,
 * les survivants déduits de l'effectif initial.
 */
export function aggregateRuns(
  results: CombatResult[],
  attackerFleet: Record<string, number>,
): AggregatedRuns {
  const runs = results.length;
  if (runs === 0) {
    return {
      winRate: 0,
      drawRate: 0,
      lossRate: 0,
      avgRounds: 0,
      avgDebris: { minerai: 0, silicium: 0 },
      attacker: { avgLosses: {}, avgSurvivors: { ...attackerFleet }, flagshipLossChance: 0 },
      defender: { avgLosses: {} },
    };
  }

  let win = 0;
  let draw = 0;
  let loss = 0;
  let roundsSum = 0;
  let debrisM = 0;
  let debrisS = 0;
  let flagshipLost = 0;
  const atkLossSum: Record<string, number> = {};
  const defLossSum: Record<string, number> = {};

  for (const r of results) {
    if (r.outcome === 'attacker') win++;
    else if (r.outcome === 'defender') loss++;
    else draw++;

    roundsSum += r.rounds.length;
    debrisM += r.debris.minerai;
    debrisS += r.debris.silicium;

    for (const [k, v] of Object.entries(r.attackerLosses)) {
      atkLossSum[k] = (atkLossSum[k] ?? 0) + v;
      if (k === 'flagship' && v > 0) flagshipLost++;
    }
    for (const [k, v] of Object.entries(r.defenderLosses)) {
      defLossSum[k] = (defLossSum[k] ?? 0) + v;
    }
  }

  const avgLossesAtk: Record<string, number> = {};
  const avgSurvivors: Record<string, number> = {};
  for (const [k, n] of Object.entries(attackerFleet)) {
    const lost = (atkLossSum[k] ?? 0) / runs;
    avgLossesAtk[k] = lost;
    avgSurvivors[k] = Math.max(0, n - lost);
  }
  const avgLossesDef: Record<string, number> = {};
  for (const [k, sum] of Object.entries(defLossSum)) {
    avgLossesDef[k] = sum / runs;
  }

  return {
    winRate: win / runs,
    drawRate: draw / runs,
    lossRate: loss / runs,
    avgRounds: roundsSum / runs,
    avgDebris: { minerai: Math.round(debrisM / runs), silicium: Math.round(debrisS / runs) },
    attacker: { avgLosses: avgLossesAtk, avgSurvivors, flagshipLossChance: flagshipLost / runs },
    defender: { avgLosses: avgLossesDef },
  };
}

export function createCombatService(db: Database, gameConfigService: GameConfigService) {
  /**
   * Simule un combat « bac à sable » : la flotte de l'utilisateur (avec sa vraie
   * recherche) contre une composition adverse saisie. Lecture seule, aucun effet
   * de bord — c'est un outil d'entraînement, pas un oracle sur une vraie cible.
   */
  async function simulate(userId: string, input: SimulateInput): Promise<SimulateResult> {
    const config = await gameConfigService.getFullConfig();
    const shipIds = new Set(Object.keys(config.ships));
    const defenseIds = new Set(Object.keys(config.defenses));

    const attackerFleet = sanitizeUnits(input.attackerShips, shipIds);
    if (Object.keys(attackerFleet).length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Compose une flotte attaquante (au moins un vaisseau).',
      });
    }
    const defenderFleet = sanitizeUnits(input.defenderShips, shipIds);
    const defenderDefenses = sanitizeUnits(input.defenderDefenses, defenseIds);

    // Attaquant : sa vraie recherche. Défenseur : niveau uniforme saisi.
    const attackerMultipliers = await getCombatMultipliers(db, userId, config.bonuses);
    const bonusPerLevel = Number(config.universe['combat_research_bonus_per_level']) || 0.1;
    const techMult = 1 + bonusPerLevel * Math.max(0, Math.floor(input.defenderTechLevel) || 0);
    const defenderMultipliers = { weapons: techMult, shielding: techMult, armor: techMult };

    const shipCombatConfigs = buildShipCombatConfigs(config);
    const shipCostsMap = buildShipCosts(config);
    const combatConfig = buildCombatConfig(config.universe);

    const shieldLevel = Math.max(0, Math.floor(input.defenderShieldLevel) || 0);
    const planetaryShieldCapacity = shieldLevel > 0
      ? Math.floor(calculateShieldCapacity(shieldLevel) * defenderMultipliers.shielding)
      : 0;

    const hasDefenders =
      Object.keys(defenderFleet).length > 0 ||
      Object.keys(defenderDefenses).length > 0 ||
      planetaryShieldCapacity > 0;

    const runs = Math.min(MAX_RUNS, Math.max(1, Math.floor(input.runs) || DEFAULT_RUNS));

    // Aucune défense → victoire garantie, zéro perte (cohérent avec attack.handler).
    if (!hasDefenders) {
      return {
        runs,
        hasDefenders: false,
        winRate: 1,
        drawRate: 0,
        lossRate: 0,
        avgRounds: 0,
        avgDebris: { minerai: 0, silicium: 0 },
        attacker: { avgLosses: {}, avgSurvivors: { ...attackerFleet }, flagshipLossChance: 0 },
        defender: { avgLosses: {} },
        multipliers: { attacker: attackerMultipliers, defender: defenderMultipliers },
      };
    }

    const results: CombatResult[] = [];
    for (let i = 0; i < runs; i++) {
      const combatInput: CombatInput = {
        attackerFleet,
        defenderFleet,
        defenderDefenses,
        attackerMultipliers,
        defenderMultipliers,
        combatConfig,
        shipConfigs: shipCombatConfigs,
        shipCosts: shipCostsMap,
        shipIds,
        defenseIds,
        planetaryShieldCapacity,
        rngSeed: seedFor(i),
        detailedLog: false,
      };
      results.push(simulateCombat(combatInput));
    }

    return {
      runs,
      hasDefenders: true,
      ...aggregateRuns(results, attackerFleet),
      multipliers: { attacker: attackerMultipliers, defender: defenderMultipliers },
    };
  }

  /**
   * Codex des contres : stats normalisées + batteries de chaque unité combat,
   * pour rendre lisible « qui contre qui » (catégorie ciblée, rafale, enchaînement).
   */
  async function codex(): Promise<CodexResult> {
    const config = await gameConfigService.getFullConfig();
    const combatConfigs = buildShipCombatConfigs(config);

    const toWeapons = (cfg: (typeof combatConfigs)[string]): CodexWeapon[] => {
      const profiles: WeaponProfile[] =
        cfg.weapons && cfg.weapons.length > 0
          ? cfg.weapons
          : cfg.baseWeaponDamage > 0
            ? [{ damage: cfg.baseWeaponDamage, shots: cfg.baseShotCount, targetCategory: 'light' }]
            : [];
      return profiles.map((p) => ({
        damage: p.damage,
        shots: p.shots,
        targetCategory: p.targetCategory,
        ...(p.rafale ? { rafale: p.rafale } : {}),
        chainKill: p.hasChainKill ?? false,
      }));
    };

    const units: CodexUnit[] = [];

    for (const [id, ship] of Object.entries(config.ships)) {
      const cfg = combatConfigs[id];
      // On ne montre que les unités qui combattent (les support n'ont pas de méta de contre).
      if (!cfg || cfg.categoryId === 'support') continue;
      units.push({
        id,
        name: (ship as { name?: string }).name ?? id,
        kind: 'ship',
        categoryId: cfg.categoryId,
        shield: cfg.baseShield,
        hull: cfg.baseHull,
        armor: cfg.baseArmor,
        weapons: toWeapons(cfg),
      });
    }
    for (const [id, def] of Object.entries(config.defenses)) {
      const cfg = combatConfigs[id];
      if (!cfg) continue;
      units.push({
        id,
        name: (def as { name?: string }).name ?? id,
        kind: 'defense',
        categoryId: cfg.categoryId,
        shield: cfg.baseShield,
        hull: cfg.baseHull,
        armor: cfg.baseArmor,
        weapons: toWeapons(cfg),
      });
    }

    const categories = COMBAT_CATEGORIES.map((c) => ({
      id: c.id,
      name: c.name,
      targetable: c.targetable,
      targetOrder: c.targetOrder,
    }));

    return { categories, units };
  }

  return { simulate, codex };
}
