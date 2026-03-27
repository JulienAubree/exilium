# Fleet Mission Unification — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the monolithic `fleet.service.ts` (1585 lines) into a Strategy-pattern dispatcher + 8 mission handlers, without changing DB schema, API, or frontend.

**Architecture:** Each mission type gets a handler implementing `MissionHandler` (or `PhasedMissionHandler` for mine). Handlers own their mission-specific logic (including DB reads/writes) but **never** touch queues or notifications — they return structured results, and the dispatcher handles scheduling, notifications, and common operations (cargo deposit, ship restore, recall). The dispatcher keeps common logic (distance, fuel, ships, recall, scheduling).

**Handler purity contract:** Handlers CAN access `ctx.db` and services for mission-specific DB operations (combat losses, debris creation, planet creation, etc.). They CANNOT schedule jobs or publish notifications. They return `ArrivalResult` which tells the dispatcher what to schedule next. `processReturn` is **not** on the handler interface — it's 100% common logic in the dispatcher (restore ships, deposit cargo, mark completed).

**Tech Stack:** TypeScript, Drizzle ORM, BullMQ, tRPC

**Spec:** `docs/superpowers/specs/2026-03-19-fleet-mission-unification-design.md`

---

## File Structure

```
apps/api/src/modules/fleet/
├── fleet.service.ts          # MODIFY: shrink from ~1585 to ~400 lines
├── fleet.router.ts           # UNCHANGED
├── fleet.types.ts            # CREATE: interfaces, result types, shared helpers
├── handlers/
│   ├── transport.handler.ts  # CREATE
│   ├── station.handler.ts    # CREATE
│   ├── spy.handler.ts        # CREATE
│   ├── recycle.handler.ts    # CREATE
│   ├── colonize.handler.ts   # CREATE
│   ├── attack.handler.ts     # CREATE
│   ├── pirate.handler.ts     # CREATE
│   └── mine.handler.ts       # CREATE
packages/shared/src/types/
└── missions.ts               # MODIFY: align MissionType enum
```

---

## Chunk 1: Foundation

### Task 1: Create fleet.types.ts

**Files:**
- Create: `apps/api/src/modules/fleet/fleet.types.ts`

- [ ] **Step 1: Create the types file with all interfaces**

Create `apps/api/src/modules/fleet/fleet.types.ts` with:

```typescript
import type { Database } from '@exilium/db';
import type { createResourceService } from '../resource/resource.service.js';
import type { createMessageService } from '../message/message.service.js';
import type { GameConfigService } from '../admin/game-config.service.js';
import type { createPveService } from '../pve/pve.service.js';
import type { createAsteroidBeltService } from '../pve/asteroid-belt.service.js';
import type { createPirateService } from '../pve/pirate.service.js';
import type { Queue } from 'bullmq';
import type { ShipStats } from '@exilium/game-engine';

// ── Input types ──

export interface SendFleetInput {
  originPlanetId: string;
  targetGalaxy: number;
  targetSystem: number;
  targetPosition: number;
  mission: 'transport' | 'station' | 'spy' | 'attack' | 'colonize' | 'recycle' | 'mine' | 'pirate';
  ships: Record<string, number>;
  mineraiCargo?: number;
  siliciumCargo?: number;
  hydrogeneCargo?: number;
  pveMissionId?: string;
}

export interface ResourceCargo {
  minerai: number;
  silicium: number;
  hydrogene: number;
}

// ── Fleet event type (matches DB row) ──

export type FleetEvent = {
  id: string;
  userId: string;
  originPlanetId: string;
  targetPlanetId: string | null;
  targetGalaxy: number;
  targetSystem: number;
  targetPosition: number;
  mission: string;
  phase: string;
  status: string;
  departureTime: Date;
  arrivalTime: Date;
  mineraiCargo: string;
  siliciumCargo: string;
  hydrogeneCargo: string;
  ships: Record<string, number>;
  metadata: unknown;
  pveMissionId: string | null;
};

// ── Handler context ──

export type GameConfig = Awaited<ReturnType<GameConfigService['getFullConfig']>>;

export interface MissionHandlerContext {
  db: Database;
  resourceService: ReturnType<typeof createResourceService>;
  gameConfigService: GameConfigService;
  messageService?: ReturnType<typeof createMessageService>;
  pveService?: ReturnType<typeof createPveService>;
  asteroidBeltService?: ReturnType<typeof createAsteroidBeltService>;
  pirateService?: ReturnType<typeof createPirateService>;
  fleetArrivalQueue: Queue;
  fleetReturnQueue: Queue;
  universeSpeed: number;
}

// ── Result types ──

export interface ArrivalResult {
  scheduleReturn: boolean;
  schedulePhase?: {
    jobName: string;
    delayMs: number;
  };
  cargo?: ResourceCargo;
  shipsAfterArrival?: Record<string, number>;
  completePveMission?: boolean;
  createReturnEvent?: Record<string, unknown>;
}

export interface PhaseResult {
  scheduleNextPhase?: {
    jobName: string;
    delayMs: number;
  };
  scheduleReturn?: boolean;
  cargo?: ResourceCargo;
  updateFleet?: Record<string, unknown>;
  completePveMission?: boolean;
}

// ── Handler interfaces ──
// NOTE: No processReturn — return logic is 100% common (restore ships, deposit cargo, mark completed).
// Handlers own mission-specific logic via processArrival (and processPhase for mine).
// Handlers CAN do DB reads/writes for their mission logic but NEVER touch queues or notifications.

export interface MissionHandler {
  validateFleet(input: SendFleetInput, config: GameConfig, ctx: MissionHandlerContext): Promise<void>;
  processArrival(fleetEvent: FleetEvent, ctx: MissionHandlerContext): Promise<ArrivalResult>;
}

export interface PhasedMissionHandler extends MissionHandler {
  processPhase(phase: string, fleetEvent: FleetEvent, ctx: MissionHandlerContext): Promise<PhaseResult>;
}

// ── Shared helpers (moved from fleet.service.ts lines 47-77) ──

export function buildShipStatsMap(config: GameConfig): Record<string, ShipStats> {
  const map: Record<string, ShipStats> = {};
  for (const [id, ship] of Object.entries(config.ships)) {
    map[id] = {
      baseSpeed: ship.baseSpeed,
      fuelConsumption: ship.fuelConsumption,
      cargoCapacity: ship.cargoCapacity,
      driveType: ship.driveType as ShipStats['driveType'],
    };
  }
  return map;
}

export function buildCombatStats(config: GameConfig) {
  const stats: Record<string, { weapons: number; shield: number; armor: number }> = {};
  for (const [id, ship] of Object.entries(config.ships)) {
    stats[id] = { weapons: ship.weapons, shield: ship.shield, armor: ship.armor };
  }
  for (const [id, def] of Object.entries(config.defenses)) {
    stats[id] = { weapons: def.weapons, shield: def.shield, armor: def.armor };
  }
  return stats;
}

export function buildShipCosts(config: GameConfig) {
  const costs: Record<string, { minerai: number; silicium: number }> = {};
  for (const [id, ship] of Object.entries(config.ships)) {
    costs[id] = { minerai: ship.cost.minerai, silicium: ship.cost.silicium };
  }
  return costs;
}

// Used by attack and pirate handlers (moved from fleet.service.ts lines 1048-1064)
export async function getCombatTechs(db: Database, userId: string): Promise<CombatTechs> {
  // Query userResearch for weapons, shielding, armor levels
  // Extract the exact implementation from fleet.service.ts lines 1048-1064
}
```

**Note:** Import `CombatTechs` from `@exilium/game-engine`.

- [ ] **Step 2: Verify build**

Run: `cd apps/api && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/fleet/fleet.types.ts
git commit -m "feat(fleet): create fleet.types.ts with handler interfaces and shared helpers"
```

---

### Task 2: Align shared MissionType enum

**Files:**
- Modify: `packages/shared/src/types/missions.ts`

- [ ] **Step 1: Update the MissionType enum**

Replace the current `MissionType` enum with:

```typescript
export enum MissionType {
  Transport = 'transport',
  Station = 'station',
  Spy = 'spy',
  Attack = 'attack',
  Colonize = 'colonize',
  Recycle = 'recycle',
  Mine = 'mine',
  Pirate = 'pirate',
}
```

