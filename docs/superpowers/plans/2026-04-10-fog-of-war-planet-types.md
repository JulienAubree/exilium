# Fog of War + Probabilistic Planet Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide planet types in galaxy view until explored (fog of war), and replace deterministic position-based type assignment with a temperature-weighted probabilistic distribution (still deterministic per coordinates via seeded RNG).

**Architecture:** New `discovered_positions` table tracks which positions a player has explored. New `pickPlanetTypeForPosition(temp, rng)` function in game-engine returns a planet type ID based on temperature-weighted probabilities. Galaxy service filters by discovery state. Frontend shows "Inconnu" with a neutral grey dot for undiscovered positions.

**Tech Stack:** Drizzle ORM (PostgreSQL), TypeScript, Vitest, tRPC, React

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/db/src/schema/biomes.ts` | Modify | Add `discoveredPositions` table |
| `packages/db/drizzle/0032_discovered_positions.sql` | Create | Migration SQL + backfill |
| `packages/game-engine/src/formulas/planet-type.ts` | Create | `pickPlanetTypeForPosition(temp, rng)` |
| `packages/game-engine/src/formulas/planet-type.test.ts` | Create | Tests for type distribution |
| `packages/game-engine/src/index.ts` | Modify | Export new module |
| `apps/api/src/modules/galaxy/galaxy.service.ts` | Modify | Use temp-weighted type, filter by discovery |
| `apps/api/src/modules/fleet/handlers/explore.handler.ts` | Modify | Insert into `discovered_positions` |
| `apps/api/src/modules/fleet/handlers/colonize.handler.ts` | Modify | Insert into `discovered_positions` |
| `apps/web/src/components/galaxy/PlanetDot.tsx` | Modify | Add grey "unknown" variant |
| `apps/web/src/pages/Galaxy.tsx` | Modify | Render "Inconnu" for undiscovered slots |

---

### Task 1: DB Schema for `discovered_positions`

**Files:**
- Modify: `packages/db/src/schema/biomes.ts`
- Create: `packages/db/drizzle/0032_discovered_positions.sql`

- [ ] **Step 1: Add `discoveredPositions` table to schema**

In `packages/db/src/schema/biomes.ts`, add after `discoveredBiomes`:

```typescript
export const discoveredPositions = pgTable('discovered_positions', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  galaxy: smallint('galaxy').notNull(),
  system: smallint('system').notNull(),
  position: smallint('position').notNull(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.galaxy, t.system, t.position] }),
]);
```

(`smallint`, `users` and `pgTable, primaryKey` are already imported in this file from previous tasks.)

- [ ] **Step 2: Create migration SQL with backfill**

Create `packages/db/drizzle/0032_discovered_positions.sql`:

```sql
-- Per-player record of which positions have been explored or colonized
CREATE TABLE "discovered_positions" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "galaxy" smallint NOT NULL,
  "system" smallint NOT NULL,
  "position" smallint NOT NULL,
  PRIMARY KEY ("user_id", "galaxy", "system", "position")
);

CREATE INDEX "discovered_positions_user_idx" ON "discovered_positions" ("user_id", "galaxy", "system");

-- Backfill: every colonized planet position is automatically discovered for its owner
INSERT INTO "discovered_positions" ("user_id", "galaxy", "system", "position")
SELECT DISTINCT "user_id", "galaxy", "system", "position" FROM "planets"
ON CONFLICT DO NOTHING;

-- Backfill: every position with at least one discovered biome is discovered
INSERT INTO "discovered_positions" ("user_id", "galaxy", "system", "position")
SELECT DISTINCT "user_id", "galaxy", "system", "position" FROM "discovered_biomes"
ON CONFLICT DO NOTHING;
```

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/schema/biomes.ts packages/db/drizzle/0032_discovered_positions.sql
git commit -m "feat(db): add discovered_positions table for fog of war"
```

---

### Task 2: Planet Type Distribution Formula

