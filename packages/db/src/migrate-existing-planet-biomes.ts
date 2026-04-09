/**
 * Migration script: assign biomes to existing colonized planets.
 * Skips homeworlds and planets that already have biomes.
 * Uses the same seeded random as the galaxy view for consistency.
 *
 * Usage: npx tsx src/migrate-existing-planet-biomes.ts
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { planets } from './schema/planets.js';
import { planetTypes } from './schema/game-config.js';
import { biomeDefinitions, planetBiomes } from './schema/biomes.js';
import {
  seededRandom,
  coordinateSeed,
  generateBiomeCount,
  pickBiomes,
  type BiomeDefinition,
} from '@exilium/game-engine';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://exilium:exilium@localhost:5432/exilium';
const client = postgres(DATABASE_URL);
const db = drizzle(client);

async function main() {
  console.log('Migrating existing planets: assigning biomes...\n');

  // Load biome catalogue
  const biomeRows = await db.select().from(biomeDefinitions);
  const catalogue: BiomeDefinition[] = biomeRows.map((b) => ({
    id: b.id,
    rarity: b.rarity,
    compatiblePlanetTypes: b.compatiblePlanetTypes as string[],
    effects: b.effects as Array<{ stat: string; modifier: number }>,
  }));

  if (catalogue.length === 0) {
    console.log('No biome definitions found. Run the seed first.');
    await client.end();
    return;
  }

  // Load planet types to identify homeworld
  const ptRows = await db.select().from(planetTypes);
  const homeworldType = ptRows.find((pt) => pt.role === 'homeworld');
  const homeworldId = homeworldType?.id ?? 'homeworld';

  // Find all non-homeworld planets that don't have biomes yet
  const allPlanets = await db
    .select({
      id: planets.id,
      galaxy: planets.galaxy,
      system: planets.system,
      position: planets.position,
      planetClassId: planets.planetClassId,
    })
    .from(planets)
    .where(
      and(
        sql`${planets.planetClassId} IS NOT NULL`,
        sql`${planets.planetClassId} != ${homeworldId}`,
      ),
    );

  // Filter out planets that already have biomes
  const existingBiomes = await db
    .select({ planetId: planetBiomes.planetId })
    .from(planetBiomes);
  const planetsWithBiomes = new Set(existingBiomes.map((r) => r.planetId));

  const planetsToMigrate = allPlanets.filter((p) => !planetsWithBiomes.has(p.id));

  if (planetsToMigrate.length === 0) {
    console.log('All planets already have biomes. Nothing to do.');
    await client.end();
    return;
  }

  console.log(`Found ${planetsToMigrate.length} planets to assign biomes to.\n`);

  let totalBiomes = 0;

  for (const planet of planetsToMigrate) {
    const planetTypeId = planet.planetClassId!;
    const seed = coordinateSeed(planet.galaxy, planet.system, planet.position);
    const rng = seededRandom(seed);
    const biomeCount = generateBiomeCount(rng);
    const picked = pickBiomes(catalogue, planetTypeId, biomeCount, rng);

    if (picked.length > 0) {
      await db.insert(planetBiomes).values(
        picked.map((b) => ({ planetId: planet.id, biomeId: b.id })),
      );
      totalBiomes += picked.length;
    }

    const biomeNames = picked.map((b) => b.id).join(', ');
    console.log(`  [${planet.galaxy}:${planet.system}:${planet.position}] ${planetTypeId} -> ${picked.length} biomes (${biomeNames})`);
  }

  console.log(`\nDone! Assigned ${totalBiomes} biomes to ${planetsToMigrate.length} planets.`);
  await client.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
