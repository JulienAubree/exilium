/**
 * migrate-research-forks.ts — one-time migration script (Task 6, Research S1)
 *
 * Converts existing players to the new exclusive fork system.
 * For each user × fork combination that has existing investment in user_research_levels:
 *
 *   - One path invested  → set user_research_choices.chosenPath = that path, no refund.
 *   - Both paths invested → chosen = path with greater cumulative resource cost;
 *                           tie-break = first path listed (deterministic);
 *                           zero losing-path levels; refund losing-path resources to homeworld;
 *                           respecCount = 0.
 *   - Neither invested   → no row inserted (player chooses freely later).
 *
 * Idempotent: any fork already present in user_research_choices is skipped.
 *
 * Conflict forks processed:
 *   defense_doctrine  — shields: [shielding, glacialShielding] / armor: [armor, aridArmor]
 *   intel_warfare     — detection: [sensorNetwork] / stealth: [stealthTech]
 *   economy_yield     — production: [temperateProduction] / efficiency: [semiconductors]
 *
 * armament_spec is new content → no existing investment → skipped.
 *
 * Run manually at deploy (NOT via apply-migrations.sh):
 *   pnpm --filter @exilium/api migrate:forks
 *   or: cd apps/api && npx tsx src/scripts/migrate-research-forks.ts
 */

import { eq, and, inArray, sql } from 'drizzle-orm';
import {
  type Database,
  createDb,
  userResearchLevels,
  userResearchChoices,
  researchDefinitions,
  planets,
  users,
} from '@exilium/db';
import { researchCost } from '@exilium/game-engine';

// ── Fork registry ──────────────────────────────────────────────────────────

/**
 * Ordered list of paths per fork.
 * Order matters: first path wins in case of a tie.
 */
export const CONFLICT_FORKS: Array<{
  forkId: string;
  paths: string[]; // ordered; first = wins tie
}> = [
  { forkId: 'defense_doctrine', paths: ['shields', 'armor'] },
  { forkId: 'intel_warfare', paths: ['detection', 'stealth'] },
  { forkId: 'economy_yield', paths: ['production', 'efficiency'] },
];

// ── Types ──────────────────────────────────────────────────────────────────

export interface MigrateForkOptions {
  /**
   * Limit migration to specific user IDs (default: all users in DB).
   * Useful for tests or partial rollouts.
   */
  userIds?: string[];
  /**
   * Limit migration to specific fork IDs (default: all CONFLICT_FORKS).
   * Useful for tests.
   */
  forkIds?: string[];
  /**
   * Limit the set of researchDefinitions loaded (default: all in DB with a forkId).
   * Useful for tests that seed fake research IDs.
   */
  researchIds?: string[];
  /**
   * The planetClassId that identifies a homeworld (default: 'homeworld').
   * Tests may pass a custom value since planet_types is empty in exilium_test.
   */
  homeworldClassId?: string;
  /** Set to true to log progress to stdout (default: false in library mode). */
  verbose?: boolean;
}

// ── Core function (exported for testing) ──────────────────────────────────

/**
 * Runs the fork migration on the provided database connection.
 *
 * @param db - Drizzle database instance (can be a transaction or top-level connection).
 * @param opts - Optional scoping options (for tests or partial runs).
 */
