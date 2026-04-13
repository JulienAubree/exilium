# Research Annex System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce 5 planet-type-specific research annexes on colonies that provide passive research speed bonuses and unlock exclusive technologies, while restricting the main lab to the homeworld.

**Architecture:** 5 new building definitions (one per non-homeworld planet type) reusing the existing building/bonus/prerequisite systems. New cross-planet bonus aggregation in the research service for annex levels and discovered biomes. New fields on `building_definitions` (`allowedPlanetTypes`) and `research_definitions` (`requiredAnnexType`) to enforce placement and prerequisite rules.

**Tech Stack:** Drizzle ORM (PostgreSQL), vitest, game-engine pure formulas, TRPC services.

**Spec:** `docs/superpowers/specs/2026-04-13-research-annex-system-design.md`

---

### Task 1: Schema — add new columns

**Files:**
- Modify: `packages/db/src/schema/game-config.ts:14-27` (buildingDefinitions table)
- Modify: `packages/db/src/schema/game-config.ts:51-65` (researchDefinitions table)
- Modify: `packages/db/src/schema/user-research.ts:4-22` (userResearch table)

- [ ] **Step 1: Add `allowedPlanetTypes` to `buildingDefinitions`**

In `packages/db/src/schema/game-config.ts`, add the column after `flavorText` (line 26):

```typescript
export const buildingDefinitions = pgTable('building_definitions', {
  // ... existing columns ...
  flavorText: text('flavor_text'),
  allowedPlanetTypes: jsonb('allowed_planet_types'), // string[] | null — null = all types
});
```

- [ ] **Step 2: Add `requiredAnnexType` to `researchDefinitions`**

In the same file, add after `maxLevel` (line 64):

```typescript
export const researchDefinitions = pgTable('research_definitions', {
  // ... existing columns ...
  maxLevel: smallint('max_level'),
  requiredAnnexType: varchar('required_annex_type', { length: 64 }),
});
```

- [ ] **Step 3: Add 5 columns to `userResearch`**

In `packages/db/src/schema/user-research.ts`, add after `planetaryExploration` (line 21):

```typescript
  planetaryExploration: smallint('planetary_exploration').notNull().default(0),
  volcanicWeaponry: smallint('volcanic_weaponry').notNull().default(0),
  aridArmor: smallint('arid_armor').notNull().default(0),
  temperateProduction: smallint('temperate_production').notNull().default(0),
  glacialShielding: smallint('glacial_shielding').notNull().default(0),
  gaseousPropulsion: smallint('gaseous_propulsion').notNull().default(0),
```

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema/game-config.ts packages/db/src/schema/user-research.ts
git commit -m "feat(db): add allowedPlanetTypes, requiredAnnexType, and annex research columns"
```

---

### Task 2: Game engine — annex and biome bonus formulas (TDD)

**Files:**
- Modify: `packages/game-engine/src/formulas/bonus.ts`
- Create: `packages/game-engine/src/formulas/bonus.test.ts`

- [ ] **Step 1: Write failing tests for `researchAnnexBonus`**

Create `packages/game-engine/src/formulas/bonus.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { researchAnnexBonus, researchBiomeBonus } from './bonus.js';

describe('researchAnnexBonus', () => {
  it('returns 1 when no annex levels', () => {
    expect(researchAnnexBonus(0)).toBe(1);
  });

  it('applies -5% per annex level', () => {
    expect(researchAnnexBonus(1)).toBeCloseTo(0.95);
    expect(researchAnnexBonus(5)).toBeCloseTo(0.75);
    expect(researchAnnexBonus(10)).toBeCloseTo(0.50);
  });

  it('clamps to minimum 0.01', () => {
    expect(researchAnnexBonus(25)).toBe(0.01);
    expect(researchAnnexBonus(100)).toBe(0.01);
  });
});

