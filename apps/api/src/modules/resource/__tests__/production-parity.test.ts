import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  users,
  planets,
  planetBuildings,
  planetBiomes,
  planetShips,
  empirePolicies,
  empireProgression,
  userResearchLevels,
} from '@exilium/db';
import { testDb, closeTestDb } from '../../../test/test-db.js';
import { createGameConfigService } from '../../admin/game-config.service.js';
import { createTalentService } from '../../flagship/talent.service.js';
import { createResourceService } from '../resource.service.js';
import { resourceTick } from '../../../cron/resource-tick.js';

/**
 * ============================================================================
 * LE TEST DE L'ACTE 0 : « l'affiché égale le versé, au centime »
 * ============================================================================
 *
 * L'économie affichait ~528 423/h et en versait ~425 740. Trois chemins de
 * production coexistaient en production :
 *
 *   1. getProductionRates ...... ce que le joueur LIT
 *   2. materializeResources .... ce qu'il TOUCHE en jouant
 *   3. resourceTick ............ ce qu'il TOUCHE hors ligne (le dominant)
 *
 * Ce test les met face à face sur une même planète, une même heure écoulée, et
 * exige une égalité STRICTE — pas une tolérance. C'est le filet qui rend la
 * fuite impossible à réintroduire.
 *
 * Prérequis : `bash scripts/setup-test-db.sh` puis
 * `DATABASE_URL=…/exilium_test pnpm --filter @exilium/db db:seed`.
 *
 * Note de concurrence : `resourceTick` balaie TOUTES les planètes de la base
 * de test. Les assertions ne portent que sur les planètes de cette fixture
 * (utilisateur dédié, coordonnées dédiées), donc la coexistence avec d'autres
 * fichiers de test est sans effet sur le verdict.
 */

const UID = '00000000-0000-4000-8000-00000000aa01';
const PID = '00000000-0000-4000-8000-00000000aa02';
const PID_COLONISATION = '00000000-0000-4000-8000-00000000aa03';

const T0 = new Date('2026-08-09T12:00:00.000Z');
const UNE_HEURE_AVANT = new Date(T0.getTime() - 3600 * 1000);

let config: Awaited<ReturnType<ReturnType<typeof createGameConfigService>['getFullConfig']>>;
let resourceService: ReturnType<typeof createResourceService>;
let planetRow: typeof planets.$inferSelect;
let coloniePlanetTypeId: string;