export async function migrateResearchForks(
  db: Database,
  opts: MigrateForkOptions = {},
): Promise<void> {
  const homeworldClassId = opts.homeworldClassId ?? 'homeworld';
  const verbose = opts.verbose ?? false;

  const log = verbose ? console.log : () => {};

  // ── 1. Load all relevant research definitions ────────────────────────────
  //
  // We load only forks in CONFLICT_FORKS (or the forkIds subset for tests).

  const activeForks = CONFLICT_FORKS.filter(
    (f) => !opts.forkIds || opts.forkIds.includes(f.forkId),
  );
  const activeForkIds = activeForks.map((f) => f.forkId);

  let defQuery = db
    .select({
      id: researchDefinitions.id,
      forkId: researchDefinitions.forkId,
      forkPath: researchDefinitions.forkPath,
      baseCostMinerai: researchDefinitions.baseCostMinerai,
      baseCostSilicium: researchDefinitions.baseCostSilicium,
      baseCostHydrogene: researchDefinitions.baseCostHydrogene,
      costFactor: researchDefinitions.costFactor,
    })
    .from(researchDefinitions)
    .where(
      and(
        inArray(researchDefinitions.forkId, activeForkIds),
        ...(opts.researchIds ? [inArray(researchDefinitions.id, opts.researchIds)] : []),
      ),
    );

  const defs = await defQuery;

  // Index: forkId → path → list of research defs
  const forkPathDefs: Record<string, Record<string, typeof defs>> = {};
  for (const def of defs) {
    if (!def.forkId || !def.forkPath) continue;
    forkPathDefs[def.forkId] ??= {};
    forkPathDefs[def.forkId][def.forkPath] ??= [];
    forkPathDefs[def.forkId][def.forkPath].push(def);
  }

  // ── 2. Load target users ─────────────────────────────────────────────────

  const allUserIds: string[] = opts.userIds
    ? opts.userIds
    : (await db.select({ id: users.id }).from(users)).map((u) => u.id);

  if (allUserIds.length === 0) {
    log('[migrate-forks] No users found — nothing to do.');
    return;
  }

  log(`[migrate-forks] Processing ${allUserIds.length} user(s), ${activeForks.length} fork(s).`);

  // ── 3. Load existing research levels for all target users ────────────────

  const allResearchIds = defs.map((d) => d.id);

  const levels = allResearchIds.length > 0
    ? await db
        .select({
          userId: userResearchLevels.userId,
          researchId: userResearchLevels.researchId,
          level: userResearchLevels.level,
        })
        .from(userResearchLevels)
        .where(
          and(
            inArray(userResearchLevels.userId, allUserIds),
            inArray(userResearchLevels.researchId, allResearchIds),
          ),
        )
    : [];

  // Index: userId → researchId → level
  const levelMap: Record<string, Record<string, number>> = {};
  for (const row of levels) {
    levelMap[row.userId] ??= {};
    levelMap[row.userId][row.researchId] = row.level;
  }

  // ── 4. Load existing fork choices (for idempotency) ─────────────────────

  const existingChoices = await db
    .select({
      userId: userResearchChoices.userId,
      forkId: userResearchChoices.forkId,
    })
    .from(userResearchChoices)
    .where(
      and(
        inArray(userResearchChoices.userId, allUserIds),
        inArray(userResearchChoices.forkId, activeForkIds),
      ),
    );

  // Set: "userId:forkId" → already chosen
  const alreadyChosen = new Set<string>(
    existingChoices.map((c) => `${c.userId}:${c.forkId}`),
  );

  // ── 5. Load homeworld planets ────────────────────────────────────────────

  const homeworldRows = await db
    .select({ id: planets.id, userId: planets.userId, minerai: planets.minerai, silicium: planets.silicium, hydrogene: planets.hydrogene })
    .from(planets)
    .where(
      and(
        inArray(planets.userId, allUserIds),
        eq(planets.planetClassId, homeworldClassId),
      ),
    );

  // Index: userId → homeworld planet row
  const homeworldMap: Record<string, typeof homeworldRows[0]> = {};
  for (const p of homeworldRows) {
    homeworldMap[p.userId] = p;
  }

  // ── 6. Process each user × fork ─────────────────────────────────────────

  for (const userId of allUserIds) {
    const userLevels = levelMap[userId] ?? {};

    for (const fork of activeForks) {
      const { forkId, paths } = fork;

      // Skip if already chosen (idempotency)
      if (alreadyChosen.has(`${userId}:${forkId}`)) {
        log(`[migrate-forks] ${userId} / ${forkId} — already chosen, skipping.`);
        continue;
      }

      const pathDefs = forkPathDefs[forkId] ?? {};

      // Compute cumulative investment per path
      const pathCosts: Record<string, { minerai: number; silicium: number; hydrogene: number; total: number; hasInvestment: boolean }> = {};

      for (const path of paths) {
        const defsForPath = pathDefs[path] ?? [];
        let minerai = 0, silicium = 0, hydrogene = 0;
        let hasInvestment = false;

        for (const def of defsForPath) {
          const level = userLevels[def.id] ?? 0;
          if (level > 0) {
            hasInvestment = true;
            for (let l = 1; l <= level; l++) {
              const cost = researchCost(
                {
                  baseCost: {
                    minerai: def.baseCostMinerai,
                    silicium: def.baseCostSilicium,
                    hydrogene: def.baseCostHydrogene,
                  },
                  costFactor: def.costFactor,
                },
                l,
                // No phaseMap → uses default phase multipliers from game-engine
              );
              minerai += cost.minerai;
              silicium += cost.silicium;
              hydrogene += cost.hydrogene;
            }
          }
        }

        pathCosts[path] = {
          minerai,
          silicium,
          hydrogene,
          total: minerai + silicium + hydrogene,
          hasInvestment,
        };
      }

      const investedPaths = paths.filter((p) => pathCosts[p]?.hasInvestment);

      // Neither path invested → skip (player will choose freely)
      if (investedPaths.length === 0) {
        log(`[migrate-forks] ${userId} / ${forkId} — no investment on either path, skipping.`);
        continue;
      }

      let chosenPath: string;
      let losingPath: string | null = null;

      if (investedPaths.length === 1) {
        // Single path invested → auto-choose, no refund
        chosenPath = investedPaths[0];
        log(`[migrate-forks] ${userId} / ${forkId} — single path (${chosenPath}), setting choice.`);
      } else {
        // Both paths invested → dominant wins by total resource cost
        // Tie-break: first path in `paths` array (deterministic)
        let dominant = paths[0];
        for (const p of paths.slice(1)) {
          if ((pathCosts[p]?.total ?? 0) > (pathCosts[dominant]?.total ?? 0)) {
            dominant = p;
          }
        }
        chosenPath = dominant;
        losingPath = paths.find((p) => p !== chosenPath) ?? null;
        log(
          `[migrate-forks] ${userId} / ${forkId} — both paths invested: ` +
          `${chosenPath}=${pathCosts[chosenPath]?.total} wins over ${losingPath}=${pathCosts[losingPath ?? '']?.total}.`,
        );
      }

      // ── Mutations ──────────────────────────────────────────────────────

      await db.transaction(async (tx) => {
        // Insert fork choice
        await tx.insert(userResearchChoices).values({
          userId,
          forkId,
          chosenPath,
          respecCount: 0,
        });

        if (losingPath !== null) {
          // Zero out losing path's research levels
          const losingResearchIds = (pathDefs[losingPath] ?? []).map((d) => d.id);
          if (losingResearchIds.length > 0) {
            await tx
              .update(userResearchLevels)
              .set({ level: 0 })
              .where(
                and(
                  eq(userResearchLevels.userId, userId),
                  inArray(userResearchLevels.researchId, losingResearchIds),
                ),
              );
          }

          // Refund losing path's cumulative resources to homeworld
          const homeworld = homeworldMap[userId];
          if (homeworld) {
            const refund = pathCosts[losingPath];
            await tx
              .update(planets)
              .set({
                minerai: sql`${planets.minerai} + ${refund.minerai}`,
                silicium: sql`${planets.silicium} + ${refund.silicium}`,
                hydrogene: sql`${planets.hydrogene} + ${refund.hydrogene}`,
              })
              .where(eq(planets.id, homeworld.id));
            log(`[migrate-forks] ${userId} / ${forkId} — refunded ${refund.minerai}M/${refund.silicium}S/${refund.hydrogene}H to planet ${homeworld.id}.`);
          } else {
            log(`[migrate-forks] WARNING: ${userId} has no homeworld (${homeworldClassId}), refund skipped.`);
          }
        }
      });
    }
  }

  log('[migrate-forks] Done.');
}

// ── CLI entry-point ────────────────────────────────────────────────────────

/**
 * When executed directly (tsx src/scripts/migrate-research-forks.ts),
 * connects to DATABASE_URL and runs the full migration.
 */
if (process.argv[1]?.endsWith('migrate-research-forks.ts') || process.argv[1]?.endsWith('migrate-research-forks.js')) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('[migrate-forks] ERROR: DATABASE_URL environment variable is not set.');
    process.exit(1);
  }

  const db = createDb(databaseUrl);

  console.log('[migrate-forks] Starting research fork migration…');
  console.log(`[migrate-forks] Target DB: ${databaseUrl.replace(/:[^:@]*@/, ':***@')}`);

  migrateResearchForks(db, { verbose: true })
    .then(() => {
      console.log('[migrate-forks] Migration complete.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[migrate-forks] FATAL:', err);
      process.exit(1);
    });
}
