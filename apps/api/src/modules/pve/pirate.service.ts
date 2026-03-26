import { eq, and, gte, lte } from 'drizzle-orm';
import { pirateTemplates } from '@ogame-clone/db';
import type { Database } from '@ogame-clone/db';
import {
  simulateCombat,
  resolveBonus,
  type CombatMultipliers,
  type CombatConfig,
  type CombatInput,
  type ShipCategory,
  type ShipCombatConfig,
} from '@ogame-clone/game-engine';
import type { GameConfigService } from '../admin/game-config.service.js';

interface PirateArrivalResult {
  outcome: 'attacker' | 'defender' | 'draw';
  survivingShips: Record<string, number>;
  loot: { minerai: number; silicium: number; hydrogene: number };
  bonusShips: Record<string, number>;
  attackerLosses: Record<string, number>;
}

export function createPirateService(db: Database, gameConfigService: GameConfigService) {
  return {
    async pickTemplate(centerLevel: number, tier: 'easy' | 'medium' | 'hard') {
      const templates = await db.select().from(pirateTemplates)
        .where(and(
          eq(pirateTemplates.tier, tier),
          lte(pirateTemplates.centerLevelMin, centerLevel),
          gte(pirateTemplates.centerLevelMax, centerLevel),
        ));

      if (templates.length === 0) return null;
      return templates[Math.floor(Math.random() * templates.length)];
    },

    async processPirateArrival(
      playerShips: Record<string, number>,
      playerMultipliers: CombatMultipliers,
      templateId: string,
      fleetCargoCapacity: number,
    ): Promise<PirateArrivalResult> {
      const [template] = await db.select().from(pirateTemplates)
        .where(eq(pirateTemplates.id, templateId));

      if (!template) {
        throw new Error(`Pirate template ${templateId} not found`);
      }

      const pirateShips = template.ships as Record<string, number>;
      const pirateTechLevels = template.techs as { weapons: number; shielding: number; armor: number };
      const config = await gameConfigService.getFullConfig();
      const pirateMultipliers: CombatMultipliers = {
        weapons: resolveBonus('weapons', null, { weapons: pirateTechLevels.weapons }, config.bonuses),
        shielding: resolveBonus('shielding', null, { shielding: pirateTechLevels.shielding }, config.bonuses),
        armor: resolveBonus('armor', null, { armor: pirateTechLevels.armor }, config.bonuses),
      };
      const rewards = template.rewards as {
        minerai: number;
        silicium: number;
        hydrogene: number;
        bonusShips: { shipId: string; count: number; chance: number }[];
      };

      // Build ShipCombatConfig map from game config
      const shipCombatConfigs: Record<string, ShipCombatConfig> = {};
      for (const [id, ship] of Object.entries(config.ships)) {
        shipCombatConfigs[id] = {
          shipType: id,
          categoryId: ship.combatCategoryId ?? 'support',
          baseShield: ship.shield,
          baseArmor: ship.baseArmor ?? 0,
          baseHull: ship.hull,
          baseWeaponDamage: ship.weapons,
          baseShotCount: ship.shotCount ?? 1,
        };
      }
      for (const [id, def] of Object.entries(config.defenses)) {
        shipCombatConfigs[id] = {
          shipType: id,
          categoryId: def.combatCategoryId ?? 'heavy',
          baseShield: def.shield,
          baseArmor: def.baseArmor ?? 0,
          baseHull: def.hull,
          baseWeaponDamage: def.weapons,
          baseShotCount: def.shotCount ?? 1,
        };
      }

      const shipIds = new Set(Object.keys(config.ships));
      const shipCosts: Record<string, { minerai: number; silicium: number }> = {};
      for (const [id, ship] of Object.entries(config.ships)) {
        shipCosts[id] = { minerai: ship.cost.minerai, silicium: ship.cost.silicium };
      }

      const categories: ShipCategory[] = [
        { id: 'light', name: 'Léger', targetable: true, targetOrder: 1 },
        { id: 'medium', name: 'Moyen', targetable: true, targetOrder: 2 },
        { id: 'heavy', name: 'Lourd', targetable: true, targetOrder: 3 },
        { id: 'support', name: 'Support', targetable: false, targetOrder: 4 },
      ];

      const combatConfig: CombatConfig = {
        maxRounds: Number(config.universe['combat_max_rounds']) || 4,
        debrisRatio: Number(config.universe['combat_debris_ratio']) || 0.3,
        defenseRepairRate: Number(config.universe['combat_defense_repair_rate']) || 0.7,
        pillageRatio: Number(config.universe['combat_pillage_ratio']) || 0.33,
        minDamagePerHit: Number(config.universe['combat_min_damage_per_hit']) || 1,
        researchBonusPerLevel: Number(config.universe['combat_research_bonus_per_level']) || 0.1,
        categories,
      };

      const combatInput: CombatInput = {
        attackerFleet: playerShips,
        defenderFleet: pirateShips,
        defenderDefenses: {},
        attackerMultipliers: playerMultipliers,
        defenderMultipliers: pirateMultipliers,
        attackerTargetPriority: 'light',
        defenderTargetPriority: 'light',
        combatConfig,
        shipConfigs: shipCombatConfigs,
        shipCosts,
        shipIds,
        defenseIds: new Set(),
      };

      const result = simulateCombat(combatInput);

      // Calculate surviving ships
      const survivingShips: Record<string, number> = {};
      for (const [type, count] of Object.entries(playerShips)) {
        const lost = result.attackerLosses[type] ?? 0;
        const remaining = count - lost;
        if (remaining > 0) survivingShips[type] = remaining;
      }

      // Victory: loot + bonus ships
      let loot = { minerai: 0, silicium: 0, hydrogene: 0 };
      const bonusShips: Record<string, number> = {};

      if (result.outcome === 'attacker') {
        // Cap loot to cargo capacity
        const totalLoot = rewards.minerai + rewards.silicium + rewards.hydrogene;
        const ratio = totalLoot > fleetCargoCapacity ? fleetCargoCapacity / totalLoot : 1;
        loot = {
          minerai: Math.floor(rewards.minerai * ratio),
          silicium: Math.floor(rewards.silicium * ratio),
          hydrogene: Math.floor(rewards.hydrogene * ratio),
        };

        // Roll for bonus ships
        for (const bonus of rewards.bonusShips) {
          if (Math.random() < bonus.chance) {
            bonusShips[bonus.shipId] = (bonusShips[bonus.shipId] ?? 0) + bonus.count;
          }
        }
      }

      return {
        outcome: result.outcome,
        survivingShips,
        loot,
        bonusShips,
        attackerLosses: result.attackerLosses,
      };
    },
  };
}
