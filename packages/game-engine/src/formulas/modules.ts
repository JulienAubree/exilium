/**
 * Pure formulas for the Flagship Modules system.
 * All inputs/outputs are plain data — no DB, no I/O.
 */

import type { UnitWeaponProfile } from './fp.js';

export type StatKey =
  | 'damage' | 'hull' | 'shield' | 'armor' | 'cargo' | 'speed' | 'regen' | 'epic_charges_max';

export type TriggerKey = 'first_round' | 'low_hull' | 'enemy_fp_above';

export type AbilityKey =
  | 'repair' | 'shield_burst' | 'overcharge' | 'scan' | 'skip' | 'damage_burst';

export type ModuleEffect =
  | { type: 'stat'; stat: StatKey; value: number }
  | { type: 'conditional'; trigger: TriggerKey; threshold?: number;
      effect: { stat: StatKey; value: number } }
  | { type: 'active'; ability: AbilityKey; magnitude: number }
  /** V7-WeaponProfiles : module qui apporte un weaponProfile au flagship. */
  | { type: 'weapon'; profile: UnitWeaponProfile };

/** V7-WeaponProfiles : 'passive' = ancien comportement (stat/conditional/active),
 *  'weapon' = module qui ajoute un weaponProfile au combat. */
export type ModuleKind = 'passive' | 'weapon';

export interface ModuleDefinitionLite {
  id: string;
  hullId: string;
  rarity: 'common' | 'rare' | 'epic';
  /** V7-WeaponProfiles : kind du module (default 'passive' pour back-compat). */
  kind?: ModuleKind;
  enabled: boolean;
  effect: ModuleEffect;
}

export interface HullSlot {
  epic: string | null;
  /** Fixed-length 3 with explicit `null` placeholders for empty slots. */
  rare: (string | null)[];
  /** Fixed-length 5 with explicit `null` placeholders for empty slots. */
  common: (string | null)[];
  /** V7-WeaponProfiles : 1 slot weapon par rareté, indépendants des passives. */
  weaponEpic?: string | null;
  weaponRare?: string | null;
  weaponCommon?: string | null;
}

export type ModuleLoadout = Partial<Record<string, HullSlot>>;

export interface ParsedLoadout {
  /** Passive modules (effect.type stat / conditional / active). */
  equipped: ModuleDefinitionLite[];
  /** V7-WeaponProfiles : weapon modules équipés (effect.type === 'weapon'). */
  weapons: ModuleDefinitionLite[];
}

/**
 * Resolve a loadout (ids) to actual module definitions for one hull.
 * Silently ignores unknown ids, disabled modules, and `null` placeholders
 * (used for fixed-length slot arrays — see hullSlotSchema in modules.types.ts).
 *
 * V7-WeaponProfiles : sépare passives (slots epic/rare/common) et weapons
 * (slots weaponEpic/weaponRare/weaponCommon). Le `kind` du module sert de
 * fallback si le module est dans le mauvais slot (ex: weapon dans rare slot).
 */
export function parseLoadout(
  loadout: ModuleLoadout,
  hullId: string,
  pool: ModuleDefinitionLite[],
): ParsedLoadout {
  const slot = loadout[hullId];
  if (!slot) return { equipped: [], weapons: [] };

  const isString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
  const passiveIds: string[] = [
    ...((slot.common ?? []) as (string | null | undefined)[]).filter(isString),
    ...((slot.rare ?? []) as (string | null | undefined)[]).filter(isString),
    ...(slot.epic ? [slot.epic] : []),
  ];
  const weaponIds: string[] = [
    ...(slot.weaponCommon ? [slot.weaponCommon] : []),
    ...(slot.weaponRare ? [slot.weaponRare] : []),
    ...(slot.weaponEpic ? [slot.weaponEpic] : []),
  ];

  const byId = new Map(pool.map((m) => [m.id, m] as const));
  const resolve = (ids: string[]) => ids
    .map((id) => byId.get(id))
    .filter((m): m is ModuleDefinitionLite => m !== undefined && m.enabled);

  // Defensive partitioning : route by effect.type so a weapon module
  // mistakenly placed in a passive slot still ends up in `weapons`, and
  // vice versa. Belt + braces against admin or migration mistakes.
  const allEquipped = [...resolve(passiveIds), ...resolve(weaponIds)];
  const equipped: ModuleDefinitionLite[] = [];
  const weapons: ModuleDefinitionLite[] = [];
  for (const m of allEquipped) {
    if (m.effect.type === 'weapon') weapons.push(m);
    else equipped.push(m);
  }

  return { equipped, weapons };
}

