# PvE Discovery Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the on-demand mission pool with passive lazy discovery of mining deposits, with RNG on size/composition, fixed cap of 3, and a dismiss mechanic.

**Architecture:** New `mission_center_state` table tracks per-player discovery timer. `materializeDiscoveries()` uses lazy catch-up pattern (like `materializeResources`) to create deposits when the player interacts. The `pve_missions` lifecycle changes: mining missions stay `available` until the deposit is empty. New formulas (`discoveryCooldown`, `depositSize`, `depositComposition`) in game-engine. Slag rates updated to 45%/30%.

**Tech Stack:** TypeScript, Drizzle ORM (PostgreSQL), tRPC, Vitest, React

**Spec:** `docs/superpowers/specs/2026-03-21-pve-discovery-rework-design.md`

---

### Task 1: New formulas in game-engine

**Files:**
- Modify: `packages/game-engine/src/formulas/pve.ts`
- Modify: `packages/game-engine/src/formulas/pve.test.ts`

- [ ] **Step 1: Write failing tests for `discoveryCooldown`**

In `packages/game-engine/src/formulas/pve.test.ts`, add:

```typescript
import {
  // ... existing imports ...
  discoveryCooldown,
  depositSize,
  depositComposition,
} from './pve.js';

describe('discoveryCooldown', () => {
  it('returns 8h at level 1', () => {
    expect(discoveryCooldown(1)).toBe(8);
  });
  it('returns 6.8h at level 5', () => {
    expect(discoveryCooldown(5)).toBeCloseTo(6.8);
  });
  it('returns 5.3h at level 10', () => {
    expect(discoveryCooldown(10)).toBeCloseTo(5.3);
  });
  it('floors at 5h for level 11+', () => {
    expect(discoveryCooldown(11)).toBe(5);
    expect(discoveryCooldown(15)).toBe(5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/game-engine && ./node_modules/.bin/vitest run src/formulas/pve.test.ts`
Expected: FAIL — `discoveryCooldown` is not exported

- [ ] **Step 3: Implement `discoveryCooldown`**

In `packages/game-engine/src/formulas/pve.ts`, add after the `miningDuration` function (after line 23):

```typescript
/**
 * Discovery cooldown in hours based on Mission Center level.
 * Formula: max(5, 8 - 0.3 * (level - 1))
 */
export function discoveryCooldown(centerLevel: number): number {
  return Math.max(5, 8 - 0.3 * (centerLevel - 1));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/game-engine && ./node_modules/.bin/vitest run src/formulas/pve.test.ts`
Expected: All PASS

- [ ] **Step 5: Write failing tests for `depositSize`**

```typescript
describe('depositSize', () => {
  it('returns base 15000 at level 1', () => {
    // With multiplier 1.0
    expect(depositSize(1, 1.0)).toBe(15000);
  });
  it('scales with level', () => {
    expect(depositSize(10, 1.0)).toBe(60000);
  });
  it('applies variance multiplier', () => {
    expect(depositSize(1, 0.6)).toBe(9000);
    expect(depositSize(1, 1.6)).toBe(24000);
  });
});
```

- [ ] **Step 6: Implement `depositSize`**

```typescript
/**
 * Total resource quantity for a discovered deposit.
 * @param varianceMultiplier - random value between 0.6 and 1.6
 */
export function depositSize(centerLevel: number, varianceMultiplier: number): number {
  const base = 15000 + 5000 * (centerLevel - 1);
  return Math.floor(base * varianceMultiplier);
}
```

- [ ] **Step 7: Write failing tests for `depositComposition`**

