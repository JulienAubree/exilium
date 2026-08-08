// GameConfig shape from the API
interface GameConfigData {
  buildings: Record<string, { id: string; name: string; description: string; flavorText?: string | null; baseCost: { minerai: number; silicium: number; hydrogene: number }; costFactor: number; prerequisites: { buildingId: string; level: number }[] }>;
  research: Record<string, { id: string; name: string; description: string; flavorText?: string | null; effectDescription?: string | null; baseCost: { minerai: number; silicium: number; hydrogene: number }; costFactor: number; prerequisites: { buildings: { buildingId: string; level: number }[]; research: { researchId: string; level: number }[] } }>;
  ships: Record<string, { id: string; name: string; description: string; flavorText?: string | null; cost: { minerai: number; silicium: number; hydrogene: number }; baseSpeed: number; fuelConsumption: number; cargoCapacity: number; driveType: string; miningExtraction: number; weapons: number; shield: number; hull: number; baseArmor: number; shotCount: number; weaponProfiles?: WeaponProfile[]; combatCategoryId: string | null; isStationary: boolean; prerequisites: { buildings: { buildingId: string; level: number }[]; research: { researchId: string; level: number }[] } }>;
  defenses: Record<string, { id: string; name: string; description: string; flavorText?: string | null; cost: { minerai: number; silicium: number; hydrogene: number }; weapons: number; shield: number; hull: number; baseArmor: number; shotCount: number; weaponProfiles?: WeaponProfile[]; combatCategoryId: string | null; maxPerPlanet: number | null; prerequisites: { buildings: { buildingId: string; level: number }[]; research: { researchId: string; level: number }[] } }>;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResearchDetails {
  type: 'research';
  id: string;
  name: string;
  description: string;
  flavorText: string;
  effect: string;
  baseCost: { minerai: number; silicium: number; hydrogene: number };
  costFactor: number;
  prerequisites: { buildings?: { buildingId: string; level: number }[]; research?: { researchId: string; level: number }[] };
}

export interface WeaponProfile {
  damage: number;
  shots: number;
  targetCategory: string;
  rafale?: { category: string; count: number };
  hasChainKill?: boolean;
}

export interface CombatStats {
  shield: number;
  baseArmor: number;
  hull: number;
  weapons: number;
  shotCount: number;
  weaponProfiles?: WeaponProfile[];
}

export interface ShipDetails {
  type: 'ship';
  id: string;
  name: string;
  description: string;
  flavorText: string;
  cost: { minerai: number; silicium: number; hydrogene: number };
  prerequisites: { buildings?: { buildingId: string; level: number }[]; research?: { researchId: string; level: number }[] };
  combat: CombatStats;
  stats: { baseSpeed: number; fuelConsumption: number; cargoCapacity: number; driveType: string; miningExtraction: number };
  isStationary: boolean;
}

export interface DefenseDetails {
  type: 'defense';
  id: string;
  name: string;
  description: string;
  flavorText: string;
  cost: { minerai: number; silicium: number; hydrogene: number };
  prerequisites: { buildings?: { buildingId: string; level: number }[]; research?: { researchId: string; level: number }[] };
  combat: CombatStats;
  maxPerPlanet?: number;
}

// ---------------------------------------------------------------------------
// Name resolvers (use config if available, fall back to constants)
// ---------------------------------------------------------------------------

function humanize(id: string): string {
  return id.replace(/([A-Z])/g, ' $1').trim();
}

export function resolveBuildingName(id: string, config?: GameConfigData): string {
  return config?.buildings[id]?.name ?? humanize(id);
}

export function resolveResearchName(id: string, config?: GameConfigData): string {
  return config?.research[id]?.name ?? humanize(id);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface PlanetContext {
  maxTemp: number;
  productionFactor: number;
}

export function getResearchDetails(id: string, config?: GameConfigData): ResearchDetails {
  const cfgDef = config?.research[id];
  return {
    type: 'research',
    id,
    name: cfgDef?.name ?? humanize(id),
    description: cfgDef?.description ?? '',
    flavorText: cfgDef?.flavorText ?? '',
    effect: cfgDef?.effectDescription ?? '',
    baseCost: cfgDef?.baseCost ?? { minerai: 0, silicium: 0, hydrogene: 0 },
    costFactor: cfgDef?.costFactor ?? 1,
    prerequisites: cfgDef?.prerequisites ?? {},
  };
}

export function getShipDetails(id: string, config?: GameConfigData): ShipDetails {
  const cfgDef = config?.ships[id];
  const combat: CombatStats = cfgDef
    ? { shield: cfgDef.shield, baseArmor: cfgDef.baseArmor, hull: cfgDef.hull, weapons: cfgDef.weapons, shotCount: cfgDef.shotCount, weaponProfiles: cfgDef.weaponProfiles }
    : { shield: 0, baseArmor: 0, hull: 0, weapons: 0, shotCount: 1 };
  const stats = cfgDef
    ? { baseSpeed: cfgDef.baseSpeed, fuelConsumption: cfgDef.fuelConsumption, cargoCapacity: cfgDef.cargoCapacity, driveType: cfgDef.driveType, miningExtraction: cfgDef.miningExtraction ?? 0 }
    : { baseSpeed: 0, fuelConsumption: 0, cargoCapacity: 0, driveType: 'combustion' as string, miningExtraction: 0 };
  return {
    type: 'ship',
    id,
    name: cfgDef?.name ?? humanize(id),
    description: cfgDef?.description ?? '',
    flavorText: cfgDef?.flavorText ?? '',
    cost: cfgDef?.cost ?? { minerai: 0, silicium: 0, hydrogene: 0 },
    prerequisites: cfgDef?.prerequisites ?? {},
    combat,
    stats,
    isStationary: cfgDef?.isStationary ?? false,
  };
}

export function getDefenseDetails(id: string, config?: GameConfigData): DefenseDetails {
  const cfgDef = config?.defenses[id];
  const combat: CombatStats = cfgDef
    ? { shield: cfgDef.shield, baseArmor: cfgDef.baseArmor, hull: cfgDef.hull, weapons: cfgDef.weapons, shotCount: cfgDef.shotCount, weaponProfiles: cfgDef.weaponProfiles }
    : { shield: 0, baseArmor: 0, hull: 0, weapons: 0, shotCount: 1 };
  return {
    type: 'defense',
    id,
    name: cfgDef?.name ?? humanize(id),
    description: cfgDef?.description ?? '',
    flavorText: cfgDef?.flavorText ?? '',
    cost: cfgDef?.cost ?? { minerai: 0, silicium: 0, hydrogene: 0 },
    prerequisites: cfgDef?.prerequisites ?? {},
    combat,
    maxPerPlanet: cfgDef?.maxPerPlanet ?? undefined,
  };
}
