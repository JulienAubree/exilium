import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  users,
  planets,
  planetBiomes,
  empirePolicies,
  empireProgression,
  userResearchLevels,
} from '@exilium/db';
import { testDb, closeTestDb } from '../../../test/test-db.js';
import { createGameConfigService } from '../../admin/game-config.service.js';
import {
  assembleBonusContext,
  createBatchBonusLoader,
  createPerPlanetBonusLoader,
  type BonusFacts,
} from '../bonus-context.js';

/**
 * Le verrou anti-divergence de l'acte 0.
 *
 * L'économie fuyait de ~19,4 % parce que quatre chemins calculaient la
 * production avec des ingrédients différents, le tick du worker (créditeur
 * dominant) étant le plus appauvri. Les deux chargeurs de `bonus-context.ts`
 * sont désormais les seules sources de faits, et ce test exige qu'ils
 * produisent EXACTEMENT la même chose — ctx et détail.
 *
 * Prérequis : `bash scripts/setup-test-db.sh` puis un seed de la base de test
 * (`DATABASE_URL=…/exilium_test pnpm --filter @exilium/db db:seed`).
 */

const UID = '00000000-0000-4000-8000-00000000ce01';
const PID_COLONIE = '00000000-0000-4000-8000-00000000ce02';
const PID_MERE = '00000000-0000-4000-8000-00000000ce03';
const PID_COLONIE_2 = '00000000-0000-4000-8000-00000000ce04';

let config: Awaited<ReturnType<ReturnType<typeof createGameConfigService>['getFullConfig']>>;
let homeworldTypeId: string;

beforeAll(async () => {
  const gameConfigService = createGameConfigService(testDb);
  config = await gameConfigService.getFullConfig();
  homeworldTypeId = config.planetTypes.find((t) => t.role === 'homeworld')!.id;

  await testDb.delete(planets).where(eq(planets.userId, UID));
  await testDb.delete(users).where(eq(users.id, UID));

  await testDb.insert(users).values({
    id: UID,
    email: 'bonus-context@test.local',
    username: 'bonus_context_fixture',
    passwordHash: 'x',
  });

  // Planète-mère : exemptée du malus de gouvernance.
  await testDb.insert(planets).values({
    id: PID_MERE,
    userId: UID,
    galaxy: 9, system: 499, position: 5,
    diameter: 12000, minTemp: -10, maxTemp: 40,
    planetClassId: homeworldTypeId,
    status: 'active',
  });

  // Colonie : cumule biomes + vocation + gouvernance en surextension.
  await testDb.insert(planets).values({
    id: PID_COLONIE,
    userId: UID,
    galaxy: 9, system: 499, position: 6,
    diameter: 9000, minTemp: -20, maxTemp: 60,
    planetClassId: config.planetTypes.find((t) => t.id !== homeworldTypeId)!.id,
    status: 'active',
    vocation: 'miniere',
  });

  // Deux biomes ACTIFS (production + stockage) et un INACTIF, qui ne doit
  // compter nulle part — c'est la moitié de ce que le tick ignorait.
  await testDb.insert(planetBiomes).values([
    { planetId: PID_COLONIE, biomeId: 'surface_deposits', active: true },
    { planetId: PID_COLONIE, biomeId: 'deep_caverns', active: true },
    { planetId: PID_COLONIE, biomeId: 'fertile_plains', active: false },
  ]);

  // Recherche : production ET énergie (la production d'énergie était absente
  // du tick, la recherche énergie entière était absente de l'accrual API).
  await testDb.insert(userResearchLevels).values([
    { userId: UID, researchId: 'temperateProduction', level: 5 },
    { userId: UID, researchId: 'energyTech', level: 4 },
    { userId: UID, researchId: 'semiconductors', level: 3 },
  ]);

  // Seconde colonie : sans elle, la fixture ne déclenche PAS la surextension.
  // La capacité de gouvernance au niveau 1 est de 1 colonie ; il en faut donc
  // deux pour que le malus de récolte soit non nul et que cette source-là soit
  // réellement couverte par la comparaison des deux chargeurs.
  await testDb.insert(planets).values({
    id: PID_COLONIE_2,
    userId: UID,
    galaxy: 9, system: 499, position: 7,
    diameter: 8000, minTemp: -30, maxTemp: 30,
    planetClassId: config.planetTypes.find((t) => t.id !== homeworldTypeId)!.id,
    status: 'active',
  });

  // Politique d'empire : +12 % de production — l'autre grand absent du tick.
  await testDb.insert(empirePolicies).values({ userId: UID, active: { doctrine: 'croissance' } });

  // Niveau d'empire 1 → capacité de 1 colonie, pour 2 colonies actives : la
  // surextension est effective.
  await testDb.insert(empireProgression).values({ userId: UID, level: 1 });
});

afterAll(async () => {
  await testDb.delete(planets).where(eq(planets.userId, UID));
  await testDb.delete(users).where(eq(users.id, UID));
  await closeTestDb();
});

async function factsDesDeuxChemins(planetId: string, planet: { planetClassId: string; vocation: string | null }) {
  const perPlanet = await createPerPlanetBonusLoader(testDb, config)(planetId, UID, planet);
  const batch = (await createBatchBonusLoader(testDb, config))(planetId, UID, planet);
  return { perPlanet, batch };
}