beforeAll(async () => {
  const gameConfigService = createGameConfigService(testDb);
  config = await gameConfigService.getFullConfig();
  const homeworldTypeId = config.planetTypes.find((t) => t.role === 'homeworld')!.id;
  coloniePlanetTypeId = config.planetTypes.find((t) => t.id !== homeworldTypeId)!.id;

  const talentService = createTalentService(testDb, gameConfigService);
  resourceService = createResourceService(testDb, gameConfigService, undefined, talentService);

  await testDb.delete(planets).where(eq(planets.userId, UID));
  await testDb.delete(users).where(eq(users.id, UID));

  await testDb.insert(users).values({
    id: UID,
    email: 'production-parity@test.local',
    username: 'production_parity_fixture',
    passwordHash: 'x',
  });

  // Planète-mère, pour que la colonie soit bien une COLONIE (le compte de
  // colonies actives pilote le malus de gouvernance).
  await testDb.insert(planets).values({
    id: '00000000-0000-4000-8000-00000000aa04',
    userId: UID,
    galaxy: 8, system: 400, position: 5,
    diameter: 12000, minTemp: -10, maxTemp: 40,
    planetClassId: homeworldTypeId,
    status: 'active',
  });

  // LA planète du test : elle cumule toutes les sources de bonus qui
  // divergeaient entre les trois chemins.
  await testDb.insert(planets).values({
    id: PID,
    userId: UID,
    galaxy: 8, system: 400, position: 6,
    diameter: 9000, minTemp: -20, maxTemp: 60,
    planetClassId: coloniePlanetTypeId,
    status: 'active',
    vocation: 'miniere',
    // Curseurs volontairement hors 100 % : ils multiplient l'énergie ET la
    // production, donc ils amplifient toute divergence de facteur.
    mineraiMinePercent: 90,
    siliciumMinePercent: 80,
    hydrogeneSynthPercent: 70,
    // Bouclier à 50 % : le poste que le tick ignorait complètement.
    shieldPercent: 50,
  });

  // Une seconde colonie pour dépasser la capacité de gouvernance (1 au niveau
  // d'empire 1) et rendre le malus de récolte réellement non nul.
  await testDb.insert(planets).values({
    id: '00000000-0000-4000-8000-00000000aa05',
    userId: UID,
    galaxy: 8, system: 400, position: 7,
    diameter: 8000, minTemp: -30, maxTemp: 30,
    planetClassId: coloniePlanetTypeId,
    status: 'active',
  });

  // Une planète en colonisation : elle ne doit RIEN toucher, et son horodatage
  // ne doit pas être réécrit.
  await testDb.insert(planets).values({
    id: PID_COLONISATION,
    userId: UID,
    galaxy: 8, system: 400, position: 8,
    diameter: 8000, minTemp: -30, maxTemp: 30,
    planetClassId: coloniePlanetTypeId,
    status: 'colonizing',
  });

  await testDb.insert(planetBuildings).values([
    { planetId: PID, buildingId: 'mineraiMine', level: 20 },
    { planetId: PID, buildingId: 'siliciumMine', level: 18 },
    { planetId: PID, buildingId: 'hydrogeneSynth', level: 15 },
    { planetId: PID, buildingId: 'solarPlant', level: 16 },
    { planetId: PID, buildingId: 'storageMinerai', level: 12 },
    { planetId: PID, buildingId: 'storageSilicium', level: 12 },
    { planetId: PID, buildingId: 'storageHydrogene', level: 12 },
    // Le bouclier consomme de l'énergie — invisible pour l'ancien tick.
    { planetId: PID, buildingId: 'planetaryShield', level: 4 },
  ]);

  // Satellites solaires : encore un terme d'énergie.
  await testDb.insert(planetShips).values({ planetId: PID, solarSatellite: 25 });

  await testDb.insert(planetBiomes).values([
    { planetId: PID, biomeId: 'surface_deposits', active: true },
    { planetId: PID, biomeId: 'deep_caverns', active: true },
  ]);

  await testDb.insert(userResearchLevels).values([
    { userId: UID, researchId: 'temperateProduction', level: 5 },
    { userId: UID, researchId: 'energyTech', level: 4 },
    { userId: UID, researchId: 'semiconductors', level: 3 },
  ]);

  await testDb.insert(empirePolicies).values({ userId: UID, active: { doctrine: 'croissance' } });
  await testDb.insert(empireProgression).values({ userId: UID, level: 1 });

  [planetRow] = await testDb.select().from(planets).where(eq(planets.id, PID));

  // Seule `Date` est simulée : postgres-js s'appuie sur de vrais timers pour
  // ses connexions, les geler ferait pendre les requêtes.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
});

afterAll(async () => {
  vi.useRealTimers();
  await testDb.delete(planets).where(eq(planets.userId, UID));
  await testDb.delete(users).where(eq(users.id, UID));
  await closeTestDb();
});

/** Remet la planète à zéro, avec exactement une heure de retard à rattraper. */
async function remettreAZero() {
  await testDb
    .update(planets)
    .set({ minerai: '0', silicium: '0', hydrogene: '0', resourcesUpdatedAt: UNE_HEURE_AVANT })
    .where(eq(planets.id, PID));
  await testDb
    .update(planets)
    .set({ minerai: '0', silicium: '0', hydrogene: '0', resourcesUpdatedAt: UNE_HEURE_AVANT })
    .where(eq(planets.id, PID_COLONISATION));
}

beforeEach(remettreAZero);

async function lire(planetId: string) {
  const [row] = await testDb.select().from(planets).where(eq(planets.id, planetId));
  return {
    minerai: Number(row.minerai),
    silicium: Number(row.silicium),
    hydrogene: Number(row.hydrogene),
    resourcesUpdatedAt: row.resourcesUpdatedAt,
  };
}

