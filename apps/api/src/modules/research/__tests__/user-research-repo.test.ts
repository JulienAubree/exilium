/**
 * Test d'intégration — getUserResearchLevels / getAllUserResearchLevels (Lot 2)
 *
 * Vérifie que les helpers du repository @exilium/db lisent le modèle EN LIGNES
 * `user_research_levels` (et non plus la table large `user_research`).
 *
 * Filet de test : base `exilium_test` (séparée de prod), schéma poussé par
 * `bash scripts/setup-test-db.sh`. Nettoie ses propres données.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inArray } from 'drizzle-orm';
import {
  users,
  userResearchLevels,
  getUserResearchLevels,
  getAllUserResearchLevels,
} from '@exilium/db';
import { testDb, closeTestDb } from '../../../test/test-db.js';

const USER_A = '00000000-0000-0000-0000-0000000000a1';
const USER_B = '00000000-0000-0000-0000-0000000000a2';
const ABSENT = '00000000-0000-0000-0000-0000000000af';
const IDS = [USER_A, USER_B];

describe('getUserResearchLevels / getAllUserResearchLevels (modèle en lignes)', () => {
  beforeAll(async () => {
    await testDb.delete(userResearchLevels).where(inArray(userResearchLevels.userId, IDS));
    await testDb.delete(users).where(inArray(users.id, IDS));

    await testDb.insert(users).values([
      { id: USER_A, email: 'lot2-a@exilium.test', username: 'lot2_a', passwordHash: 'x' },
      { id: USER_B, email: 'lot2-b@exilium.test', username: 'lot2_b', passwordHash: 'x' },
    ]);
    await testDb.insert(userResearchLevels).values([
      { userId: USER_A, researchId: 'weapons', level: 3 },
      { userId: USER_A, researchId: 'espionageTech', level: 2 },
      { userId: USER_B, researchId: 'shielding', level: 5 },
    ]);
  });

  afterAll(async () => {
    await testDb.delete(userResearchLevels).where(inArray(userResearchLevels.userId, IDS));
    await testDb.delete(users).where(inArray(users.id, IDS));
    await closeTestDb();
  });

  it('getUserResearchLevels lit user_research_levels', async () => {
    const levels = await getUserResearchLevels(testDb, USER_A);
    expect(levels).toEqual({ weapons: 3, espionageTech: 2 });
  });

  it("getUserResearchLevels renvoie {} pour un user sans ligne", async () => {
    const levels = await getUserResearchLevels(testDb, ABSENT);
    expect(levels).toEqual({});
  });

  it('getAllUserResearchLevels regroupe les niveaux par userId', async () => {
    const byUser = await getAllUserResearchLevels(testDb);
    expect(byUser.get(USER_A)).toEqual({ weapons: 3, espionageTech: 2 });
    expect(byUser.get(USER_B)).toEqual({ shielding: 5 });
  });
});
