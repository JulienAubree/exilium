import type { CombatInput, ShipCombatConfig, CombatConfig, ShipCategory } from './combat.js';

export const CATEGORIES: ShipCategory[] = [
  { id: 'light', name: 'Léger', targetable: true, targetOrder: 1 },
  { id: 'medium', name: 'Moyen', targetable: true, targetOrder: 2 },
  { id: 'heavy', name: 'Lourd', targetable: true, targetOrder: 3 },
  { id: 'shield', name: 'Bouclier', targetable: true, targetOrder: 4 },
  { id: 'defense', name: 'Défense', targetable: true, targetOrder: 5 },
  { id: 'support', name: 'Support', targetable: false, targetOrder: 6 },
];

export const COMBAT_CONFIG: CombatConfig = {
  maxRounds: 4,
  debrisRatio: 0.3,
  defenseRepairRate: 0.7,
  pillageRatio: 0.33,
  minDamagePerHit: 1,
  researchBonusPerLevel: 0.1,
  categories: CATEGORIES,
};

export const SHIP_CONFIGS: Record<string, ShipCombatConfig> = {
  interceptor:          { shipType: 'interceptor',          categoryId: 'light',   baseShield: 8,  baseArmor: 1, baseHull: 12,  baseWeaponDamage: 4,  baseShotCount: 3 },
  frigate:              { shipType: 'frigate',              categoryId: 'medium',  baseShield: 16, baseArmor: 2, baseHull: 30,  baseWeaponDamage: 12, baseShotCount: 2 },
  cruiser:              { shipType: 'cruiser',              categoryId: 'heavy',   baseShield: 28, baseArmor: 4, baseHull: 55,  baseWeaponDamage: 45, baseShotCount: 1 },
  battlecruiser:        { shipType: 'battlecruiser',        categoryId: 'heavy',   baseShield: 40, baseArmor: 6, baseHull: 100, baseWeaponDamage: 70, baseShotCount: 1 },
  smallCargo:           { shipType: 'smallCargo',           categoryId: 'support', baseShield: 2,  baseArmor: 0, baseHull: 8,   baseWeaponDamage: 1,  baseShotCount: 1 },
  rocketLauncher:       { shipType: 'rocketLauncher',       categoryId: 'defense', baseShield: 4,  baseArmor: 0, baseHull: 10,  baseWeaponDamage: 20, baseShotCount: 1 },
  electromagneticCannon:{ shipType: 'electromagneticCannon',categoryId: 'defense', baseShield: 10, baseArmor: 2, baseHull: 25,  baseWeaponDamage: 40, baseShotCount: 1 },
};

export const SHIP_IDS = new Set(['interceptor', 'frigate', 'cruiser', 'battlecruiser', 'smallCargo']);
export const DEFENSE_IDS = new Set(['rocketLauncher', 'electromagneticCannon']);

export const SHIP_COSTS: Record<string, { minerai: number; silicium: number }> = {
  interceptor:   { minerai: 3000,  silicium: 1000 },
  frigate:       { minerai: 6000,  silicium: 4000 },
  cruiser:       { minerai: 20000, silicium: 7000 },
  battlecruiser: { minerai: 45000, silicium: 15000 },
  smallCargo:    { minerai: 2000,  silicium: 2000 },
};

export const NO_BONUS = { weapons: 1, shielding: 1, armor: 1 };

export function makeInput(overrides: Partial<CombatInput> = {}): CombatInput {
  return {
    attackerFleet: {},
    defenderFleet: {},
    defenderDefenses: {},
    attackerMultipliers: NO_BONUS,
    defenderMultipliers: NO_BONUS,
    attackerTargetPriority: 'light',
    defenderTargetPriority: 'light',
    combatConfig: COMBAT_CONFIG,
    shipConfigs: SHIP_CONFIGS,
    shipCosts: SHIP_COSTS,
    shipIds: SHIP_IDS,
    defenseIds: DEFENSE_IDS,
    ...overrides,
  };
}