Changes: `Espionage = 'espionage'` → `Spy = 'spy'`, add `Mine` and `Pirate`, remove `Expedition`.

- [ ] **Step 2: Check for references to old enum values**

Run: `grep -r "MissionType\." apps/ packages/ --include="*.ts" | grep -v node_modules | grep -v dist`

If any references to `MissionType.Espionage` or `MissionType.Expedition` exist, update them. (Expected: none — the enum is currently unused outside its definition file.)

- [ ] **Step 3: Rebuild shared package**

Run: `npx turbo build --filter=@exilium/shared`

- [ ] **Step 4: Verify full build**

Run: `cd apps/api && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/types/missions.ts
git commit -m "refactor(shared): align MissionType enum with DB (add Mine/Pirate, rename Spy, remove Expedition)"
```

---

## Chunk 2: Simple Handlers

Each handler task follows the same pattern:
1. Create handler file implementing `MissionHandler` (`validateFleet` + `processArrival` only — no `processReturn`)
2. Move validation logic from `sendFleet` (lines 92-280) into `validateFleet`
3. Move arrival logic from `processArrival` (lines 348-567) or the dedicated method into `processArrival`
4. Handlers do their own DB operations for mission-specific logic (combat losses, debris, planet creation, deposit extraction, etc.)
5. Handlers return `ArrivalResult` — the dispatcher handles scheduling, notifications, cargo deposit on return
6. Register in service, remove old branches
7. Build verify + commit

**Important:** During extraction, the dispatcher still keeps the old if/else branches for unextracted missions. Only remove a branch when its handler is wired in. This keeps the code working at every step.

**Worker return format:** The dispatcher's public `processArrival()` and `processReturn()` methods must continue returning the same shape that workers expect (`userId`, `mission`, `originName`, `targetCoords`, `ships`, `cargo`, `originPlanetId`). The handler's `ArrivalResult` is internal — the dispatcher wraps it with common fields before returning to the worker.

### Task 3: Transport handler

**Files:**
- Create: `apps/api/src/modules/fleet/handlers/transport.handler.ts`
- Modify: `apps/api/src/modules/fleet/fleet.service.ts`

- [ ] **Step 1: Create transport handler**

Create `apps/api/src/modules/fleet/handlers/transport.handler.ts`:

The transport handler is the simplest — no special validation, arrival deposits cargo at target planet, return brings back empty fleet.

Read the current transport logic:
- **Validation:** none specific (sendFleet lines 92-280 have no transport-specific block)
- **Arrival:** `processArrival` lines 348-567 — look for the transport branch. It deposits cargo at the target planet and schedules return.
- **Return:** `processReturn` lines 670-756 — common logic (no transport-specific code).

The handler should implement `MissionHandler`:
- `validateFleet`: no-op (no transport-specific validation)
- `processArrival`: deposit cargo at target planet (DB write), then return `{ scheduleReturn: true, cargo: { minerai: 0, silicium: 0, hydrogene: 0 } }` (cargo zeroed since it was delivered). The handler does the DB deposit directly.

- [ ] **Step 2: Wire handler into fleet.service.ts**

In `fleet.service.ts`:
1. Import the handler: `import { TransportHandler } from './handlers/transport.handler.js';`
2. Add to a handlers map at the top of `createFleetService`:
   ```typescript
   const handlers: Record<string, MissionHandler> = {
     transport: new TransportHandler(),
   };
   ```
3. In `sendFleet`, after the common validation and before the mission-specific blocks, add:
   ```typescript
   const handler = handlers[input.mission];
   if (handler) {
     await handler.validateFleet(input, config, ctx);
   }
   ```
4. In `processArrival`, replace the transport branch with:
   ```typescript
   if (event.mission in handlers) {
     const handler = handlers[event.mission];
     const result = await handler.processArrival(event, ctx);
     // Execute side effects...
     // Schedule return or next phase...
   }
   ```
   Keep the old branches for missions not yet extracted.

- [ ] **Step 3: Build verify**