**Files:**
- Create: `packages/game-engine/src/formulas/planet-type.test.ts`
- Create: `packages/game-engine/src/formulas/planet-type.ts`
- Modify: `packages/game-engine/src/index.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/game-engine/src/formulas/planet-type.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { pickPlanetTypeForPosition } from './planet-type.js';
import { seededRandom } from './biomes.js';

describe('pickPlanetTypeForPosition', () => {
  it('very hot temp (>150) is mostly volcanic', () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 1000; i++) {
      const rng = seededRandom(i);
      const type = pickPlanetTypeForPosition(200, rng);
      counts[type] = (counts[type] ?? 0) + 1;
    }
    // Volcanic should dominate at very hot temperatures
    expect(counts['volcanic']).toBeGreaterThan(500);
  });

  it('very cold temp (<-100) never produces volcanic', () => {
    for (let i = 0; i < 200; i++) {
      const rng = seededRandom(i + 10000);
      const type = pickPlanetTypeForPosition(-150, rng);
      expect(type).not.toBe('volcanic');
    }
  });

  it('temperate temp (~30) is mostly temperate', () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 1000; i++) {
      const rng = seededRandom(i + 20000);
      const type = pickPlanetTypeForPosition(30, rng);
      counts[type] = (counts[type] ?? 0) + 1;
    }
    expect(counts['temperate']).toBeGreaterThan(counts['volcanic'] ?? 0);
    expect(counts['temperate']).toBeGreaterThan(counts['glacial'] ?? 0);
  });

  it('cold temp (-50) is mostly glacial', () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 1000; i++) {
      const rng = seededRandom(i + 30000);
      const type = pickPlanetTypeForPosition(-50, rng);
      counts[type] = (counts[type] ?? 0) + 1;
    }
    expect(counts['glacial']).toBeGreaterThan(400);
  });

  it('returns deterministic results for the same seed', () => {
    const rng1 = seededRandom(42);
    const rng2 = seededRandom(42);
    expect(pickPlanetTypeForPosition(80, rng1)).toBe(pickPlanetTypeForPosition(80, rng2));
  });

  it('only returns valid planet type ids', () => {
    const valid = new Set(['volcanic', 'arid', 'temperate', 'glacial', 'gaseous']);
    for (let i = 0; i < 100; i++) {
      const rng = seededRandom(i);
      const type = pickPlanetTypeForPosition(50, rng);
      expect(valid.has(type)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/game-engine && npx vitest run src/formulas/planet-type.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement planet type picker**

Create `packages/game-engine/src/formulas/planet-type.ts`:

```typescript
type PlanetTypeId = 'volcanic' | 'arid' | 'temperate' | 'glacial' | 'gaseous';

interface TempBracket {
  maxTemp: number; // upper bound (inclusive)
  weights: Array<[PlanetTypeId, number]>;
}

const TEMP_BRACKETS: TempBracket[] = [
  // Order: lowest maxTemp first (so we find the first bracket the temp fits into)
  { maxTemp: -100, weights: [['volcanic', 0], ['arid', 0], ['temperate', 0.05], ['glacial', 0.60], ['gaseous', 0.35]] },
  { maxTemp: -20,  weights: [['volcanic', 0], ['arid', 0.05], ['temperate', 0.20], ['glacial', 0.55], ['gaseous', 0.20]] },
  { maxTemp: 50,   weights: [['volcanic', 0.05], ['arid', 0.20], ['temperate', 0.50], ['glacial', 0.10], ['gaseous', 0.15]] },
  { maxTemp: 150,  weights: [['volcanic', 0.25], ['arid', 0.45], ['temperate', 0.20], ['glacial', 0], ['gaseous', 0.10]] },
  { maxTemp: Infinity, weights: [['volcanic', 0.60], ['arid', 0.25], ['temperate', 0.10], ['glacial', 0], ['gaseous', 0.05]] },
];

/**
 * Pick a planet type id based on the position's max temperature.
 * Uses weighted random selection. Pass a seeded RNG for deterministic results.
 */
