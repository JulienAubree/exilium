# Planet Biomes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a biome system where each colonized planet has a major biome (its existing type) plus 1-5 randomly generated minor biomes that provide real, effective gameplay bonuses.

**Architecture:** New `biomeDefinitions` config table + `planetBiomes` join table. Biome bonuses are merged into the existing `talentBonuses` parameter in `calculateProductionRates()`. Biomes are generated at first galaxy scan and persisted. The homeworld gets no biomes.

**Tech Stack:** Drizzle ORM (PostgreSQL), TypeScript, Vitest, tRPC, React

**Spec:** `docs/superpowers/specs/2026-04-09-planet-biomes-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/db/src/schema/biomes.ts` | Create | Schema for `biomeDefinitions` + `planetBiomes` tables |
| `packages/db/src/schema/index.ts` | Modify | Export new biome schema |
| `packages/db/drizzle/0029_planet_biomes.sql` | Create | Migration SQL |
| `packages/db/src/seed-game-config.ts` | Modify | Seed biome catalogue data |
| `packages/game-engine/src/formulas/biomes.ts` | Create | Biome generation algorithm + bonus aggregation |
| `packages/game-engine/src/formulas/biomes.test.ts` | Create | Tests for biome generation + bonus aggregation |
| `packages/game-engine/src/index.ts` | Modify | Export biomes module |
| `apps/api/src/modules/galaxy/galaxy.service.ts` | Modify | Generate + return biomes on system scan |
| `apps/api/src/modules/fleet/handlers/colonize.handler.ts` | Modify | Generate biomes at colonization (fallback) |
| `apps/api/src/modules/resource/resource.service.ts` | Modify | Merge biome bonuses into production calculation |
| `apps/api/src/modules/planet/planet.service.ts` | Modify | Return biomes in empire overview |
| `apps/api/src/modules/admin/game-config.service.ts` | Modify | Include biome definitions in game config |
| `apps/web/src/pages/Galaxy.tsx` | Modify | Display biomes on planet slots |
| `apps/web/src/pages/Overview.tsx` | Modify | Display biomes on planet detail |

---

### Task 1: Database Schema

**Files:**
- Create: `packages/db/src/schema/biomes.ts`
- Modify: `packages/db/src/schema/index.ts`
- Create: `packages/db/drizzle/0029_planet_biomes.sql`

- [ ] **Step 1: Create biomes schema file**

Create `packages/db/src/schema/biomes.ts`:

```typescript
import { pgTable, varchar, text, real, jsonb, uuid, primaryKey, pgEnum } from 'drizzle-orm/pg-core';
import { planets } from './planets.js';

export const biomeRarityEnum = pgEnum('biome_rarity', ['common', 'uncommon', 'rare', 'epic', 'legendary']);

export const biomeDefinitions = pgTable('biome_definitions', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 128 }).notNull(),
  description: text('description').notNull().default(''),
  rarity: biomeRarityEnum('rarity').notNull(),
  compatiblePlanetTypes: jsonb('compatible_planet_types').notNull(), // string[] — empty array = all types
  effects: jsonb('effects').notNull(), // Array<{ stat: string; category?: string; modifier: number }>
});

export const planetBiomes = pgTable('planet_biomes', {
  planetId: uuid('planet_id').notNull().references(() => planets.id, { onDelete: 'cascade' }),
  biomeId: varchar('biome_id', { length: 64 }).notNull().references(() => biomeDefinitions.id, { onDelete: 'cascade' }),
}, (t) => [
  primaryKey({ columns: [t.planetId, t.biomeId] }),
]);
```

- [ ] **Step 2: Export from schema index**

In `packages/db/src/schema/index.ts`, add at the end:

```typescript
export * from './biomes.js';
```

- [ ] **Step 3: Create migration SQL**

Create `packages/db/drizzle/0029_planet_biomes.sql`:

```sql
-- Biome rarity enum
CREATE TYPE "biome_rarity" AS ENUM ('common', 'uncommon', 'rare', 'epic', 'legendary');

-- Biome definitions (game config)
CREATE TABLE "biome_definitions" (
  "id" varchar(64) PRIMARY KEY,
  "name" varchar(128) NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "rarity" "biome_rarity" NOT NULL,
  "compatible_planet_types" jsonb NOT NULL,
  "effects" jsonb NOT NULL
);

-- Planet biomes (join table)
CREATE TABLE "planet_biomes" (
  "planet_id" uuid NOT NULL REFERENCES "planets"("id") ON DELETE CASCADE,
  "biome_id" varchar(64) NOT NULL REFERENCES "biome_definitions"("id") ON DELETE CASCADE,
  PRIMARY KEY ("planet_id", "biome_id")
);

CREATE INDEX "planet_biomes_planet_idx" ON "planet_biomes" ("planet_id");
```

- [ ] **Step 4: Run migration**

```bash
cd packages/db && npx drizzle-kit push
```

If `drizzle-kit push` is not the pattern used (check `package.json` scripts), use the appropriate migration command. The migration file is already created; it may need to be applied with:

```bash
psql $DATABASE_URL -f drizzle/0029_planet_biomes.sql
```

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/biomes.ts packages/db/src/schema/index.ts packages/db/drizzle/0029_planet_biomes.sql
git commit -m "feat(db): add biome_definitions and planet_biomes tables"
```

---

### Task 2: Biome Generation Algorithm (game-engine)

**Files:**
- Create: `packages/game-engine/src/formulas/biomes.test.ts`
- Create: `packages/game-engine/src/formulas/biomes.ts`
- Modify: `packages/game-engine/src/index.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/game-engine/src/formulas/biomes.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateBiomeCount, pickBiomes, aggregateBiomeBonuses } from './biomes.js';
import type { BiomeDefinition, BiomeEffect } from './biomes.js';