```typescript
describe('depositComposition', () => {
  it('returns ratios that sum to 1', () => {
    const comp = depositComposition(0.6, 0.3);
    expect(comp.minerai + comp.silicium + comp.hydrogene).toBeCloseTo(1);
  });
  it('clamps hydrogene to minimum 0.02', () => {
    // mineraiOffset=+0.15, siliciumOffset=+0.10 => hydro = 1 - 0.75 - 0.40 = -0.15 => clamped to 0.02
    const comp = depositComposition(0.15, 0.10);
    expect(comp.hydrogene).toBeGreaterThanOrEqual(0.02);
    expect(comp.minerai + comp.silicium + comp.hydrogene).toBeCloseTo(1);
  });
  it('uses base ratios with zero offsets', () => {
    const comp = depositComposition(0, 0);
    expect(comp.minerai).toBeCloseTo(0.6, 1);
    expect(comp.silicium).toBeCloseTo(0.3, 1);
    expect(comp.hydrogene).toBeCloseTo(0.1, 1);
  });
});
```

- [ ] **Step 8: Implement `depositComposition`**

```typescript
/**
 * Compute resource composition ratios for a deposit.
 * @param mineraiOffset - random value between -0.15 and +0.15
 * @param siliciumOffset - random value between -0.10 and +0.10
 * @returns normalized ratios summing to 1
 */
export function depositComposition(
  mineraiOffset: number,
  siliciumOffset: number,
): { minerai: number; silicium: number; hydrogene: number } {
  const rawMinerai = 0.60 + mineraiOffset;
  const rawSilicium = 0.30 + siliciumOffset;
  const rawHydrogene = Math.max(0.02, 1 - rawMinerai - rawSilicium);
  const total = rawMinerai + rawSilicium + rawHydrogene;
  return {
    minerai: rawMinerai / total,
    silicium: rawSilicium / total,
    hydrogene: rawHydrogene / total,
  };
}
```

- [ ] **Step 9: Run all pve tests**

Run: `cd packages/game-engine && ./node_modules/.bin/vitest run src/formulas/pve.test.ts`
Expected: All PASS

- [ ] **Step 10: Commit**

```bash
git add packages/game-engine/src/formulas/pve.ts packages/game-engine/src/formulas/pve.test.ts
git commit -m "feat: add discovery cooldown, deposit size and composition formulas"
```

---

### Task 2: DB schema — mission_center_state table

