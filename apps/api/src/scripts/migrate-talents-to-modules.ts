/**
 * One-off script: migrate from talents to modules.
 *
 * Steps:
 *   1. Seed module_definitions from DEFAULT_MODULES (idempotent via ON CONFLICT)
 *   2. Refund Exilium for each flagship based on talent ranks × tier cost
 *   3. Insert 1 starter common module per flagship (matching their hull)
 *   4. Set _migrations_state.flagship_modules_refund = 'done' (idempotence)
 *
 * Usage:
 *   pnpm --filter @exilium/api tsx src/scripts/migrate-talents-to-modules.ts
 *
 * Safe to re-run : the marker prevents double-refund. Module seed uses
 * ON CONFLICT DO UPDATE. Starter pack uses ON CONFLICT DO NOTHING.
 */
import { sql, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {
  flagships, flagshipModuleInventory, moduleDefinitions, userExilium, exiliumLog,
} from '@exilium/db';
import { DEFAULT_MODULES, STARTER_MODULES_BY_HULL } from '../modules/modules/default-modules.seed.js';
import { moduleDefinitionSchema } from '../modules/modules/modules.types.js';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  try {
    // ── Idempotence check ─────────────────────────────────────────────────
    const [existing] = await db.execute<{ value: string }>(sql`
      SELECT value FROM _migrations_state WHERE key = 'flagship_modules_refund' LIMIT 1
    `);
    if (existing && existing.value === 'done') {
      console.log('✓ Migration already applied (marker present). Skipping refund + starter.');
    }

    // ── Step 1: seed modules ───────────────────────────────────────────────
    console.log(`Seeding ${DEFAULT_MODULES.length} modules...`);
    for (const m of DEFAULT_MODULES) {
      const parsed = moduleDefinitionSchema.parse(m);
      await db.insert(moduleDefinitions).values(parsed).onConflictDoUpdate({
        target: moduleDefinitions.id,
        set: {
          hullId: parsed.hullId, rarity: parsed.rarity, name: parsed.name,
          description: parsed.description, image: parsed.image,
          enabled: parsed.enabled, effect: parsed.effect,
        },
      });
    }
    console.log('✓ Modules seeded');

    if (existing && existing.value === 'done') {
      await client.end();
      return;
    }

    // ── Step 2: refund Exilium ─────────────────────────────────────────────
    console.log('Computing Exilium refund per flagship...');
    const refunds = await db.execute<{ flagship_id: string; user_id: string; total_exilium: number }>(sql`
      SELECT
        f.id AS flagship_id,
        f.user_id,
        COALESCE(SUM(ft.current_rank * (
          CASE td.tier
            WHEN 1 THEN COALESCE((SELECT value::int FROM universe_config WHERE key='talent_cost_tier_1'), 1)
            WHEN 2 THEN COALESCE((SELECT value::int FROM universe_config WHERE key='talent_cost_tier_2'), 2)
            WHEN 3 THEN COALESCE((SELECT value::int FROM universe_config WHERE key='talent_cost_tier_3'), 3)
            WHEN 4 THEN COALESCE((SELECT value::int FROM universe_config WHERE key='talent_cost_tier_4'), 4)
            WHEN 5 THEN COALESCE((SELECT value::int FROM universe_config WHERE key='talent_cost_tier_5'), 5)
            ELSE 1
          END
        )), 0) AS total_exilium
      FROM flagships f
      LEFT JOIN flagship_talents ft ON ft.flagship_id = f.id AND ft.current_rank > 0
      LEFT JOIN talent_definitions td ON td.id = ft.talent_id
      GROUP BY f.id, f.user_id
    `);

    let totalRefunded = 0;
    let countRefunded = 0;
    for (const row of refunds) {
      if (row.total_exilium <= 0) continue;
      await db.transaction(async (tx) => {
        await tx.update(userExilium).set({
          balance: sql`${userExilium.balance} + ${row.total_exilium}`,
          totalEarned: sql`${userExilium.totalEarned} + ${row.total_exilium}`,
          updatedAt: new Date(),
        }).where(eq(userExilium.userId, row.user_id));
        await tx.insert(exiliumLog).values({
          userId: row.user_id,
          amount: row.total_exilium,
          source: 'talent_refund',
          details: { flagshipId: row.flagship_id, computedExilium: row.total_exilium },
        });
      });
      totalRefunded += row.total_exilium;
      countRefunded++;
    }
    console.log(`✓ Refunded ${totalRefunded} Exilium across ${countRefunded} flagships`);

    // ── Step 3: starter pack ───────────────────────────────────────────────
    console.log('Inserting starter modules...');
    const allFlagships = await db.select({ id: flagships.id, hullId: flagships.hullId })
      .from(flagships).where(sql`${flagships.hullId} IS NOT NULL`);

    let starterCount = 0;
    for (const f of allFlagships) {
      const starterId = STARTER_MODULES_BY_HULL[f.hullId!];
      if (!starterId) {
        console.warn(`  ! No starter for hull "${f.hullId}" (flagship ${f.id})`);
        continue;
      }
      await db.insert(flagshipModuleInventory).values({
        flagshipId: f.id, moduleId: starterId, count: 1,
      }).onConflictDoNothing();
      starterCount++;
    }
    console.log(`✓ Starter pack distributed (${starterCount} flagships)`);

    // ── Step 4: set marker ─────────────────────────────────────────────────
    await db.execute(sql`
      INSERT INTO _migrations_state (key, value) VALUES ('flagship_modules_refund', 'done')
      ON CONFLICT (key) DO UPDATE SET value = 'done', set_at = now()
    `);
    console.log('✓ Marker set — script will skip refund/starter on re-run');

  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