Run: `cd apps/api && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/fleet/handlers/transport.handler.ts apps/api/src/modules/fleet/fleet.service.ts
git commit -m "refactor(fleet): extract transport handler"
```

---

### Task 4: Station handler

**Files:**
- Create: `apps/api/src/modules/fleet/handlers/station.handler.ts`
- Modify: `apps/api/src/modules/fleet/fleet.service.ts`

- [ ] **Step 1: Create station handler**

Station is unique: ships + cargo stay at destination, no return. Read the station branch in `processArrival` (lines 348-567).

- `validateFleet`: no-op
- `processArrival`: deposit ships and cargo at the target planet (DB writes), then return `{ scheduleReturn: false }`. No return trip for station missions.

- [ ] **Step 2: Register handler and remove old branch**

Add `station: new StationHandler()` to the handlers map. Remove the station branch from `processArrival`.

- [ ] **Step 3: Build verify + commit**

```bash
git add apps/api/src/modules/fleet/handlers/station.handler.ts apps/api/src/modules/fleet/fleet.service.ts
git commit -m "refactor(fleet): extract station handler"
```

---

### Task 5: Spy handler

**Files:**
- Create: `apps/api/src/modules/fleet/handlers/spy.handler.ts`
- Modify: `apps/api/src/modules/fleet/fleet.service.ts`

- [ ] **Step 1: Create spy handler**

Read `processSpy` (lines 1076-1208) and the spy validation in `sendFleet` (lines 160-167).

- `validateFleet`: only espionage probes allowed (move lines 160-167)
- `processArrival`: extract `processSpy` logic (lines 1076-1208). Uses `calculateSpyReport`, `calculateDetectionChance`. Sends spy report and detection alert messages directly via `ctx.messageService`. Returns `{ scheduleReturn: true }`. If probes are detected and destroyed, returns `{ scheduleReturn: true, shipsAfterArrival: {} }` (empty fleet).

Also move the `getEspionageTech` helper (lines 1066-1074) into the handler as a private method.

- [ ] **Step 2: Register handler, remove old `processSpy` method and spy validation block**

- [ ] **Step 3: Build verify + commit**

```bash
git add apps/api/src/modules/fleet/handlers/spy.handler.ts apps/api/src/modules/fleet/fleet.service.ts
git commit -m "refactor(fleet): extract spy handler"
```

---

### Task 6: Recycle handler

**Files:**
- Create: `apps/api/src/modules/fleet/handlers/recycle.handler.ts`
- Modify: `apps/api/src/modules/fleet/fleet.service.ts`

- [ ] **Step 1: Create recycle handler**

Read `processRecycle` (lines 1209-1278) and the recycle validation in `sendFleet` (lines 151-158).

- `validateFleet`: only recyclers allowed (move lines 151-158)
- `processArrival`: extract `processRecycle` logic (lines 1209-1278). Collects debris from `debrisFields` (DB read/write), calculates collected resources capped to cargo capacity. Return `{ scheduleReturn: true, cargo: collectedResources }`.

- [ ] **Step 2: Register handler, remove old `processRecycle` method and recycle validation block**

- [ ] **Step 3: Build verify + commit**

```bash
git add apps/api/src/modules/fleet/handlers/recycle.handler.ts apps/api/src/modules/fleet/fleet.service.ts
git commit -m "refactor(fleet): extract recycle handler"
```

---

## Chunk 3: Complex Handlers

### Task 7: Colonize handler

**Files:**
- Create: `apps/api/src/modules/fleet/handlers/colonize.handler.ts`
- Modify: `apps/api/src/modules/fleet/fleet.service.ts`

- [ ] **Step 1: Create colonize handler**

Read `processColonize` (lines 853-1046) and the colonize validation in `sendFleet` (lines 169-176).

- `validateFleet`: only colony ships allowed (move lines 169-176). Max planets and position availability checks stay in `processArrival` since conditions can change between send and arrival.
- `processArrival`: extract `processColonize` logic. The handler does all DB operations directly: check max planets, check position availability, create planet + planetShips + planetDefenses, consume colony ship, send success/failure messages via `ctx.messageService`. **Edge case:** on success, return `{ scheduleReturn: false, createReturnEvent: { ... } }` — the colony ship is consumed and remaining ships return in a **new** fleet event. On failure, return `{ scheduleReturn: true }`.

