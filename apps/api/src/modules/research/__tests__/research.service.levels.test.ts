/**
 * Test d'intégration — Task 3 Lot 1 : service branché sur le modèle en lignes
 *
 * Vérifie que :
 *   1. `completeResearch` écrit dans `user_research_levels` via `bumpResearchLevel`.
 *   2. `loadResearchLevels` reflète ensuite le bon niveau (lecture via le modèle en lignes).
 *   3. (C1 dual-write) `completeResearch` synchronise aussi `user_research`.
 *   4. (I1 dual-write) `setResearchLevel` / `updatePlayerResearchLevel` synchronisent les deux tables.
 *
 * Filet de test : base `exilium_test` (séparée de prod). Nettoie ses propres données.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, and } from 'drizzle-orm';
import { users, planets, buildQueue, userResearchLevels, userResearch } from '@exilium/db';
import { testDb, closeTestDb } from '../../../test/test-db.js';
import { createResearchService } from '../research.service.js';
import { loadResearchLevels, setResearchLevel } from '../research-levels.repo.js';
import { createPlayerAdminService } from '../../admin/player-admin.service.js';
import type { GameConfig } from '../../admin/game-config.types.js';

// IDs uniques pour ce run (évite les collisions avec d'autres tests)
const TEST_USER_ID = '00000000-0000-0000-0000-000000000099';
const TEST_PLANET_ID = '00000000-0000-0000-0000-000000000098';
const TEST_RESEARCH_ID = 'weapons';

// ID dédié pour les tests admin (évite les interférences avec le bloc completeResearch)
const ADMIN_USER_ID = '00000000-0000-0000-0000-000000000097';

// ---- Mocks minimaux ----

/** GameConfigService minimal : retourne un GameConfig avec une seule recherche. */
const mockGameConfigService = {
  async getFullConfig(): Promise<GameConfig> {
    return {
      categories: [],
      buildings: {},
      research: {
        [TEST_RESEARCH_ID]: {
          id: TEST_RESEARCH_ID,
          name: 'Technologie Armes',
          description: 'Test',
          baseCost: { minerai: 800, silicium: 200, hydrogene: 0 },
          costFactor: 2,
          flavorText: null,
          effectDescription: null,
          levelColumn: TEST_RESEARCH_ID,
          categoryId: null,
          sortOrder: 0,
          maxLevel: 20,
          requiredAnnexType: null,
          prerequisites: { buildings: [], research: [] },
        },
      },
      ships: {},
      defenses: {},
      production: {},
      universe: {},
      planetTypes: [],
      pirateTemplates: [],
      tutorialQuests: [],
      bonuses: [],
      missions: {},
      labels: {},
      talentBranches: [],
      talents: {},
      hulls: {},
      biomes: [],
    } as unknown as GameConfig;
  },
  // Méthodes du service non utilisées dans ce test
  invalidateCache() {},
};

/** Queue de complétion stub (completeResearch n'ajoute pas à la queue). */
const mockQueue = {
  add: async () => {},
  remove: async () => {},
} as unknown as import('bullmq').Queue;

/** ResourceService stub (non utilisé dans completeResearch). */
const mockResourceService = {} as ReturnType<
  typeof import('../../resource/resource.service.js').createResourceService
>;

// Fermeture globale — une seule fois pour tout le fichier
afterAll(async () => {
  await closeTestDb();
});

