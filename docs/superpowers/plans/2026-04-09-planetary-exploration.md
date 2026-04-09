# Planetary Exploration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a planetary exploration system where players send explorer ships to discover hidden biomes on uncolonized positions, with probability-based discovery influenced by ship count and research level.

**Architecture:** New research `planetary_exploration` + new ship `explorer` + new mission type `explore` using the existing `PhasedMissionHandler` pattern (outbound -> scan phase -> return). New `discovered_biomes` table tracks per-player discoveries. Galaxy view hides biomes until explored. Colonization auto-discovers all biomes.

**Tech Stack:** Drizzle ORM (PostgreSQL), TypeScript, Vitest, tRPC, React, BullMQ (fleet queue)

**Spec:** `docs/superpowers/specs/2026-04-09-planetary-exploration-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/db/src/schema/user-research.ts` | Modify | Add `planetaryExploration` column |
| `packages/db/src/schema/fleet-events.ts` | Modify | Add `'explore'` to fleet mission enum |
| `packages/db/src/schema/planet-ships.ts` | Modify | Add `explorer` column |
| `packages/db/src/schema/biomes.ts` | Modify | Add `discoveredBiomes` table |
| `packages/db/drizzle/0030_planetary_exploration.sql` | Create | Migration SQL |
| `packages/db/src/seed-game-config.ts` | Modify | Add research + ship + mission definitions |
| `packages/shared/src/types/missions.ts` | Modify | Add `Explore` to MissionType enum |
| `packages/game-engine/src/formulas/exploration.ts` | Create | Discovery probability formula |
| `packages/game-engine/src/formulas/exploration.test.ts` | Create | Tests for exploration formula |
| `packages/game-engine/src/index.ts` | Modify | Export exploration module |
| `apps/api/src/modules/fleet/handlers/explore.handler.ts` | Create | ExploreHandler (phased mission) |
| `apps/api/src/modules/fleet/fleet.service.ts` | Modify | Register ExploreHandler |
| `apps/api/src/modules/fleet/handlers/colonize.handler.ts` | Modify | Auto-discover biomes on colonization |
| `apps/api/src/modules/galaxy/galaxy.service.ts` | Modify | Filter biomes by discovery state |
| `apps/web/src/pages/Galaxy.tsx` | Modify | Hide undiscovered biomes, add Explorer button |

---

### Task 1: Database Schema + Migration

**Files:**
- Modify: `packages/db/src/schema/user-research.ts`
- Modify: `packages/db/src/schema/fleet-events.ts`
- Modify: `packages/db/src/schema/planet-ships.ts`
- Modify: `packages/db/src/schema/biomes.ts`
- Create: `packages/db/drizzle/0030_planetary_exploration.sql`

- [ ] **Step 1: Add `planetaryExploration` column to user-research schema**

In `packages/db/src/schema/user-research.ts`, add after the `armoredStorage` line:

```typescript
  planetaryExploration: smallint('planetary_exploration').notNull().default(0),
```

- [ ] **Step 2: Add `explorer` column to planet-ships schema**

In `packages/db/src/schema/planet-ships.ts`, add after `solarSatellite`:

```typescript
  explorer: integer('explorer').notNull().default(0),
```

- [ ] **Step 3: Add `'explore'` to fleet mission enum**

In `packages/db/src/schema/fleet-events.ts`, add `'explore'` to the `fleetMissionEnum` array:

```typescript
export const fleetMissionEnum = pgEnum('fleet_mission', [
  'transport',
  'station',
  'spy',
  'attack',
  'colonize',
  'recycle',
  'mine',
  'pirate',
  'trade',
  'scan',
  'explore',
]);
```

- [ ] **Step 4: Add `discoveredBiomes` table to biomes schema**

In `packages/db/src/schema/biomes.ts`, add:

```typescript
import { smallint } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const discoveredBiomes = pgTable('discovered_biomes', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  galaxy: smallint('galaxy').notNull(),
  system: smallint('system').notNull(),
  position: smallint('position').notNull(),
  biomeId: varchar('biome_id', { length: 64 }).notNull().references(() => biomeDefinitions.id, { onDelete: 'cascade' }),
}, (t) => [
  primaryKey({ columns: [t.userId, t.galaxy, t.system, t.position, t.biomeId] }),
]);
```