export function pickPlanetTypeForPosition(maxTemp: number, rng: () => number): PlanetTypeId {
  const bracket = TEMP_BRACKETS.find((b) => maxTemp <= b.maxTemp) ?? TEMP_BRACKETS[TEMP_BRACKETS.length - 1];
  const totalWeight = bracket.weights.reduce((sum, [, w]) => sum + w, 0);
  if (totalWeight <= 0) return 'temperate';

  const roll = rng() * totalWeight;
  let cumulative = 0;
  for (const [type, weight] of bracket.weights) {
    cumulative += weight;
    if (roll < cumulative) return type;
  }
  return bracket.weights[bracket.weights.length - 1][0];
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/game-engine && npx vitest run src/formulas/planet-type.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Export from index**

In `packages/game-engine/src/index.ts`, add:

```typescript
export * from './formulas/planet-type.js';
```

- [ ] **Step 6: Commit**

```bash
git add packages/game-engine/src/formulas/planet-type.ts packages/game-engine/src/formulas/planet-type.test.ts packages/game-engine/src/index.ts
git commit -m "feat(game-engine): temperature-weighted planet type distribution"
```

---

### Task 3: Galaxy Service — Fog of War

**Files:**
- Modify: `apps/api/src/modules/galaxy/galaxy.service.ts`

- [ ] **Step 1: Add imports**

Add `discoveredPositions` to the `@exilium/db` import:

```typescript
import { planets, users, debrisFields, allianceMembers, alliances, planetBiomes, biomeDefinitions, discoveredBiomes, discoveredPositions } from '@exilium/db';
```

Add `pickPlanetTypeForPosition` and `calculateMaxTemp` to the `@exilium/game-engine` import:

```typescript
import { seededRandom, coordinateSeed, generateBiomeCount, pickBiomes, pickPlanetTypeForPosition, calculateMaxTemp } from '@exilium/game-engine';
```

- [ ] **Step 2: Load discovered positions for the player**

After loading `playerDiscoveries` (the biome discoveries), add:

```typescript
      // Load player's discovered positions for this system
      const discoveredPositionRows = _currentUserId
        ? await db
            .select({ position: discoveredPositions.position })
            .from(discoveredPositions)
            .where(
              and(
                eq(discoveredPositions.userId, _currentUserId),
                eq(discoveredPositions.galaxy, galaxy),
                eq(discoveredPositions.system, system),
              ),
            )
        : [];

      const discoveredPositionSet = new Set(discoveredPositionRows.map((r) => r.position));
```

- [ ] **Step 3: Update EmptySlot type**

Change the `EmptySlot` type to make `planetClassId` nullable and add `isDiscovered`:

```typescript
type EmptySlot = {
  type: 'empty';
  position: number;
  planetClassId: string | null;
  isDiscovered: boolean;
  biomes: Array<{ id: string; name: string; rarity: string; effects: unknown }>;
  totalBiomeCount: number;
  undiscoveredCount: number;
};
```

- [ ] **Step 4: Replace position-based type with temperature-weighted picker**

In the empty slot generation loop, replace the planet type lookup. Find the block:

```typescript
        // Determine planet class for this position based on config
        const planetTypeForPos = config.planetTypes.find(pt => pt.positions.includes(i));
        const planetClassId = planetTypeForPos?.id ?? null;
```

Replace with:

```typescript
        const isDiscovered = discoveredPositionSet.has(i);

        // Compute deterministic max temperature for the position
        // (use a fixed offset of 0 so the temp is stable across players)
        const maxTemp = calculateMaxTemp(i, 0);

        // Pick the planet type using a temperature-weighted distribution
        // (deterministic via seeded RNG, separate seed namespace from biomes)
        const typeRng = seededRandom(coordinateSeed(galaxy, system, i) ^ 0x9E3779B9);
        const planetClassId = pickPlanetTypeForPosition(maxTemp, typeRng);
```

- [ ] **Step 5: Filter biomes if not discovered**

Below the planet type computation, the biomes are already filtered via `discoverySet`. We need to **also** hide them entirely if the position is not discovered. Update the slot construction:

```typescript
        slots[i - 1] = isDiscovered
          ? {
              type: 'empty',
              position: i,
              planetClassId,
              isDiscovered: true,
              biomes: discoveredForPos.map((b) => {
                const full = biomeCatalogue.find((bc: any) => bc.id === b.id);
                return { id: b.id, name: (full as any)?.name ?? b.id, rarity: b.rarity, effects: b.effects };
              }),
              totalBiomeCount,
              undiscoveredCount,
            }
          : {
              type: 'empty',
              position: i,
              planetClassId: null,
              isDiscovered: false,
              biomes: [],
              totalBiomeCount: 0,
              undiscoveredCount: 0,
            };
```

The complete loop should look like this (replace the whole `for (let i = 1; i <= positions; i++)` block):

```typescript
      for (let i = 1; i <= positions; i++) {
        if (beltSet.has(i) || occupiedPositions.has(i)) continue;

        const isDiscovered = discoveredPositionSet.has(i);

        // Compute deterministic max temperature for the position
        const maxTemp = calculateMaxTemp(i, 0);

        // Pick the planet type using a temperature-weighted distribution
        const typeRng = seededRandom(coordinateSeed(galaxy, system, i) ^ 0x9E3779B9);
        const planetClassId = pickPlanetTypeForPosition(maxTemp, typeRng);

        // Compute biomes deterministically (same seed as before)
        const rng = seededRandom(coordinateSeed(galaxy, system, i));
        const count = generateBiomeCount(rng);
        const biomes = pickBiomes(biomeCatalogue, planetClassId, count, rng);

        const discoveredForPos = biomes.filter((b) =>
          discoverySet.has(`${i}:${b.id}`),
        );
        const totalBiomeCount = biomes.length;
        const undiscoveredCount = totalBiomeCount - discoveredForPos.length;

        slots[i - 1] = isDiscovered
          ? {
              type: 'empty',
              position: i,
              planetClassId,
              isDiscovered: true,
              biomes: discoveredForPos.map((b) => {
                const full = biomeCatalogue.find((bc: any) => bc.id === b.id);
                return { id: b.id, name: (full as any)?.name ?? b.id, rarity: b.rarity, effects: b.effects };
              }),
              totalBiomeCount,
              undiscoveredCount,
            }
          : {
              type: 'empty',
              position: i,
              planetClassId: null,
              isDiscovered: false,
              biomes: [],
              totalBiomeCount: 0,
              undiscoveredCount: 0,
            };
      }
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/galaxy/galaxy.service.ts
git commit -m "feat(api): fog of war on galaxy view + temperature-weighted planet types"
```

---

### Task 4: ExploreHandler Marks Position as Discovered

**Files:**
- Modify: `apps/api/src/modules/fleet/handlers/explore.handler.ts`

- [ ] **Step 1: Import the new table**

Add `discoveredPositions` to the `@exilium/db` import:

```typescript
import { fleetEvents, planets, userResearch, discoveredBiomes, discoveredPositions } from '@exilium/db';
```

- [ ] **Step 2: Insert discovered position when scan completes**

In `processPhase('explore-done')`, at the very beginning of the method (before the biome generation logic), add:

```typescript
    // Mark this position as discovered for the player (regardless of biome roll outcome)
    await ctx.db.insert(discoveredPositions).values({
      userId: fleetEvent.userId,
      galaxy: fleetEvent.targetGalaxy,
      system: fleetEvent.targetSystem,
      position: fleetEvent.targetPosition,
    }).onConflictDoNothing();
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/fleet/handlers/explore.handler.ts
git commit -m "feat(api): mark position discovered when exploration completes"
```

---

### Task 5: ColonizeHandler Marks Position as Discovered

**Files:**
- Modify: `apps/api/src/modules/fleet/handlers/colonize.handler.ts`

- [ ] **Step 1: Import the new table**

Add `discoveredPositions` to the `@exilium/db` import:

```typescript
import { planetBiomes, discoveredBiomes, discoveredPositions } from '@exilium/db';
```

- [ ] **Step 2: Insert discovered position right after biome auto-discovery**

After the existing block that inserts into `discoveredBiomes` (the auto-discover block added in a previous task), add:

```typescript
    // Mark the colonized position as discovered for the colonizer
    await ctx.db.insert(discoveredPositions).values({
      userId: fleetEvent.userId,
      galaxy: fleetEvent.targetGalaxy,
      system: fleetEvent.targetSystem,
      position: fleetEvent.targetPosition,
    }).onConflictDoNothing();
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/fleet/handlers/colonize.handler.ts
git commit -m "feat(api): mark position discovered on colonization"
```

---

### Task 6: Frontend — PlanetDot Unknown Variant

**Files:**
- Modify: `apps/web/src/components/galaxy/PlanetDot.tsx`

- [ ] **Step 1: Add a neutral grey color entry**

Read the file first. Then add an entry to the `TYPE_COLORS` map for the unknown case. Or, add a special handling when `planetClassId` is `null`.

Modify the component to render a grey/neutral SVG when `planetClassId` is `null`:

```typescript
const TYPE_COLORS: Record<string, { from: string; to: string; accent: string }> = {
  volcanic:  { from: '#ef4444', to: '#f97316', accent: '#fbbf24' },
  arid:      { from: '#d97706', to: '#92400e', accent: '#fbbf24' },
  temperate: { from: '#22c55e', to: '#3b82f6', accent: '#86efac' },
  glacial:   { from: '#93c5fd', to: '#e0f2fe', accent: '#ffffff' },
  gaseous:   { from: '#a855f7', to: '#ec4899', accent: '#e879f9' },
  homeworld: { from: '#22d3ee', to: '#10b981', accent: '#a7f3d0' },
  unknown:   { from: '#52525b', to: '#27272a', accent: '#a1a1aa' },
};

// In the component, when planetClassId is null/undefined, use the 'unknown' colors
const colors = TYPE_COLORS[planetClassId ?? 'unknown'] ?? TYPE_COLORS.unknown;
```

The exact location of the `TYPE_COLORS` access needs to be updated to use the fallback. Read the file before editing to find the right line.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/galaxy/PlanetDot.tsx
git commit -m "feat(web): grey unknown variant for PlanetDot"
```

---

### Task 7: Frontend — Galaxy View "Inconnu" Label

**Files:**
- Modify: `apps/web/src/pages/Galaxy.tsx`

- [ ] **Step 1: Update mobile empty slot rendering**

In the mobile empty slot block, replace the planet type name display. Find:

```typescript
                if (isEmpty) {
                  const emptySlot = slot as any;
                  const planetTypeName = emptySlot.planetClassId
                    ? gameConfig?.planetTypes?.find((t) => t.id === emptySlot.planetClassId)?.name ?? ''
                    : '';
```

The existing code already handles `null` planetClassId with empty string. Update the display to show "Inconnu" instead of empty when not discovered:

```typescript
                if (isEmpty) {
                  const emptySlot = slot as any;
                  const planetTypeName = emptySlot.isDiscovered && emptySlot.planetClassId
                    ? gameConfig?.planetTypes?.find((t) => t.id === emptySlot.planetClassId)?.name ?? 'Inconnu'
                    : 'Inconnu';
```

The `<span className="ml-1 text-xs text-primary/60">{planetTypeName}</span>` line should remain as-is. To make "Inconnu" visually distinct, also adjust its color when not discovered:

Find:
```typescript
                          {planetTypeName && (
                            <span className="ml-1 text-xs text-primary/60">{planetTypeName}</span>
                          )}
```

Replace with:
```typescript
                          <span className={`ml-1 text-xs ${emptySlot.isDiscovered ? 'text-primary/60' : 'text-muted-foreground italic'}`}>
                            {planetTypeName}
                          </span>
```

- [ ] **Step 2: Update desktop empty slot rendering**

Find the desktop block:

```typescript
                    if (isEmpty2) {
                      const emptySlot2 = slot as any;
                      const planetTypeName2 = emptySlot2.planetClassId
                        ? gameConfig?.planetTypes?.find((t) => t.id === emptySlot2.planetClassId)?.name ?? ''
                        : '';
```

Update to:

```typescript
                    if (isEmpty2) {
                      const emptySlot2 = slot as any;
                      const planetTypeName2 = emptySlot2.isDiscovered && emptySlot2.planetClassId
                        ? gameConfig?.planetTypes?.find((t) => t.id === emptySlot2.planetClassId)?.name ?? 'Inconnu'
                        : 'Inconnu';
```

And find the type cell:
```typescript
                          <td className="px-2 py-2 text-xs text-muted-foreground">
                            {planetTypeName2}
                          </td>
```

Replace with:
```typescript
                          <td className={`px-2 py-2 text-xs ${emptySlot2.isDiscovered ? 'text-muted-foreground' : 'text-muted-foreground/60 italic'}`}>
                            {planetTypeName2}
                          </td>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/Galaxy.tsx
git commit -m "feat(web): show 'Inconnu' for undiscovered positions in galaxy view"
```

---

### Task 8: Verify End-to-End

- [ ] **Step 1: Run game-engine tests**

```bash
cd packages/game-engine && npx vitest run
```

Expected: All tests pass including new planet-type tests.

- [ ] **Step 2: Build all packages**

```bash
npx turbo build
```

Expected: All packages build successfully with no TypeScript errors.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A && git commit -m "fix: resolve build issues for fog of war"
```