describe('research.service — modèle en lignes (Task 3 Lot 1)', () => {
  let buildQueueId: string;

  beforeAll(async () => {
    // Nettoyage préventif
    await testDb.delete(buildQueue).where(eq(buildQueue.userId, TEST_USER_ID));
    await testDb
      .delete(userResearchLevels)
      .where(eq(userResearchLevels.userId, TEST_USER_ID));
    await testDb.delete(userResearch).where(eq(userResearch.userId, TEST_USER_ID));
    await testDb.delete(planets).where(eq(planets.userId, TEST_USER_ID));
    await testDb.delete(users).where(eq(users.id, TEST_USER_ID));

    // Utilisateur minimal
    await testDb.insert(users).values({
      id: TEST_USER_ID,
      email: 'service-levels-test@exilium.test',
      username: 'service_levels_test',
      passwordHash: 'not-a-real-hash',
    });

    // Planète minimale (requise par la FK de build_queue)
    // planetClassId omis : nullable, pas de planet_types en base de test
    await testDb.insert(planets).values({
      id: TEST_PLANET_ID,
      userId: TEST_USER_ID,
      galaxy: 1,
      system: 1,
      position: 1,
      diameter: 10000,
      minTemp: -10,
      maxTemp: 30,
    });

    // Entrée build_queue active pour la recherche
    const [entry] = await testDb
      .insert(buildQueue)
      .values({
        planetId: TEST_PLANET_ID,
        userId: TEST_USER_ID,
        type: 'research',
        itemId: TEST_RESEARCH_ID,
        startTime: new Date(),
        endTime: new Date(Date.now() + 60_000),
        status: 'active',
      })
      .returning({ id: buildQueue.id });

    buildQueueId = entry.id;
  });

  afterAll(async () => {
    await testDb.delete(buildQueue).where(eq(buildQueue.userId, TEST_USER_ID));
    await testDb
      .delete(userResearchLevels)
      .where(eq(userResearchLevels.userId, TEST_USER_ID));
    await testDb.delete(userResearch).where(eq(userResearch.userId, TEST_USER_ID));
    await testDb.delete(planets).where(eq(planets.userId, TEST_USER_ID));
    await testDb.delete(users).where(eq(users.id, TEST_USER_ID));
  });

  it("aucun niveau avant la complétion (user_research_levels vide pour l'utilisateur)", async () => {
    const levels = await loadResearchLevels(testDb, TEST_USER_ID);
    expect(levels).toEqual({});
  });

  it('completeResearch incrémente user_research_levels à 1', async () => {
    const service = createResearchService(
      testDb,
      mockResourceService,
      mockQueue,
      mockGameConfigService as unknown as import('../../admin/game-config.service.js').GameConfigService,
    );

    const result = await service.completeResearch(buildQueueId);

    expect(result).not.toBeNull();
    expect(result?.eventPayload).toMatchObject({
      techId: TEST_RESEARCH_ID,
      level: 1,
    });
  });

  it('user_research_levels contient bien la ligne research après complétion', async () => {
    const [row] = await testDb
      .select()
      .from(userResearchLevels)
      .where(
        and(
          eq(userResearchLevels.userId, TEST_USER_ID),
          eq(userResearchLevels.researchId, TEST_RESEARCH_ID),
        ),
      );

    expect(row).toBeDefined();
    expect(row.level).toBe(1);
  });

  it('loadResearchLevels renvoie le bon niveau après complétion', async () => {
    const levels = await loadResearchLevels(testDb, TEST_USER_ID);
    expect(levels[TEST_RESEARCH_ID]).toBe(1);
  });

  it('build_queue entry est passée à status completed', async () => {
    const [entry] = await testDb
      .select({ status: buildQueue.status })
      .from(buildQueue)
      .where(eq(buildQueue.id, buildQueueId));

    expect(entry?.status).toBe('completed');
  });

  // C1 — dual-write : user_research doit être synchronisée après completeResearch
  it('C1 dual-write — completeResearch synchronise user_research (filet pour les ~10 lecteurs)', async () => {
    const [row] = await testDb
      .select()
      .from(userResearch)
      .where(eq(userResearch.userId, TEST_USER_ID));

    expect(row).toBeDefined();
    // weapons est levelColumn = TEST_RESEARCH_ID
    expect(row.weapons).toBe(1);
  });
});

describe('setResearchLevel / updatePlayerResearchLevel — dual-write admin (I1)', () => {
  beforeAll(async () => {
    // Nettoyage préventif pour ADMIN_USER_ID
    await testDb
      .delete(userResearchLevels)
      .where(eq(userResearchLevels.userId, ADMIN_USER_ID));
    await testDb.delete(userResearch).where(eq(userResearch.userId, ADMIN_USER_ID));
    await testDb.delete(users).where(eq(users.id, ADMIN_USER_ID));

    // Utilisateur minimal
    await testDb.insert(users).values({
      id: ADMIN_USER_ID,
      email: 'admin-research-test@exilium.test',
      username: 'admin_research_test',
      passwordHash: 'not-a-real-hash',
    });

    // user_research doit exister (la méthode fait un UPDATE sans upsert)
    await testDb.insert(userResearch).values({ userId: ADMIN_USER_ID });
  });

  afterAll(async () => {
    await testDb
      .delete(userResearchLevels)
      .where(eq(userResearchLevels.userId, ADMIN_USER_ID));
    await testDb.delete(userResearch).where(eq(userResearch.userId, ADMIN_USER_ID));
    await testDb.delete(users).where(eq(users.id, ADMIN_USER_ID));
  });

  it('setResearchLevel upsert crée la ligne user_research_levels au niveau demandé', async () => {
    await setResearchLevel(testDb, ADMIN_USER_ID, TEST_RESEARCH_ID, 5);

    const [row] = await testDb
      .select()
      .from(userResearchLevels)
      .where(
        and(
          eq(userResearchLevels.userId, ADMIN_USER_ID),
          eq(userResearchLevels.researchId, TEST_RESEARCH_ID),
        ),
      );

    expect(row).toBeDefined();
    expect(row.level).toBe(5);
  });

  it('setResearchLevel met à jour la ligne existante (SET idempotent)', async () => {
    await setResearchLevel(testDb, ADMIN_USER_ID, TEST_RESEARCH_ID, 7);

    const [row] = await testDb
      .select()
      .from(userResearchLevels)
      .where(
        and(
          eq(userResearchLevels.userId, ADMIN_USER_ID),
          eq(userResearchLevels.researchId, TEST_RESEARCH_ID),
        ),
      );

    expect(row?.level).toBe(7);
  });

  it('I1 dual-write — updatePlayerResearchLevel synchronise user_research ET user_research_levels', async () => {
    const adminService = createPlayerAdminService(testDb);

    await adminService.updatePlayerResearchLevel(ADMIN_USER_ID, TEST_RESEARCH_ID, 10);

    // user_research (colonne weapons)
    const [urRow] = await testDb
      .select()
      .from(userResearch)
      .where(eq(userResearch.userId, ADMIN_USER_ID));

    expect(urRow).toBeDefined();
    expect(urRow.weapons).toBe(10);

    // user_research_levels (ligne)
    const [urlRow] = await testDb
      .select()
      .from(userResearchLevels)
      .where(
        and(
          eq(userResearchLevels.userId, ADMIN_USER_ID),
          eq(userResearchLevels.researchId, TEST_RESEARCH_ID),
        ),
      );

    expect(urlRow).toBeDefined();
    expect(urlRow.level).toBe(10);
  });
});
