/**
 * One-off script: V4 migration of anomaly mode (flagship-only).
 *
 * Steps:
 *   1. Force-retreat every active anomaly (refund Exilium, return loot
 *      resources + escort ships to origin planet, restore flagship to base).
 *   2. Set _migrations_state.anomaly_v4_migrated = 'done' (idempotence).
 *
 * Safe to re-run : the marker prevents double-refund. Re-run = no-op.
 *
 * Usage:
 *   pnpm --filter @exilium/api exec tsx --env-file=/opt/exilium/.env apps/api/src/scripts/migrate-anomaly-v4.ts
 */
import { sql, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {
  anomalies, flagships, planets, planetShips, userExilium, exiliumLog,
} from '@exilium/db';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  try {
    // ── Idempotence check ────────────────────────────────────────────
    const [existing] = await db.execute<{ value: string }>(sql`
      SELECT value FROM _migrations_state WHERE key = 'anomaly_v4_migrated' LIMIT 1
    `);
    if (existing && existing.value === 'done') {
      console.log('✓ Migration already applied (marker present). Skipping.');
      await client.end();
      return;
    }

    // ── Step 1: Find active anomalies ────────────────────────────────
    const activeRows = await db.select().from(anomalies)
      .where(eq(anomalies.status, 'active'));
    console.log(`Found ${activeRows.length} active anomalies to force-retreat.`);

    let refundedCount = 0;
    let totalRefunded = 0;

    for (const row of activeRows) {
      await db.transaction(async (tx) => {
        // 1a. Mark completed
        await tx.update(anomalies).set({
          status: 'completed',
          completedAt: new Date(),
          nextNodeAt: null,
          nextEnemyFleet: null,
          nextEnemyFp: null,
        }).where(eq(anomalies.id, row.id));

        // 1b. Refund Exilium
        if (row.exiliumPaid > 0) {
          await tx.update(userExilium).set({
            balance: sql`${userExilium.balance} + ${row.exiliumPaid}`,
            totalEarned: sql`${userExilium.totalEarned} + ${row.exiliumPaid}`,
            updatedAt: new Date(),
          }).where(eq(userExilium.userId, row.userId));
          await tx.insert(exiliumLog).values({
            userId: row.userId,
            amount: row.exiliumPaid,
            source: 'pve',
            details: { source: 'anomaly_v4_migration', anomalyId: row.id },
          });
          totalRefunded += row.exiliumPaid;
        }

        // 1c. Credit loot resources to origin planet
        const lootMinerai = Number(row.lootMinerai);
        const lootSilicium = Number(row.lootSilicium);
        const lootHydrogene = Number(row.lootHydrogene);
        if (lootMinerai > 0 || lootSilicium > 0 || lootHydrogene > 0) {
          await tx.update(planets).set({
            minerai: sql`${planets.minerai} + ${lootMinerai}`,
            silicium: sql`${planets.silicium} + ${lootSilicium}`,
            hydrogene: sql`${planets.hydrogene} + ${lootHydrogene}`,
          }).where(eq(planets.id, row.originPlanetId));
        }

        // 1d. Return escort ships + loot ships to origin planet's planet_ships
        const fleet = (row.fleet ?? {}) as Record<string, { count: number; hullPercent: number }>;
        const lootShips = (row.lootShips ?? {}) as Record<string, number>;
        const totalToInject: Record<string, number> = {};
        for (const [shipId, entry] of Object.entries(fleet)) {
          if (shipId === 'flagship') continue;
          if (entry.count > 0) totalToInject[shipId] = (totalToInject[shipId] ?? 0) + entry.count;
        }
        for (const [shipId, count] of Object.entries(lootShips)) {
          if (count > 0) totalToInject[shipId] = (totalToInject[shipId] ?? 0) + count;
        }
        if (Object.keys(totalToInject).length > 0) {
          const incrementUpdate: Record<string, unknown> = {};
          for (const [shipId, count] of Object.entries(totalToInject)) {
            const col = (planetShips as unknown as Record<string, unknown>)[shipId];
            if (col) incrementUpdate[shipId] = sql`${col} + ${count}`;
          }
          if (Object.keys(incrementUpdate).length > 0) {
            await tx.update(planetShips).set(incrementUpdate as never)
              .where(eq(planetShips.planetId, row.originPlanetId));
          }
        }

        // 1e. Flagship returns to base, status active
        // Clear repair/refit timers too — defensive cleanup. Without this, if a flagship
        // happens to be in 'hull_refit' or 'incapacitated' when the migration runs, we'd
        // flip it to 'active' but leave the timer fields populated, which would confuse
        // the lazy completion logic in flagshipService.get().
        await tx.update(flagships).set({
          status: 'active',
          planetId: row.originPlanetId,
          repairEndsAt: null,
          refitEndsAt: null,
          updatedAt: new Date(),
        }).where(eq(flagships.userId, row.userId));

        refundedCount++;
      });
    }

    console.log(`✓ Force-retreated ${refundedCount} anomalies, refunded ${totalRefunded} Exilium total.`);

    // ── Step 2: Set marker ───────────────────────────────────────────
    await db.execute(sql`
      INSERT INTO _migrations_state (key, value) VALUES ('anomaly_v4_migrated', 'done')
      ON CONFLICT (key) DO UPDATE SET value = 'done', set_at = now()
    `);
    console.log('✓ Marker set — script will skip on re-run.');

  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
