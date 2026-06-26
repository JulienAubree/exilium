/**
 * Test d'intégration — migrate-research-forks (Task 6)
 *
 * Vérifie :
 *   (a) both-paths → dominant wins (armor > shields by cost), losing path levels → 0,
 *       refund credited to homeworld, respecCount = 0
 *   (b) one-path (shields only) → chosenPath = shields, no refund
 *   (c) idempotent re-run → no-op (existing choice row skipped)
 *   (d) both-paths + no homeworld → atomic skip: no choice row, levels unchanged, userId in needsManualFollowUp
 *   (e) tuned phase_multiplier in universe_config → refund amount uses configured multiplier
 *
 * Filet : exilium_test. IDs uniques pour éviter collisions.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, and, inArray } from 'drizzle-orm';
import {
  users,
  planets,
  planetTypes,
  userResearchChoices,
  userResearchLevels,
  researchDefinitions,
  universeConfig,
} from '@exilium/db';
import { testDb, closeTestDb } from '../../../test/test-db.js';

// ── Unique IDs ──────────────────────────────────────────────────────────────

const USER_A = '00000000-0000-0000-0001-000000000006'; // both paths invested
const USER_B = '00000000-0000-0000-0002-000000000006'; // one path (shields) only
const USER_C = '00000000-0000-0000-0003-000000000006'; // both paths, NO homeworld (test d)
const USER_D = '00000000-0000-0000-0004-000000000006'; // both paths, for phase-multiplier test (test e)

const PLANET_A = '10000000-0000-0000-0001-000000000006';
const PLANET_B = '10000000-0000-0000-0002-000000000006';
// USER_C has no planet — intentionally omitted
const PLANET_D = '10000000-0000-0000-0004-000000000006';

// Minimal fork IDs (reuse real fork names so the script picks them up)
const FORK_ID = 'defense_doctrine';
const PATH_SHIELDS = 'shields';
const PATH_ARMOR = 'armor';

// Research IDs that belong to this fork (real IDs from seed)
// shields path: shielding, glacialShielding
// armor path: armor, aridArmor
// We'll seed minimal research_definitions with these IDs

const RES_SHIELDING = 't6_test_shielding';
const RES_GLACIAL = 't6_test_glacialShielding';
const RES_ARMOR = 't6_test_armor';
const RES_ARID = 't6_test_aridArmor';

// Cost formula replication for assertions:
// researchCost uses phaseMap defaults for levels 1-7:
// { 1: 0.35, 2: 0.45, 3: 0.55, 4: 0.65, 5: 0.78, 6: 0.90, 7: 0.95 }
// cost(level) = floor(baseCost * factor^(level-1) * phaseMultiplier(level))

const PHASE_MAP: Record<number, number> = {
  1: 0.35, 2: 0.45, 3: 0.55, 4: 0.65, 5: 0.78, 6: 0.90, 7: 0.95,
};
function phaseM(level: number): number {
  return PHASE_MAP[level] ?? 1.0;
}
function calcCost(baseMinerai: number, baseSilicium: number, baseHydrogene: number, costFactor: number, level: number) {
  const factor = Math.pow(costFactor, level - 1) * phaseM(level);
  return {
    minerai: Math.floor(baseMinerai * factor),
    silicium: Math.floor(baseSilicium * factor),
    hydrogene: Math.floor(baseHydrogene * factor),
  };
}
function sumCosts(baseMinerai: number, baseSilicium: number, baseHydrogene: number, costFactor: number, maxLevel: number) {
  let m = 0, s = 0, h = 0;
  for (let l = 1; l <= maxLevel; l++) {
    const c = calcCost(baseMinerai, baseSilicium, baseHydrogene, costFactor, l);
    m += c.minerai;
    s += c.silicium;
    h += c.hydrogene;
  }
  return { minerai: m, silicium: s, hydrogene: h };
}

// User A: shielding=4, glacialShielding=2 (shields path); armor=6 (armor path)
// Cumulative shields cost = sum(shielding 1..4) + sum(glacialShielding 1..2)
// Cumulative armor cost = sum(armor 1..6)
// We set costs so armor wins (larger cumulative)
// shielding baseCost: minerai=200, silicium=600, hydrogene=0, factor=2
// armor baseCost: minerai=1000, silicium=0, hydrogene=0, factor=2
// Let's compute expected values
function computeShieldsTotal() {
  const s1 = sumCosts(200, 600, 0, 2, 4); // shielding l1..4
  const s2 = sumCosts(200, 600, 0, 2, 2); // glacialShielding l1..2
  return {
    minerai: s1.minerai + s2.minerai,
    silicium: s1.silicium + s2.silicium,
    hydrogene: 0,
  };
}

const PLANET_TYPE_ID = 't6_homeworld_type';

// ── Setup / Teardown ────────────────────────────────────────────────────────

beforeAll(async () => {
  // Clean up from any prior run
  await testDb.delete(userResearchChoices).where(inArray(userResearchChoices.userId, [USER_A, USER_B, USER_C, USER_D]));
  await testDb.delete(userResearchLevels).where(inArray(userResearchLevels.userId, [USER_A, USER_B, USER_C, USER_D]));
  await testDb.delete(planets).where(inArray(planets.id, [PLANET_A, PLANET_B, PLANET_D]));
  await testDb.delete(users).where(inArray(users.id, [USER_A, USER_B, USER_C, USER_D]));
  await testDb.delete(researchDefinitions).where(
    inArray(researchDefinitions.id, [RES_SHIELDING, RES_GLACIAL, RES_ARMOR, RES_ARID]),
  );
  await testDb.delete(planetTypes).where(eq(planetTypes.id, PLANET_TYPE_ID));

  // Seed a planet type so the FK passes
  await testDb.insert(planetTypes).values({
    id: PLANET_TYPE_ID,
    name: 'T6 Homeworld',
    positions: [],
    diameterMin: 10000,
    diameterMax: 14000,
  });

  // Insert users
  await testDb.insert(users).values([
    { id: USER_A, email: 't6-user-a@exilium.test', username: 't6_user_a', passwordHash: 'x' },
    { id: USER_B, email: 't6-user-b@exilium.test', username: 't6_user_b', passwordHash: 'x' },
    { id: USER_C, email: 't6-user-c@exilium.test', username: 't6_user_c', passwordHash: 'x' }, // no homeworld
    { id: USER_D, email: 't6-user-d@exilium.test', username: 't6_user_d', passwordHash: 'x' }, // for phase-multiplier test
  ]);

  // Insert homeworld planets (planetClassId = PLANET_TYPE_ID)
  // The migration script will detect homeworld by planetClassId = 'homeworld'.
  // For the test, we use a custom type ID and pass it explicitly to the migration function.
  // USER_C intentionally has no homeworld planet.
  await testDb.insert(planets).values([
    {
      id: PLANET_A,
      userId: USER_A,
      name: 'HomeA',
      galaxy: 9,
      system: 999,
      position: 6,
      planetClassId: PLANET_TYPE_ID,
      diameter: 10000,
      minTemp: 0,
      maxTemp: 50,
      minerai: '500',
      silicium: '500',
      hydrogene: '0',
    },
    {
      id: PLANET_B,
      userId: USER_B,
      name: 'HomeB',
      galaxy: 9,
      system: 999,
      position: 7,
      planetClassId: PLANET_TYPE_ID,
      diameter: 10000,
      minTemp: 0,
      maxTemp: 50,
      minerai: '500',
      silicium: '500',
      hydrogene: '0',
    },
    {
      id: PLANET_D,
      userId: USER_D,
      name: 'HomeD',
      galaxy: 9,
      system: 999,
      position: 8,
      planetClassId: PLANET_TYPE_ID,
      diameter: 10000,
      minTemp: 0,
      maxTemp: 50,
      minerai: '500',
      silicium: '500',
      hydrogene: '0',
    },
  ]);

  // Insert minimal research definitions for the fork
  await testDb.insert(researchDefinitions).values([
    {
      id: RES_SHIELDING,
      name: 'T6 Shielding',
      description: '',
      levelColumn: RES_SHIELDING,
      baseCostMinerai: 200,
      baseCostSilicium: 600,
      baseCostHydrogene: 0,
      costFactor: 2,
      forkId: FORK_ID,
      forkPath: PATH_SHIELDS,
    },
    {
      id: RES_GLACIAL,
      name: 'T6 GlacialShielding',
      description: '',
      levelColumn: RES_GLACIAL,
      baseCostMinerai: 200,
      baseCostSilicium: 600,
      baseCostHydrogene: 0,
      costFactor: 2,
      forkId: FORK_ID,
      forkPath: PATH_SHIELDS,
    },
    {
      id: RES_ARMOR,
      name: 'T6 Armor',
      description: '',
      levelColumn: RES_ARMOR,
      baseCostMinerai: 1000,
      baseCostSilicium: 0,
      baseCostHydrogene: 0,
      costFactor: 2,
      forkId: FORK_ID,
      forkPath: PATH_ARMOR,
    },
    {
      id: RES_ARID,
      name: 'T6 AridArmor',
      description: '',
      levelColumn: RES_ARID,
      baseCostMinerai: 200,
      baseCostSilicium: 600,
      baseCostHydrogene: 0,
      costFactor: 2,
      forkId: FORK_ID,
      forkPath: PATH_ARMOR,
    },
  ]);

  // USER_A: shielding=4, glacialShielding=2 (shields path) AND armor=6 (armor path)
  await testDb.insert(userResearchLevels).values([
    { userId: USER_A, researchId: RES_SHIELDING, level: 4 },
    { userId: USER_A, researchId: RES_GLACIAL, level: 2 },
    { userId: USER_A, researchId: RES_ARMOR, level: 6 },
  ]);

  // USER_B: shielding=3 only (shields path)
  await testDb.insert(userResearchLevels).values([
    { userId: USER_B, researchId: RES_SHIELDING, level: 3 },
  ]);

  // USER_C: both paths invested, but no homeworld (test d)
  await testDb.insert(userResearchLevels).values([
    { userId: USER_C, researchId: RES_SHIELDING, level: 2 },
    { userId: USER_C, researchId: RES_ARMOR, level: 3 },
  ]);

  // USER_D: both paths invested, has homeworld — used to test phase-multiplier effect (test e)
  await testDb.insert(userResearchLevels).values([
    { userId: USER_D, researchId: RES_SHIELDING, level: 3 },
    { userId: USER_D, researchId: RES_ARMOR, level: 4 },
  ]);
});

afterAll(async () => {
  await testDb.delete(userResearchChoices).where(inArray(userResearchChoices.userId, [USER_A, USER_B, USER_C, USER_D]));
  await testDb.delete(userResearchLevels).where(inArray(userResearchLevels.userId, [USER_A, USER_B, USER_C, USER_D]));
  await testDb.delete(planets).where(inArray(planets.id, [PLANET_A, PLANET_B, PLANET_D]));
  await testDb.delete(users).where(inArray(users.id, [USER_A, USER_B, USER_C, USER_D]));
  await testDb.delete(researchDefinitions).where(
    inArray(researchDefinitions.id, [RES_SHIELDING, RES_GLACIAL, RES_ARMOR, RES_ARID]),
  );
  await testDb.delete(planetTypes).where(eq(planetTypes.id, PLANET_TYPE_ID));
  // Clean up any test universe_config rows inserted during tests
  await testDb.delete(universeConfig).where(eq(universeConfig.key, 't6_test_phase_multiplier'));
  await closeTestDb();
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe('migrateResearchForks', () => {
  it('(f) pre-flight guard: throws when no forked research_definitions exist', async () => {
    const { migrateResearchForks } = await import('../../../scripts/migrate-research-forks.js');

    // Temporarily clear all fork columns by using a fake forkId scope that has
    // no rows in research_definitions with fork_id IS NOT NULL.
    // The guard queries the FULL table (not scoped), so we need to actually have
    // an empty table.  We achieve isolation by deleting our test rows, running the
    // guard, then verifying it throws before we restore them in afterAll.
    // To avoid disrupting other tests, we run this in a transaction that we roll back.
    let caughtError: Error | undefined;
    try {
      await testDb.transaction(async (tx) => {
        // Remove all fork-tagged rows so the count lands at 0
        await tx
          .update(researchDefinitions)
          .set({ forkId: null, forkPath: null })
          .where(
            inArray(researchDefinitions.id, [RES_SHIELDING, RES_GLACIAL, RES_ARMOR, RES_ARID]),
          );

        // Now the guard should fire and throw
        // tx is DbOrTx — migrateResearchForks accepts DbOrTx
        await migrateResearchForks(tx, {
          userIds: [USER_A],
          forkIds: [FORK_ID],
          researchIds: [RES_SHIELDING, RES_GLACIAL, RES_ARMOR, RES_ARID],
          homeworldClassId: PLANET_TYPE_ID,
        });

        // If we reach here, force the tx to roll back anyway
        throw new Error('__ROLLBACK__');
      });
    } catch (err) {
      if (err instanceof Error && err.message !== '__ROLLBACK__') {
        caughtError = err;
      }
      // __ROLLBACK__ sentinel means the guard did NOT throw — caughtError stays undefined
    }

    expect(caughtError).toBeDefined();
    expect(caughtError!.message).toMatch(/not seeded/i);
  });

  it('(a) both-paths: armor wins (more cumulative resources), shields levels zeroed, refund on homeworld', async () => {
    const { migrateResearchForks } = await import('../../../scripts/migrate-research-forks.js');

    // Run migration with only USER_A and USER_B as targets, and only our test fork
    await migrateResearchForks(testDb, {
      userIds: [USER_A, USER_B],
      forkIds: [FORK_ID],
      researchIds: [RES_SHIELDING, RES_GLACIAL, RES_ARMOR, RES_ARID],
      homeworldClassId: PLANET_TYPE_ID,
    });

    // USER_A: armor has more cumulative resources → chosen
    const [choiceA] = await testDb
      .select()
      .from(userResearchChoices)
      .where(and(eq(userResearchChoices.userId, USER_A), eq(userResearchChoices.forkId, FORK_ID)));
    expect(choiceA).toBeDefined();
    expect(choiceA.chosenPath).toBe(PATH_ARMOR);
    expect(choiceA.respecCount).toBe(0);

    // Shields path levels should be zeroed
    const [shieldingRow] = await testDb
      .select()
      .from(userResearchLevels)
      .where(and(eq(userResearchLevels.userId, USER_A), eq(userResearchLevels.researchId, RES_SHIELDING)));
    expect(shieldingRow?.level ?? 0).toBe(0);

    const [glacialRow] = await testDb
      .select()
      .from(userResearchLevels)
      .where(and(eq(userResearchLevels.userId, USER_A), eq(userResearchLevels.researchId, RES_GLACIAL)));
    expect(glacialRow?.level ?? 0).toBe(0);

    // Armor path levels should remain
    const [armorRow] = await testDb
      .select()
      .from(userResearchLevels)
      .where(and(eq(userResearchLevels.userId, USER_A), eq(userResearchLevels.researchId, RES_ARMOR)));
    expect(armorRow?.level ?? 0).toBe(6);

    // Refund credited to homeworld
    const shieldsRefund = computeShieldsTotal();
    const [planetARow] = await testDb
      .select({ minerai: planets.minerai, silicium: planets.silicium, hydrogene: planets.hydrogene })
      .from(planets)
      .where(eq(planets.id, PLANET_A));

    expect(Number(planetARow.minerai)).toBe(500 + shieldsRefund.minerai);
    expect(Number(planetARow.silicium)).toBe(500 + shieldsRefund.silicium);
    expect(Number(planetARow.hydrogene)).toBe(0 + shieldsRefund.hydrogene);
  });

  it('(b) one-path (shields only): chosenPath = shields, no refund, levels untouched', async () => {
    // USER_B should already have been migrated in the previous test
    const [choiceB] = await testDb
      .select()
      .from(userResearchChoices)
      .where(and(eq(userResearchChoices.userId, USER_B), eq(userResearchChoices.forkId, FORK_ID)));
    expect(choiceB).toBeDefined();
    expect(choiceB.chosenPath).toBe(PATH_SHIELDS);
    expect(choiceB.respecCount).toBe(0);

    // Shielding level remains 3 (no refund, no zeroing)
    const [shieldingRowB] = await testDb
      .select()
      .from(userResearchLevels)
      .where(and(eq(userResearchLevels.userId, USER_B), eq(userResearchLevels.researchId, RES_SHIELDING)));
    expect(shieldingRowB?.level ?? 0).toBe(3);

    // Planet B resources unchanged
    const [planetBRow] = await testDb
      .select({ minerai: planets.minerai, silicium: planets.silicium })
      .from(planets)
      .where(eq(planets.id, PLANET_B));
    expect(Number(planetBRow.minerai)).toBe(500);
    expect(Number(planetBRow.silicium)).toBe(500);
  });

  it('(c) idempotent re-run: no error, choices unchanged, levels unchanged', async () => {
    const { migrateResearchForks } = await import('../../../scripts/migrate-research-forks.js');

    // Run again — should be a no-op
    await migrateResearchForks(testDb, {
      userIds: [USER_A, USER_B],
      forkIds: [FORK_ID],
      researchIds: [RES_SHIELDING, RES_GLACIAL, RES_ARMOR, RES_ARID],
      homeworldClassId: PLANET_TYPE_ID,
    });

    // USER_A: still armor
    const [choiceA] = await testDb
      .select()
      .from(userResearchChoices)
      .where(and(eq(userResearchChoices.userId, USER_A), eq(userResearchChoices.forkId, FORK_ID)));
    expect(choiceA.chosenPath).toBe(PATH_ARMOR);

    // USER_A shields still zeroed (not re-set)
    const [shieldingRow] = await testDb
      .select()
      .from(userResearchLevels)
      .where(and(eq(userResearchLevels.userId, USER_A), eq(userResearchLevels.researchId, RES_SHIELDING)));
    expect(shieldingRow?.level ?? 0).toBe(0);

    // Planet A resources not double-refunded
    const shieldsRefund = computeShieldsTotal();
    const [planetARow] = await testDb
      .select({ minerai: planets.minerai, silicium: planets.silicium })
      .from(planets)
      .where(eq(planets.id, PLANET_A));
    // Still 500 + refund (not 500 + 2*refund)
    expect(Number(planetARow.minerai)).toBe(500 + shieldsRefund.minerai);
    expect(Number(planetARow.silicium)).toBe(500 + shieldsRefund.silicium);
  });

  it('(d) both-paths + no homeworld: atomic skip — no choice row, levels unchanged, userId in needsManualFollowUp', async () => {
    const { migrateResearchForks } = await import('../../../scripts/migrate-research-forks.js');

    // USER_C has both shields(2) and armor(3) invested, but no homeworld planet
    const result = await migrateResearchForks(testDb, {
      userIds: [USER_C],
      forkIds: [FORK_ID],
      researchIds: [RES_SHIELDING, RES_GLACIAL, RES_ARMOR, RES_ARID],
      homeworldClassId: PLANET_TYPE_ID,
    });

    // Must appear in the follow-up list
    expect(result.needsManualFollowUp).toContain(USER_C);

    // No choice row inserted
    const choiceC = await testDb
      .select()
      .from(userResearchChoices)
      .where(and(eq(userResearchChoices.userId, USER_C), eq(userResearchChoices.forkId, FORK_ID)));
    expect(choiceC).toHaveLength(0);

    // Levels must be UNCHANGED (not zeroed)
    const [shieldingC] = await testDb
      .select()
      .from(userResearchLevels)
      .where(and(eq(userResearchLevels.userId, USER_C), eq(userResearchLevels.researchId, RES_SHIELDING)));
    expect(shieldingC?.level ?? 0).toBe(2); // unchanged

    const [armorC] = await testDb
      .select()
      .from(userResearchLevels)
      .where(and(eq(userResearchLevels.userId, USER_C), eq(userResearchLevels.researchId, RES_ARMOR)));
    expect(armorC?.level ?? 0).toBe(3); // unchanged

    // Re-run must still skip (same behaviour — idempotent skip when not yet committed)
    const result2 = await migrateResearchForks(testDb, {
      userIds: [USER_C],
      forkIds: [FORK_ID],
      researchIds: [RES_SHIELDING, RES_GLACIAL, RES_ARMOR, RES_ARID],
      homeworldClassId: PLANET_TYPE_ID,
    });
    expect(result2.needsManualFollowUp).toContain(USER_C);
    const choiceC2 = await testDb
      .select()
      .from(userResearchChoices)
      .where(and(eq(userResearchChoices.userId, USER_C), eq(userResearchChoices.forkId, FORK_ID)));
    expect(choiceC2).toHaveLength(0);
  });

  it('(e) tuned phase_multiplier in universe_config changes the refund amount', async () => {
    const { migrateResearchForks } = await import('../../../scripts/migrate-research-forks.js');

    // Seed a flat phase_multiplier (all levels = 1.0) into universe_config.
    // With this map every level costs exactly floor(baseCost * factor^(level-1)).
    // USER_D: shielding=3, armor=4 → armor total > shields total → armor wins → shields refunded.
    const flatPhaseMap = { '1': 1.0, '2': 1.0, '3': 1.0, '4': 1.0, '5': 1.0, '6': 1.0, '7': 1.0 };

    // Upsert the phase multiplier so the script reads it
    await testDb
      .insert(universeConfig)
      .values({ key: 'phase_multiplier', value: flatPhaseMap })
      .onConflictDoUpdate({ target: universeConfig.key, set: { value: flatPhaseMap } });

    // Compute expected refund with flat multiplier (shields path, shielding l1..3)
    // floor(200 * 1^(l-1)) * 1.0 for minerai; floor(600 * 1^(l-1)) * 1.0 for silicium
    // l=1: factor=1^0*1=1 → m=200, s=600
    // l=2: factor=2^1*1=2 → m=400, s=1200
    // l=3: factor=2^2*1=4 → m=800, s=2400
    // total shields = m: 1400, s: 4200
    const expectedMineraiRefund = 1400;
    const expectedSiliciumRefund = 4200;

    // Contrast: with default phase map (0.35 at l=1) the refund would be much less
    // (floor(200*0.35)=70, floor(200*2*0.45)=180, floor(200*4*0.55)=440 → total 690)
    // Verifying the flat-map refund amount proves the script uses the configured map.

    const result = await migrateResearchForks(testDb, {
      userIds: [USER_D],
      forkIds: [FORK_ID],
      researchIds: [RES_SHIELDING, RES_GLACIAL, RES_ARMOR, RES_ARID],
      homeworldClassId: PLANET_TYPE_ID,
    });

    // No follow-up needed (has homeworld)
    expect(result.needsManualFollowUp).not.toContain(USER_D);

    // Choice row inserted: armor wins (armor=4 levels with baseCostMinerai=1000 > shields)
    const [choiceD] = await testDb
      .select()
      .from(userResearchChoices)
      .where(and(eq(userResearchChoices.userId, USER_D), eq(userResearchChoices.forkId, FORK_ID)));
    expect(choiceD).toBeDefined();
    expect(choiceD.chosenPath).toBe(PATH_ARMOR);

    // Shields levels zeroed
    const [shieldingD] = await testDb
      .select()
      .from(userResearchLevels)
      .where(and(eq(userResearchLevels.userId, USER_D), eq(userResearchLevels.researchId, RES_SHIELDING)));
    expect(shieldingD?.level ?? 0).toBe(0);

    // Refund on planet D matches the flat-phase-map calculation
    const [planetDRow] = await testDb
      .select({ minerai: planets.minerai, silicium: planets.silicium })
      .from(planets)
      .where(eq(planets.id, PLANET_D));
    expect(Number(planetDRow.minerai)).toBe(500 + expectedMineraiRefund);
    expect(Number(planetDRow.silicium)).toBe(500 + expectedSiliciumRefund);

    // Restore: remove the test phase_multiplier so we don't pollute other tests
    await testDb.delete(universeConfig).where(eq(universeConfig.key, 'phase_multiplier'));
  });
});