**Files:**
- Create: `packages/db/src/schema/mission-center-state.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Create the schema file**

Create `packages/db/src/schema/mission-center-state.ts`:

```typescript
import { pgTable, uuid, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const missionCenterState = pgTable('mission_center_state', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  nextDiscoveryAt: timestamp('next_discovery_at', { withTimezone: true }).notNull(),
  lastDismissAt: timestamp('last_dismiss_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 2: Export from schema index**

In `packages/db/src/schema/index.ts`, add after the last export (line 19):

```typescript
export * from './mission-center-state.js';
```

- [ ] **Step 3: Generate migration**

Run: `cd packages/db && npx drizzle-kit generate`

Verify a new migration SQL file is created in `packages/db/drizzle/` with `CREATE TABLE mission_center_state`.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema/mission-center-state.ts packages/db/src/schema/index.ts packages/db/drizzle/
git commit -m "feat: add mission_center_state table schema and migration"
```

---

### Task 3: Update slag rates

**Files:**
- Modify: `packages/db/src/seed-game-config.ts`

- [ ] **Step 1: Update slag rate values**

In `packages/db/src/seed-game-config.ts`, update lines 343-344:

```typescript
// Before:
{ key: 'slag_rate.pos8', value: 0.30 },
{ key: 'slag_rate.pos16', value: 0.15 },

// After:
{ key: 'slag_rate.pos8', value: 0.45 },
{ key: 'slag_rate.pos16', value: 0.30 },
```

- [ ] **Step 2: Create a standalone SQL migration for existing DB values**

Create a new file `packages/db/drizzle/0XXX_update_slag_rates.sql` (use the next available migration number):

```sql
UPDATE universe_config SET value = '0.45' WHERE key = 'slag_rate.pos8';
UPDATE universe_config SET value = '0.30' WHERE key = 'slag_rate.pos16';
```

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/seed-game-config.ts packages/db/drizzle/
git commit -m "feat: update slag rates to 45%/30%"
```

---

### Task 4: Core discovery service — `materializeDiscoveries`

**Files:**
- Modify: `apps/api/src/modules/pve/pve.service.ts`
- Modify: `apps/api/src/modules/pve/asteroid-belt.service.ts`

- [ ] **Step 1: Add new deposit generation function to asteroid-belt.service.ts**

In `apps/api/src/modules/pve/asteroid-belt.service.ts`, add a new function `generateDiscoveredDeposit` that uses the new RNG formulas instead of the old constants. Add this inside the returned service object:

```typescript
async generateDiscoveredDeposit(
  beltId: string,
  totalQuantity: number,
  composition: { minerai: number; silicium: number; hydrogene: number },
) {
  const mineraiTotal = Math.floor(totalQuantity * composition.minerai);
  const siliciumTotal = Math.floor(totalQuantity * composition.silicium);
  const hydrogeneTotal = totalQuantity - mineraiTotal - siliciumTotal;

  const [deposit] = await db
    .insert(asteroidDeposits)
    .values({
      beltId,
      mineraiTotal: String(mineraiTotal),
      mineraiRemaining: String(mineraiTotal),
      siliciumTotal: String(siliciumTotal),
      siliciumRemaining: String(siliciumTotal),
      hydrogeneTotal: String(hydrogeneTotal),
      hydrogeneRemaining: String(hydrogeneTotal),
    })
    .returning();
  return deposit;
},
```

- [ ] **Step 2: Add `materializeDiscoveries` to pve.service.ts**

Replace the `refreshPool` function (lines 62-118) with `materializeDiscoveries`. Keep `refreshPool` but mark it unused (or remove it — pirates are out of scope).

Add imports at the top of `pve.service.ts`:

```typescript
import { discoveryCooldown, depositSize, depositComposition } from '@exilium/game-engine';
import { missionCenterState } from '@exilium/db';
```

Add the new function inside the returned service object:

```typescript
async materializeDiscoveries(userId: string) {
  const centerLevel = await this.getMissionCenterLevel(userId);
  if (centerLevel === 0) return;

  const now = new Date();

  // Get or create state
  let [state] = await db.select().from(missionCenterState)
    .where(eq(missionCenterState.userId, userId)).limit(1);

  if (!state) {
    const cooldownMs = discoveryCooldown(centerLevel) * 3600 * 1000;
    const [created] = await db.insert(missionCenterState).values({
      userId,
      nextDiscoveryAt: new Date(now.getTime() + cooldownMs),
      updatedAt: now,
    }).onConflictDoNothing().returning();
    // If conflict (race condition), re-read
    if (!created) {
      [state] = await db.select().from(missionCenterState)
        .where(eq(missionCenterState.userId, userId)).limit(1);
    } else {
      return; // Just created — first discovery is in the future
    }
  }

  if (!state || state.nextDiscoveryAt > now) return;

  const cooldownMs = discoveryCooldown(centerLevel) * 3600 * 1000;
  const elapsed = now.getTime() - state.nextDiscoveryAt.getTime();
  // +1 because the discovery at nextDiscoveryAt itself counts as the first one
  // e.g. elapsed=0 => 1 discovery (the one due at nextDiscoveryAt)
  // e.g. elapsed=1.5*cooldown => 2 discoveries (at nextDiscoveryAt and nextDiscoveryAt+cooldown)
  const n = Math.floor(elapsed / cooldownMs) + 1;

  // Count current available missions
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(pveMissions)
    .where(and(eq(pveMissions.userId, userId), eq(pveMissions.status, 'available')));
  const currentCount = countResult?.count ?? 0;

  const CAP = 3;
  const toCreate = Math.min(n, CAP - currentCount);

  // Get player's home planet for coordinates
  const [homePlanet] = await db.select({
    galaxy: planets.galaxy,
    system: planets.system,
  }).from(planets).where(eq(planets.userId, userId)).limit(1);

  if (homePlanet) {
    for (let i = 0; i < toCreate; i++) {
      await this.generateDiscoveredMission(userId, homePlanet.galaxy, homePlanet.system, centerLevel);
    }
  }

  // Advance timer by n * cooldown
  const newNextDiscovery = new Date(state.nextDiscoveryAt.getTime() + n * cooldownMs);
  await db.update(missionCenterState).set({
    nextDiscoveryAt: newNextDiscovery,
    updatedAt: now,
  }).where(eq(missionCenterState.userId, userId));
},
```

- [ ] **Step 3: Add `generateDiscoveredMission` to pve.service.ts**

This replaces `generateMiningMission` for the new discovery system. Add inside the returned service object:

```typescript
async generateDiscoveredMission(userId: string, galaxy: number, system: number, centerLevel: number) {
  // Position selection: level 1-2 = only 8, level 3+ = 8 or 16
  const position = centerLevel >= 3 && Math.random() < 0.5 ? 16 : 8;

  const belt = await asteroidBeltService.getOrCreateBelt(galaxy, system, position);

  // RNG: size and composition
  const varianceMultiplier = 0.6 + Math.random() * 1.0; // 0.6 to 1.6
  const totalQuantity = depositSize(centerLevel, varianceMultiplier);
  const mineraiOffset = (Math.random() * 0.30) - 0.15; // -0.15 to +0.15
  const siliciumOffset = (Math.random() * 0.20) - 0.10; // -0.10 to +0.10
  const composition = depositComposition(mineraiOffset, siliciumOffset);

  const deposit = await asteroidBeltService.generateDiscoveredDeposit(
    belt.id, totalQuantity, composition,
  );

  const minerai = Math.floor(totalQuantity * composition.minerai);
  const silicium = Math.floor(totalQuantity * composition.silicium);
  const hydrogene = totalQuantity - minerai - silicium;

  // rewards = total deposit size (for display to the player, not per-trip extraction)
  await db.insert(pveMissions).values({
    userId,
    missionType: 'mine',
    parameters: { galaxy, system, position, beltId: belt.id, depositId: deposit.id },
    rewards: { minerai, silicium, hydrogene },
    status: 'available',
  });
},
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/pve/pve.service.ts apps/api/src/modules/pve/asteroid-belt.service.ts
git commit -m "feat: add materializeDiscoveries with lazy catch-up pattern"
```

---

### Task 5: Update PvE router to use materializeDiscoveries

**Files:**
- Modify: `apps/api/src/modules/pve/pve.router.ts`

- [ ] **Step 1: Replace refreshPool call with materializeDiscoveries**

In `apps/api/src/modules/pve/pve.router.ts`, update the `getMissions` endpoint (lines 11-19):

```typescript
// Before:
getMissions: protectedProcedure.query(async ({ ctx }) => {
  const centerLevel = await pveService.getMissionCenterLevel(ctx.userId!);
  let missions = await pveService.getMissions(ctx.userId!);
  if (centerLevel > 0 && missions.length === 0) {
    await pveService.refreshPool(ctx.userId!);
    missions = await pveService.getMissions(ctx.userId!);
  }
  return { missions, centerLevel };
}),

// After:
getMissions: protectedProcedure.query(async ({ ctx }) => {
  const centerLevel = await pveService.getMissionCenterLevel(ctx.userId!);
  if (centerLevel > 0) {
    await pveService.materializeDiscoveries(ctx.userId!);
  }
  const missions = await pveService.getMissions(ctx.userId!);
  return { missions, centerLevel };
}),
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/pve/pve.router.ts
git commit -m "feat: switch PvE router from refreshPool to materializeDiscoveries"
```

---

### Task 6: Mission lifecycle — keep available until deposit empty

**Files:**
- Modify: `apps/api/src/modules/fleet/fleet.service.ts` (lines 178-190)
- Modify: `apps/api/src/modules/fleet/handlers/mine.handler.ts` (line 176)
- Modify: `apps/api/src/modules/pve/pve.service.ts`

- [ ] **Step 1: Stop marking mine missions as in_progress in fleet.service.ts**

In `apps/api/src/modules/fleet/fleet.service.ts`, update the PvE mission validation block (lines 178-190). For mine missions, skip the `in_progress` status check and don't call `startMission`:

```typescript
// Before (lines 178-190):
if (input.pveMissionId && pveService) {
  const [pveMission] = await db.select().from(pveMissions)
    .where(and(eq(pveMissions.id, input.pveMissionId), eq(pveMissions.userId, userId)))
    .limit(1);
  if (!pveMission) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Mission non trouvée ou non autorisée' });
  }
  if (pveMission.status !== 'available') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Mission déjà en cours ou terminée' });
  }
  await pveService.startMission(input.pveMissionId);
}

// After:
if (input.pveMissionId && pveService) {
  const [pveMission] = await db.select().from(pveMissions)
    .where(and(eq(pveMissions.id, input.pveMissionId), eq(pveMissions.userId, userId)))
    .limit(1);
  if (!pveMission) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Mission non trouvée ou non autorisée' });
  }
  if (pveMission.status !== 'available') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Mission déjà en cours ou terminée' });
  }
  // Mine missions stay available until deposit is empty — don't mark in_progress
  if (pveMission.missionType !== 'mine') {
    await pveService.startMission(input.pveMissionId);
  }
}
```

- [ ] **Step 2: Complete mine mission only when deposit is empty**

In `apps/api/src/modules/fleet/handlers/mine.handler.ts`, update `processMineDone` (around line 176). Currently:

```typescript
await ctx.pveService.completeMission(mission.id);
```

Replace with a check on remaining deposit:

```typescript
// Check if deposit is now empty — if so, complete the mission
const [updatedDeposit] = await ctx.db.select().from(asteroidDeposits)
  .where(eq(asteroidDeposits.id, params.depositId)).limit(1);
const totalRemaining = updatedDeposit
  ? Number(updatedDeposit.mineraiRemaining) + Number(updatedDeposit.siliciumRemaining) + Number(updatedDeposit.hydrogeneRemaining)
  : 0;
if (totalRemaining <= 0 && ctx.pveService) {
  await ctx.pveService.completeMission(mission.id);
}
```

Note: `asteroidDeposits` is already imported at line 3 of `mine.handler.ts` — no import changes needed.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/fleet/fleet.service.ts apps/api/src/modules/fleet/handlers/mine.handler.ts
git commit -m "feat: mine missions stay available until deposit is empty"
```

---

### Task 7: Dismiss mission endpoint

**Files:**
- Modify: `apps/api/src/modules/pve/pve.service.ts`
- Modify: `apps/api/src/modules/pve/pve.router.ts`

- [ ] **Step 1: Add `dismissMission` to pve.service.ts**

Add inside the returned service object:

```typescript
async dismissMission(userId: string, missionId: string) {
  // Check cooldown
  const [state] = await db.select().from(missionCenterState)
    .where(eq(missionCenterState.userId, userId)).limit(1);

  if (state?.lastDismissAt) {
    const hoursSinceLastDismiss = (Date.now() - state.lastDismissAt.getTime()) / (3600 * 1000);
    if (hoursSinceLastDismiss < 24) {
      const remainingHours = Math.ceil(24 - hoursSinceLastDismiss);
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: `Vous devez attendre encore ${remainingHours}h avant de pouvoir annuler un gisement`,
      });
    }
  }

  // Check mission exists and belongs to user
  const [mission] = await db.select().from(pveMissions)
    .where(and(eq(pveMissions.id, missionId), eq(pveMissions.userId, userId)))
    .limit(1);

  if (!mission) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Mission non trouvée' });
  }
  if (mission.status !== 'available') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Seules les missions disponibles peuvent être annulées' });
  }

  // Check no fleet is currently in flight for this mission
  const [activeFleet] = await db.select({ id: fleetEvents.id }).from(fleetEvents)
    .where(and(
      eq(fleetEvents.pveMissionId, missionId),
      inArray(fleetEvents.status, ['in_transit', 'active']),
    ))
    .limit(1);
  if (activeFleet) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Une flotte est en cours pour cette mission' });
  }

  // Expire mission and update dismiss timestamp
  await db.update(pveMissions)
    .set({ status: 'expired' })
    .where(eq(pveMissions.id, missionId));

  await db.update(missionCenterState)
    .set({ lastDismissAt: new Date() })
    .where(eq(missionCenterState.userId, userId));
},
```

- [ ] **Step 2: Add dismiss endpoint to pve.router.ts**

Add a new mutation in the router:

```typescript
dismissMission: protectedProcedure
  .input(z.object({ missionId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    await pveService.dismissMission(ctx.userId!, input.missionId);
    return { success: true };
  }),
```

Add `z` import if not already present:

```typescript
import { z } from 'zod';
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/pve/pve.service.ts apps/api/src/modules/pve/pve.router.ts
git commit -m "feat: add mission dismiss endpoint with 24h cooldown"
```

---

### Task 8: Frontend — dismiss button and discovery info

**Files:**
- Modify: `apps/web/src/pages/Missions.tsx`

- [ ] **Step 1: Add dismiss mutation and UI**

In `apps/web/src/pages/Missions.tsx`:

1. Add the dismiss mutation:

```typescript
const utils = trpc.useUtils();
const dismissMutation = trpc.pve.dismissMission.useMutation({
  onSuccess: () => {
    utils.pve.getMissions.invalidate();
  },
});
```

2. Add a dismiss button next to each mining mission card. The button should be a small "X" or "Annuler" button:

```tsx
<button
  onClick={() => dismissMutation.mutate({ missionId: mission.id })}
  disabled={dismissMutation.isPending}
  className="text-xs text-muted-foreground hover:text-red-400 transition-colors"
  title="Annuler ce gisement"
>
  Annuler
</button>
```

3. Show error message if dismiss is on cooldown (from mutation error):

```tsx
{dismissMutation.error && (
  <div className="text-xs text-red-400 mt-1">{dismissMutation.error.message}</div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/Missions.tsx
git commit -m "feat: add dismiss button for mining missions"
```

---

### Task 9: Remove old pool logic and clean up

**Files:**
- Modify: `apps/api/src/modules/pve/pve.service.ts`
- Modify: `packages/game-engine/src/formulas/pve.ts`

- [ ] **Step 1: Remove `refreshPool` and `generateMiningMission` from pve.service.ts**

Delete the `refreshPool` function (old lines 62-118) and `generateMiningMission` (old lines 120-151). Keep `generatePirateMission` in the code (pirates are dormant, not deleted).

- [ ] **Step 2: Remove `poolSize` and `accumulationCap` from pve.ts**

These are no longer used (cap is a constant 3). Delete the `poolSize` function (lines 28-33) and `accumulationCap` function (lines 38-40) from `packages/game-engine/src/formulas/pve.ts`.

Also remove the corresponding tests from `pve.test.ts`.

- [ ] **Step 3: Fix any TypeScript compilation errors**

Run: `npx tsc --noEmit --project apps/api/tsconfig.json`

Fix any remaining references to the deleted functions.

- [ ] **Step 4: Run all tests**

Run: `cd packages/game-engine && ./node_modules/.bin/vitest run src/formulas/pve.test.ts`
Expected: All PASS (with old poolSize/accumulationCap tests removed)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/pve/pve.service.ts packages/game-engine/src/formulas/pve.ts packages/game-engine/src/formulas/pve.test.ts
git commit -m "chore: remove old pool refresh logic and unused formulas"
```

---

### Task 10: TypeScript check and final verification

**Files:** All modified files

- [ ] **Step 1: Run TypeScript compilation for all packages**

```bash
npx tsc --noEmit --project apps/api/tsconfig.json
npx tsc --noEmit --project apps/web/tsconfig.json
npx tsc --noEmit --project packages/game-engine/tsconfig.json
```

Expected: No errors

- [ ] **Step 2: Run all game-engine tests**

```bash
cd packages/game-engine && ./node_modules/.bin/vitest run
```

Expected: All PASS

- [ ] **Step 3: Run the DB migration**

```bash
cd packages/db && npx drizzle-kit push
```

Verify `mission_center_state` table is created and slag rates are updated.

- [ ] **Step 4: Final commit and push**

```bash
git push
```
