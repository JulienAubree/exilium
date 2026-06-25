/**
 * Test d'intégration — Backfill user_research → user_research_levels (Task 1 Lot 1)
 *
 * Vérifie que la requête de backfill extraite de la migration SQL produit bien
 * les lignes attendues dans user_research_levels à partir de user_research.
 *
 * Filet de test : base `exilium_test` (séparée de prod), schéma poussé par
 * `bash scripts/setup-test-db.sh`. Nettoie ses propres données en afterAll.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, and } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { users, userResearch, userResearchLevels } from '@exilium/db';
import { testDb, closeTestDb } from '../../../test/test-db.js';

// ID unique pour ce run de test (évite les collisions avec d'autres tests)
const TEST_USER_ID = '00000000-0000-0000-0000-000000000042';

describe('backfill user_research → user_research_levels', () => {
  beforeAll(async () => {
    // Nettoyage préventif (run précédent interrompu)
    await testDb.delete(userResearchLevels).where(eq(userResearchLevels.userId, TEST_USER_ID));
    await testDb.delete(userResearch).where(eq(userResearch.userId, TEST_USER_ID));
    await testDb.delete(users).where(eq(users.id, TEST_USER_ID));

    // Insérer un utilisateur minimal
    await testDb.insert(users).values({
      id: TEST_USER_ID,
      email: 'backfill-test@exilium.test',
      username: 'backfill_test_user',
      passwordHash: 'not-a-real-hash',
    });

    // Insérer une ligne user_research avec quelques niveaux non nuls
    await testDb.insert(userResearch).values({
      userId: TEST_USER_ID,
      weapons: 3,
      energyTech: 2,
      // tous les autres restent à 0 (default)
    });
  });

  afterAll(async () => {
    // Nettoyage — ordre important (FK cascade, mais on est explicites)
    await testDb.delete(userResearchLevels).where(eq(userResearchLevels.userId, TEST_USER_ID));
    await testDb.delete(userResearch).where(eq(userResearch.userId, TEST_USER_ID));
    await testDb.delete(users).where(eq(users.id, TEST_USER_ID));
    await closeTestDb();
  });

  it('backfille weapons=3 depuis user_research', async () => {
    // Exécuter la requête de backfill pour "weapons" (extraite de la migration)
    await testDb.execute(
      sql`INSERT INTO "user_research_levels" ("user_id", "research_id", "level")
          SELECT "user_id", 'weapons', "weapons" FROM "user_research"
          WHERE "user_id" = ${TEST_USER_ID}
          ON CONFLICT DO NOTHING`,
    );

    const rows = await testDb
      .select()
      .from(userResearchLevels)
      .where(
        and(
          eq(userResearchLevels.userId, TEST_USER_ID),
          eq(userResearchLevels.researchId, 'weapons'),
        ),
      );

    expect(rows).toHaveLength(1);
    expect(rows[0]!.level).toBe(3);
  });

  it('backfille energyTech=2 depuis user_research', async () => {
    await testDb.execute(
      sql`INSERT INTO "user_research_levels" ("user_id", "research_id", "level")
          SELECT "user_id", 'energyTech', "energy_tech" FROM "user_research"
          WHERE "user_id" = ${TEST_USER_ID}
          ON CONFLICT DO NOTHING`,
    );

    const rows = await testDb
      .select()
      .from(userResearchLevels)
      .where(
        and(
          eq(userResearchLevels.userId, TEST_USER_ID),
          eq(userResearchLevels.researchId, 'energyTech'),
        ),
      );

    expect(rows).toHaveLength(1);
    expect(rows[0]!.level).toBe(2);
  });

  it('le backfill est idempotent (ON CONFLICT DO NOTHING)', async () => {
    // Ré-exécuter le backfill weapons : ne doit pas planter ni dupliquer
    await testDb.execute(
      sql`INSERT INTO "user_research_levels" ("user_id", "research_id", "level")
          SELECT "user_id", 'weapons', "weapons" FROM "user_research"
          WHERE "user_id" = ${TEST_USER_ID}
          ON CONFLICT DO NOTHING`,
    );

    const rows = await testDb
      .select()
      .from(userResearchLevels)
      .where(
        and(
          eq(userResearchLevels.userId, TEST_USER_ID),
          eq(userResearchLevels.researchId, 'weapons'),
        ),
      );

    // Toujours exactement 1 ligne, pas de doublon
    expect(rows).toHaveLength(1);
    expect(rows[0]!.level).toBe(3);
  });

  it('backfille 0 pour une recherche non progressée (combustion)', async () => {
    await testDb.execute(
      sql`INSERT INTO "user_research_levels" ("user_id", "research_id", "level")
          SELECT "user_id", 'combustion', "combustion" FROM "user_research"
          WHERE "user_id" = ${TEST_USER_ID}
          ON CONFLICT DO NOTHING`,
    );

    const rows = await testDb
      .select()
      .from(userResearchLevels)
      .where(
        and(
          eq(userResearchLevels.userId, TEST_USER_ID),
          eq(userResearchLevels.researchId, 'combustion'),
        ),
      );

    expect(rows).toHaveLength(1);
    expect(rows[0]!.level).toBe(0);
  });
});