Note: `smallint` and `users` imports need to be added at the top of the file.

- [ ] **Step 5: Create migration SQL**

Create `packages/db/drizzle/0030_planetary_exploration.sql`:

```sql
-- Add planetary_exploration research column
ALTER TABLE "user_research" ADD COLUMN "planetary_exploration" smallint NOT NULL DEFAULT 0;

-- Add explorer ship column
ALTER TABLE "planet_ships" ADD COLUMN "explorer" integer NOT NULL DEFAULT 0;

-- Add 'explore' to fleet_mission enum
ALTER TYPE "fleet_mission" ADD VALUE IF NOT EXISTS 'explore';

-- Discovered biomes table (per-player, per-position)
CREATE TABLE "discovered_biomes" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "galaxy" smallint NOT NULL,
  "system" smallint NOT NULL,
  "position" smallint NOT NULL,
  "biome_id" varchar(64) NOT NULL REFERENCES "biome_definitions"("id") ON DELETE CASCADE,
  PRIMARY KEY ("user_id", "galaxy", "system", "position", "biome_id")
);

CREATE INDEX "discovered_biomes_user_coords_idx" ON "discovered_biomes" ("user_id", "galaxy", "system");
```

- [ ] **Step 6: Add `Explore` to MissionType enum**

In `packages/shared/src/types/missions.ts`, add:

```typescript
  Explore = 'explore',
```

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/schema/user-research.ts packages/db/src/schema/fleet-events.ts packages/db/src/schema/planet-ships.ts packages/db/src/schema/biomes.ts packages/db/drizzle/0030_planetary_exploration.sql packages/shared/src/types/missions.ts
git commit -m "feat(db): add planetary exploration schema (research, ship, mission, discoveries)"
```

---

### Task 2: Exploration Formula (game-engine)

**Files:**
- Create: `packages/game-engine/src/formulas/exploration.test.ts`
- Create: `packages/game-engine/src/formulas/exploration.ts`
- Modify: `packages/game-engine/src/index.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/game-engine/src/formulas/exploration.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { biomeDiscoveryProbability, scanDuration } from './exploration.js';

describe('biomeDiscoveryProbability', () => {
  it('returns ~22% for common with 1 ship, research 1', () => {
    const prob = biomeDiscoveryProbability(1, 1, 'common');
    expect(prob).toBeCloseTo(0.224, 2);
  });

  it('returns ~3% for legendary with 1 ship, research 1', () => {
    const prob = biomeDiscoveryProbability(1, 1, 'legendary');
    expect(prob).toBeCloseTo(0.028, 2);
  });

  it('scales with ship count', () => {
    const p1 = biomeDiscoveryProbability(1, 1, 'common');
    const p3 = biomeDiscoveryProbability(3, 1, 'common');
    const p5 = biomeDiscoveryProbability(5, 1, 'common');
    expect(p3).toBeGreaterThan(p1);
    expect(p5).toBeGreaterThan(p3);
  });

  it('scales with research level', () => {
    const r1 = biomeDiscoveryProbability(3, 1, 'rare');
    const r5 = biomeDiscoveryProbability(3, 5, 'rare');
    const r10 = biomeDiscoveryProbability(3, 10, 'rare');
    expect(r5).toBeGreaterThan(r1);
    expect(r10).toBeGreaterThan(r5);
  });

  it('caps at 95%', () => {
    const prob = biomeDiscoveryProbability(100, 100, 'common');
    expect(prob).toBe(0.95);
  });

  it('returns higher probability for common than legendary', () => {
    const common = biomeDiscoveryProbability(5, 5, 'common');
    const legendary = biomeDiscoveryProbability(5, 5, 'legendary');
    expect(common).toBeGreaterThan(legendary);
  });

  it('matches expected values from spec table', () => {
    // 5 ships, research 5: common ~82%, rare ~27%, epic ~16%, legendary ~10%
    expect(biomeDiscoveryProbability(5, 5, 'common')).toBeCloseTo(0.82, 1);
    expect(biomeDiscoveryProbability(5, 5, 'rare')).toBeCloseTo(0.27, 1);
    expect(biomeDiscoveryProbability(5, 5, 'epic')).toBeCloseTo(0.16, 1);
    expect(biomeDiscoveryProbability(5, 5, 'legendary')).toBeCloseTo(0.10, 1);
  });
});

