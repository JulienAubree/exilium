/**
 * Test d'intégration — loadResearchLevels / bumpResearchLevel (Task 2 Lot 1)
 *
 * Vérifie les deux helpers d'accès au modèle en lignes `user_research_levels`.
 *
 * Filet de test : base `exilium_test` (séparée de prod), schéma poussé par
 * `bash scripts/setup-test-db.sh`. Nettoie ses propres données en afterAll.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { users, userResearchLevels } from '@exilium/db';
import { testDb, closeTestDb } from '../../../test/test-db.js';
import {
  loadResearchLevels,
  bumpResearchLevel,
} from '../research-levels.repo.js';

// ID unique pour ce run de test (évite les collisions avec d'autres tests)
const TEST_USER_ID = '00000000-0000-0000-0000-000000000043';

describe('loadResearchLevels / bumpResearchLevel', () => {
  beforeAll(async () => {
    // Nettoyage préventif (run précédent interrompu)
    await testDb
      .delete(userResearchLevels)
      .where(eq(userResearchLevels.userId, TEST_USER_ID));
    await testDb.delete(users).where(eq(users.id, TEST_USER_ID));

    // Insérer un utilisateur minimal
    await testDb.insert(users).values({
      id: TEST_USER_ID,
      email: 'repo-test@exilium.test',
      username: 'repo_test_user',
      passwordHash: 'not-a-real-hash',
    });
  });

  afterAll(async () => {
    // Nettoyage — FK cascade couvre user_research_levels, mais on est explicites
    await testDb
      .delete(userResearchLevels)
      .where(eq(userResearchLevels.userId, TEST_USER_ID));
    await testDb.delete(users).where(eq(users.id, TEST_USER_ID));
    await closeTestDb();
  });

  it("loadResearchLevels renvoie {} quand aucune ligne n'existe", async () => {
    const levels = await loadResearchLevels(testDb, TEST_USER_ID);
    expect(levels).toEqual({});
  });

  it('bumpResearchLevel insère level=1 à la première invocation', async () => {
    const newLevel = await bumpResearchLevel(testDb, TEST_USER_ID, 'weapons');
    expect(newLevel).toBe(1);
  });

  it('bumpResearchLevel incrémente à 2 à la deuxième invocation', async () => {
    const newLevel = await bumpResearchLevel(testDb, TEST_USER_ID, 'weapons');
    expect(newLevel).toBe(2);
  });

  it('loadResearchLevels reflète le niveau bumped', async () => {
    const levels = await loadResearchLevels(testDb, TEST_USER_ID);
    expect(levels).toEqual({ weapons: 2 });
  });

  it('loadResearchLevels reflète plusieurs researchIds indépendants', async () => {
    await bumpResearchLevel(testDb, TEST_USER_ID, 'energyTech');
    await bumpResearchLevel(testDb, TEST_USER_ID, 'energyTech');
    await bumpResearchLevel(testDb, TEST_USER_ID, 'energyTech');
    const levels = await loadResearchLevels(testDb, TEST_USER_ID);
    expect(levels).toEqual({ weapons: 2, energyTech: 3 });
  });
});