export interface CombatStats {
  damage: number;
  hull: number;
  shield: number;
  armor: number;
  cargo: number;
  speed: number;
  regen: number;
}

export interface CombatContext {
  /** 1-based current round (1 = first round). */
  roundIndex: number;
  /** Current hull percentage (0..1) of the flagship. */
  currentHullPercent: number;
  /** FP of the current enemy fleet, for `enemy_fp_above` conditional. */
  enemyFP: number;
  /** Pending epic effect from a previously-activated ability. */
  pendingEpicEffect: { ability: AbilityKey; magnitude: number } | null;
}

const MAX_EPIC_CHARGES = 3;

/**
 * Apply all module effects (stat passives + conditionals + pending epic
 * effect) to the base flagship stats. Pure function — does not mutate.
 *
 * Active effects (`type: 'active'`) are NOT applied here; they're
 * resolved via the dedicated activation path which sets
 * `context.pendingEpicEffect` for the affected combat.
 */
export function applyModulesToStats(
  baseStats: CombatStats,
  modules: ModuleDefinitionLite[],
  context: CombatContext,
): CombatStats {
  const out = { ...baseStats };

  // Sum additive bonuses per stat across all modules.
  const bonusByStat: Record<string, number> = {};

  for (const m of modules) {
    if (m.effect.type === 'stat') {
      // epic_charges_max is handled separately via getMaxCharges
      if (m.effect.stat === 'epic_charges_max') continue;
      bonusByStat[m.effect.stat] = (bonusByStat[m.effect.stat] ?? 0) + m.effect.value;
    } else if (m.effect.type === 'conditional') {
      const fires = checkTrigger(m.effect.trigger, m.effect.threshold, context);
      if (fires) {
        const { stat, value } = m.effect.effect;
        bonusByStat[stat] = (bonusByStat[stat] ?? 0) + value;
      }
    }
    // active modules are ignored here (handled via pendingEpicEffect)
  }

  // Apply pending epic effect on top.
  if (context.pendingEpicEffect) {
    const eff = context.pendingEpicEffect;
    if (eff.ability === 'overcharge' || eff.ability === 'damage_burst') {
      bonusByStat['damage'] = (bonusByStat['damage'] ?? 0) + eff.magnitude;
    } else if (eff.ability === 'shield_burst') {
      bonusByStat['shield'] = (bonusByStat['shield'] ?? 0) + eff.magnitude;
    }
    // 'repair' / 'scan' / 'skip' are immediate or non-stat — handled in service
  }

  for (const [stat, bonus] of Object.entries(bonusByStat)) {
    if (stat in out) {
      out[stat as keyof CombatStats] = out[stat as keyof CombatStats] * (1 + bonus);
    }
  }

  return out;
}

function checkTrigger(
  trigger: TriggerKey,
  threshold: number | undefined,
  context: CombatContext,
): boolean {
  switch (trigger) {
    case 'first_round':    return context.roundIndex === 1;
    case 'low_hull':       return context.currentHullPercent <= (threshold ?? 0.30);
    case 'enemy_fp_above': return context.enemyFP > (threshold ?? 0);
    default: return false;
  }
}

/**
 * Compute the maximum epic charges for a loadout. Baseline 1, +1 per
 * module that boosts `epic_charges_max`, hard-capped at 3.
 */
export function getMaxCharges(modules: ModuleDefinitionLite[]): number {
  let bonus = 0;
  for (const m of modules) {
    if (m.effect.type === 'stat' && m.effect.stat === 'epic_charges_max') {
      bonus += m.effect.value;
    }
  }
  return Math.min(MAX_EPIC_CHARGES, 1 + bonus);
}

/**
 * Resolve an active ability into an applied effect descriptor.
 * The actual mutation (e.g. fleet hullPercent += 0.5) happens in
 * the anomaly service, this just classifies the ability for routing.
 */
export interface ActiveAbilityResult {
  ability: AbilityKey;
  magnitude: number;
  /** 'immediate' = mutate state now, 'pending' = persist for next combat */
  applied: 'immediate' | 'pending';
}

export function resolveActiveAbility(
  ability: AbilityKey,
  magnitude: number,
): ActiveAbilityResult {
  // repair, scan, skip → immediate (mutate fleet/anomaly state now)
  // overcharge, shield_burst, damage_burst → pending (apply to next combat)
  const immediate: AbilityKey[] = ['repair', 'scan', 'skip'];
  return {
    ability,
    magnitude,
    applied: immediate.includes(ability) ? 'immediate' : 'pending',
  };
}