describe('generateBiomeCount', () => {
  it('returns a number between 1 and 5', () => {
    for (let i = 0; i < 100; i++) {
      const count = generateBiomeCount();
      expect(count).toBeGreaterThanOrEqual(1);
      expect(count).toBeLessThanOrEqual(5);
    }
  });
});

describe('pickBiomes', () => {
  const BIOMES: BiomeDefinition[] = [
    { id: 'fertile_plains', rarity: 'common', compatiblePlanetTypes: [], effects: [{ stat: 'production_silicium', modifier: 0.08 }] },
    { id: 'surface_deposits', rarity: 'common', compatiblePlanetTypes: [], effects: [{ stat: 'production_minerai', modifier: 0.08 }] },
    { id: 'lava_flows', rarity: 'common', compatiblePlanetTypes: ['volcanic'], effects: [{ stat: 'production_silicium', modifier: 0.10 }] },
    { id: 'active_core', rarity: 'rare', compatiblePlanetTypes: [], effects: [{ stat: 'production_minerai', modifier: 0.12 }, { stat: 'production_silicium', modifier: 0.12 }, { stat: 'production_hydrogene', modifier: 0.12 }] },
    { id: 'gravitational_nexus', rarity: 'legendary', compatiblePlanetTypes: [], effects: [{ stat: 'building_time', modifier: -0.10 }] },
  ];

  it('returns the requested number of biomes', () => {
    const result = pickBiomes(BIOMES, 'volcanic', 3);
    expect(result).toHaveLength(3);
  });

  it('filters by compatible planet type', () => {
    const result = pickBiomes(BIOMES, 'arid', 5);
    // lava_flows is volcanic-only, should not appear
    expect(result.every(b => b.id !== 'lava_flows')).toBe(true);
  });

  it('includes type-specific biomes for matching type', () => {
    // With enough draws, volcanic should get lava_flows
    let found = false;
    for (let i = 0; i < 50; i++) {
      const result = pickBiomes(BIOMES, 'volcanic', 4);
      if (result.some(b => b.id === 'lava_flows')) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('returns no duplicates', () => {
    for (let i = 0; i < 50; i++) {
      const result = pickBiomes(BIOMES, 'volcanic', 4);
      const ids = result.map(b => b.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('returns fewer biomes if catalogue is too small', () => {
    const small = BIOMES.slice(0, 2);
    const result = pickBiomes(small, 'volcanic', 5);
    expect(result).toHaveLength(2);
  });
});

describe('aggregateBiomeBonuses', () => {
  it('returns empty record for no biomes', () => {
    expect(aggregateBiomeBonuses([])).toEqual({});
  });

  it('sums bonuses for the same stat', () => {
    const effects: BiomeEffect[] = [
      { stat: 'production_minerai', modifier: 0.08 },
      { stat: 'production_minerai', modifier: 0.12 },
      { stat: 'production_silicium', modifier: 0.10 },
    ];
    const result = aggregateBiomeBonuses(effects);
    expect(result['production_minerai']).toBeCloseTo(0.20);
    expect(result['production_silicium']).toBeCloseTo(0.10);
  });

  it('handles negative modifiers', () => {
    const effects: BiomeEffect[] = [
      { stat: 'building_time', modifier: -0.10 },
    ];
    const result = aggregateBiomeBonuses(effects);
    expect(result['building_time']).toBeCloseTo(-0.10);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/game-engine && npx vitest run src/formulas/biomes.test.ts
```

Expected: FAIL — module `./biomes.js` not found.

- [ ] **Step 3: Implement biomes module**

Create `packages/game-engine/src/formulas/biomes.ts`:

```typescript
export interface BiomeEffect {
  stat: string;
  category?: string;
  modifier: number; // e.g. 0.08 for +8%, -0.10 for -10%
}

export interface BiomeDefinition {
  id: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  compatiblePlanetTypes: string[]; // empty = all types
  effects: BiomeEffect[];
}

const BIOME_COUNT_WEIGHTS: [number, number][] = [
  [1, 0.15],
  [2, 0.30],
  [3, 0.30],
  [4, 0.20],
  [5, 0.05],
];

const RARITY_WEIGHTS: Record<string, number> = {
  common: 0.40,
  uncommon: 0.30,
  rare: 0.18,
  epic: 0.09,
  legendary: 0.03,
};

/**
 * Generate the number of minor biomes for a planet (1-5).
 */
export function generateBiomeCount(): number {
  const roll = Math.random();
  let cumulative = 0;
  for (const [count, weight] of BIOME_COUNT_WEIGHTS) {
    cumulative += weight;
    if (roll < cumulative) return count;
  }
  return 3; // fallback
}

/**
 * Pick N biomes from the catalogue, filtered by planet type compatibility.
 * No duplicates. Weighted by rarity.
 */
export function pickBiomes(
  catalogue: BiomeDefinition[],
  planetTypeId: string,
  count: number,
): BiomeDefinition[] {
  // Filter compatible biomes
  const compatible = catalogue.filter(
    (b) => b.compatiblePlanetTypes.length === 0 || b.compatiblePlanetTypes.includes(planetTypeId),
  );

  const picked: BiomeDefinition[] = [];
  const remaining = [...compatible];

  for (let i = 0; i < count && remaining.length > 0; i++) {
    // Calculate weighted probabilities
    const totalWeight = remaining.reduce((sum, b) => sum + (RARITY_WEIGHTS[b.rarity] ?? 0), 0);
    if (totalWeight <= 0) break;

    const roll = Math.random() * totalWeight;
    let cumulative = 0;
    let pickedIndex = 0;

    for (let j = 0; j < remaining.length; j++) {
      cumulative += RARITY_WEIGHTS[remaining[j].rarity] ?? 0;
      if (roll < cumulative) {
        pickedIndex = j;
        break;
      }
    }

    picked.push(remaining[pickedIndex]);
    remaining.splice(pickedIndex, 1); // remove to prevent duplicates
  }

  return picked;
}

/**
 * Aggregate biome effects into a Record<string, number> compatible
 * with the talentBonuses parameter of calculateProductionRates.
 * Values are summed per stat key.
 */
export function aggregateBiomeBonuses(effects: BiomeEffect[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const effect of effects) {
    result[effect.stat] = (result[effect.stat] ?? 0) + effect.modifier;
  }
  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/game-engine && npx vitest run src/formulas/biomes.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Export from game-engine index**

In `packages/game-engine/src/index.ts`, add:

```typescript
export * from './formulas/biomes.js';
```

- [ ] **Step 6: Commit**

```bash
git add packages/game-engine/src/formulas/biomes.ts packages/game-engine/src/formulas/biomes.test.ts packages/game-engine/src/index.ts
git commit -m "feat(game-engine): add biome generation algorithm and bonus aggregation"
```

---

### Task 3: Seed Biome Catalogue

**Files:**
- Modify: `packages/db/src/seed-game-config.ts`

The biome catalogue must only include biomes whose `stat` keys are already consumed in the game engine. Based on codebase analysis, these stats are consumed:

| Stat key | Consumed in | How |
|----------|-------------|-----|
| `production_minerai` | `resources.ts:97` | `1 + (talentBonuses?.['production_minerai'] ?? 0)` |
| `production_silicium` | `resources.ts:98` | `1 + (talentBonuses?.['production_silicium'] ?? 0)` |
| `production_hydrogene` | `resources.ts:99` | `1 + (talentBonuses?.['production_hydrogene'] ?? 0)` |
| `energy_production` | `resources.ts:101` | `1 + (talentBonuses?.['energy_production'] ?? 0)` |
| `storage_minerai` | `resources.ts:130` | `1 + (talentBonuses?.['storage_minerai'] ?? 0)` |
| `storage_silicium` | `resources.ts:131` | `1 + (talentBonuses?.['storage_silicium'] ?? 0)` |
| `storage_hydrogene` | `resources.ts:132` | `1 + (talentBonuses?.['storage_hydrogene'] ?? 0)` |

Stats like `building_time`, `shield_power`, `ship_speed`, `defense_resistance` are NOT consumed via the talentBonuses path and need separate integration (deferred to Task 5 for `building_time` and `research_time` which go through `resolveBonus`).

- [ ] **Step 1: Add biome definitions import**

In `packages/db/src/seed-game-config.ts`, add `biomeDefinitions` to the import from `'./schema/game-config.js'`:

Actually, biomes are in a separate schema file. Add a new import:

```typescript
import { biomeDefinitions } from './schema/biomes.js';
```

- [ ] **Step 2: Add BIOME_DEFINITIONS data**

Add this constant after the `PLANET_TYPES` array (around line 166):

```typescript
// ── Biome definitions data ──

const BIOME_DEFINITIONS = [
  // ── Universal biomes (all planet types) ──
  { id: 'fertile_plains', name: 'Plaines fertiles', description: 'De vastes étendues de terres riches en nutriments minéraux.', rarity: 'common' as const, compatiblePlanetTypes: [], effects: [{ stat: 'production_silicium', modifier: 0.08 }] },
  { id: 'surface_deposits', name: 'Gisements de surface', description: 'Des filons de minerai affleurent partout à la surface.', rarity: 'common' as const, compatiblePlanetTypes: [], effects: [{ stat: 'production_minerai', modifier: 0.08 }] },
  { id: 'deep_caverns', name: 'Cavernes profondes', description: 'Un réseau souterrain immense offrant un stockage naturel.', rarity: 'common' as const, compatiblePlanetTypes: [], effects: [{ stat: 'storage_minerai', modifier: 0.10 }] },
  { id: 'underground_reserves', name: 'Nappes souterraines', description: 'Des poches de gaz pressurisé piégées dans la croûte.', rarity: 'uncommon' as const, compatiblePlanetTypes: [], effects: [{ stat: 'storage_hydrogene', modifier: 0.10 }] },
  { id: 'stable_orbit', name: 'Orbite stable', description: 'Une orbite parfaitement régulière maximisant l\'exposition solaire.', rarity: 'rare' as const, compatiblePlanetTypes: [], effects: [{ stat: 'energy_production', modifier: 0.08 }] },
  { id: 'active_core', name: 'Noyau actif', description: 'Un noyau planétaire en fusion alimentant toute l\'activité géologique.', rarity: 'rare' as const, compatiblePlanetTypes: [], effects: [{ stat: 'production_minerai', modifier: 0.12 }, { stat: 'production_silicium', modifier: 0.12 }, { stat: 'production_hydrogene', modifier: 0.12 }] },
  { id: 'precursor_relics', name: 'Reliques précurseurs', description: 'Des artefacts d\'une civilisation disparue accélèrent les découvertes.', rarity: 'epic' as const, compatiblePlanetTypes: [], effects: [{ stat: 'production_minerai', modifier: 0.05 }, { stat: 'production_silicium', modifier: 0.05 }, { stat: 'production_hydrogene', modifier: 0.05 }, { stat: 'energy_production', modifier: 0.10 }] },
  { id: 'gravitational_nexus', name: 'Nexus gravitationnel', description: 'Une anomalie gravitationnelle qui facilite toutes les opérations planétaires.', rarity: 'legendary' as const, compatiblePlanetTypes: [], effects: [{ stat: 'production_minerai', modifier: 0.08 }, { stat: 'production_silicium', modifier: 0.08 }, { stat: 'production_hydrogene', modifier: 0.08 }, { stat: 'storage_minerai', modifier: 0.10 }, { stat: 'storage_silicium', modifier: 0.10 }, { stat: 'storage_hydrogene', modifier: 0.10 }] },

  // ── Volcanic biomes (positions 1-3) ──
  { id: 'lava_flows', name: 'Coulées de lave', description: 'Des rivières de lave charrient des cristaux de silicium en fusion.', rarity: 'common' as const, compatiblePlanetTypes: ['volcanic'], effects: [{ stat: 'production_silicium', modifier: 0.10 }] },
  { id: 'volcanic_vents', name: 'Cheminées volcaniques', description: 'Des colonnes de chaleur intense exploitables pour la production d\'énergie.', rarity: 'uncommon' as const, compatiblePlanetTypes: ['volcanic'], effects: [{ stat: 'energy_production', modifier: 0.12 }] },
  { id: 'natural_forges', name: 'Forges naturelles', description: 'Des cavités de magma à température constante, parfaites pour la métallurgie.', rarity: 'rare' as const, compatiblePlanetTypes: ['volcanic'], effects: [{ stat: 'production_minerai', modifier: 0.15 }] },
  { id: 'primordial_magma', name: 'Lac de magma primordial', description: 'Un lac de magma ancien riche en éléments lourds.', rarity: 'epic' as const, compatiblePlanetTypes: ['volcanic'], effects: [{ stat: 'production_minerai', modifier: 0.20 }] },
  { id: 'plasma_core', name: 'Coeur de plasma', description: 'Le noyau de la planète émet une énergie phénoménale.', rarity: 'legendary' as const, compatiblePlanetTypes: ['volcanic'], effects: [{ stat: 'energy_production', modifier: 0.25 }] },

  // ── Arid biomes (positions 4-6) ──
  { id: 'metallic_dunes', name: 'Dunes métalliques', description: 'Des dunes de sable chargées de particules métalliques.', rarity: 'common' as const, compatiblePlanetTypes: ['arid'], effects: [{ stat: 'production_minerai', modifier: 0.10 }] },
  { id: 'deep_canyons', name: 'Canyons profonds', description: 'D\'immenses canyons offrant un espace de stockage naturel.', rarity: 'uncommon' as const, compatiblePlanetTypes: ['arid'], effects: [{ stat: 'storage_silicium', modifier: 0.15 }] },
  { id: 'underground_oasis', name: 'Oasis souterraine', description: 'Des sources souterraines riches en composés hydrogénés.', rarity: 'rare' as const, compatiblePlanetTypes: ['arid'], effects: [{ stat: 'production_hydrogene', modifier: 0.15 }] },
  { id: 'crystal_desert', name: 'Désert de cristaux', description: 'Une étendue de cristaux de silicium naturellement formés.', rarity: 'epic' as const, compatiblePlanetTypes: ['arid'], effects: [{ stat: 'production_silicium', modifier: 0.18 }] },
  { id: 'permanent_sandstorm', name: 'Tempête de sable permanente', description: 'Une tempête éternelle qui érode la roche et expose des gisements.', rarity: 'legendary' as const, compatiblePlanetTypes: ['arid'], effects: [{ stat: 'production_minerai', modifier: 0.15 }, { stat: 'production_silicium', modifier: 0.15 }] },

  // ── Temperate biomes (positions 7, 9) ──
  { id: 'dense_forests', name: 'Forêts denses', description: 'Une biomasse luxuriante convertissant la lumière en énergie.', rarity: 'common' as const, compatiblePlanetTypes: ['temperate'], effects: [{ stat: 'energy_production', modifier: 0.08 }] },
  { id: 'mineral_plateaus', name: 'Plateaux minéraux', description: 'Des hauts plateaux où les filons sont faciles d\'accès.', rarity: 'uncommon' as const, compatiblePlanetTypes: ['temperate'], effects: [{ stat: 'production_minerai', modifier: 0.12 }] },
  { id: 'symbiotic_ecosystem', name: 'Écosystème symbiotique', description: 'Un écosystème en équilibre parfait qui amplifie toute activité.', rarity: 'rare' as const, compatiblePlanetTypes: ['temperate'], effects: [{ stat: 'production_minerai', modifier: 0.10 }, { stat: 'production_silicium', modifier: 0.10 }, { stat: 'production_hydrogene', modifier: 0.10 }] },
  { id: 'exposed_rare_earths', name: 'Terres rares exposées', description: 'Des gisements de terres rares affleurant en surface.', rarity: 'epic' as const, compatiblePlanetTypes: ['temperate'], effects: [{ stat: 'production_silicium', modifier: 0.20 }] },
  { id: 'harmonic_biosphere', name: 'Biosphère harmonique', description: 'La vie de cette planète vibre à une fréquence qui amplifie tout.', rarity: 'legendary' as const, compatiblePlanetTypes: ['temperate'], effects: [{ stat: 'production_minerai', modifier: 0.10 }, { stat: 'production_silicium', modifier: 0.10 }, { stat: 'production_hydrogene', modifier: 0.10 }, { stat: 'energy_production', modifier: 0.10 }] },

  // ── Glacial biomes (positions 10-12) ──
  { id: 'hydrogen_glaciers', name: 'Glaciers d\'hydrogène', description: 'D\'immenses glaciers d\'hydrogène solide prêts à être exploités.', rarity: 'common' as const, compatiblePlanetTypes: ['glacial'], effects: [{ stat: 'production_hydrogene', modifier: 0.10 }] },
  { id: 'rich_permafrost', name: 'Permafrost riche', description: 'Un sol gelé emprisonnant des ressources parfaitement conservées.', rarity: 'uncommon' as const, compatiblePlanetTypes: ['glacial'], effects: [{ stat: 'storage_minerai', modifier: 0.12 }, { stat: 'storage_silicium', modifier: 0.12 }, { stat: 'storage_hydrogene', modifier: 0.12 }] },
  { id: 'cryogenic_geysers', name: 'Geysers cryogéniques', description: 'Des geysers projetant de l\'hydrogène liquide depuis les profondeurs.', rarity: 'rare' as const, compatiblePlanetTypes: ['glacial'], effects: [{ stat: 'production_hydrogene', modifier: 0.15 }] },
  { id: 'antimatter_crystals', name: 'Cristaux d\'antimatière', description: 'Des formations cristallines émettant une énergie exotique.', rarity: 'epic' as const, compatiblePlanetTypes: ['glacial'], effects: [{ stat: 'production_hydrogene', modifier: 0.22 }] },
  { id: 'eternal_cryovolcano', name: 'Cryovolcan éternel', description: 'Un volcan de glace en éruption permanente, source inépuisable.', rarity: 'legendary' as const, compatiblePlanetTypes: ['glacial'], effects: [{ stat: 'production_hydrogene', modifier: 0.20 }, { stat: 'energy_production', modifier: 0.15 }] },

  // ── Gaseous biomes (positions 13-15) ──
  { id: 'noble_gas_layers', name: 'Couches de gaz nobles', description: 'Des strates atmosphériques riches en gaz exploitables.', rarity: 'common' as const, compatiblePlanetTypes: ['gaseous'], effects: [{ stat: 'production_hydrogene', modifier: 0.10 }] },
  { id: 'atmospheric_vortex', name: 'Vortex atmosphérique', description: 'Un cyclone permanent comprimant les ressources gazeuses.', rarity: 'uncommon' as const, compatiblePlanetTypes: ['gaseous'], effects: [{ stat: 'production_hydrogene', modifier: 0.08 }, { stat: 'storage_hydrogene', modifier: 0.10 }] },
  { id: 'deuterium_clouds', name: 'Nuages de deutérium', description: 'Des nuages denses de deutérium prêts pour la synthèse.', rarity: 'rare' as const, compatiblePlanetTypes: ['gaseous'], effects: [{ stat: 'production_hydrogene', modifier: 0.15 }] },
  { id: 'ionic_storm', name: 'Tempête ionique', description: 'Une tempête électrique permanente convertible en énergie pure.', rarity: 'epic' as const, compatiblePlanetTypes: ['gaseous'], effects: [{ stat: 'energy_production', modifier: 0.20 }] },
  { id: 'spatial_anomaly', name: 'Anomalie spatiale', description: 'Une distorsion de l\'espace-temps aux propriétés inexplicables.', rarity: 'legendary' as const, compatiblePlanetTypes: ['gaseous'], effects: [{ stat: 'production_hydrogene', modifier: 0.15 }, { stat: 'production_minerai', modifier: 0.10 }, { stat: 'production_silicium', modifier: 0.10 }] },
];
```

- [ ] **Step 3: Add biome seeding logic**

In the `main()` function of `seed-game-config.ts`, after the planet types seeding block (after the line `console.log(\`  ✓ ${PLANET_TYPES.length} planet types\`);`), add:

```typescript
  // Biome definitions
  for (const biome of BIOME_DEFINITIONS) {
    await db.insert(biomeDefinitions).values(biome)
      .onConflictDoUpdate({ target: biomeDefinitions.id, set: { ...biome } });
  }
  console.log(`  ✓ ${BIOME_DEFINITIONS.length} biome definitions`);
```

- [ ] **Step 4: Run the seed**

```bash
cd packages/db && npx tsx src/seed-game-config.ts
```

Expected: `✓ 33 biome definitions` appears in output.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/seed-game-config.ts
git commit -m "feat(db): seed 33 biome definitions across 5 planet types"
```

---

### Task 4: Biome Generation in Galaxy Service

**Files:**
- Modify: `apps/api/src/modules/galaxy/galaxy.service.ts`

This is the core integration: when a player views a system, biomes are generated for unoccupied positions (not yet implemented as "scan" — we generate biomes for empty slots when they're first viewed and persist them).

However, empty positions don't have planet rows in the DB yet. We need a way to store biomes for positions that don't have planets. There are two approaches:

**Approach chosen:** Generate biomes at **colonization time** only (not at scan). For the galaxy view, we compute biomes deterministically using a **seeded random** based on coordinates (galaxy + system + position) so the same position always shows the same biomes without storing them. When colonized, the biomes are persisted in `planetBiomes`.

This avoids creating rows for millions of uncolonized positions.

- [ ] **Step 1: Add seeded random to biomes module**

In `packages/game-engine/src/formulas/biomes.ts`, add a seeded random function and update `generateBiomeCount` and `pickBiomes` to accept an optional random function:

```typescript
/**
 * Simple seeded PRNG (mulberry32).
 * Returns a function that produces deterministic values in [0, 1).
 */
export function seededRandom(seed: number): () => number {
  let t = seed | 0;
  return () => {
    t = (t + 0x6D2B79F5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Create a coordinate-based seed for deterministic biome generation.
 */
export function coordinateSeed(galaxy: number, system: number, position: number): number {
  return galaxy * 1_000_000 + system * 1_000 + position;
}
```

Then update `generateBiomeCount` and `pickBiomes` signatures to accept a `rng` parameter:

```typescript
export function generateBiomeCount(rng: () => number = Math.random): number {
  const roll = rng();
  // ... same logic, just use rng() instead of Math.random()
}

export function pickBiomes(
  catalogue: BiomeDefinition[],
  planetTypeId: string,
  count: number,
  rng: () => number = Math.random,
): BiomeDefinition[] {
  // ... same logic, just use rng() instead of Math.random()
}
```

- [ ] **Step 2: Add tests for seeded generation**

Add to `packages/game-engine/src/formulas/biomes.test.ts`:

```typescript
import { seededRandom, coordinateSeed } from './biomes.js';

describe('seededRandom', () => {
  it('produces deterministic output for same seed', () => {
    const rng1 = seededRandom(12345);
    const rng2 = seededRandom(12345);
    const values1 = Array.from({ length: 10 }, () => rng1());
    const values2 = Array.from({ length: 10 }, () => rng2());
    expect(values1).toEqual(values2);
  });

  it('produces different output for different seeds', () => {
    const rng1 = seededRandom(12345);
    const rng2 = seededRandom(54321);
    expect(rng1()).not.toBe(rng2());
  });
});

describe('coordinateSeed', () => {
  it('produces unique seeds for different coordinates', () => {
    const s1 = coordinateSeed(1, 100, 5);
    const s2 = coordinateSeed(1, 100, 6);
    const s3 = coordinateSeed(1, 101, 5);
    expect(s1).not.toBe(s2);
    expect(s1).not.toBe(s3);
  });
});

describe('pickBiomes with seeded random', () => {
  it('produces deterministic results with same seed', () => {
    const BIOMES: BiomeDefinition[] = [
      { id: 'fertile_plains', rarity: 'common', compatiblePlanetTypes: [], effects: [{ stat: 'production_silicium', modifier: 0.08 }] },
      { id: 'surface_deposits', rarity: 'common', compatiblePlanetTypes: [], effects: [{ stat: 'production_minerai', modifier: 0.08 }] },
      { id: 'active_core', rarity: 'rare', compatiblePlanetTypes: [], effects: [{ stat: 'production_minerai', modifier: 0.12 }] },
    ];
    const rng1 = seededRandom(42);
    const rng2 = seededRandom(42);
    const result1 = pickBiomes(BIOMES, 'volcanic', 2, rng1);
    const result2 = pickBiomes(BIOMES, 'volcanic', 2, rng2);
    expect(result1.map(b => b.id)).toEqual(result2.map(b => b.id));
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd packages/game-engine && npx vitest run src/formulas/biomes.test.ts
```

Expected: All tests PASS.

- [ ] **Step 4: Update galaxy service to compute biomes for empty slots**

In `apps/api/src/modules/galaxy/galaxy.service.ts`:

```typescript
import { eq, and } from 'drizzle-orm';
import { planets, users, debrisFields, allianceMembers, alliances, planetBiomes, biomeDefinitions } from '@exilium/db';
import type { Database } from '@exilium/db';
import type { GameConfigService } from '../admin/game-config.service.js';
import { seededRandom, coordinateSeed, generateBiomeCount, pickBiomes, type BiomeDefinition } from '@exilium/game-engine';

export function createGalaxyService(db: Database, gameConfigService: GameConfigService) {
  return {
    async getSystem(galaxy: number, system: number, _currentUserId?: string) {
      const config = await gameConfigService.getFullConfig();
      const positions = Number(config.universe.positions) || 16;
      const beltPositions = (config.universe.belt_positions as number[]) ?? [8, 16];

      // Load biome catalogue from config
      const biomeCatalogue: BiomeDefinition[] = config.biomes ?? [];

      const systemPlanets = await db
        .select({
          position: planets.position,
          planetId: planets.id,
          planetName: planets.name,
          planetType: planets.planetType,
          userId: planets.userId,
          username: users.username,
          allianceId: allianceMembers.allianceId,
          allianceTag: alliances.tag,
          planetClassId: planets.planetClassId,
        })
        .from(planets)
        .leftJoin(users, eq(users.id, planets.userId))
        .leftJoin(allianceMembers, eq(allianceMembers.userId, planets.userId))
        .leftJoin(alliances, eq(alliances.id, allianceMembers.allianceId))
        .where(and(eq(planets.galaxy, galaxy), eq(planets.system, system)));

      // Load persisted biomes for colonized planets
      const planetIds = systemPlanets.map(p => p.planetId);
      let persistedBiomes: { planetId: string; biomeId: string }[] = [];
      if (planetIds.length > 0) {
        persistedBiomes = await db
          .select({ planetId: planetBiomes.planetId, biomeId: planetBiomes.biomeId })
          .from(planetBiomes)
          .where(sql`${planetBiomes.planetId} IN (${sql.join(planetIds.map(id => sql`${id}`), sql`, `)})`);
      }

      const slots: any[] = Array(positions).fill(null);

      // Mark belt positions
      for (const pos of beltPositions) {
        slots[pos - 1] = { type: 'belt', position: pos };
      }

      for (const planet of systemPlanets) {
        const biomeIds = persistedBiomes
          .filter(pb => pb.planetId === planet.planetId)
          .map(pb => pb.biomeId);
        const biomes = biomeCatalogue.filter(b => biomeIds.includes(b.id));
        slots[planet.position - 1] = { ...planet, biomes };
      }

      // For empty (non-belt) slots, compute biomes deterministically
      for (let i = 0; i < positions; i++) {
        if (slots[i] !== null) continue;
        const pos = i + 1;
        if (beltPositions.includes(pos)) continue;

        // Find planet type for this position
        const planetType = config.planetTypes.find(
          (pt: any) => pt.role !== 'homeworld' && (pt.positions as number[]).includes(pos),
        );
        if (!planetType) continue;

        const seed = coordinateSeed(galaxy, system, pos);
        const rng = seededRandom(seed);
        const count = generateBiomeCount(rng);
        const biomes = pickBiomes(biomeCatalogue, planetType.id, count, rng);

        slots[i] = {
          type: 'empty',
          position: pos,
          planetClassId: planetType.id,
          biomes: biomes.map(b => ({ id: b.id, name: (biomeCatalogue.find(bc => bc.id === b.id) as any)?.name ?? b.id, rarity: b.rarity, effects: b.effects })),
        };
      }

      const debris = await db
        .select()
        .from(debrisFields)
        .where(
          and(
            eq(debrisFields.galaxy, galaxy),
            eq(debrisFields.system, system),
          ),
        );

      for (const d of debris) {
        const slot = slots[d.position - 1];
        if (slot) {
          slot.debris = { minerai: Number(d.minerai), silicium: Number(d.silicium) };
        }
      }

      return { galaxy, system, slots };
    },
  };
}
```

Note: The `sql` import needs to be added: `import { eq, and, sql } from 'drizzle-orm';`

Also need to add the `inArray` import from drizzle-orm if preferred over raw SQL for the biome query. Alternatively, use the simpler approach:

```typescript
import { eq, and, inArray } from 'drizzle-orm';
// ...
persistedBiomes = await db
  .select({ planetId: planetBiomes.planetId, biomeId: planetBiomes.biomeId })
  .from(planetBiomes)
  .where(inArray(planetBiomes.planetId, planetIds));
```

- [ ] **Step 5: Add biomes to game config service**

In `apps/api/src/modules/admin/game-config.service.ts`, add biome definitions to the `getFullConfig()` method. Find where `planetTypes` are loaded and add a similar block for biomes:

```typescript
// Load biome definitions
const biomeRows = await db.select().from(biomeDefinitions);
// Add to config object:
config.biomes = biomeRows.map(b => ({
  id: b.id,
  name: b.name,
  description: b.description,
  rarity: b.rarity,
  compatiblePlanetTypes: b.compatiblePlanetTypes as string[],
  effects: b.effects as Array<{ stat: string; category?: string; modifier: number }>,
}));
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/galaxy/galaxy.service.ts apps/api/src/modules/admin/game-config.service.ts packages/game-engine/src/formulas/biomes.ts packages/game-engine/src/formulas/biomes.test.ts
git commit -m "feat(api): generate and display biomes in galaxy view"
```

---

### Task 5: Persist Biomes at Colonization

**Files:**
- Modify: `apps/api/src/modules/fleet/handlers/colonize.handler.ts`

- [ ] **Step 1: Import biome utilities and schema**

At the top of `colonize.handler.ts`, add:

```typescript
import { planetBiomes } from '@exilium/db';
import { seededRandom, coordinateSeed, generateBiomeCount, pickBiomes, type BiomeDefinition } from '@exilium/game-engine';
```

- [ ] **Step 2: Generate and persist biomes after planet creation**

After the planet creation block (after `await ctx.db.insert(planetDefenses).values({ planetId: newPlanet.id });` at line 161), add:

```typescript
    // Generate and persist biomes for the new colony
    const biomeCatalogue: BiomeDefinition[] = (config.biomes ?? []).map((b: any) => ({
      id: b.id,
      rarity: b.rarity,
      compatiblePlanetTypes: b.compatiblePlanetTypes as string[],
      effects: b.effects as Array<{ stat: string; modifier: number }>,
    }));

    if (biomeCatalogue.length > 0 && planetTypeForPos) {
      const seed = coordinateSeed(fleetEvent.targetGalaxy, fleetEvent.targetSystem, fleetEvent.targetPosition);
      const rng = seededRandom(seed);
      const biomeCount = generateBiomeCount(rng);
      const pickedBiomes = pickBiomes(biomeCatalogue, planetTypeForPos.id, biomeCount, rng);

      if (pickedBiomes.length > 0) {
        await ctx.db.insert(planetBiomes).values(
          pickedBiomes.map(b => ({ planetId: newPlanet.id, biomeId: b.id })),
        );
      }
    }
```

- [ ] **Step 3: Add biomes to colonization report**

In the success report, add biome info. Update the report creation call (around line 187-190):

```typescript
    const reportId = await createColonizeReport(
      `Colonisation réussie ${coords}`,
      {
        success: true,
        diameter,
        planetId: newPlanet.id,
        biomes: pickedBiomes?.map(b => b.id) ?? [],
      },
    );
```

Move the biome generation before the report creation to ensure `pickedBiomes` is available.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/fleet/handlers/colonize.handler.ts
git commit -m "feat(api): persist biomes at colonization and include in report"
```

---

### Task 6: Integrate Biome Bonuses into Production

**Files:**
- Modify: `apps/api/src/modules/resource/resource.service.ts`
- Modify: `apps/api/src/modules/planet/planet.service.ts`

This is the critical task: biome bonuses must actually affect production.

- [ ] **Step 1: Create a helper to load biome bonuses for a planet**

In `apps/api/src/modules/resource/resource.service.ts`, add a function after the existing helper functions (around line 46):

```typescript
import { planetBiomes, biomeDefinitions } from '@exilium/db';
import { aggregateBiomeBonuses, type BiomeEffect } from '@exilium/game-engine';

async function loadBiomeBonuses(db: Database, planetId: string): Promise<Record<string, number>> {
  const rows = await db
    .select({ effects: biomeDefinitions.effects })
    .from(planetBiomes)
    .innerJoin(biomeDefinitions, eq(biomeDefinitions.id, planetBiomes.biomeId))
    .where(eq(planetBiomes.planetId, planetId));

  const allEffects: BiomeEffect[] = rows.flatMap(r => r.effects as BiomeEffect[]);
  return aggregateBiomeBonuses(allEffects);
}
```

- [ ] **Step 2: Merge biome bonuses into materializeResources**

In the `materializeResources` method (around line 134), after `const talentCtx = ...`, add:

```typescript
      const biomeBonuses = await loadBiomeBonuses(db, planetId);
      // Merge biome bonuses into talent context (additive)
      for (const [key, value] of Object.entries(biomeBonuses)) {
        talentCtx[key] = (talentCtx[key] ?? 0) + value;
      }
```

- [ ] **Step 3: Merge biome bonuses into spendResources**

In the `spendResources` method (around line 196), after `const talentCtx = ...`, add the same merge:

```typescript
      const biomeBonuses = await loadBiomeBonuses(db, planetId);
      for (const [key, value] of Object.entries(biomeBonuses)) {
        talentCtx[key] = (talentCtx[key] ?? 0) + value;
      }
```

- [ ] **Step 4: Merge biome bonuses into getProductionRates**

In the `getProductionRates` method (around line 269), after `const talentCtx = ...`, add:

```typescript
      const biomeBonuses = await loadBiomeBonuses(db, planetId);
      for (const [key, value] of Object.entries(biomeBonuses)) {
        talentCtx[key] = (talentCtx[key] ?? 0) + value;
      }
```

- [ ] **Step 5: Add biomes to empire overview**

In `apps/api/src/modules/planet/planet.service.ts`, in `getEmpireOverview`, add biome data to each planet's response. After fetching rates (around line 183), add:

```typescript
import { planetBiomes, biomeDefinitions } from '@exilium/db';

// Inside getEmpireOverview, in the map callback:
          const biomes = await db
            .select({
              id: biomeDefinitions.id,
              name: biomeDefinitions.name,
              rarity: biomeDefinitions.rarity,
              effects: biomeDefinitions.effects,
            })
            .from(planetBiomes)
            .innerJoin(biomeDefinitions, eq(biomeDefinitions.id, planetBiomes.biomeId))
            .where(eq(planetBiomes.planetId, planet.id));
```

Then add `biomes` to the returned planet object (in the return block around line 252):

```typescript
            biomes,
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/resource/resource.service.ts apps/api/src/modules/planet/planet.service.ts
git commit -m "feat(api): integrate biome bonuses into production calculations"
```

---

### Task 7: Frontend — Galaxy View Biome Display

**Files:**
- Modify: `apps/web/src/pages/Galaxy.tsx`

- [ ] **Step 1: Define rarity color map**

Add at the top of the Galaxy component file or in a shared constants file:

```typescript
const RARITY_COLORS: Record<string, string> = {
  common: '#9ca3af',    // gray
  uncommon: '#22c55e',  // green
  rare: '#3b82f6',      // blue
  epic: '#a855f7',      // purple
  legendary: '#eab308', // gold
};

const RARITY_LABELS: Record<string, string> = {
  common: 'Commun',
  uncommon: 'Peu commun',
  rare: 'Rare',
  epic: 'Épique',
  legendary: 'Légendaire',
};
```

- [ ] **Step 2: Display biomes in slot detail**

Find the section where empty slot or planet slot details are shown (the tooltip or expanded view). Add a biome list rendering:

```tsx
{slot.biomes && slot.biomes.length > 0 && (
  <div className="mt-2 space-y-1">
    <div className="text-xs text-zinc-400 font-medium">Biomes</div>
    {slot.biomes.map((biome: any) => (
      <div key={biome.id} className="flex items-center gap-2 text-xs">
        <span
          className="w-2 h-2 rounded-full inline-block"
          style={{ backgroundColor: RARITY_COLORS[biome.rarity] }}
        />
        <span style={{ color: RARITY_COLORS[biome.rarity] }}>{biome.name}</span>
        <span className="text-zinc-500">
          {biome.effects?.map((e: any) =>
            `${e.modifier > 0 ? '+' : ''}${Math.round(e.modifier * 100)}% ${e.stat.replace(/_/g, ' ')}`
          ).join(', ')}
        </span>
      </div>
    ))}
  </div>
)}
```

Adapt this JSX to match the existing UI patterns in Galaxy.tsx (card style, spacing, etc.).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/Galaxy.tsx
git commit -m "feat(web): display biomes in galaxy system view"
```

---

### Task 8: Frontend — Planet Detail Biome Display

**Files:**
- Modify: `apps/web/src/pages/Overview.tsx` (or the relevant planet detail component)

- [ ] **Step 1: Add biome section to planet overview**

In the Overview page, after the planet info section (name, coordinates, diameter, temperature), add a biomes section. The biome data comes from the empire overview or planet detail API.

```tsx
{planet.biomes && planet.biomes.length > 0 && (
  <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
    <h3 className="text-sm font-semibold text-zinc-300 mb-3">Biomes</h3>
    <div className="space-y-2">
      {planet.biomes.map((biome: any) => (
        <div key={biome.id} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: RARITY_COLORS[biome.rarity] }}
            />
            <span className="text-sm" style={{ color: RARITY_COLORS[biome.rarity] }}>
              {biome.name}
            </span>
            <span className="text-xs text-zinc-500">
              {RARITY_LABELS[biome.rarity]}
            </span>
          </div>
          <div className="text-xs text-zinc-400">
            {biome.effects?.map((e: any, i: number) => (
              <span key={i} className={e.modifier > 0 ? 'text-emerald-400' : 'text-red-400'}>
                {e.modifier > 0 ? '+' : ''}{Math.round(e.modifier * 100)}% {e.stat.replace(/_/g, ' ')}
                {i < biome.effects.length - 1 ? ', ' : ''}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
)}
```

Adapt to match the existing UI style (card borders, colors, spacing patterns from Overview.tsx).

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/Overview.tsx
git commit -m "feat(web): display biomes on planet detail page"
```

---

### Task 9: Verify End-to-End

- [ ] **Step 1: Run all game-engine tests**

```bash
cd packages/game-engine && npx vitest run
```

Expected: All tests pass, including the new biome tests.

- [ ] **Step 2: Run API tests**

```bash
cd apps/api && npx vitest run
```

Expected: Existing tests still pass (3 pre-existing failures are expected — those are in daily-quest tests).

- [ ] **Step 3: Build check**

```bash
npx turbo build
```

Expected: All packages build successfully with no TypeScript errors.

- [ ] **Step 4: Manual verification**

1. Run the seed: `cd packages/db && npx tsx src/seed-game-config.ts`
2. Start the dev server
3. Navigate to galaxy view → verify biomes appear on empty slots with rarity colors
4. Colonize a planet → verify biomes are persisted and appear on the planet detail
5. Check production rates → verify biome bonuses are reflected in the production numbers

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: planet biome system — complete implementation"
```
