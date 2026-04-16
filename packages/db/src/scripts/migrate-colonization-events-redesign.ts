/**
 * Migration: Colonization events redesign.
 *
 * - Add `outpost_established` and `last_raid_at` columns to colonization_processes
 * - Set active processes to outpost_established = true with a grace period on last_raid_at
 * - Drop removed columns from colonization_processes
 * - Drop colonization_events table and associated enums
 *
 * Usage: DATABASE_URL="..." npx tsx packages/db/src/scripts/migrate-colonization-events-redesign.ts
 */
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is required. Run: DATABASE_URL="..." npx tsx packages/db/src/scripts/migrate-colonization-events-redesign.ts',
  );
}

const sql = postgres(DATABASE_URL);

async function main() {
  // 1. Add new columns to colonization_processes
  await sql`
    ALTER TABLE colonization_processes
      ADD COLUMN IF NOT EXISTS outpost_established boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS last_raid_at timestamptz NOT NULL DEFAULT now()
  `;
  console.log('Added outpost_established and last_raid_at columns');

  // 2. For active processes, set outpost_established = true and last_raid_at = now() (grace period)
  const result = await sql`
    UPDATE colonization_processes
    SET outpost_established = true, last_raid_at = now()
    WHERE status = 'active'
  `;
  console.log(`Updated ${result.count} active colonization processes`);

  // 3. Drop removed columns from colonization_processes
  await sql`
    ALTER TABLE colonization_processes
      DROP COLUMN IF EXISTS consolidate_completed,
      DROP COLUMN IF EXISTS supply_completed,
      DROP COLUMN IF EXISTS reinforce_completed,
      DROP COLUMN IF EXISTS reinforce_passive_bonus,
      DROP COLUMN IF EXISTS last_event_at,
      DROP COLUMN IF EXISTS last_consolidate_at
  `;
  console.log('Dropped removed columns from colonization_processes');

  // 4. Drop colonization_events table
  await sql`DROP TABLE IF EXISTS colonization_events`;
  console.log('Dropped colonization_events table');

  // 5. Drop removed enums
  await sql`DROP TYPE IF EXISTS colonization_event_type`;
  await sql`DROP TYPE IF EXISTS colonization_event_status`;
  console.log('Dropped colonization_event_type and colonization_event_status enums');

  console.log('\nMigration complete.');
  await sql.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