The dispatcher must handle `createReturnEvent` by inserting a new fleet event and scheduling its return job.

- [ ] **Step 2: Add `create_return_event` handling in the dispatcher's side effect executor**

In the dispatcher's `processArrival`, after calling `handler.processArrival(event, ctx)`, loop through `result.sideEffects` and handle each type:
- `send_message` → call `messageService.createSystemMessage(...)`
- `create_planet` → insert planet (logic from processColonize)
- `create_return_event` → insert new fleet event + schedule return job
- `start_pve_mission` → call `pveService.startMission(...)`

- [ ] **Step 3: Register handler, remove old `processColonize` method and colonize validation block**

- [ ] **Step 4: Build verify + commit**

```bash
git add apps/api/src/modules/fleet/handlers/colonize.handler.ts apps/api/src/modules/fleet/fleet.service.ts
git commit -m "refactor(fleet): extract colonize handler"
```

---

### Task 8: Attack handler

**Files:**
- Create: `apps/api/src/modules/fleet/handlers/attack.handler.ts`
- Modify: `apps/api/src/modules/fleet/fleet.service.ts`

- [ ] **Step 1: Create attack handler**

Read `processAttack` (lines 1279-1540) and the attack validation in `sendFleet` (lines 133-149).

- `validateFleet`: cannot attack own planet (move lines 133-149). This is **async** — needs DB query via `ctx.db` to check target planet ownership.
- `processArrival`: extract `processAttack` logic. This is the largest handler. Uses `simulateCombat`, `buildCombatStats`, `buildShipCosts`, `getCombatTechs` (all from `fleet.types.ts`). The handler does all DB operations directly: apply defender losses, create/update debris field, calculate and apply pillage. Sends combat reports to attacker + defender via `ctx.messageService`. Returns `{ scheduleReturn: true, cargo: lootedResources, shipsAfterArrival: survivingShips }`.

- [ ] **Step 2: Register handler, remove old `processAttack` method and attack validation block**

- [ ] **Step 3: Build verify + commit**

```bash
git add apps/api/src/modules/fleet/handlers/attack.handler.ts apps/api/src/modules/fleet/fleet.service.ts
git commit -m "refactor(fleet): extract attack handler"
```

---

### Task 9: Pirate handler

**Files:**
- Create: `apps/api/src/modules/fleet/handlers/pirate.handler.ts`
- Modify: `apps/api/src/modules/fleet/fleet.service.ts`

- [ ] **Step 1: Create pirate handler**

Read the pirate branch in `processArrival` (lines 502-556). It calls `pirateService.processPirateArrival()`.

- `validateFleet`: no specific validation (pirate missions are initiated via PvE mission system)
- `processArrival`: call `ctx.pirateService.processPirateArrival(...)`. Process combat result, calculate surviving ships, loot capped to cargo capacity, store bonus ships in fleet event metadata (DB write). Calls `ctx.pveService.completeMission()` directly (PvE completion happens at arrival, not return). Returns `{ scheduleReturn: true, cargo: loot, shipsAfterArrival: survivors, completePveMission: false }` (already completed inline).

**Note:** `getCombatTechs` from `fleet.types.ts` is needed here for the combat tech lookup.

- [ ] **Step 2: Register handler, remove old pirate branch**

- [ ] **Step 3: Build verify + commit**

```bash
git add apps/api/src/modules/fleet/handlers/pirate.handler.ts apps/api/src/modules/fleet/fleet.service.ts
git commit -m "refactor(fleet): extract pirate handler"
```

---

### Task 10: Mine handler (PhasedMissionHandler)

**Files:**
- Create: `apps/api/src/modules/fleet/handlers/mine.handler.ts`
- Modify: `apps/api/src/modules/fleet/fleet.service.ts`

- [ ] **Step 1: Create mine handler**