describe('researchBiomeBonus', () => {
  it('returns 1 when no biomes discovered', () => {
    expect(researchBiomeBonus(0)).toBe(1);
  });

  it('applies -1% per discovered biome', () => {
    expect(researchBiomeBonus(1)).toBeCloseTo(0.99);
    expect(researchBiomeBonus(12)).toBeCloseTo(0.88);
    expect(researchBiomeBonus(35)).toBeCloseTo(0.65);
  });

  it('clamps to minimum 0.01', () => {
    expect(researchBiomeBonus(200)).toBe(0.01);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/game-engine && npx vitest run src/formulas/bonus.test.ts`
Expected: FAIL — `researchAnnexBonus` and `researchBiomeBonus` are not exported.

- [ ] **Step 3: Implement the functions**

Add at the end of `packages/game-engine/src/formulas/bonus.ts`:

```typescript
/**
 * Passive research time multiplier from all annex lab levels combined.
 * Linear: each annex level gives -5% research time.
 * Unlike building bonuses in resolveBonus (diminishing returns),
 * this is intentionally linear to reward empire expansion.
 */
export function researchAnnexBonus(totalAnnexLevels: number, percentPerLevel: number = 5): number {
  if (totalAnnexLevels <= 0) return 1;
  return Math.max(0.01, 1 - totalAnnexLevels * (percentPerLevel / 100));
}

/**
 * Research time multiplier from total discovered biomes across all planets.
 * Each unique biome discovered gives -1% research time.
 */
export function researchBiomeBonus(totalDiscoveredBiomes: number, percentPerBiome: number = 1): number {
  if (totalDiscoveredBiomes <= 0) return 1;
  return Math.max(0.01, 1 - totalDiscoveredBiomes * (percentPerBiome / 100));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/game-engine && npx vitest run src/formulas/bonus.test.ts`
Expected: PASS — all 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/game-engine/src/formulas/bonus.ts packages/game-engine/src/formulas/bonus.test.ts
git commit -m "feat(game-engine): add researchAnnexBonus and researchBiomeBonus formulas with tests"
```

---

### Task 3: Seed data — annex buildings + exclusive researches + bonuses

**Files:**
- Modify: `packages/db/src/seed-game-config.ts`

- [ ] **Step 1: Add annex building definitions**

In `packages/db/src/seed-game-config.ts`, add 5 entries at the end of the `BUILDINGS` array (before the closing `];` at line 95). Also update the `researchLab` entry to add `allowedPlanetTypes`.

First, update the `researchLab` entry (line 74) — add `allowedPlanetTypes: ['homeworld']` to the object. All other existing buildings get no `allowedPlanetTypes` property (they default to null in the DB).

Then add the 5 annex buildings:

```typescript
  { id: 'labVolcanic', name: 'Forge Volcanique', description: "Annexe de recherche specialisee dans les technologies offensives, exploitant la chaleur extreme du volcanisme.", baseCostMinerai: 400, baseCostSilicium: 800, baseCostHydrogene: 400, costFactor: 1.8, baseTime: 120, categoryId: 'building_recherche', sortOrder: 1, role: null, flavorText: "Au coeur des coulees de lave, les forges volcaniques exploitent des temperatures impossibles a reproduire artificiellement pour developper des armes devastatrices.", prerequisites: [{ buildingId: 'researchLab', level: 6 }], allowedPlanetTypes: ['volcanic'] },
  { id: 'labArid', name: 'Laboratoire Aride', description: "Annexe de recherche specialisee dans les materiaux de blindage, tirant parti des mineraux rares du desert.", baseCostMinerai: 400, baseCostSilicium: 800, baseCostHydrogene: 400, costFactor: 1.8, baseTime: 120, categoryId: 'building_recherche', sortOrder: 2, role: null, flavorText: "Les conditions extremes du desert permettent de tester des alliages sous des contraintes thermiques et abrasives uniques.", prerequisites: [{ buildingId: 'researchLab', level: 6 }], allowedPlanetTypes: ['arid'] },
  { id: 'labTemperate', name: 'Bio-Laboratoire', description: "Annexe de recherche specialisee dans l'optimisation de la production, s'appuyant sur la biodiversite locale.", baseCostMinerai: 400, baseCostSilicium: 800, baseCostHydrogene: 400, costFactor: 1.8, baseTime: 120, categoryId: 'building_recherche', sortOrder: 3, role: null, flavorText: "La richesse biologique des mondes temperes inspire des procedes d'optimisation energetique et productive sans equivalent.", prerequisites: [{ buildingId: 'researchLab', level: 6 }], allowedPlanetTypes: ['temperate'] },
  { id: 'labGlacial', name: 'Cryo-Laboratoire', description: "Annexe de recherche specialisee dans les technologies defensives, exploitant les proprietes cryogeniques.", baseCostMinerai: 400, baseCostSilicium: 800, baseCostHydrogene: 400, costFactor: 1.8, baseTime: 120, categoryId: 'building_recherche', sortOrder: 4, role: null, flavorText: "Les temperatures proches du zero absolu permettent de developper des supraconducteurs et des boucliers d'une efficacite inegalee.", prerequisites: [{ buildingId: 'researchLab', level: 6 }], allowedPlanetTypes: ['glacial'] },
  { id: 'labGaseous', name: 'Nebula-Lab', description: "Annexe de recherche specialisee dans la propulsion, exploitant les courants atmospheriques et les gaz rares.", baseCostMinerai: 400, baseCostSilicium: 800, baseCostHydrogene: 400, costFactor: 1.8, baseTime: 120, categoryId: 'building_recherche', sortOrder: 5, role: null, flavorText: "Flottant dans l'atmosphere dense des geantes gazeuses, le Nebula-Lab teste des systemes de propulsion dans des conditions extremes.", prerequisites: [{ buildingId: 'researchLab', level: 6 }], allowedPlanetTypes: ['gaseous'] },
```

Note: The prerequisite `researchLab level 6` will be checked cross-planet (see Task 5) since `allowedPlanetTypes` is set. This allows the annex on a colony to require the lab on the homeworld.

- [ ] **Step 2: Add exclusive research definitions**

Add 5 entries at the end of the `RESEARCH` array (before the closing `];` at line 118):

```typescript
  { id: 'volcanicWeaponry', name: 'Metallurgie de plasma', description: "Les forges volcaniques permettent de developper des armes d'une puissance superieure.", baseCostMinerai: 2000, baseCostSilicium: 4000, baseCostHydrogene: 1000, costFactor: 2, levelColumn: 'volcanicWeaponry', categoryId: 'research_combat', sortOrder: 20, flavorText: "Le plasma en fusion, canalise par des champs magnetiques, produit des projectiles capables de traverser n'importe quel blindage.", effectDescription: "Chaque niveau augmente les degats de toutes les unites de 10%.", maxLevel: null, requiredAnnexType: 'volcanic', prerequisites: { buildings: [], research: [{ researchId: 'weapons', level: 3 }] } },
  { id: 'aridArmor', name: 'Blindage composite', description: "Les mineraux rares du desert permettent de creer des alliages de coque ultra-resistants.", baseCostMinerai: 2000, baseCostSilicium: 4000, baseCostHydrogene: 1000, costFactor: 2, levelColumn: 'aridArmor', categoryId: 'research_combat', sortOrder: 21, flavorText: "Des fibres minerales entrelacees avec des nano-polymeres forment un blindage composite capable d'absorber des impacts devastateurs.", effectDescription: "Chaque niveau augmente la coque de toutes les unites de 10%.", maxLevel: null, requiredAnnexType: 'arid', prerequisites: { buildings: [], research: [{ researchId: 'armor', level: 3 }] } },
  { id: 'temperateProduction', name: 'Symbiose adaptative', description: "L'etude des ecosystemes temperes ameliore l'efficacite de toutes les chaines de production.", baseCostMinerai: 2000, baseCostSilicium: 4000, baseCostHydrogene: 1000, costFactor: 2, levelColumn: 'temperateProduction', categoryId: 'research_sciences', sortOrder: 22, flavorText: "Des micro-organismes symbiotiques, adaptes a chaque processus industriel, optimisent la production de toutes les ressources.", effectDescription: "Chaque niveau augmente la production de toutes les ressources de 2%.", maxLevel: null, requiredAnnexType: 'temperate', prerequisites: { buildings: [], research: [{ researchId: 'energyTech', level: 3 }] } },
  { id: 'glacialShielding', name: 'Bouclier cryogenique', description: "Les supraconducteurs cryogeniques permettent de creer des boucliers d'une efficacite inegalee.", baseCostMinerai: 2000, baseCostSilicium: 4000, baseCostHydrogene: 1000, costFactor: 2, levelColumn: 'glacialShielding', categoryId: 'research_combat', sortOrder: 23, flavorText: "Des circuits supraconducteurs refroidis a des temperatures proches du zero absolu generent des champs de force d'une stabilite parfaite.", effectDescription: "Chaque niveau augmente les boucliers de toutes les unites de 10%.", maxLevel: null, requiredAnnexType: 'glacial', prerequisites: { buildings: [], research: [{ researchId: 'shielding', level: 3 }] } },
  { id: 'gaseousPropulsion', name: 'Propulsion ionique avancee', description: "Les gaz rares des geantes gazeuses alimentent des moteurs d'une vitesse inegalee.", baseCostMinerai: 2000, baseCostSilicium: 4000, baseCostHydrogene: 1000, costFactor: 2, levelColumn: 'gaseousPropulsion', categoryId: 'research_propulsion', sortOrder: 24, flavorText: "Des ions lourds extraits de l'atmosphere dense sont acceleres a des vitesses relativistes, propulsant les vaisseaux au-dela de toutes les limites connues.", effectDescription: "Chaque niveau augmente la vitesse de tous les vaisseaux de 10%.", maxLevel: null, requiredAnnexType: 'gaseous', prerequisites: { buildings: [], research: [{ researchId: 'impulse', level: 3 }] } },
```

- [ ] **Step 3: Add bonus definitions for exclusive researches**

Add 5 entries at the end of the `BONUS_DEFINITIONS` array:

```typescript
  { id: 'volcanicWeaponry__weapons', sourceType: 'research', sourceId: 'volcanicWeaponry', stat: 'weapons', percentPerLevel: 10, category: null, statLabel: 'Degats des armes (Forge Volcanique)' },
  { id: 'aridArmor__armor', sourceType: 'research', sourceId: 'aridArmor', stat: 'armor', percentPerLevel: 10, category: null, statLabel: 'Resistance de la coque (Laboratoire Aride)' },
  { id: 'temperateProduction__all_production', sourceType: 'research', sourceId: 'temperateProduction', stat: 'all_production', percentPerLevel: 2, category: null, statLabel: 'Production de toutes les ressources (Bio-Laboratoire)' },
  { id: 'glacialShielding__shielding', sourceType: 'research', sourceId: 'glacialShielding', stat: 'shielding', percentPerLevel: 10, category: null, statLabel: 'Puissance des boucliers (Cryo-Laboratoire)' },
  { id: 'gaseousPropulsion__ship_speed', sourceType: 'research', sourceId: 'gaseousPropulsion', stat: 'ship_speed', percentPerLevel: 10, category: null, statLabel: 'Vitesse des vaisseaux (Nebula-Lab)' },
```

Note: the annex passive bonus (-5% research time per level) is NOT added to `BONUS_DEFINITIONS` because the existing `resolveBonus()` uses diminishing returns for buildings. The annex bonus is computed separately via the new `researchAnnexBonus()` function (linear). This is intentional per the spec.

- [ ] **Step 4: Handle `allowedPlanetTypes` and `requiredAnnexType` in the seed insertion logic**

Search the seed file for where `BUILDINGS` and `RESEARCH` are inserted into the database. The `allowedPlanetTypes` field must be included in the building upsert, and `requiredAnnexType` in the research upsert. The existing buildings that don't have `allowedPlanetTypes` will get `null` (the default), which is correct.

Check how the seed function maps the `prerequisites` field — it's likely extracted before insertion. Follow the same pattern: extract `allowedPlanetTypes` from each building entry before insertion, then include it in the `values` for the `buildingDefinitions` insert.

Similarly, extract `requiredAnnexType` from each research entry.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/seed-game-config.ts
git commit -m "feat(db): add annex buildings, exclusive researches, and bonus definitions to seed data"
```

---

### Task 4: Building service — planet type restriction

**Files:**
- Modify: `apps/api/src/modules/building/building.service.ts:33-78` (listBuildings)
- Modify: `apps/api/src/modules/building/building.service.ts:80-167` (startUpgrade)

- [ ] **Step 1: Modify `listBuildings` to filter by planet type**

In `apps/api/src/modules/building/building.service.ts`, the `listBuildings` method (line 33) needs to fetch the planet's type and filter buildings.

Replace the current `listBuildings` method starting at line 33:

```typescript
    async listBuildings(userId: string, planetId: string) {
      const planet = await this.getOwnedPlanet(userId, planetId);
      const config = await gameConfigService.getFullConfig();
      const buildingLevels = await this.getBuildingLevels(planetId);

      const [activeBuild] = await db
        .select()
        .from(buildQueue)
        .where(
          and(
            eq(buildQueue.planetId, planetId),
            eq(buildQueue.type, 'building'),
            eq(buildQueue.status, 'active'),
          ),
        )
        .limit(1);

      const phaseMap = config.universe.phase_multiplier
        ? Object.fromEntries(Object.entries(config.universe.phase_multiplier as Record<string, number>).map(([k, v]) => [Number(k), v]))
        : undefined;

      const talentCtx = talentService ? await talentService.computeTalentContext(userId, planetId) : {};
      const talentTimeMultiplier = 1 / (1 + (talentCtx['building_time'] ?? 0));

      return Object.values(config.buildings)
        .filter((def) => {
          // Filter out buildings incompatible with this planet type
          const allowed = def.allowedPlanetTypes as string[] | null;
          if (allowed === null || allowed === undefined) return true;
          return allowed.includes(planet.planetClassId ?? '');
        })
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((def) => {
          const currentLevel = buildingLevels[def.id] ?? 0;
          const nextLevel = currentLevel + 1;
          const cost = buildingCost(def, nextLevel, phaseMap);
          const bonusMultiplier = resolveBonus('building_time', null, buildingLevels, config.bonuses);
          const time = buildingTime(def, nextLevel, bonusMultiplier * talentTimeMultiplier, phaseMap);

          return {
            id: def.id,
            name: def.name,
            description: def.description,
            currentLevel,
            nextLevelCost: cost,
            nextLevelTime: time,
            prerequisites: def.prerequisites,
            isUpgrading: activeBuild?.itemId === def.id,
            upgradeEndTime: activeBuild?.itemId === def.id ? activeBuild.endTime.toISOString() : null,
          };
        });
    },
```

Key change: `const planet = await this.getOwnedPlanet(...)` (was already called but result unused) + `.filter()` before `.map()`.

- [ ] **Step 2: Modify `startUpgrade` to validate planet type and cross-planet prerequisites**

In `startUpgrade` (line 80), add planet type validation after the building definition check, and modify the prerequisite check to support cross-planet prerequisites for annex buildings.

After line 84 (`if (!def) throw ...`), add:

```typescript
      // Check planet type restriction
      const allowedTypes = def.allowedPlanetTypes as string[] | null;
      if (allowedTypes && !allowedTypes.includes(planet.planetClassId ?? '')) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Ce batiment ne peut pas etre construit sur ce type de planete',
        });
      }
```

Then modify the prerequisite check (lines 105-116). For annex buildings (those with `allowedPlanetTypes` set), prerequisites must be checked cross-planet (e.g., researchLab on the homeworld):

```typescript
      // Check prerequisites
      // For buildings restricted to specific planet types (annexes), check prerequisites
      // across ALL player's planets (e.g., researchLab on homeworld)
      let prereqLevels = buildingLevels;
      if (allowedTypes) {
        const allPlanetRows = await db
          .select({ buildingId: planetBuildings.buildingId, level: planetBuildings.level })
          .from(planetBuildings)
          .innerJoin(planets, eq(planets.id, planetBuildings.planetId))
          .where(eq(planets.userId, userId));
        const globalLevels: Record<string, number> = {};
        for (const row of allPlanetRows) {
          globalLevels[row.buildingId] = Math.max(globalLevels[row.buildingId] ?? 0, row.level);
        }
        prereqLevels = globalLevels;
      }

      for (const prereq of def.prerequisites) {
        const prereqLevel = prereqLevels[prereq.buildingId] ?? 0;
        if (prereqLevel < prereq.level) {
          const prereqDef = config.buildings[prereq.buildingId];
          const prereqName = prereqDef?.name ?? prereq.buildingId;
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Prerequis non rempli : ${prereqName} niveau ${prereq.level}`,
          });
        }
      }
```

- [ ] **Step 3: Verify build passes**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/building/building.service.ts
git commit -m "feat(building): enforce allowedPlanetTypes restriction with cross-planet prerequisites"
```

---

### Task 5: Research service — cross-planet annex & biome bonuses + annex prerequisite

**Files:**
- Modify: `apps/api/src/modules/research/research.service.ts`

- [ ] **Step 1: Add imports for new formulas and DB tables**

At the top of `apps/api/src/modules/research/research.service.ts`, update the game-engine import (line 5):

```typescript
import { researchCost, researchTime, checkResearchPrerequisites, resolveBonus, researchAnnexBonus, researchBiomeBonus } from '@exilium/game-engine';
```

Add `discoveredBiomes` to the DB import (line 3):

```typescript
import { planets, userResearch, buildQueue, planetBuildings, discoveredBiomes } from '@exilium/db';
```

Add `sql` to the drizzle import (line 1):

```typescript
import { eq, and, sql, inArray } from 'drizzle-orm';
```

- [ ] **Step 2: Add helper functions for cross-planet data**

After the existing `getBuildingLevels` function (line 22), add two new helpers:

```typescript
const ANNEX_BUILDING_IDS = ['labVolcanic', 'labArid', 'labTemperate', 'labGlacial', 'labGaseous'];

async function getAnnexLevelsSum(db: Database, userId: string): Promise<number> {
  const userPlanets = db
    .select({ id: planets.id })
    .from(planets)
    .where(eq(planets.userId, userId));

  const [result] = await db
    .select({ total: sql<number>`coalesce(sum(${planetBuildings.level}), 0)` })
    .from(planetBuildings)
    .where(
      and(
        inArray(planetBuildings.planetId, userPlanets),
        inArray(planetBuildings.buildingId, ANNEX_BUILDING_IDS),
      ),
    );
  return Number(result?.total ?? 0);
}

async function getDiscoveredBiomesCount(db: Database, userId: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(discoveredBiomes)
    .where(eq(discoveredBiomes.userId, userId));
  return Number(result?.count ?? 0);
}

async function hasAnnexOfType(db: Database, userId: string, annexType: string): Promise<boolean> {
  const annexBuildingId = `lab${annexType.charAt(0).toUpperCase()}${annexType.slice(1)}`;
  const userPlanets = db
    .select({ id: planets.id })
    .from(planets)
    .where(eq(planets.userId, userId));

  const [result] = await db
    .select({ level: planetBuildings.level })
    .from(planetBuildings)
    .where(
      and(
        inArray(planetBuildings.planetId, userPlanets),
        eq(planetBuildings.buildingId, annexBuildingId),
      ),
    )
    .limit(1);
  return (result?.level ?? 0) >= 1;
}
```

- [ ] **Step 3: Update `listResearch` to include annex/biome bonuses and annex prerequisite**

In the `listResearch` method, after line 57 (`const hullTimeMultiplier = ...`), add:

```typescript
      const annexLevelsSum = await getAnnexLevelsSum(db, userId);
      const annexBonusMultiplier = researchAnnexBonus(annexLevelsSum);
      const discoveredBiomesCount = await getDiscoveredBiomesCount(db, userId);
      const biomeBonusMultiplier = researchBiomeBonus(discoveredBiomesCount);
```

Update the time calculation inside the `.map()` (line 66):

```typescript
          const time = Math.max(1, Math.floor(researchTime(def, nextLevel, bonusMultiplier, { timeDivisor, phaseMap }) * talentTimeMultiplier * hullTimeMultiplier * annexBonusMultiplier * biomeBonusMultiplier));
```

Add the annex prerequisite check after `prereqCheck` (line 72). Modify the return to include annex info:

```typescript
          const researchLevels: Record<string, number> = {};
          for (const [key, rDef] of Object.entries(config.research)) {
            researchLevels[key] = (research[rDef.levelColumn as keyof typeof research] ?? 0) as number;
          }
          const prereqCheck = checkResearchPrerequisites(def.prerequisites, buildingLevels, researchLevels);

          // Check annex prerequisite if required
          const requiredAnnex = (def as { requiredAnnexType?: string | null }).requiredAnnexType;
          let annexMet = true;
          if (requiredAnnex) {
            // We already fetched annexLevelsSum, but need to check specific type
            // Use a cached lookup per type to avoid N+1
            annexMet = await hasAnnexOfType(db, userId, requiredAnnex);
          }

          return {
            id: def.id,
            name: def.name,
            description: def.description,
            currentLevel,
            nextLevelCost: cost,
            nextLevelTime: time,
            prerequisitesMet: prereqCheck.met && annexMet,
            missingPrerequisites: [
              ...prereqCheck.missing,
              ...(requiredAnnex && !annexMet ? [`Requires annex: ${requiredAnnex}`] : []),
            ],
            requiredAnnexType: requiredAnnex ?? null,
            isResearching: activeResearch?.itemId === def.id,
            researchEndTime: activeResearch?.itemId === def.id ? activeResearch.endTime.toISOString() : null,
          };
```

Note: The `.map()` callback becomes `async`. The method will need to change from `.map()` to a loop or `Promise.all()` to handle the async annex check. Wrap the map with `Promise.all()`:

```typescript
      const results = await Promise.all(
        Object.values(config.research)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(async (def) => {
            // ... all the existing logic + new annex check ...
          }),
      );
      return results;
```

- [ ] **Step 4: Update `startResearch` to include annex/biome bonuses and validate annex prerequisite**

In `startResearch`, after the existing prerequisite check (line 118-120), add the annex prerequisite validation:

```typescript
      // Check annex prerequisite
      const requiredAnnex = (def as { requiredAnnexType?: string | null }).requiredAnnexType;
      if (requiredAnnex) {
        const hasAnnex = await hasAnnexOfType(db, userId, requiredAnnex);
        if (!hasAnnex) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `Annexe requise : ${requiredAnnex}` });
        }
      }
```

After line 135 (`const hullTimeMultiplier = ...`), add:

```typescript
      const annexLevelsSum = await getAnnexLevelsSum(db, userId);
      const annexBonusMultiplier = researchAnnexBonus(annexLevelsSum);
      const discoveredBiomesCount = await getDiscoveredBiomesCount(db, userId);
      const biomeBonusMultiplier = researchBiomeBonus(discoveredBiomesCount);
```

Update the time calculation (line 136):

```typescript
      const time = Math.max(1, Math.floor(researchTime(def, nextLevel, bonusMultiplier, { timeDivisor, phaseMap }) * talentTimeMultiplier * hullTimeMultiplier * annexBonusMultiplier * biomeBonusMultiplier));
```

- [ ] **Step 5: Verify build passes**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/research/research.service.ts
git commit -m "feat(research): add cross-planet annex bonus, biome bonus, and annex prerequisite check"
```

---

### Task 6: Migration generation & verification

**Files:**
- Generated: `packages/db/drizzle/0034_*.sql` (or next number)

- [ ] **Step 1: Generate drizzle migration**

Run: `cd packages/db && npx drizzle-kit generate`

This will auto-detect the schema changes and generate a SQL migration file with:
- `ALTER TABLE building_definitions ADD COLUMN allowed_planet_types jsonb`
- `ALTER TABLE research_definitions ADD COLUMN required_annex_type varchar(64)`
- `ALTER TABLE user_research ADD COLUMN volcanic_weaponry smallint NOT NULL DEFAULT 0`
- `ALTER TABLE user_research ADD COLUMN arid_armor smallint NOT NULL DEFAULT 0`
- `ALTER TABLE user_research ADD COLUMN temperate_production smallint NOT NULL DEFAULT 0`
- `ALTER TABLE user_research ADD COLUMN glacial_shielding smallint NOT NULL DEFAULT 0`
- `ALTER TABLE user_research ADD COLUMN gaseous_propulsion smallint NOT NULL DEFAULT 0`

- [ ] **Step 2: Review the generated migration**

Read the generated file in `packages/db/drizzle/` and verify it matches expectations. Ensure no destructive operations (DROP, DELETE).

- [ ] **Step 3: Verify the full project builds**

Run: `cd /Users/julienaubree/_projet/exilium-game/exilium && npm run build` (or equivalent turbo build command)
Expected: Clean build with no errors.

- [ ] **Step 4: Run all existing tests**

Run: `cd /Users/julienaubree/_projet/exilium-game/exilium && npm test` (or equivalent turbo test command)
Expected: All existing tests pass + new bonus tests pass.

- [ ] **Step 5: Commit migration**

```bash
git add packages/db/drizzle/
git commit -m "chore(db): generate migration for annex system schema changes"
```

---

### Task 7: Verify bonus consumption end-to-end

**Files:**
- Read-only verification of existing bonus consumers

- [ ] **Step 1: Verify `weapons` stat consumption in combat formulas**

Read `packages/game-engine/src/formulas/combat.ts` and search for how `resolveBonus('weapons', ...)` is called. The `volcanicWeaponry__weapons` bonus needs `volcanicWeaponry` to be present in the `userLevels` passed to `resolveBonus`. Verify that combat formulas receive research levels (not just building levels). If they receive research levels, `volcanicWeaponry` will be picked up automatically once it's in `user_research`.

- [ ] **Step 2: Verify `armor` stat consumption**

Same check for `resolveBonus('armor', ...)` — must receive research levels containing `aridArmor`.

- [ ] **Step 3: Verify `shielding` stat consumption**

Same check for `resolveBonus('shielding', ...)` — must receive research levels containing `glacialShielding`.

- [ ] **Step 4: Verify `ship_speed` stat consumption**

Check `packages/game-engine/src/formulas/fleet.ts` for how ship speed bonuses are consumed. The `gaseousPropulsion__ship_speed` bonus needs research levels to include `gaseousPropulsion`. Verify the `category` field — `gaseousPropulsion` has `category: null`, which means it applies to ALL drive types (matching the spec "+10% vitesse de tous les vaisseaux"). This differs from existing propulsion bonuses that have specific categories like `combustion`, `impulse`. Verify this is correct behavior.

- [ ] **Step 5: Verify `all_production` stat consumption for temperateProduction**

The `temperateProduction__all_production` bonus uses stat `all_production` with `percentPerLevel: 2`. Check in `packages/game-engine/src/formulas/resources.ts` and `packages/game-engine/src/formulas/production.ts` whether `resolveBonus('all_production', ...)` is already consumed somewhere. If not, this bonus needs a consumer to be added to the production formulas, or the stat key needs to match an existing one (e.g., separate entries for `production_minerai`, `production_silicium`, `production_hydrogene` at 2% each).

**Important:** If `all_production` is not consumed anywhere, the `temperateProduction` bonus definition needs to be split into 3 entries:

```typescript
  { id: 'temperateProduction__production_minerai', sourceType: 'research', sourceId: 'temperateProduction', stat: 'production_minerai', percentPerLevel: 2, category: null, statLabel: 'Production de minerai (Bio-Laboratoire)' },
  { id: 'temperateProduction__production_silicium', sourceType: 'research', sourceId: 'temperateProduction', stat: 'production_silicium', percentPerLevel: 2, category: null, statLabel: 'Production de silicium (Bio-Laboratoire)' },
  { id: 'temperateProduction__production_hydrogene', sourceType: 'research', sourceId: 'temperateProduction', stat: 'production_hydrogene', percentPerLevel: 2, category: null, statLabel: "Production d'hydrogene (Bio-Laboratoire)" },
```

Replace the single `temperateProduction__all_production` entry in the seed data accordingly.

- [ ] **Step 6: Fix any missing consumers and commit**

If any bonus stat is not consumed by the existing formulas, add the necessary calls. Commit any fixes:

```bash
git add -A
git commit -m "fix: ensure all annex research bonuses are consumed by existing formulas"
```
