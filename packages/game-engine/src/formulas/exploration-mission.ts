/**
 * Formules pures pour les Missions d'exploration en espace profond.
 *
 * Cf. spec docs/superpowers/specs/2026-05-11-deep-space-exploration-missions-design.md
 *
 * Toutes les fonctions ici sont déterministes (RNG injectée) et sans
 * accès DB, pour être testables en isolation et utilisables côté front
 * (preview engagement) comme côté back (résolution).
 */

export type ExpeditionTier = 'early' | 'mid' | 'deep';

// ─── Tier pondéré selon le niveau de recherche ────────────────────────────

/**
 * Pondération du tirage de palier selon le niveau de la recherche
 * `planetaryExploration`. Niveau 1-3 → grosso modo en initial,
 * niveau 8+ → 90% mid/deep.
 *
 * Retourne une fonction qui sample un palier en fonction d'un RNG injecté.
 */
export interface TierWeights {
  early: number;
  mid: number;
  deep: number;
}

export function tierWeightsForResearchLevel(researchLevel: number): TierWeights {
  if (researchLevel >= 8) return { early: 0.10, mid: 0.50, deep: 0.40 };
  if (researchLevel >= 4) return { early: 0.40, mid: 0.50, deep: 0.10 };
  return { early: 0.80, mid: 0.20, deep: 0.00 };
}

export function pickTierForResearchLevel(
  researchLevel: number,
  rng: () => number,
): ExpeditionTier {
  const weights = tierWeightsForResearchLevel(researchLevel);
  const roll = rng();
  if (roll < weights.early) return 'early';
  if (roll < weights.early + weights.mid) return 'mid';
  return 'deep';
}

// ─── Caractéristiques d'une offre de mission ──────────────────────────────

export interface ExpeditionConfigKeys {
  stepDurationEarlySeconds: number;
  stepDurationMidSeconds: number;
  stepDurationDeepSeconds: number;
  hydrogenBaseCostEarly: number;
  hydrogenBaseCostMid: number;
  hydrogenBaseCostDeep: number;
  hydrogenMassFactor: number;
  totalStepsEarlyMin: number;
  totalStepsEarlyMax: number;
  totalStepsMidMin: number;
  totalStepsMidMax: number;
  totalStepsDeepMin: number;
  totalStepsDeepMax: number;
}

export interface MissionAttributes {
  totalSteps: number;
  stepDurationSeconds: number;
  estimatedDurationSeconds: number;
  hydrogenBaseCost: number;
}

export function generateMissionAttributes(
  tier: ExpeditionTier,
  config: ExpeditionConfigKeys,
  rng: () => number,
): MissionAttributes {
  let stepsMin: number;
  let stepsMax: number;
  let stepDurationSeconds: number;
  let hydrogenBaseCost: number;

  switch (tier) {
    case 'early':
      stepsMin = config.totalStepsEarlyMin;
      stepsMax = config.totalStepsEarlyMax;
      stepDurationSeconds = config.stepDurationEarlySeconds;
      hydrogenBaseCost = config.hydrogenBaseCostEarly;
      break;
    case 'mid':
      stepsMin = config.totalStepsMidMin;
      stepsMax = config.totalStepsMidMax;
      stepDurationSeconds = config.stepDurationMidSeconds;
      hydrogenBaseCost = config.hydrogenBaseCostMid;
      break;
    case 'deep':
      stepsMin = config.totalStepsDeepMin;
      stepsMax = config.totalStepsDeepMax;
      stepDurationSeconds = config.stepDurationDeepSeconds;
      hydrogenBaseCost = config.hydrogenBaseCostDeep;
      break;
  }

  const totalSteps = stepsMin + Math.floor(rng() * (stepsMax - stepsMin + 1));
  const estimatedDurationSeconds = totalSteps * stepDurationSeconds;

  return { totalSteps, stepDurationSeconds, estimatedDurationSeconds, hydrogenBaseCost };
}

/**
 * Coût hydrogène final = base + masse * factor (arrondi).
 * Masse calculée comme somme(ship.mass * count) à l'engagement.
 */
export function computeHydrogenCost(
  baseCost: number,
  fleetMass: number,
  massFactor: number,
): number {
  return Math.ceil(baseCost + fleetMass * massFactor);
}

// ─── Capacité de soute et débordement ─────────────────────────────────────

export type ResourceKind = 'minerai' | 'silicium' | 'hydrogene';

export interface ResourceOutcomeBuckets {
  minerai: number;
  silicium: number;
  hydrogene: number;
}