it('affiche des taux non triviaux (la fixture prouve quelque chose)', async () => {
  const rates = await resourceService.getProductionRates(
    PID,
    planetRow,
    {
      mineraiBonus: config.planetTypes.find((t) => t.id === coloniePlanetTypeId)!.mineraiBonus,
      siliciumBonus: config.planetTypes.find((t) => t.id === coloniePlanetTypeId)!.siliciumBonus,
      hydrogeneBonus: config.planetTypes.find((t) => t.id === coloniePlanetTypeId)!.hydrogeneBonus,
    },
    UID,
  );

  expect(rates.mineraiPerHour).toBeGreaterThan(0);
  expect(rates.siliciumPerHour).toBeGreaterThan(0);
  // Le bouclier doit réellement consommer : sans ça, le poste que le tick
  // ignorait ne serait pas couvert.
  expect(rates.shieldEnergyConsumption).toBeGreaterThan(0);
  // Et le détail doit contenir les sources jadis absentes du tick.
  const sources = new Set(rates.bonuses.map((b) => b.source));
  expect(sources.has('biomes')).toBe(true);
  expect(sources.has('politique')).toBe(true);
  expect(sources.has('recherche')).toBe(true);
  expect(sources.has('gouvernance')).toBe(true);
  expect(sources.has('vocation')).toBe(true);
});

it('materializeResources verse EXACTEMENT ce que getProductionRates affiche', async () => {
  const bonus = {
    mineraiBonus: config.planetTypes.find((t) => t.id === coloniePlanetTypeId)!.mineraiBonus,
    siliciumBonus: config.planetTypes.find((t) => t.id === coloniePlanetTypeId)!.siliciumBonus,
    hydrogeneBonus: config.planetTypes.find((t) => t.id === coloniePlanetTypeId)!.hydrogeneBonus,
  };
  const rates = await resourceService.getProductionRates(PID, planetRow, bonus, UID);

  await resourceService.materializeResources(PID, UID);
  const apres = await lire(PID);

  // Une heure pile écoulée, soldes partis de zéro : le crédit doit être le
  // taux horaire affiché, à l'unité près — aucune tolérance.
  expect(apres.minerai).toBe(rates.mineraiPerHour);
  expect(apres.silicium).toBe(rates.siliciumPerHour);
  expect(apres.hydrogene).toBe(rates.hydrogenePerHour);
});

it('resourceTick verse EXACTEMENT la même chose que materializeResources', async () => {
  await resourceService.materializeResources(PID, UID);
  const parLApi = await lire(PID);

  await remettreAZero();
  const gameConfigService = createGameConfigService(testDb);
  await resourceTick(testDb, gameConfigService);
  const parLeTick = await lire(PID);

  expect(parLeTick.minerai).toBe(parLApi.minerai);
  expect(parLeTick.silicium).toBe(parLApi.silicium);
  expect(parLeTick.hydrogene).toBe(parLApi.hydrogene);
});

it('le tick ne crédite pas une planète en colonisation et ne réécrit pas son horodatage', async () => {
  const gameConfigService = createGameConfigService(testDb);
  await resourceTick(testDb, gameConfigService);
  const apres = await lire(PID_COLONISATION);

  expect(apres.minerai).toBe(0);
  expect(apres.silicium).toBe(0);
  expect(apres.hydrogene).toBe(0);
  expect(apres.resourcesUpdatedAt.getTime()).toBe(UNE_HEURE_AVANT.getTime());
});

it('les capacités de stockage bonifiées par les biomes sont les mêmes des deux côtés', async () => {
  const bonus = {
    mineraiBonus: config.planetTypes.find((t) => t.id === coloniePlanetTypeId)!.mineraiBonus,
    siliciumBonus: config.planetTypes.find((t) => t.id === coloniePlanetTypeId)!.siliciumBonus,
    hydrogeneBonus: config.planetTypes.find((t) => t.id === coloniePlanetTypeId)!.hydrogeneBonus,
  };
  const rates = await resourceService.getProductionRates(PID, planetRow, bonus, UID);

  // deep_caverns donne +10 % de stockage minerai : la capacité affichée doit
  // dépasser la capacité nue, sinon le bonus n'est pas appliqué du tout.
  const sansBiome = rates.storageSiliciumCapacity;
  expect(rates.storageMineraiCapacity).toBeGreaterThan(sansBiome);
});