describe('scanDuration', () => {
  it('returns 1800s at research 0', () => {
    expect(scanDuration(0)).toBe(1800);
  });

  it('decreases with research level', () => {
    expect(scanDuration(5)).toBeCloseTo(1200, -1);
    expect(scanDuration(10)).toBeCloseTo(900, -1);
  });

  it('never goes below a minimum', () => {
    expect(scanDuration(1000)).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/game-engine && npx vitest run src/formulas/exploration.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement exploration module**

Create `packages/game-engine/src/formulas/exploration.ts`:

```typescript
const BASE_CHANCE = 0.20;
const SHIP_FACTOR_COEFF = 0.35;
const RESEARCH_FACTOR_COEFF = 0.12;
const MAX_PROBABILITY = 0.95;
const BASE_SCAN_DURATION = 1800; // seconds
const SCAN_RESEARCH_COEFF = 0.1;

const RARITY_PENALTY: Record<string, number> = {
  common: 1,
  uncommon: 1.8,
  rare: 3,
  epic: 5,
  legendary: 8,
};

/**
 * Calculate the probability of discovering a biome during an exploration mission.
 *
 * @param shipCount - Number of explorer ships sent
 * @param researchLevel - Level of planetary_exploration research
 * @param rarity - Biome rarity tier
 * @returns Probability between 0 and 0.95
 */
export function biomeDiscoveryProbability(
  shipCount: number,
  researchLevel: number,
  rarity: string,
): number {
  const shipFactor = 1 + (shipCount - 1) * SHIP_FACTOR_COEFF;
  const researchFactor = 1 + researchLevel * RESEARCH_FACTOR_COEFF;
  const penalty = RARITY_PENALTY[rarity] ?? 1;
  return Math.min(MAX_PROBABILITY, BASE_CHANCE * shipFactor * researchFactor / penalty);
}

/**
 * Calculate scan duration in seconds based on research level.
 *
 * @param researchLevel - Level of planetary_exploration research
 * @returns Duration in seconds
 */
export function scanDuration(researchLevel: number): number {
  return Math.floor(BASE_SCAN_DURATION / (1 + researchLevel * SCAN_RESEARCH_COEFF));
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/game-engine && npx vitest run src/formulas/exploration.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Export from game-engine index**

In `packages/game-engine/src/index.ts`, add:

```typescript
export * from './formulas/exploration.js';
```

- [ ] **Step 6: Commit**

```bash
git add packages/game-engine/src/formulas/exploration.ts packages/game-engine/src/formulas/exploration.test.ts packages/game-engine/src/index.ts
git commit -m "feat(game-engine): add exploration discovery probability and scan duration formulas"
```

---

### Task 3: Seed Research + Ship + Mission

**Files:**
- Modify: `packages/db/src/seed-game-config.ts`

- [ ] **Step 1: Add exploration research to RESEARCH array**

In `packages/db/src/seed-game-config.ts`, add to the `RESEARCH` array (after the last entry, before the closing `];`):

```typescript
  { id: 'planetaryExploration', name: 'Exploration planétaire', description: "Permet d'explorer les planètes pour découvrir leurs biomes.", baseCostMinerai: 1000, baseCostSilicium: 2000, baseCostHydrogene: 500, costFactor: 2, levelColumn: 'planetaryExploration', categoryId: 'research_sciences', sortOrder: 15, flavorText: "L'étude approfondie des écosystèmes planétaires révèle des biomes aux propriétés uniques, offrant des avantages stratégiques à ceux qui savent les exploiter.", effectDescription: "Niveau 1 : débloque le vaisseau Explorateur. Chaque niveau augmente les chances de découvrir des biomes lors des missions d'exploration.", maxLevel: null, prerequisites: { buildings: [{ buildingId: 'researchLab', level: 3 }], research: [{ researchId: 'espionageTech', level: 2 }] } },
```

- [ ] **Step 2: Add explorer ship to SHIPS array**

In the `SHIPS` array, add after the `solarSatellite` entry (in the industrial/utility section):

```typescript
  { id: 'explorer', name: 'Explorateur', description: "Vaisseau scientifique d'exploration planétaire.", costMinerai: 3000, costSilicium: 2000, costHydrogene: 500, countColumn: 'explorer', baseSpeed: 8000, fuelConsumption: 20, cargoCapacity: 0, driveType: 'combustion', weapons: 0, shield: 5, hull: 10, baseArmor: 0, shotCount: 0, combatCategoryId: 'support', categoryId: 'ship_utilitaire', sortOrder: 8, role: 'exploration', flavorText: "Équipé de capteurs avancés et de laboratoires embarqués, l'explorateur analyse la composition des planètes pour révéler leurs biomes cachés.", prerequisites: { buildings: [{ buildingId: 'shipyard', level: 3 }], research: [{ researchId: 'planetaryExploration', level: 1 }] } },
```

- [ ] **Step 3: Add explore mission to MISSION_DEFINITIONS array**

In the `MISSION_DEFINITIONS` array, add:

```typescript
  { id: 'explore', label: 'Explorer', hint: "Envoyez des explorateurs découvrir les biomes d'une planète", buttonLabel: 'Explorer', color: '#06b6d4', sortOrder: 10, dangerous: false, requiredShipRoles: ['exploration'], exclusive: true, recommendedShipRoles: ['exploration'], requiresPveMission: false },
```

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/seed-game-config.ts
git commit -m "feat(db): seed exploration research, explorer ship, and explore mission"
```

---

### Task 4: ExploreHandler (phased mission)

**Files:**
- Create: `apps/api/src/modules/fleet/handlers/explore.handler.ts`
- Modify: `apps/api/src/modules/fleet/fleet.service.ts`

- [ ] **Step 1: Create ExploreHandler**

Create `apps/api/src/modules/fleet/handlers/explore.handler.ts`:

```typescript
import { eq, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { fleetEvents, planets, userResearch, discoveredBiomes } from '@exilium/db';
import { biomeDiscoveryProbability, scanDuration, seededRandom, coordinateSeed, generateBiomeCount, pickBiomes, type BiomeDefinition } from '@exilium/game-engine';
import type { PhasedMissionHandler, SendFleetInput, GameConfig, MissionHandlerContext, FleetEvent, ArrivalResult, PhaseResult } from '../fleet.types.js';
import { findShipsByRole } from '../../../lib/config-helpers.js';

export class ExploreHandler implements PhasedMissionHandler {
  async validateFleet(input: SendFleetInput, _config: GameConfig, ctx: MissionHandlerContext): Promise<void> {
    const config = await ctx.gameConfigService.getFullConfig();
    const explorerShips = findShipsByRole(config, 'exploration');
    const explorerCount = explorerShips.reduce((sum, def) => sum + (input.ships[def.id] ?? 0), 0);

    if (explorerCount === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: "La mission Explorer nécessite au moins un vaisseau d'exploration" });
    }

    // Check target is not colonized
    const [existing] = await ctx.db
      .select({ id: planets.id })
      .from(planets)
      .where(
        and(
          eq(planets.galaxy, input.targetGalaxy),
          eq(planets.system, input.targetSystem),
          eq(planets.position, input.targetPosition),
        ),
      )
      .limit(1);

    if (existing) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Impossible d\'explorer une position déjà colonisée' });
    }

    // Check not a belt position
    const beltPositions = (config.universe.belt_positions as number[]) ?? [8, 16];
    if (beltPositions.includes(input.targetPosition)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: "Impossible d'explorer une ceinture d'astéroïdes" });
    }
  }

  async processArrival(fleetEvent: FleetEvent, ctx: MissionHandlerContext): Promise<ArrivalResult> {
    const config = await ctx.gameConfigService.getFullConfig();

    // Get research level
    const [research] = await ctx.db.select().from(userResearch)
      .where(eq(userResearch.userId, fleetEvent.userId)).limit(1);
    const researchLevel = (research as any)?.planetaryExploration ?? 0;

    // Calculate scan duration
    const scanMs = scanDuration(researchLevel) * 1000;
    const now = new Date();
    const scanEnd = new Date(now.getTime() + scanMs);

    // Count explorer ships
    const explorerShips = findShipsByRole(config, 'exploration');
    const explorerCount = explorerShips.reduce((sum, def) => sum + (fleetEvent.ships[def.id] ?? 0), 0);

    // Store metadata for phase resolution
    await ctx.db.update(fleetEvents).set({
      phase: 'prospecting',
      departureTime: now,
      arrivalTime: scanEnd,
      metadata: {
        explorerCount,
        researchLevel,
      },
    }).where(eq(fleetEvents.id, fleetEvent.id));

    return {
      scheduleReturn: false,
      schedulePhase: {
        jobName: 'explore-done',
        delayMs: scanMs,
      },
    };
  }

  async processPhase(phase: string, fleetEvent: FleetEvent, ctx: MissionHandlerContext): Promise<PhaseResult> {
    if (phase !== 'explore-done') {
      throw new Error(`Unknown explore phase: ${phase}`);
    }

    const config = await ctx.gameConfigService.getFullConfig();
    const metadata = fleetEvent.metadata as { explorerCount: number; researchLevel: number } | null;
    const explorerCount = metadata?.explorerCount ?? 1;
    const researchLevel = metadata?.researchLevel ?? 0;

    // Generate biomes for this position (deterministic)
    const biomeCatalogue: BiomeDefinition[] = (config.biomes ?? []).map((b: any) => ({
      id: b.id,
      rarity: b.rarity,
      compatiblePlanetTypes: b.compatiblePlanetTypes as string[],
      effects: b.effects as Array<{ stat: string; modifier: number }>,
    }));

    const planetType = config.planetTypes.find(
      (pt: any) => pt.role !== 'homeworld' && (pt.positions as number[]).includes(fleetEvent.targetPosition),
    );

    if (!planetType || biomeCatalogue.length === 0) {
      return this.createExploreResult(fleetEvent, ctx, [], 0);
    }

    const seed = coordinateSeed(fleetEvent.targetGalaxy, fleetEvent.targetSystem, fleetEvent.targetPosition);
    const rng = seededRandom(seed);
    const biomeCount = generateBiomeCount(rng);
    const allBiomes = pickBiomes(biomeCatalogue, planetType.id, biomeCount, rng);

    // Check which biomes are already discovered by this player
    const alreadyDiscovered = await ctx.db
      .select({ biomeId: discoveredBiomes.biomeId })
      .from(discoveredBiomes)
      .where(
        and(
          eq(discoveredBiomes.userId, fleetEvent.userId),
          eq(discoveredBiomes.galaxy, fleetEvent.targetGalaxy),
          eq(discoveredBiomes.system, fleetEvent.targetSystem),
          eq(discoveredBiomes.position, fleetEvent.targetPosition),
        ),
      );

    const discoveredSet = new Set(alreadyDiscovered.map((d) => d.biomeId));
    const undiscovered = allBiomes.filter((b) => !discoveredSet.has(b.id));

    // Roll for each undiscovered biome
    const newlyDiscovered: BiomeDefinition[] = [];
    for (const biome of undiscovered) {
      const prob = biomeDiscoveryProbability(explorerCount, researchLevel, biome.rarity);
      if (Math.random() < prob) {
        newlyDiscovered.push(biome);
      }
    }

    // Persist discoveries
    if (newlyDiscovered.length > 0) {
      await ctx.db.insert(discoveredBiomes).values(
        newlyDiscovered.map((b) => ({
          userId: fleetEvent.userId,
          galaxy: fleetEvent.targetGalaxy,
          system: fleetEvent.targetSystem,
          position: fleetEvent.targetPosition,
          biomeId: b.id,
        })),
      ).onConflictDoNothing();
    }

    const remaining = undiscovered.length - newlyDiscovered.length;
    return this.createExploreResult(fleetEvent, ctx, newlyDiscovered, remaining);
  }

  private async createExploreResult(
    fleetEvent: FleetEvent,
    ctx: MissionHandlerContext,
    discovered: BiomeDefinition[],
    remaining: number,
  ): Promise<PhaseResult> {
    const coords = `[${fleetEvent.targetGalaxy}:${fleetEvent.targetSystem}:${fleetEvent.targetPosition}]`;

    let reportId: string | undefined;
    if (ctx.reportService) {
      const config = await ctx.gameConfigService.getFullConfig();
      const biomeDetails = discovered.map((b) => {
        const fullBiome = (config.biomes ?? []).find((cb: any) => cb.id === b.id);
        return {
          id: b.id,
          name: (fullBiome as any)?.name ?? b.id,
          rarity: b.rarity,
          effects: b.effects,
        };
      });

      const [originPlanet] = await ctx.db.select({
        galaxy: planets.galaxy, system: planets.system, position: planets.position, name: planets.name,
      }).from(planets).where(eq(planets.id, fleetEvent.originPlanetId)).limit(1);

      const report = await ctx.reportService.create({
        userId: fleetEvent.userId,
        fleetEventId: fleetEvent.id,
        missionType: 'explore',
        title: discovered.length > 0
          ? `Exploration réussie ${coords}`
          : `Exploration infructueuse ${coords}`,
        coordinates: {
          galaxy: fleetEvent.targetGalaxy,
          system: fleetEvent.targetSystem,
          position: fleetEvent.targetPosition,
        },
        originCoordinates: originPlanet ? {
          galaxy: originPlanet.galaxy,
          system: originPlanet.system,
          position: originPlanet.position,
          planetName: originPlanet.name,
        } : undefined,
        fleet: { ships: fleetEvent.ships },
        departureTime: fleetEvent.departureTime,
        completionTime: fleetEvent.arrivalTime,
        result: {
          discovered: biomeDetails,
          discoveredCount: discovered.length,
          remaining,
        },
      });
      reportId = report.id;
    }

    return {
      scheduleReturn: true,
      cargo: { minerai: 0, silicium: 0, hydrogene: 0 },
      reportId,
    };
  }
}
```

- [ ] **Step 2: Register handler in fleet.service.ts**

In `apps/api/src/modules/fleet/fleet.service.ts`, add the import after the `ScanHandler` import:

```typescript
import { ExploreHandler } from './handlers/explore.handler.js';
```

And add to the `handlers` record:

```typescript
    explore: new ExploreHandler(),
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/fleet/handlers/explore.handler.ts apps/api/src/modules/fleet/fleet.service.ts
git commit -m "feat(api): add ExploreHandler with phased scan and discovery logic"
```

---

### Task 5: Auto-discover Biomes on Colonization

**Files:**
- Modify: `apps/api/src/modules/fleet/handlers/colonize.handler.ts`

- [ ] **Step 1: Import discoveredBiomes table**

In `colonize.handler.ts`, add `discoveredBiomes` to the `@exilium/db` import:

```typescript
import { planetBiomes, discoveredBiomes } from '@exilium/db';
```

- [ ] **Step 2: Insert all biomes as discovered after colonization**

After the block that inserts biomes into `planetBiomes` (the block starting with `if (biomeCatalogue.length > 0 && planetTypeForPos)`), add:

```typescript
    // Auto-discover all biomes for the colonizer
    if (pickedBiomes.length > 0) {
      await ctx.db.insert(discoveredBiomes).values(
        pickedBiomes.map((b) => ({
          userId: fleetEvent.userId,
          galaxy: fleetEvent.targetGalaxy,
          system: fleetEvent.targetSystem,
          position: fleetEvent.targetPosition,
          biomeId: b.id,
        })),
      ).onConflictDoNothing();
    }
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/fleet/handlers/colonize.handler.ts
git commit -m "feat(api): auto-discover all biomes on colonization"
```

---

### Task 6: Galaxy Service — Filter Biomes by Discovery

**Files:**
- Modify: `apps/api/src/modules/galaxy/galaxy.service.ts`

- [ ] **Step 1: Import discoveredBiomes and pass userId**

Add `discoveredBiomes` to the `@exilium/db` import. The `_currentUserId` parameter is already available but unused — use it now.

- [ ] **Step 2: Load player's discoveries for this system**

After loading the biome catalogue, query all discovered biomes for this player in this system:

```typescript
      // Load player's discovered biomes for this system
      const playerDiscoveries = _currentUserId
        ? await db
            .select({ position: discoveredBiomes.position, biomeId: discoveredBiomes.biomeId })
            .from(discoveredBiomes)
            .where(
              and(
                eq(discoveredBiomes.userId, _currentUserId),
                eq(discoveredBiomes.galaxy, galaxy),
                eq(discoveredBiomes.system, system),
              ),
            )
        : [];

      const discoverySet = new Set(playerDiscoveries.map((d) => `${d.position}:${d.biomeId}`));
```

- [ ] **Step 3: Filter biomes for empty slots**

In the empty slots loop, instead of returning all computed biomes, filter to only show discovered ones:

```typescript
        // For empty slots: compute biomes but only show discovered ones
        const allBiomes = pickBiomes(biomeCatalogue, planetType.id, count, rng);
        const discoveredBiomesForPos = allBiomes.filter((b) =>
          discoverySet.has(`${pos}:${b.id}`),
        );
        const totalBiomeCount = allBiomes.length;
        const undiscoveredCount = totalBiomeCount - discoveredBiomesForPos.length;

        slots[i] = {
          type: 'empty',
          position: pos,
          planetClassId: planetType.id,
          biomes: discoveredBiomesForPos.map((b) => {
            const full = biomeCatalogue.find((bc: any) => bc.id === b.id);
            return { id: b.id, name: (full as any)?.name ?? b.id, rarity: b.rarity, effects: b.effects };
          }),
          totalBiomeCount,
          undiscoveredCount,
        };
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/galaxy/galaxy.service.ts
git commit -m "feat(api): filter galaxy biomes by player discovery state"
```

---

### Task 7: Frontend — Galaxy View Updates

**Files:**
- Modify: `apps/web/src/pages/Galaxy.tsx`

- [ ] **Step 1: Update empty slot display**

For empty slots, update the display to show:
- Discovered biomes (as before, in the toggle)
- A count of undiscovered biomes (e.g., "2/4 biomes" or "? biomes" if none discovered)
- An "Explorer" button if the player has explorer ships

In the `BiomeToggle`, update to show discovered vs total:

Where `BiomeToggle` is used for empty slots, replace the count logic:

```typescript
// Instead of: biomes.length biomes
// Show: discovered/total or "? biomes" if nothing discovered

const discovered = emptySlot.biomes?.length ?? 0;
const total = emptySlot.totalBiomeCount ?? 0;
const undiscovered = emptySlot.undiscoveredCount ?? 0;

// Show toggle only if some biomes discovered
{discovered > 0 && (
  <BiomeToggle
    count={discovered}
    expanded={isExpanded}
    onToggle={() => setExpandedBiomeSlot(isExpanded ? null : i)}
  />
)}
{undiscovered > 0 && (
  <span className="text-[11px] text-muted-foreground ml-1">
    {discovered > 0 ? `+ ${undiscovered} inconnu${undiscovered > 1 ? 's' : ''}` : `${total} biome${total > 1 ? 's' : ''} inconnu${total > 1 ? 's' : ''}`}
  </span>
)}
```

- [ ] **Step 2: Add "Explorer" button**

For empty slots (both mobile and desktop), add an "Explorer" button next to "Coloniser". The button should appear if the player has explorer ships (check from the ships query like colonizer):

```typescript
// Check if player has explorer ships (similar to hasColonizer)
const hasExplorer = useMemo(() => {
  if (!ships || !gameConfig?.ships) return false;
  const explorerDef = Object.values(gameConfig.ships).find((s) => s.role === 'exploration');
  if (!explorerDef) return false;
  return (ships as any)[explorerDef.countColumn] > 0;
}, [ships, gameConfig]);
```

Then add the button:

```tsx
{hasExplorer && (
  <Button
    size="sm"
    variant="ghost"
    className="text-xs h-6 px-1.5 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/20"
    onClick={() => navigate(`/fleet/send?mission=explore&galaxy=${galaxy}&system=${system}&position=${i + 1}`)}
  >
    Explorer
  </Button>
)}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/Galaxy.tsx
git commit -m "feat(web): show discovery state and Explorer button in galaxy view"
```

---

### Task 8: Verify End-to-End

- [ ] **Step 1: Run game-engine tests**

```bash
cd packages/game-engine && npx vitest run
```

Expected: All tests pass including new exploration tests.

- [ ] **Step 2: Run API tests**

```bash
cd apps/api && npx vitest run
```

Expected: Existing tests pass (3 pre-existing failures in daily-quest).

- [ ] **Step 3: Build check**

```bash
npx turbo build
```

Expected: All packages build successfully.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A && git commit -m "fix: resolve build issues for planetary exploration"
```
