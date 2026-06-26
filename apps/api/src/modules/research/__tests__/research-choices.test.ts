/**
 * Test d'intégration — research-choices.repo + respecFork (Task 4)
 *
 * Vérifie :
 *   (a) chooseFork crée la ligne, 2e appel rejette
 *   (b) isResearchLocked : vrai pour la mauvaise voie / fork non choisi, faux pour la bonne
 *   (c) respecFork : débite l'exilium attendu, remet à 0 les niveaux ancienne voie,
 *       bascule le path, respecCount 0→1, 2e respec = base×factor
 *
 * Filet : exilium_test. IDs uniques pour éviter collisions.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, and, inArray } from 'drizzle-orm';
import {
  users,
  userResearchChoices,
  userResearchLevels,
  userExilium,
  researchDefinitions,
} from '@exilium/db';
import { testDb, closeTestDb } from '../../../test/test-db.js';
import {
  loadChoices,
  chooseFork,
  isResearchLocked,
} from '../research-choices.repo.js';

// Unique IDs for this test run
const TEST_USER_ID = '00000000-0000-0000-0000-000000000090';
const FORK_ID = 'test-fork-t4-armement';
const PATH_A = 'offense';
const PATH_B = 'defense';

// Two forked research definitions with same forkId, different forkPath
const RES_A = 'test_t4_fork_offense';
const RES_B = 'test_t4_fork_defense';

// A def shape for isResearchLocked tests (pure function — no DB needed)
const defA = {
  id: RES_A,
  forkId: FORK_ID,
  forkPath: PATH_A,
} as { id: string; forkId: string | null; forkPath: string | null };

const defB = {
  id: RES_B,
  forkId: FORK_ID,
  forkPath: PATH_B,
} as { id: string; forkId: string | null; forkPath: string | null };

const defNoFork = {
  id: 'test_t4_no_fork',
  forkId: null,
  forkPath: null,
} as { id: string; forkId: string | null; forkPath: string | null };

describe('research-choices: loadChoices / chooseFork / isResearchLocked / respecFork', () => {
  beforeAll(async () => {
    // Preventive cleanup from a previous interrupted run
    await testDb.delete(userResearchLevels).where(eq(userResearchLevels.userId, TEST_USER_ID));
    await testDb.delete(userResearchChoices).where(eq(userResearchChoices.userId, TEST_USER_ID));
    await testDb.delete(userExilium).where(eq(userExilium.userId, TEST_USER_ID));
    await testDb.delete(users).where(eq(users.id, TEST_USER_ID));
    // Clean up test research_definitions
    await testDb
      .delete(researchDefinitions)
      .where(inArray(researchDefinitions.id, [RES_A, RES_B]));

    // Insert user
    await testDb.insert(users).values({
      id: TEST_USER_ID,
      email: 'choices-test-t4@exilium.test',
      username: 'choices_test_t4',
      passwordHash: 'not-a-real-hash',
    });

    // Credit exilium (enough for several respecs)
    await testDb.insert(userExilium).values({
      userId: TEST_USER_ID,
      balance: 1000,
      totalEarned: 1000,
      totalSpent: 0,
    });

    // Insert minimal forked research_definitions
    await testDb.insert(researchDefinitions).values([
      {
        id: RES_A,
        name: 'Fork Offense Test',
        description: '',
        levelColumn: RES_A,
        forkId: FORK_ID,
        forkPath: PATH_A,
        costFactor: 2,
      },
      {
        id: RES_B,
        name: 'Fork Defense Test',
        description: '',
        levelColumn: RES_B,
        forkId: FORK_ID,
        forkPath: PATH_B,
        costFactor: 2,
      },
    ]);

    // Seed research levels for RES_A (to be zeroed out by respec)
    await testDb.insert(userResearchLevels).values([
      { userId: TEST_USER_ID, researchId: RES_A, level: 3 },
    ]);
  });

  afterAll(async () => {
    await testDb.delete(userResearchLevels).where(eq(userResearchLevels.userId, TEST_USER_ID));
    await testDb.delete(userResearchChoices).where(eq(userResearchChoices.userId, TEST_USER_ID));
    await testDb.delete(userExilium).where(eq(userExilium.userId, TEST_USER_ID));
    await testDb.delete(users).where(eq(users.id, TEST_USER_ID));
    await testDb
      .delete(researchDefinitions)
      .where(inArray(researchDefinitions.id, [RES_A, RES_B]));
    await closeTestDb();
  });

  // ── (a) chooseFork ──────────────────────────────────────────────────────────

  it('loadChoices renvoie {} quand aucun choix', async () => {
    const choices = await loadChoices(testDb, TEST_USER_ID);
    expect(choices).toEqual({});
  });

  it('chooseFork insère le choix', async () => {
    await chooseFork(testDb, TEST_USER_ID, FORK_ID, PATH_A);
    const choices = await loadChoices(testDb, TEST_USER_ID);
    expect(choices[FORK_ID]).toEqual({ path: PATH_A, respecCount: 0 });
  });

  it('chooseFork rejette si déjà choisi', async () => {
    await expect(
      chooseFork(testDb, TEST_USER_ID, FORK_ID, PATH_B),
    ).rejects.toThrow();
  });

  // ── (b) isResearchLocked ────────────────────────────────────────────────────

  it('isResearchLocked = false pour une recherche sans fork', () => {
    const choices = { [FORK_ID]: { path: PATH_A, respecCount: 0 } };
    expect(isResearchLocked(defNoFork, choices)).toBe(false);
  });

  it('isResearchLocked = false pour la bonne voie choisie', () => {
    const choices = { [FORK_ID]: { path: PATH_A, respecCount: 0 } };
    expect(isResearchLocked(defA, choices)).toBe(false);
  });

  it('isResearchLocked = true pour la mauvaise voie', () => {
    const choices = { [FORK_ID]: { path: PATH_A, respecCount: 0 } };
    expect(isResearchLocked(defB, choices)).toBe(true);
  });

  it('isResearchLocked = true si fork non encore choisi', () => {
    const choices: Record<string, { path: string; respecCount: number }> = {};
    expect(isResearchLocked(defA, choices)).toBe(true);
  });

  // ── (c) respecFork ──────────────────────────────────────────────────────────

  it('respecFork débite le bon montant, remet les niveaux à 0, bascule path, respecCount 0→1', async () => {
    // Import service here to avoid circular deps at describe level
    const { loadChoices: lc } = await import('../research-choices.repo.js');
    const { createExiliumService } = await import('../../exilium/exilium.service.js');
    const { createGameConfigService } = await import('../../admin/game-config.service.js');
    const { createResearchService } = await import('../research.service.js');

    const gameConfigService = createGameConfigService(testDb);
    const exiliumService = createExiliumService(testDb, gameConfigService);

    // respecFork needs access through service — pass null queue/resource stubs
    // since we only test the respec path (no queue/resource interactions)
    const researchService = createResearchService(
      testDb,
      null as any,
      null as any,
      gameConfigService,
      undefined,
      undefined,
      exiliumService,
    );

    // base=5, factor=2, respecCount=0 → cost = 5 × 2^0 = 5
    const balanceBefore = 1000;
    await researchService.respecFork(TEST_USER_ID, FORK_ID, PATH_B);

    // Check exilium balance
    const [exRow] = await testDb
      .select({ balance: userExilium.balance })
      .from(userExilium)
      .where(eq(userExilium.userId, TEST_USER_ID));
    expect(exRow.balance).toBe(balanceBefore - 5); // base=5, factor^0=1

    // Check choices updated
    const choices = await lc(testDb, TEST_USER_ID);
    expect(choices[FORK_ID]).toEqual({ path: PATH_B, respecCount: 1 });

    // Check RES_A levels zeroed (was PATH_A = old path)
    const [lvlA] = await testDb
      .select({ level: userResearchLevels.level })
      .from(userResearchLevels)
      .where(
        and(
          eq(userResearchLevels.userId, TEST_USER_ID),
          eq(userResearchLevels.researchId, RES_A),
        ),
      );
    expect(lvlA?.level ?? 0).toBe(0);
  });

  it('2e respecFork coûte base × factor = 5 × 2^1 = 10', async () => {
    const { createExiliumService } = await import('../../exilium/exilium.service.js');
    const { createGameConfigService } = await import('../../admin/game-config.service.js');
    const { createResearchService } = await import('../research.service.js');

    const gameConfigService = createGameConfigService(testDb);
    const exiliumService = createExiliumService(testDb, gameConfigService);
    const researchService = createResearchService(
      testDb,
      null as any,
      null as any,
      gameConfigService,
      undefined,
      undefined,
      exiliumService,
    );

    const balanceBefore = 1000 - 5; // after first respec
    // respecCount=1 → cost = 5 × 2^1 = 10
    await researchService.respecFork(TEST_USER_ID, FORK_ID, PATH_A);

    const [exRow] = await testDb
      .select({ balance: userExilium.balance })
      .from(userExilium)
      .where(eq(userExilium.userId, TEST_USER_ID));
    expect(exRow.balance).toBe(balanceBefore - 10);

    const choices = await loadChoices(testDb, TEST_USER_ID);
    expect(choices[FORK_ID]).toEqual({ path: PATH_A, respecCount: 2 });
  });
});