/**
 * Ajoute un montant à un type de ressource dans les outcomes accumulés,
 * en respectant la capacité de soute totale.
 *
 * - `granted` = montant effectivement ajouté
 * - `overflowed` = excédent perdu (à mentionner dans la narration)
 *
 * Cette fonction est pure : elle ne mute pas les outcomes en entrée.
 */
export function addResourceToOutcomes(
  outcomes: ResourceOutcomeBuckets,
  totalCargo: number,
  kind: ResourceKind,
  amount: number,
): { outcomes: ResourceOutcomeBuckets; granted: number; overflowed: number } {
  if (amount <= 0) return { outcomes, granted: 0, overflowed: 0 };
  const usedCargo = outcomes.minerai + outcomes.silicium + outcomes.hydrogene;
  const remaining = Math.max(0, totalCargo - usedCargo);
  const granted = Math.min(amount, remaining);
  const overflowed = amount - granted;
  return {
    outcomes: { ...outcomes, [kind]: outcomes[kind] + granted },
    granted,
    overflowed,
  };
}

// ─── Picker d'événement pondéré, exclusion des déjà vus ───────────────────

export interface ExpeditionEventLite {
  id: string;
  tier: ExpeditionTier;
  weight: number;
  enabled: boolean;
}

export function pickExplorationEvent<E extends ExpeditionEventLite>(
  events: E[],
  tier: ExpeditionTier,
  seenIds: string[],
  rng: () => number,
): E | null {
  const seenSet = new Set(seenIds);
  const candidates = events.filter((e) => e.enabled && e.tier === tier && !seenSet.has(e.id));

  // Si tout le pool de ce tier a été vu, on autorise la répétition (warn possible).
  const pool = candidates.length > 0
    ? candidates
    : events.filter((e) => e.enabled && e.tier === tier);

  if (pool.length === 0) return null;

  const totalWeight = pool.reduce((acc, e) => acc + Math.max(0, e.weight), 0);
  if (totalWeight <= 0) {
    // weights mal configurés → fallback uniforme
    return pool[Math.floor(rng() * pool.length)];
  }

  let roll = rng() * totalWeight;
  for (const e of pool) {
    roll -= Math.max(0, e.weight);
    if (roll <= 0) return e;
  }
  return pool[pool.length - 1];
}

// ─── Validation des requirements d'un choix ───────────────────────────────

export type ChoiceRequirement =
  | { kind: 'research'; researchId: string; minLevel: number }
  | { kind: 'shipRole'; role: string; minCount: number }
  | { kind: 'shipId'; shipId: string; minCount: number };

export interface RequirementContext {
  userResearch: Record<string, number>;
  /** Vaisseaux vivants courants (après combats éventuels). */
  shipsAlive: Record<string, number>;
  /** Mapping shipId → rôle (lu dans game-config). */
  shipRoles: Record<string, string>;
}

export interface RequirementCheckResult {
  pass: boolean;
  failures: Array<{ requirement: ChoiceRequirement; reason: string }>;
}

export function validateRequirements(
  requirements: ChoiceRequirement[] | undefined,
  ctx: RequirementContext,
): RequirementCheckResult {
  if (!requirements || requirements.length === 0) {
    return { pass: true, failures: [] };
  }

  const failures: Array<{ requirement: ChoiceRequirement; reason: string }> = [];

  for (const req of requirements) {
    if (req.kind === 'research') {
      const current = ctx.userResearch[req.researchId] ?? 0;
      if (current < req.minLevel) {
        failures.push({
          requirement: req,
          reason: `Recherche ${req.researchId} niveau ${current}/${req.minLevel}`,
        });
      }
    } else if (req.kind === 'shipRole') {
      let count = 0;
      for (const [shipId, alive] of Object.entries(ctx.shipsAlive)) {
        if (alive <= 0) continue;
        if (ctx.shipRoles[shipId] === req.role) count += alive;
      }
      if (count < req.minCount) {
        failures.push({
          requirement: req,
          reason: `Rôle ${req.role} : ${count}/${req.minCount} disponibles`,
        });
      }
    } else if (req.kind === 'shipId') {
      const count = ctx.shipsAlive[req.shipId] ?? 0;
      if (count < req.minCount) {
        failures.push({
          requirement: req,
          reason: `Vaisseau ${req.shipId} : ${count}/${req.minCount} disponibles`,
        });
      }
    }
  }

  return { pass: failures.length === 0, failures };
}

// ─── Hull delta : clamp [0.01, 1.0] ────────────────────────────────────────

export function applyHullDelta(currentRatio: number, delta: number): number {
  return Math.min(1.0, Math.max(0.01, currentRatio + delta));
}
