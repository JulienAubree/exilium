import { createDb } from '../index.js';
import { planets } from '../schema/planets.js';
import { isNull, eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

const DATABASE_URL = process.env.DATABASE_URL;
const ASSETS_DIR = process.env.ASSETS_DIR;

if (!DATABASE_URL || !ASSETS_DIR) {
  console.error('DATABASE_URL and ASSETS_DIR env vars required');
  process.exit(1);
}

const db = createDb(DATABASE_URL);

async function main() {
  const allPlanets = await db
    .select()
    .from(planets)
    .where(isNull(planets.planetImageIndex));

  console.log(`Found ${allPlanets.length} planets without image index`);

  let updated = 0;
  for (const planet of allPlanets) {
    const classId = planet.planetClassId ?? 'homeworld';
    const dir = path.join(ASSETS_DIR, 'planets', classId);

    if (!fs.existsSync(dir)) continue;

    const indexes = fs.readdirSync(dir)
      .filter((f: string) => /^\d+\.webp$/.test(f))
      .map((f: string) => parseInt(f, 10));

    if (indexes.length === 0) continue;

    const imageIndex = indexes[Math.floor(Math.random() * indexes.length)];

    await db
      .update(planets)
      .set({ planetImageIndex: imageIndex })
      .where(eq(planets.id, planet.id));

    updated++;
  }

  console.log(`Updated ${updated} planets`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