describe('les deux chargeurs de faits sont interchangeables', () => {
  it('produisent des faits identiques sur une colonie qui cumule toutes les sources', async () => {
    const planet = { planetClassId: config.planetTypes.find((t) => t.id !== homeworldTypeId)!.id, vocation: 'miniere' };
    const { perPlanet, batch } = await factsDesDeuxChemins(PID_COLONIE, planet);
    expect(batch).toEqual(perPlanet);
  });

  it('produisent des faits identiques sur la planète-mère (gouvernance exemptée)', async () => {
    const planet = { planetClassId: homeworldTypeId, vocation: null };
    const { perPlanet, batch } = await factsDesDeuxChemins(PID_MERE, planet);
    expect(batch).toEqual(perPlanet);
    expect(batch.governanceHarvestMalus).toBe(0);
  });

  it('assemblent un contexte et un détail strictement égaux', async () => {
    const planet = { planetClassId: config.planetTypes.find((t) => t.id !== homeworldTypeId)!.id, vocation: 'miniere' };
    const { perPlanet, batch } = await factsDesDeuxChemins(PID_COLONIE, planet);
    expect(assembleBonusContext(batch, config)).toEqual(assembleBonusContext(perPlanet, config));
  });
});

describe('la fixture couvre bien toutes les sources de la fuite', () => {
  it('inclut les biomes ACTIFS uniquement', async () => {
    const planet = { planetClassId: config.planetTypes.find((t) => t.id !== homeworldTypeId)!.id, vocation: 'miniere' };
    const { perPlanet } = await factsDesDeuxChemins(PID_COLONIE, planet);
    // surface_deposits (+8 % minerai) et deep_caverns (+10 % stockage minerai)
    // sont actifs ; fertile_plains (+8 % silicium) ne l'est pas.
    expect(perPlanet.biomeBonuses['production_minerai']).toBeCloseTo(0.08, 10);
    expect(perPlanet.biomeBonuses['storage_minerai']).toBeCloseTo(0.1, 10);
    expect(perPlanet.biomeBonuses['production_silicium']).toBeUndefined();
  });

  it('inclut la politique d\'empire et la vocation', async () => {
    const planet = { planetClassId: config.planetTypes.find((t) => t.id !== homeworldTypeId)!.id, vocation: 'miniere' };
    const { perPlanet } = await factsDesDeuxChemins(PID_COLONIE, planet);
    expect(perPlanet.policyProductionDelta).toBeCloseTo(0.12, 10);
    expect(perPlanet.vocation).toBe('miniere');
  });

  it('déclenche réellement le malus de gouvernance sur la colonie', async () => {
    // Sans cette assertion, la fixture pouvait comparer deux zéros et laisser
    // croire que la gouvernance était couverte alors qu'elle ne l'était pas.
    const planet = { planetClassId: config.planetTypes.find((t) => t.id !== homeworldTypeId)!.id, vocation: 'miniere' };
    const { perPlanet, batch } = await factsDesDeuxChemins(PID_COLONIE, planet);
    expect(perPlanet.governanceHarvestMalus).toBeGreaterThan(0);
    expect(batch.governanceHarvestMalus).toBe(perPlanet.governanceHarvestMalus);
  });

  it('inclut la recherche énergie DANS LES DEUX SENS — la condition du « affiché = versé »', () => {
    const facts: BonusFacts = {
      talentCtx: {},
      biomeBonuses: {},
      researchLevels: { energyTech: 4, semiconductors: 3 },
      governanceHarvestMalus: 0,
      vocation: null,
      policyProductionDelta: 0,
    };
    const { ctx } = assembleBonusContext(facts, config);
    // energyTech : +2 %/niveau de production d'énergie — le tick ne l'appliquait pas.
    expect(ctx['energy_production']).toBeCloseTo(0.08, 10);
    // semiconductors : −2 %/niveau de consommation — l'accrual API ne l'appliquait pas.
    expect(ctx['energy_consumption']).toBeCloseTo(-0.06, 10);
  });
});

describe('assembleBonusContext — sémantique de cumul', () => {
  it('cumule additivement les sources qui touchent la même statistique', () => {
    const facts: BonusFacts = {
      talentCtx: { production_minerai: 0.05 },
      biomeBonuses: { production_minerai: 0.08 },
      researchLevels: {},
      governanceHarvestMalus: 0.15,
      vocation: 'miniere',
      policyProductionDelta: 0.12,
    };
    const { ctx, breakdown } = assembleBonusContext(facts, config);
    // 0.05 (talent) + 0.08 (biome) − 0.15 (gouvernance) + 0.20 (miniere) + 0.12 (politique)
    expect(ctx['production_minerai']).toBeCloseTo(0.3, 10);
    expect(breakdown.filter((b) => b.stat === 'production_minerai').map((b) => b.source)).toEqual([
      'talents', 'biomes', 'gouvernance', 'vocation', 'politique',
    ]);
  });

  it('n\'inscrit jamais une entrée nulle au détail', () => {
    const facts: BonusFacts = {
      talentCtx: { production_minerai: 0 },
      biomeBonuses: {},
      researchLevels: {},
      governanceHarvestMalus: 0,
      vocation: null,
      policyProductionDelta: 0,
    };
    const { ctx, breakdown } = assembleBonusContext(facts, config);
    expect(breakdown).toEqual([]);
    expect(ctx['production_minerai']).toBeUndefined();
  });
});