This is the only `PhasedMissionHandler`. Read:
- Mine validation in `sendFleet` (lines 178-187)
- Mine arrival branch in `processArrival` (lines 348-567)
- `processProspectDone` (lines 568-613)
- `processMineDone` (lines 614-669)

Implement `PhasedMissionHandler`:
- `validateFleet`: require at least 1 prospector + belt position (move lines 178-187). Import `BELT_POSITIONS` from `'../../universe/universe.config.js'`.
- `processArrival`: start prospecting phase, update fleet event phase to `'prospecting'` (DB write). Return `{ scheduleReturn: false, schedulePhase: { jobName: 'prospect-done', delayMs: prospectionDuration(...) } }`.
- `processPhase('prospect-done')`: transition to mining phase, update fleet event (DB write). Return `{ scheduleNextPhase: { jobName: 'mine-done', delayMs: miningDuration(...) } }`.
- `processPhase('mine-done')`: extract resources from deposit via `ctx.asteroidBeltService` (DB write), calculate cargo, call `ctx.pveService.completeMission()`. Return `{ scheduleReturn: true, cargo: extractedResources }`.

- [ ] **Step 2: Update dispatcher for phased handlers**

In the dispatcher:
- `processProspectDone(fleetEventId)`: load event, get handler, verify `'processPhase' in handler`, call `handler.processPhase('prospect-done', event, ctx)`. Execute the returned `PhaseResult` (schedule next phase or return).
- `processMineDone(fleetEventId)`: same pattern with `'mine-done'`.

- [ ] **Step 3: Register handler, remove old mine branch + `processProspectDone` + `processMineDone` methods**

- [ ] **Step 4: Build verify + commit**

```bash
git add apps/api/src/modules/fleet/handlers/mine.handler.ts apps/api/src/modules/fleet/fleet.service.ts
git commit -m "refactor(fleet): extract mine handler (PhasedMissionHandler)"
```

---

## Chunk 4: Cleanup & Verification

### Task 11: Dispatcher cleanup

**Files:**
- Modify: `apps/api/src/modules/fleet/fleet.service.ts`

- [ ] **Step 1: Remove dead code**

At this point, all 8 handlers are extracted. Clean up `fleet.service.ts`:
- Remove `buildShipStatsMap`, `buildCombatStats`, `buildShipCosts` (now in fleet.types.ts) — import them instead
- Remove the old `SendFleetInput` interface (now in fleet.types.ts) — import it
- Remove any remaining mission-specific if/else branches in `processArrival`
- Remove the old `processSpy`, `processRecycle`, `processAttack`, `processColonize` methods
- Remove `getEspionageTech` (moved to spy handler)
- Remove `getCombatTechs` (moved to fleet.types.ts)
- Remove `scheduleReturnWithDelay` (dead code, line 804-851 — never called)

The service should now contain only:
- Handler registry
- `sendFleet` (common logic + handler.validateFleet dispatch)
- `recallFleet` (unchanged)
- `listMovements` (unchanged)
- `processArrival` (dispatch to handler + execute ArrivalResult: schedule return/phase, handle createReturnEvent)
- `processProspectDone` / `processMineDone` (dispatch to mine handler's processPhase)
- `processReturn` (common logic: restore ships + bonusShips, deposit cargo, mark completed)
- `scheduleReturn` (common)
- `getOwnedPlanet`, `getDriveTechs`, `getDriveTechsByEvent`, `getOrCreateShips` (helpers)

- [ ] **Step 2: Verify the service is ~300-400 lines**

Run: `wc -l apps/api/src/modules/fleet/fleet.service.ts`

- [ ] **Step 3: Build full monorepo**

Run: `npx turbo build`
Expected: all packages build successfully

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/fleet/fleet.service.ts apps/api/src/modules/fleet/fleet.types.ts
git commit -m "refactor(fleet): clean up dispatcher, remove dead code"
```

---

### Task 12: Final verification & push

- [ ] **Step 1: Verify all handlers exist**

Run: `ls apps/api/src/modules/fleet/handlers/`
Expected: 8 files (transport, station, spy, recycle, colonize, attack, pirate, mine)

- [ ] **Step 2: Full build**

Run: `npx turbo build`

- [ ] **Step 3: Push**

```bash
git push
```
