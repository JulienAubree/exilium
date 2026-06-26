/**
 * Test d'intégration — migrate-research-forks (Task 6)
 *
 * Vérifie :
 *   (a) both-paths → dominant wins (armor > shields by cost), losing path levels → 0,
 *       refund credited to homeworld, respecCount = 0
 *   (b) one-path (shields only) → chosenPath = shields, no refund
 *   (c) idempotent re-run → no-op (existing choice row skipped)
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
} from '@exilium/db';
import { testDb, closeTestDb } from '../../../test/test-db.js';

// ── Unique IDs ──────────────────────────────────────────────────────────────

const USER_A = '00000000-0000-0000-0001-000000000006'; // both paths invested
const USER_B = '00000000-0000-0000-0002-000000000006'; // one path (shields) only

const PLANET_A = '10000000-0000-0000-0001-000000000006';
const PLANET_B = '10000000-0000-0000-0002-000000000006';

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

// Test research definitions (minimally seeded)
const BASE_COST_MINERAI = 200;
const BASE_COST_SILICIUM = 600;
const BASE_COST_HYDROGENE = 0;
const COST_FACTOR = 2;

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
function computeArmorTotal() {
  return sumCosts(1000, 0, 0, 2, 6); // armor l1..6
}

const PLANET_TYPE_ID = 't6_homeworld_type';

// ── Setup / Teardown ────────────────────────────────────────────────────────

beforeAll(async () => {
  // Clean up from any prior run
  await testDb.delete(userResearchChoices).where(inArray(userResearchChoices.userId, [USER_A, USER_B]));
  await testDb.delete(userResearchLevels).where(inArray(userResearchLevels.userId, [USER_A, USER_B]));
  await testDb.delete(planets).where(inArray(planets.id, [PLANET_A, PLANET_B]));
  await testDb.delete(users).where(inArray(users.id, [USER_A, USER_B]));
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
  ]);

  // Insert homeworld planets (planetClassId = PLANET_TYPE_ID)
  // The migration script will detect homeworld by planetClassId = 'homeworld'.
  // For the test, we use a custom type ID and pass it explicitly to the migration function.
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
});

afterAll(async () => {
  await testDb.delete(userResearchChoices).where(inArray(userResearchChoices.userId, [USER_A, USER_B]));
  await testDb.delete(userResearchLevels).where(inArray(userResearchLevels.userId, [USER_A, USER_B]));
  await testDb.delete(planets).where(inArray(planets.id, [PLANET_A, PLANET_B]));
  await testDb.delete(users).where(inArray(users.id, [USER_A, USER_B]));
  await testDb.delete(researchDefinitions).where(
    inArray(researchDefinitions.id, [RES_SHIELDING, RES_GLACIAL, RES_ARMOR, RES_ARID]),
  );
  await testDb.delete(planetTypes).where(eq(planetTypes.id, PLANET_TYPE_ID));
  await closeTestDb();
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe('migrateResearchForks', () => {
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
});
