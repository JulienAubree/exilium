import { eq, and, gte, lte } from 'drizzle-orm';
import { pirateTemplates } from '@ogame-clone/db';
import type { Database } from '@ogame-clone/db';
import {
  simulateCombat,
  type CombatTechs,
  type UnitCombatStats,
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
      playerTechs: CombatTechs,
      templateId: string,
      fleetCargoCapacity: number,
    ): Promise<PirateArrivalResult> {
      const [template] = await db.select().from(pirateTemplates)
        .where(eq(pirateTemplates.id, templateId));

      if (!template) {
        throw new Error(`Pirate template ${templateId} not found`);
      }

      const pirateShips = template.ships as Record<string, number>;
      const pirateTechs = template.techs as CombatTechs;
      const rewards = template.rewards as {
        minerai: number;
        silicium: number;
        hydrogene: number;
        bonusShips: { shipId: string; count: number; chance: number }[];
      };

      // Load combat stats from game config
      const config = await gameConfigService.getFullConfig();
      const combatStats: Record<string, UnitCombatStats> = {};
      for (const [id, ship] of Object.entries(config.ships)) {
        combatStats[id] = { weapons: ship.weapons, shield: ship.shield, armor: ship.armor };
      }
      for (const [id, defense] of Object.entries(config.defenses)) {
        combatStats[id] = { weapons: defense.weapons, shield: defense.shield, armor: defense.armor };
      }

      const shipIds = new Set(Object.keys(config.ships));
      const shipCosts: Record<string, { minerai: number; silicium: number }> = {};
      for (const [id, ship] of Object.entries(config.ships)) {
        shipCosts[id] = { minerai: ship.cost.minerai, silicium: ship.cost.silicium };
      }

      // Use rapidFire map directly from config (already in the right shape)
      const rapidFireMap = config.rapidFire;

      const result = simulateCombat(
        playerShips,
        pirateShips,
        playerTechs,
        pirateTechs,
        combatStats,
        rapidFireMap,
        shipIds,
        shipCosts,
        new Set(), // no defenses for pirates
      );

      // Calculate surviving ships
      const survivingShips: Record<string, number> = {};
      for (const [type, count] of Object.entries(playerShips)) {
        const lost = result.attackerLosses[type] ?? 0;
        const remaining = count - lost;
        if (remaining > 0) survivingShips[type] = remaining;
      }

      // Victory: loot + bonus ships
      let loot = { minerai: 0, silicium: 0, hydrogene: 0 };
      let bonusShips: Record<string, number> = {};

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
