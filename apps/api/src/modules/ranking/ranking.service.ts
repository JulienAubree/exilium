import { eq } from 'drizzle-orm';
import { users, planets, userResearch, planetShips, planetDefenses, rankings } from '@ogame-clone/db';
import type { Database } from '@ogame-clone/db';
import {
  calculateBuildingPoints,
  calculateResearchPoints,
  calculateFleetPoints,
  calculateDefensePoints,
  calculateTotalPoints,
} from '@ogame-clone/game-engine';
import type { GameConfigService } from '../admin/game-config.service.js';

export function createRankingService(db: Database, gameConfigService: GameConfigService) {
  return {
    async recalculateAll() {
      const allUsers = await db.select({ id: users.id }).from(users);
      const config = await gameConfigService.getFullConfig();

      const pointsPerUser: { userId: string; totalPoints: number }[] = [];

      for (const user of allUsers) {
        const userPlanets = await db.select().from(planets).where(eq(planets.userId, user.id));
        let buildingPoints = 0;
        for (const planet of userPlanets) {
          buildingPoints += calculateBuildingPoints({
            metalMineLevel: planet.metalMineLevel,
            crystalMineLevel: planet.crystalMineLevel,
            deutSynthLevel: planet.deutSynthLevel,
            solarPlantLevel: planet.solarPlantLevel,
            roboticsLevel: planet.roboticsLevel,
            shipyardLevel: planet.shipyardLevel,
            researchLabLevel: planet.researchLabLevel,
            storageMetalLevel: planet.storageMetalLevel,
            storageCrystalLevel: planet.storageCrystalLevel,
            storageDeutLevel: planet.storageDeutLevel,
          }, config.buildings);
        }

        const [research] = await db.select().from(userResearch).where(eq(userResearch.userId, user.id)).limit(1);
        const researchPoints = research
          ? calculateResearchPoints({
              espionageTech: research.espionageTech,
              computerTech: research.computerTech,
              energyTech: research.energyTech,
              combustion: research.combustion,
              impulse: research.impulse,
              hyperspaceDrive: research.hyperspaceDrive,
              weapons: research.weapons,
              shielding: research.shielding,
              armor: research.armor,
            }, config.research)
          : 0;

        let fleetPoints = 0;
        for (const planet of userPlanets) {
          const [ships] = await db.select().from(planetShips).where(eq(planetShips.planetId, planet.id)).limit(1);
          if (ships) {
            fleetPoints += calculateFleetPoints({
              smallCargo: ships.smallCargo,
              largeCargo: ships.largeCargo,
              lightFighter: ships.lightFighter,
              heavyFighter: ships.heavyFighter,
              cruiser: ships.cruiser,
              battleship: ships.battleship,
              espionageProbe: ships.espionageProbe,
              colonyShip: ships.colonyShip,
              recycler: ships.recycler,
            }, config.ships);
          }
        }

        let defensePoints = 0;
        for (const planet of userPlanets) {
          const [defenses] = await db.select().from(planetDefenses).where(eq(planetDefenses.planetId, planet.id)).limit(1);
          if (defenses) {
            defensePoints += calculateDefensePoints({
              rocketLauncher: defenses.rocketLauncher,
              lightLaser: defenses.lightLaser,
              heavyLaser: defenses.heavyLaser,
              gaussCannon: defenses.gaussCannon,
              plasmaTurret: defenses.plasmaTurret,
              smallShield: defenses.smallShield,
              largeShield: defenses.largeShield,
            }, config.defenses);
          }
        }

        const total = calculateTotalPoints(buildingPoints, researchPoints, fleetPoints, defensePoints);
        pointsPerUser.push({ userId: user.id, totalPoints: total });
      }

      pointsPerUser.sort((a, b) => b.totalPoints - a.totalPoints);

      const now = new Date();
      for (let i = 0; i < pointsPerUser.length; i++) {
        const { userId, totalPoints } = pointsPerUser[i];
        const rank = i + 1;

        await db
          .insert(rankings)
          .values({ userId, totalPoints, rank, calculatedAt: now })
          .onConflictDoUpdate({
            target: rankings.userId,
            set: { totalPoints, rank, calculatedAt: now },
          });
      }

      console.log(`[ranking] Recalculated rankings for ${pointsPerUser.length} users`);
    },

    async getRankings(page: number = 1, limit: number = 20) {
      const offset = (page - 1) * limit;
      return db
        .select({
          rank: rankings.rank,
          userId: rankings.userId,
          username: users.username,
          totalPoints: rankings.totalPoints,
          calculatedAt: rankings.calculatedAt,
        })
        .from(rankings)
        .innerJoin(users, eq(users.id, rankings.userId))
        .orderBy(rankings.rank)
        .limit(limit)
        .offset(offset);
    },

    async getPlayerRank(userId: string) {
      const [result] = await db
        .select()
        .from(rankings)
        .where(eq(rankings.userId, userId))
        .limit(1);

      return result ?? { totalPoints: 0, rank: 0 };
    },
  };
}
