# Queue Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unifier les 5 queues BullMQ et 5 workers en 2 queues (`build-completion`, `fleet`) et 2 workers, avec un pipeline post-completion factorise.

**Architecture:** Les 3 queues de build deviennent une seule queue `build-completion` routee par `jobName`. Les 2 queues fleet deviennent une seule queue `fleet`. Chaque service de completion retourne un type standardise (`BuildCompletionResult` / `FleetCompletionResult`) et le worker applique un pipeline commun (notification, gameEvent, tutorial check).

**Tech Stack:** BullMQ, Redis (ioredis), Drizzle ORM, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-20-queue-unification-design.md`

**Note importante:** Les Tasks 3 a 7 modifient les services et creent les nouveaux workers, mais l'ancien `app-router.ts` et `worker.ts` referenceront encore les anciennes queues. Le build ne compilera pas entre les Tasks 3 et 8. C'est attendu — la Task 8 branche tout ensemble et restaure la compilation.

**Changement de naming :** Le type d'event tutorial est normalise en `'tutorial-quest-done'` partout (l'ancien research worker utilisait `'tutorial-quest-complete'` de maniere inconsistante). Pas d'impact frontend (le frontend lit les events via `gameEvents` sans filtrer sur ce type specifique).

---

### Task 1: Creer le nouveau fichier de queues

**Files:**
- Create: `apps/api/src/queues/queues.ts`

- [ ] **Step 1: Creer le nouveau fichier avec 2 queues**

```typescript
import { Queue } from 'bullmq';
import { env } from '../config/env.js';

const connection = { url: env.REDIS_URL };

export const buildCompletionQueue = new Queue('build-completion', { connection });
export const fleetQueue = new Queue('fleet', { connection });
```

- [ ] **Step 2: Verifier que le build compile**

Run: `cd /Users/julienaubree/_projet/exilium && pnpm --filter api build`
Expected: PASS (le nouveau fichier n'est pas encore importe)

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/queues/queues.ts
git commit -m "feat: add unified queue definitions (build-completion + fleet)"
```

---

### Task 2: Elargir le type NotificationEvent et definir les types CompletionResult

**Files:**
- Modify: `apps/api/src/modules/notification/notification.publisher.ts:3-6` (elargir le type union)
- Create: `apps/api/src/workers/completion.types.ts`

- [ ] **Step 1: Elargir NotificationEvent.type pour accepter n'importe quel string**

Le type actuel est une union stricte (`'building-done' | 'research-done' | ...`). Les workers unifies passent `result.eventType` (string) ce qui causerait une erreur de compilation. Modifier `notification.publisher.ts` :

```typescript
export interface NotificationEvent {
  type: string;
  payload: Record<string, unknown>;
}
```

- [ ] **Step 2: Creer le fichier de types**

```typescript
export type BuildCompletionResult = {
  userId: string;
  planetId: string;
  eventType: string;
  notificationPayload: Record<string, unknown>;
  eventPayload: Record<string, unknown>;
  tutorialCheck?: {
    type: string;
    targetId: string;
    targetValue: number;
  };
} | null;

export type FleetCompletionResult = {
  userId: string;
  planetId: string;
  mission: string;
  eventType: string;
  notificationPayload: Record<string, unknown>;
  eventPayload: Record<string, unknown>;
  extraEvents?: Array<{
    type: string;
    payload: Record<string, unknown>;
  }>;
  tutorialChecks?: Array<{
    type: string;
    targetId: string;
    targetValue: number;
  }>;
} | null;
```

- [ ] **Step 2: Verifier que le build compile**

Run: `cd /Users/julienaubree/_projet/exilium && pnpm --filter api build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/workers/completion.types.ts
git commit -m "feat: add BuildCompletionResult and FleetCompletionResult types"
```

---

### Task 3: Adapter buildingService pour retourner BuildCompletionResult

**Files:**
- Modify: `apps/api/src/modules/building/building.service.ts:10-15` (signature createBuildingService — remplacer `buildingQueue` par `buildCompletionQueue`)
- Modify: `apps/api/src/modules/building/building.service.ts:140-145` (startUpgrade — changer `buildingQueue.add('complete', ...)` en `buildCompletionQueue.add('building', ...)`)
- Modify: `apps/api/src/modules/building/building.service.ts:186` (cancelUpgrade — changer `buildingQueue.remove(...)`)
- Modify: `apps/api/src/modules/building/building.service.ts:194-227` (completeUpgrade — enrichir le retour pour inclure userId, planetId, eventType, etc.)

- [ ] **Step 1: Renommer le parametre queue dans la signature**

Dans `createBuildingService`, renommer le parametre `buildingQueue: Queue` en `buildQueue: Queue` (nom generique). Ce parametre recevra `buildCompletionQueue` depuis l'appelant.

- [ ] **Step 2: Changer les appels queue.add et queue.remove**

- `buildQueue.add('building', { buildQueueId: entry.id }, { delay: time * 1000, jobId: \`building-\${entry.id}\` })` (ligne ~141)
- `buildQueue.remove(\`building-\${activeBuild.id}\`)` (ligne ~186)

Le jobName passe de `'complete'` a `'building'`. Le `jobId` reste identique.

- [ ] **Step 3: Enrichir le retour de completeUpgrade**

Modifier `completeUpgrade` pour retourner un `BuildCompletionResult` au lieu de `{ buildingId, newLevel }`. Le service doit maintenant fetch le planet name et resoudre le nom lisible :

```typescript
async completeUpgrade(buildQueueId: string): Promise<BuildCompletionResult> {
  const [entry] = await db
    .select()
    .from(buildQueue)
    .where(and(eq(buildQueue.id, buildQueueId), eq(buildQueue.status, 'active')))
    .limit(1);

  if (!entry) return null;

  const config = await gameConfigService.getFullConfig();
  const def = config.buildings[entry.itemId];
  if (!def) return null;

  const buildingLevels = await this.getBuildingLevels(entry.planetId);
  const currentLevel = buildingLevels[entry.itemId] ?? 0;
  const newLevel = currentLevel + 1;

  await db
    .insert(planetBuildings)
    .values({ planetId: entry.planetId, buildingId: entry.itemId, level: newLevel })
    .onConflictDoUpdate({
      target: [planetBuildings.planetId, planetBuildings.buildingId],
      set: { level: newLevel },
    });

  await db
    .update(buildQueue)
    .set({ status: 'completed' })
    .where(eq(buildQueue.id, buildQueueId));

  const [planet] = await db
    .select({ name: planets.name })
    .from(planets)
    .where(eq(planets.id, entry.planetId))
    .limit(1);

  const buildingName = config.buildings[entry.itemId]?.name ?? entry.itemId;
  const planetName = planet?.name ?? 'Planete';

  return {
    userId: entry.userId,
    planetId: entry.planetId,
    eventType: 'building-done',
    notificationPayload: {
      planetId: entry.planetId,
      buildingId: entry.itemId,
      name: buildingName,
      level: newLevel,
    },
    eventPayload: {
      buildingId: entry.itemId,
      name: buildingName,
      level: newLevel,
      planetName,
    },
    tutorialCheck: {
      type: 'building_level',
      targetId: entry.itemId,
      targetValue: newLevel,
    },
  };
},
```

Ajouter `import type { BuildCompletionResult } from '../../workers/completion.types.js';` en haut du fichier.

- [ ] **Step 4: Verifier que le build compile**

Run: `cd /Users/julienaubree/_projet/exilium && pnpm --filter api build`
Expected: FAIL possible car `app-router.ts` passe encore `buildingCompletionQueue` — on corrigera a la Task 8.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/building/building.service.ts
git commit -m "refactor: buildingService returns BuildCompletionResult, uses unified queue"
```

---

### Task 4: Adapter researchService pour retourner BuildCompletionResult

**Files:**
- Modify: `apps/api/src/modules/research/research.service.ts:22-27` (signature — remplacer `researchQueue` par nom generique)
- Modify: `apps/api/src/modules/research/research.service.ts:137-141` (startResearch — changer add)
- Modify: `apps/api/src/modules/research/research.service.ts:188` (cancelResearch — changer remove)
- Modify: `apps/api/src/modules/research/research.service.ts:194-222` (completeResearch — enrichir le retour)

- [ ] **Step 1: Renommer le parametre queue**

Renommer `researchQueue: Queue` en `buildQueue: Queue` dans `createResearchService`.

- [ ] **Step 2: Changer les appels queue.add et queue.remove**

- `buildQueue.add('research', { buildQueueId: entry.id }, { delay: time * 1000, jobId: \`research-\${entry.id}\` })`
- `buildQueue.remove(\`research-\${activeResearch.id}\`)`

- [ ] **Step 3: Enrichir le retour de completeResearch**

```typescript
async completeResearch(buildQueueId: string): Promise<BuildCompletionResult> {
  const [entry] = await db
    .select()
    .from(buildQueue)
    .where(and(eq(buildQueue.id, buildQueueId), eq(buildQueue.status, 'active')))
    .limit(1);

  if (!entry) return null;

  const config = await gameConfigService.getFullConfig();
  const def = config.research[entry.itemId];
  if (!def) return null;

  const columnKey = def.levelColumn;
  const research = await this.getOrCreateResearch(entry.userId);
  const newLevel = ((research[columnKey as keyof typeof research] ?? 0) as number) + 1;

  await db
    .update(userResearch)
    .set({ [columnKey]: newLevel })
    .where(eq(userResearch.userId, entry.userId));

  await db
    .update(buildQueue)
    .set({ status: 'completed' })
    .where(eq(buildQueue.id, buildQueueId));

  const [planet] = await db
    .select({ name: planets.name })
    .from(planets)
    .where(eq(planets.id, entry.planetId))
    .limit(1);

  const techName = config.research[entry.itemId]?.name ?? entry.itemId;
  const planetName = planet?.name ?? 'Planete';

  return {
    userId: entry.userId,
    planetId: entry.planetId,
    eventType: 'research-done',
    notificationPayload: {
      techId: entry.itemId,
      name: techName,
      level: newLevel,
    },
    eventPayload: {
      techId: entry.itemId,
      name: techName,
      level: newLevel,
      planetName,
    },
    tutorialCheck: {
      type: 'research_level',
      targetId: entry.itemId,
      targetValue: newLevel,
    },
  };
},
```

Ajouter `import type { BuildCompletionResult } from '../../workers/completion.types.js';` et `import { planets } from '@exilium/db';` si pas deja importe.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/research/research.service.ts
git commit -m "refactor: researchService returns BuildCompletionResult, uses unified queue"
```

---

### Task 5: Adapter shipyardService pour retourner BuildCompletionResult

**Files:**
- Modify: `apps/api/src/modules/shipyard/shipyard.service.ts:10-14` (signature — renommer `shipyardQueue`)
- Modify: `apps/api/src/modules/shipyard/shipyard.service.ts:191-196` (buildUnit — changer add)
- Modify: `apps/api/src/modules/shipyard/shipyard.service.ts:272-276` (completeUnit mid-batch — changer add pour next unit)
- Modify: `apps/api/src/modules/shipyard/shipyard.service.ts:321-325` (activateNextBatch — changer add)
- Modify: `apps/api/src/modules/shipyard/shipyard.service.ts:373-377` (cancelBatch — changer getJob/remove)
- Modify: `apps/api/src/modules/shipyard/shipyard.service.ts:201-278` (completeUnit — enrichir le retour quand `completed: true`)

- [ ] **Step 1: Renommer le parametre queue**

Renommer `shipyardQueue: Queue` en `buildQueue: Queue` dans `createShipyardService`.

- [ ] **Step 2: Changer tous les appels queue.add et queue.remove**

4 sites d'appel a modifier :
- `buildUnit` (ligne ~191) : `buildQueue.add('shipyard-unit', ...)`
- `completeUnit` (ligne ~272) : `buildQueue.add('shipyard-unit', ...)` (pour le next unit dans le batch)
- `activateNextBatch` (ligne ~321) : `buildQueue.add('shipyard-unit', ...)`
- `cancelBatch` (ligne ~374) : `buildQueue.getJob(jobId)` (la queue est la meme, seul l'import change)

Les `jobId` restent au format `shipyard-${entry.id}-${N}`.

- [ ] **Step 3: Enrichir le retour de completeUnit**

Le retour actuel est `{ completed: boolean, itemId, totalCompleted }`. Modifier pour retourner `BuildCompletionResult` quand `completed: true`, et `null`-like quand le batch continue (mid-batch) :

```typescript
// Quand le batch est termine (newCompletedCount >= entry.quantity) :
const config = await gameConfigService.getFullConfig();
const unitName = config.ships[entry.itemId]?.name
  ?? config.defenses[entry.itemId]?.name
  ?? entry.itemId;

const [planet] = await db
  .select({ name: planets.name })
  .from(planets)
  .where(eq(planets.id, entry.planetId))
  .limit(1);

return {
  userId: entry.userId,
  planetId: entry.planetId,
  eventType: 'shipyard-done',
  notificationPayload: {
    planetId: entry.planetId,
    unitId: entry.itemId,
    name: unitName,
    count: newCompletedCount,
  },
  eventPayload: {
    unitId: entry.itemId,
    name: unitName,
    count: newCompletedCount,
    planetName: planet?.name ?? 'Planete',
  },
  tutorialCheck: entry.type === 'ship' ? {
    type: 'ship_count',
    targetId: entry.itemId,
    targetValue: newCompletedCount,
  } : undefined,
};

// Quand le batch continue (mid-batch, encore des unites a construire) :
// return null;  // pas de notification, le worker ne fera rien
```

Ajouter `import type { BuildCompletionResult } from '../../workers/completion.types.js';`.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/shipyard/shipyard.service.ts
git commit -m "refactor: shipyardService returns BuildCompletionResult, uses unified queue"
```

---

### Task 6: Adapter fleetService pour utiliser une seule queue

**Files:**
- Modify: `apps/api/src/modules/fleet/fleet.service.ts:27-39` (signature — remplacer 2 queues par 1)
- Modify: `apps/api/src/modules/fleet/fleet.service.ts:194` (sendFleet — `fleetQueue.add('arrive', ...)`)
- Modify: `apps/api/src/modules/fleet/fleet.service.ts:237` (recallFleet — `fleetQueue.remove(...)`)
- Modify: `apps/api/src/modules/fleet/fleet.service.ts:253` (recallFleet — `fleetQueue.add('return', ...)`)
- Modify: `apps/api/src/modules/fleet/fleet.service.ts:339` (processArrival — `fleetQueue.add(...)`)
- Modify: `apps/api/src/modules/fleet/fleet.service.ts:430` (processPhaseDispatch — `fleetQueue.add(...)`)
- Modify: `apps/api/src/modules/fleet/fleet.service.ts:578` (scheduleReturn — `fleetQueue.add('return', ...)`)
- Modify: `apps/api/src/modules/fleet/fleet.types.ts:72-73` (MissionHandlerContext — remplacer 2 queues par 1)

- [ ] **Step 1: Modifier la signature de createFleetService**

Remplacer les 2 parametres `fleetArrivalQueue: Queue` et `fleetReturnQueue: Queue` par un seul `fleetQueue: Queue`.

- [ ] **Step 2: Mettre a jour MissionHandlerContext dans fleet.types.ts**

Remplacer :
```typescript
fleetArrivalQueue: Queue;
fleetReturnQueue: Queue;
```
Par :
```typescript
fleetQueue: Queue;
```

Et dans `fleet.service.ts`, mettre a jour la creation du `handlerCtx` pour passer `fleetQueue` au lieu des deux queues separees.

- [ ] **Step 3: Remplacer tous les appels aux anciennes queues (6 sites)**

Tous les `fleetArrivalQueue.add(...)` et `fleetReturnQueue.add(...)` deviennent `fleetQueue.add(...)` :
- `sendFleet()` : `fleetQueue.add('arrive', { fleetEventId: event.id }, { delay, jobId: \`fleet-arrive-\${event.id}\` })`
- `recallFleet()` : `fleetQueue.remove(jobId)` puis `fleetQueue.add('return', ...)`
- `processArrival()` : `fleetQueue.add(result.schedulePhase.jobName, ...)`
- `processPhaseDispatch()` : `fleetQueue.add(result.scheduleNextPhase.jobName, ...)`
- `scheduleReturn()` : `fleetQueue.add('return', ...)`

- [ ] **Step 4: Enrichir processReturn pour retourner FleetCompletionResult**

Ajouter `import type { FleetCompletionResult } from '../../workers/completion.types.js';`.

Le retour actuel de `processReturn` contient deja `userId`, `originPlanetId`, `mission`, `ships`, `cargo`, etc. L'enrichir pour retourner un `FleetCompletionResult` :

```typescript
// A la fin de processReturn, au lieu de retourner l'objet actuel :
const fleetResult: FleetCompletionResult = {
  userId: event.userId,
  planetId: event.originPlanetId,
  mission: event.mission,
  eventType: 'fleet-returned',
  notificationPayload: {
    mission: event.mission,
    originName: originPlanet?.name ?? 'Planete',
    targetCoords: `${event.targetGalaxy}:${event.targetSystem}:${event.targetPosition}`,
  },
  eventPayload: {
    mission: event.mission,
    originName: originPlanet?.name ?? 'Planete',
    targetCoords: `${event.targetGalaxy}:${event.targetSystem}:${event.targetPosition}`,
    ships,
    cargo: {
      minerai: Number(event.mineraiCargo),
      silicium: Number(event.siliciumCargo),
      hydrogene: Number(event.hydrogeneCargo),
    },
  },
  extraEvents: (event.mission === 'mine' || event.mission === 'pirate') ? [{
    type: 'pve-mission-done',
    payload: {
      missionType: event.mission,
      targetCoords: `${event.targetGalaxy}:${event.targetSystem}:${event.targetPosition}`,
      originName: originPlanet?.name ?? 'Planete',
      cargo: {
        minerai: Number(event.mineraiCargo),
        silicium: Number(event.siliciumCargo),
        hydrogene: Number(event.hydrogeneCargo),
      },
    },
  }] : undefined,
  tutorialChecks: [
    { type: 'fleet_return', targetId: event.mission, targetValue: 1 },
    ...(event.mission === 'mine' ? [{ type: 'mission_complete', targetId: 'mine', targetValue: 1 }] : []),
  ],
};
return fleetResult;
```

- [ ] **Step 5: Enrichir processArrival pour retourner FleetCompletionResult**

Le retour actuel contient `userId`, `mission`, `originName`, `targetCoords`, etc. Enrichir de la meme facon :

```typescript
// A la fin de processArrival, au lieu de retourner l'objet actuel :
return {
  userId: event.userId,
  planetId: event.originPlanetId,
  mission: event.mission,
  eventType: 'fleet-arrived',
  notificationPayload: {
    mission: event.mission,
    originName: eventMeta.originName,
    targetCoords: eventMeta.targetCoords,
  },
  eventPayload: {
    mission: event.mission,
    originName: eventMeta.originName,
    targetCoords: eventMeta.targetCoords,
    ships,
    cargo: {
      minerai: Number(event.mineraiCargo),
      silicium: Number(event.siliciumCargo),
      hydrogene: Number(event.hydrogeneCargo),
    },
  },
  // Pas de tutorialChecks ni extraEvents sur arrival
};
```

**Important :** `processProspectDone` et `processMineDone` retournent actuellement un objet interne (`{ skipped, fleetEventId, phase }` / `{ ...result, extracted }`) qui n'est pas compatible avec `FleetCompletionResult`. Ces methodes ne declenchent pas de notification/event — elles ne font que dispatcher la phase suivante en interne. Il faut :

1. Changer leur type de retour pour renvoyer `null` (le worker ne fera rien pour le pipeline post-completion)
2. Ou les exclure du handler map type dans le fleet worker

Approche retenue : modifier `processProspectDone` et `processMineDone` pour retourner `null` apres avoir fait leur travail interne. Le fleet worker traite `null` comme un no-op.

```typescript
async processProspectDone(fleetEventId: string): Promise<FleetCompletionResult> {
  await this.processPhaseDispatch(fleetEventId, 'prospect-done', 'prospecting');
  return null;
},

async processMineDone(fleetEventId: string): Promise<FleetCompletionResult> {
  await this.processPhaseDispatch(fleetEventId, 'mine-done', 'mining');
  return null;
},
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/fleet/fleet.service.ts apps/api/src/modules/fleet/fleet.types.ts
git commit -m "refactor: fleetService uses single fleetQueue, returns FleetCompletionResult"
```

---

### Task 7: Creer les 2 workers unifies

**Files:**
- Create: `apps/api/src/workers/build-completion.worker.ts`
- Create: `apps/api/src/workers/fleet.worker.ts`

- [ ] **Step 1: Creer le build-completion worker**

```typescript
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import type { Database } from '@exilium/db';
import { gameEvents } from '@exilium/db';
import { publishNotification } from '../modules/notification/notification.publisher.js';
import { env } from '../config/env.js';
import type { BuildCompletionResult } from './completion.types.js';
import type { createBuildingService } from '../modules/building/building.service.js';
import type { createResearchService } from '../modules/research/research.service.js';
import type { createShipyardService } from '../modules/shipyard/shipyard.service.js';
import type { createTutorialService } from '../modules/tutorial/tutorial.service.js';

type Services = {
  buildingService: ReturnType<typeof createBuildingService>;
  researchService: ReturnType<typeof createResearchService>;
  shipyardService: ReturnType<typeof createShipyardService>;
  tutorialService: ReturnType<typeof createTutorialService>;
};

export function startBuildCompletionWorker(db: Database, redis: Redis, services: Services) {
  const { buildingService, researchService, shipyardService, tutorialService } = services;

  const handlers: Record<string, (id: string) => Promise<BuildCompletionResult>> = {
    'building':      (id) => buildingService.completeUpgrade(id),
    'research':      (id) => researchService.completeResearch(id),
    'shipyard-unit': (id) => shipyardService.completeUnit(id),
  };

  const worker = new Worker(
    'build-completion',
    async (job) => {
      const { buildQueueId } = job.data as { buildQueueId: string };
      console.log(`[build-completion] Processing ${job.name} job ${job.id}`);

      const handler = handlers[job.name];
      if (!handler) {
        console.error(`[build-completion] Unknown job name: ${job.name}`);
        return;
      }

      const result = await handler(buildQueueId);
      if (!result) {
        console.log(`[build-completion] Entry ${buildQueueId} not found or already completed`);
        return;
      }

      // Pipeline post-completion commun
      publishNotification(redis, result.userId, {
        type: result.eventType,
        payload: result.notificationPayload,
      });

      await db.insert(gameEvents).values({
        userId: result.userId,
        planetId: result.planetId,
        type: result.eventType,
        payload: result.eventPayload,
      });

      if (result.tutorialCheck) {
        const tutorialResult = await tutorialService.checkAndComplete(result.userId, {
          type: result.tutorialCheck.type,
          targetId: result.tutorialCheck.targetId,
          targetValue: result.tutorialCheck.targetValue,
        });
        if (tutorialResult) {
          publishNotification(redis, result.userId, {
            type: 'tutorial-quest-complete',
            payload: {
              questId: tutorialResult.completedQuest.id,
              questTitle: tutorialResult.completedQuest.title,
              reward: tutorialResult.reward,
              nextQuest: tutorialResult.nextQuest
                ? { id: tutorialResult.nextQuest.id, title: tutorialResult.nextQuest.title }
                : null,
              tutorialComplete: tutorialResult.tutorialComplete,
            },
          });

          await db.insert(gameEvents).values({
            userId: result.userId,
            planetId: result.planetId,
            type: 'tutorial-quest-done',
            payload: {
              questId: tutorialResult.completedQuest.id,
              questTitle: tutorialResult.completedQuest.title,
              reward: tutorialResult.reward,
              tutorialComplete: tutorialResult.tutorialComplete,
            },
          });
        }
      }

      console.log(`[build-completion] ${job.name} completed for ${buildQueueId}`);
    },
    {
      connection: { url: env.REDIS_URL },
      concurrency: 5,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    },
  );

  worker.on('failed', (job, err) => {
    console.error(`[build-completion] Job ${job?.id} failed:`, err);
  });

  return worker;
}
```

- [ ] **Step 2: Creer le fleet worker**

```typescript
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import type { Database } from '@exilium/db';
import { gameEvents } from '@exilium/db';
import { publishNotification } from '../modules/notification/notification.publisher.js';
import { env } from '../config/env.js';
import type { FleetCompletionResult } from './completion.types.js';
import type { createFleetService } from '../modules/fleet/fleet.service.js';
import type { createTutorialService } from '../modules/tutorial/tutorial.service.js';

type Services = {
  fleetService: ReturnType<typeof createFleetService>;
  tutorialService: ReturnType<typeof createTutorialService>;
};

export function startFleetWorker(db: Database, redis: Redis, services: Services) {
  const { fleetService, tutorialService } = services;

  const handlers: Record<string, (id: string) => Promise<FleetCompletionResult>> = {
    'arrive':        (id) => fleetService.processArrival(id),
    'return':        (id) => fleetService.processReturn(id),
    'prospect-done': (id) => fleetService.processProspectDone(id),
    'mine-done':     (id) => fleetService.processMineDone(id),
  };

  const worker = new Worker(
    'fleet',
    async (job) => {
      const { fleetEventId } = job.data as { fleetEventId: string };
      console.log(`[fleet] Processing ${job.name} job ${job.id}`);

      const handler = handlers[job.name];
      if (!handler) {
        console.error(`[fleet] Unknown job name: ${job.name}`);
        return;
      }

      const result = await handler(fleetEventId);
      if (!result) {
        console.log(`[fleet] Event ${fleetEventId} not found, already completed, or phase-only`);
        return;
      }

      // Pipeline post-completion commun
      if (result.userId) {
        publishNotification(redis, result.userId, {
          type: result.eventType,
          payload: result.notificationPayload,
        });

        await db.insert(gameEvents).values({
          userId: result.userId,
          planetId: result.planetId,
          type: result.eventType,
          payload: result.eventPayload,
        });

        // Extra events (ex: pve-mission-done)
        if (result.extraEvents) {
          for (const extra of result.extraEvents) {
            await db.insert(gameEvents).values({
              userId: result.userId,
              planetId: result.planetId,
              type: extra.type,
              payload: extra.payload,
            });
          }
        }

        // Tutorial checks (peut y en avoir plusieurs)
        if (result.tutorialChecks) {
          for (const check of result.tutorialChecks) {
            const tutorialResult = await tutorialService.checkAndComplete(result.userId, {
              type: check.type,
              targetId: check.targetId,
              targetValue: check.targetValue,
            });
            if (tutorialResult) {
              publishNotification(redis, result.userId, {
                type: 'tutorial-quest-complete',
                payload: {
                  questId: tutorialResult.completedQuest.id,
                  questTitle: tutorialResult.completedQuest.title,
                  reward: tutorialResult.reward,
                  nextQuest: tutorialResult.nextQuest
                    ? { id: tutorialResult.nextQuest.id, title: tutorialResult.nextQuest.title }
                    : null,
                  tutorialComplete: tutorialResult.tutorialComplete,
                },
              });

              await db.insert(gameEvents).values({
                userId: result.userId,
                planetId: result.planetId,
                type: 'tutorial-quest-done',
                payload: {
                  questId: tutorialResult.completedQuest.id,
                  questTitle: tutorialResult.completedQuest.title,
                  reward: tutorialResult.reward,
                  tutorialComplete: tutorialResult.tutorialComplete,
                },
              });
            }
          }
        }
      }

      console.log(`[fleet] ${job.name} completed for ${fleetEventId}`);
    },
    {
      connection: { url: env.REDIS_URL },
      concurrency: 5,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    },
  );

  worker.on('failed', (job, err) => {
    console.error(`[fleet] Job ${job?.id} failed:`, err);
  });

  return worker;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/workers/build-completion.worker.ts apps/api/src/workers/fleet.worker.ts
git commit -m "feat: add unified build-completion and fleet workers"
```

---

### Task 8: Mettre a jour worker.ts et app-router.ts pour utiliser les nouvelles queues

**Files:**
- Modify: `apps/api/src/workers/worker.ts` (remplacer les 5 start par 2, partager les services)
- Modify: `apps/api/src/trpc/app-router.ts:14` (importer depuis `queues.ts` au lieu de `queue.ts`)
- Modify: `apps/api/src/trpc/app-router.ts:51-53` (passer `buildCompletionQueue` aux 3 services de build)
- Modify: `apps/api/src/trpc/app-router.ts:61` (passer `fleetQueue` au lieu de 2 queues)

- [ ] **Step 1: Mettre a jour app-router.ts**

Remplacer l'import :
```typescript
// Avant
import { buildingCompletionQueue, researchCompletionQueue, shipyardCompletionQueue, fleetArrivalQueue, fleetReturnQueue } from '../queues/queue.js';
// Apres
import { buildCompletionQueue, fleetQueue } from '../queues/queues.js';
```

Mettre a jour les appels de creation de services :
```typescript
const buildingService = createBuildingService(db, resourceService, buildCompletionQueue, gameConfigService);
const researchService = createResearchService(db, resourceService, buildCompletionQueue, gameConfigService);
const shipyardService = createShipyardService(db, resourceService, buildCompletionQueue, gameConfigService);
// ...
const fleetService = createFleetService(db, resourceService, fleetQueue, universeSpeed, messageService, gameConfigService, pveService, asteroidBeltService, pirateService, reportService);
```

Note : `createFleetService` perd un parametre (2 queues -> 1 queue), donc sa signature a deja ete mise a jour a la Task 6.

- [ ] **Step 2: Reecrire worker.ts**

```typescript
import Redis from 'ioredis';
import { createDb } from '@exilium/db';
import { env } from '../config/env.js';
import { createResourceService } from '../modules/resource/resource.service.js';
import { createBuildingService } from '../modules/building/building.service.js';
import { createResearchService } from '../modules/research/research.service.js';
import { createShipyardService } from '../modules/shipyard/shipyard.service.js';
import { createFleetService } from '../modules/fleet/fleet.service.js';
import { createGameConfigService } from '../modules/admin/game-config.service.js';
import { createTutorialService } from '../modules/tutorial/tutorial.service.js';
import { createMessageService } from '../modules/message/message.service.js';
import { createAsteroidBeltService } from '../modules/pve/asteroid-belt.service.js';
import { createPirateService } from '../modules/pve/pirate.service.js';
import { createPveService } from '../modules/pve/pve.service.js';
import { createReportService } from '../modules/report/report.service.js';
import { buildCompletionQueue, fleetQueue } from '../queues/queues.js';
import { UNIVERSE_CONFIG } from '../modules/universe/universe.config.js';
import { startBuildCompletionWorker } from './build-completion.worker.js';
import { startFleetWorker } from './fleet.worker.js';
import { eventCatchup } from '../cron/event-catchup.js';
import { resourceTick } from '../cron/resource-tick.js';
import { rankingUpdate } from '../cron/ranking-update.js';
import { eventCleanup } from '../cron/event-cleanup.js';
import { sql } from 'drizzle-orm';

// Shared instances
const db = createDb(env.DATABASE_URL);
const redis = new Redis(env.REDIS_URL);
const gameConfigService = createGameConfigService(db);
const resourceService = createResourceService(db);
const messageService = createMessageService(db, redis);
const asteroidBeltService = createAsteroidBeltService(db);
const pirateService = createPirateService(db, gameConfigService);
const pveService = createPveService(db, asteroidBeltService, pirateService);
const reportService = createReportService(db);
const tutorialService = createTutorialService(db, pveService);

// Build services (receive the unified build queue)
const buildingService = createBuildingService(db, resourceService, buildCompletionQueue, gameConfigService);
const researchService = createResearchService(db, resourceService, buildCompletionQueue, gameConfigService);
const shipyardService = createShipyardService(db, resourceService, buildCompletionQueue, gameConfigService);

// Fleet service (receives the unified fleet queue)
const fleetService = createFleetService(db, resourceService, fleetQueue, UNIVERSE_CONFIG.speed, messageService, gameConfigService, pveService, asteroidBeltService, pirateService, reportService);

console.log('[worker] Starting workers...');

startBuildCompletionWorker(db, redis, { buildingService, researchService, shipyardService, tutorialService });
console.log('[worker] Build completion worker started');

startFleetWorker(db, redis, { fleetService, tutorialService });
console.log('[worker] Fleet worker started');

// Crons (inchanges)
setInterval(async () => {
  try { await eventCatchup(db); } catch (err) { console.error('[event-catchup] Error:', err); }
}, 30_000);
console.log('[worker] Event catchup cron started (30s)');

setInterval(async () => {
  try { await resourceTick(db); } catch (err) { console.error('[resource-tick] Error:', err); }
}, 15 * 60_000);
console.log('[worker] Resource tick cron started (15min)');

setInterval(async () => {
  try { await rankingUpdate(db); } catch (err) { console.error('[ranking-update] Error:', err); }
}, 30 * 60_000);
console.log('[worker] Ranking update cron started (30min)');

setInterval(async () => {
  try { await eventCleanup(db); } catch (err) { console.error('[event-cleanup] Error:', err); }
}, 24 * 60 * 60_000);
console.log('[worker] Event cleanup cron started (24h)');

setInterval(async () => {
  try {
    const usersWithCenter = await db.execute(sql`
      SELECT DISTINCT p.user_id
      FROM planet_buildings pb
      JOIN planets p ON p.id = pb.planet_id
      WHERE pb.building_id = 'missionCenter' AND pb.level >= 1
      LIMIT 100
    `);
    for (const row of usersWithCenter) {
      await pveService.refreshPool(row.user_id as string);
    }
    await asteroidBeltService.regenerateDepletedDeposits();
  } catch (err) { console.error('[mission-refresh] Error:', err); }
}, 30 * 60_000);
console.log('[worker] Mission refresh cron started (30min)');

process.on('SIGTERM', () => {
  console.log('[worker] Shutting down...');
  process.exit(0);
});
```

- [ ] **Step 3: Verifier que le build compile**

Run: `cd /Users/julienaubree/_projet/exilium && pnpm --filter api build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/workers/worker.ts apps/api/src/trpc/app-router.ts
git commit -m "refactor: wire unified queues into worker.ts and app-router.ts"
```

---

### Task 9: Mettre a jour le catchup cron

**Files:**
- Modify: `apps/api/src/cron/event-catchup.ts`

- [ ] **Step 1: Reecrire event-catchup.ts**

```typescript
import { lte, eq, and } from 'drizzle-orm';
import { buildQueue, fleetEvents } from '@exilium/db';
import type { Database } from '@exilium/db';
import { buildCompletionQueue, fleetQueue } from '../queues/queues.js';

const buildJobName: Record<string, string> = {
  building: 'building',
  research: 'research',
  ship: 'shipyard-unit',
  defense: 'shipyard-unit',
};

const fleetPhaseToJobName: Record<string, string> = {
  outbound: 'arrive',
  return: 'return',
  prospecting: 'prospect-done',
  mining: 'mine-done',
};

export async function eventCatchup(db: Database) {
  const now = new Date();

  // Build queue catchup
  const expiredEntries = await db
    .select()
    .from(buildQueue)
    .where(and(eq(buildQueue.status, 'active'), lte(buildQueue.endTime, now)));

  for (const entry of expiredEntries) {
    const jobName = buildJobName[entry.type] ?? 'shipyard-unit';
    const jobId = (entry.type === 'ship' || entry.type === 'defense')
      ? `shipyard-${entry.id}-${entry.completedCount + 1}`
      : `${entry.type}-${entry.id}`;

    const existingJob = await buildCompletionQueue.getJob(jobId);
    if (!existingJob) {
      console.log(`[event-catchup] Re-queuing expired ${entry.type} ${entry.id}`);
      await buildCompletionQueue.add(jobName, { buildQueueId: entry.id }, { jobId });
    }
  }

  // Fleet events catchup
  const expiredFleets = await db
    .select()
    .from(fleetEvents)
    .where(and(eq(fleetEvents.status, 'active'), lte(fleetEvents.arrivalTime, now)));

  for (const fleet of expiredFleets) {
    const jobName = fleetPhaseToJobName[fleet.phase] ?? 'arrive';
    const jobId = `fleet-${jobName}-${fleet.id}`;

    const existingJob = await fleetQueue.getJob(jobId);
    if (!existingJob) {
      console.log(`[event-catchup] Re-queuing expired fleet ${fleet.id} (${fleet.phase})`);
      await fleetQueue.add(jobName, { fleetEventId: fleet.id }, { jobId });
    }
  }

  const totalExpired = expiredEntries.length + expiredFleets.length;
  if (totalExpired > 0) {
    console.log(`[event-catchup] Found ${totalExpired} expired entries`);
  }
}
```

- [ ] **Step 2: Verifier que le build compile**

Run: `cd /Users/julienaubree/_projet/exilium && pnpm --filter api build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/cron/event-catchup.ts
git commit -m "refactor: event-catchup uses unified build-completion and fleet queues"
```

---

### Task 10: Supprimer les anciens fichiers et nettoyer

**Files:**
- Delete: `apps/api/src/queues/queue.ts`
- Delete: `apps/api/src/workers/building-completion.worker.ts`
- Delete: `apps/api/src/workers/research-completion.worker.ts`
- Delete: `apps/api/src/workers/shipyard-completion.worker.ts`
- Delete: `apps/api/src/workers/fleet-arrival.worker.ts`
- Delete: `apps/api/src/workers/fleet-return.worker.ts`

- [ ] **Step 1: Verifier qu'aucun fichier n'importe encore les anciens modules**

Run: `grep -r "from.*queues/queue" apps/api/src/ --include="*.ts" | grep -v node_modules`
Run: `grep -r "building-completion.worker\|research-completion.worker\|shipyard-completion.worker\|fleet-arrival.worker\|fleet-return.worker" apps/api/src/ --include="*.ts" | grep -v node_modules`

Expected: aucun resultat (tous les imports ont ete migres)

- [ ] **Step 2: Supprimer les anciens fichiers**

```bash
rm apps/api/src/queues/queue.ts
rm apps/api/src/workers/building-completion.worker.ts
rm apps/api/src/workers/research-completion.worker.ts
rm apps/api/src/workers/shipyard-completion.worker.ts
rm apps/api/src/workers/fleet-arrival.worker.ts
rm apps/api/src/workers/fleet-return.worker.ts
```

- [ ] **Step 3: Verifier que le build compile**

Run: `cd /Users/julienaubree/_projet/exilium && pnpm --filter api build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove old queue and worker files (replaced by unified versions)"
```

---

### Task 11: Test de bout en bout

**Files:** aucun (verification manuelle)

- [ ] **Step 1: Lancer l'API et le worker en local**

```bash
cd /Users/julienaubree/_projet/exilium
pnpm --filter api dev
```

Dans un autre terminal :
```bash
pnpm --filter api dev:worker
```

Verifier dans les logs :
- `[worker] Build completion worker started`
- `[worker] Fleet worker started`
- Pas d'erreurs de connexion Redis

- [ ] **Step 2: Tester un build de batiment**

Depuis le frontend, lancer une construction de batiment. Verifier dans les logs :
- `[build-completion] Processing building job ...`
- `[build-completion] building completed for ...`
- La notification arrive cote frontend
- L'event apparait dans l'historique

- [ ] **Step 3: Tester une recherche**

Lancer une recherche. Verifier :
- `[build-completion] Processing research job ...`
- Notification + event correctement generes

- [ ] **Step 4: Tester la construction de vaisseaux (batch)**

Lancer 3 vaisseaux. Verifier :
- Les 3 unites se construisent sequentiellement
- La notification + event n'arrivent qu'a la fin du batch
- Le compteur diminue dans le frontend

- [ ] **Step 5: Tester l'envoi de flotte**

Envoyer une flotte en transport. Verifier :
- `[fleet] Processing arrive job ...`
- `[fleet] Processing return job ...`
- Notifications d'arrivee et de retour

- [ ] **Step 6: Tester le catchup**

Redemarrer le worker. Le catchup doit re-scheduler les jobs en cours :
- `[event-catchup] Re-queuing expired ...`

- [ ] **Step 7: Commit final et push**

```bash
git push
```

---

### Task 12: Nettoyer les anciennes queues Redis en production

**Files:** aucun (operation Redis manuelle apres deploiement)

- [ ] **Step 1: Verifier que le deploiement fonctionne**

Attendre que le nouveau code tourne en production et que quelques jobs aient ete traites avec succes dans les nouvelles queues (`build-completion`, `fleet`).

- [ ] **Step 2: Supprimer les anciennes cles Redis**

Se connecter au Redis de production et supprimer les cles des anciennes queues :

```bash
redis-cli --scan --pattern "bull:building-completion:*" | xargs -r redis-cli del
redis-cli --scan --pattern "bull:research-completion:*" | xargs -r redis-cli del
redis-cli --scan --pattern "bull:shipyard-completion:*" | xargs -r redis-cli del
redis-cli --scan --pattern "bull:fleet-arrival:*" | xargs -r redis-cli del
redis-cli --scan --pattern "bull:fleet-return:*" | xargs -r redis-cli del
```

Attention : ne faire cela qu'apres avoir confirme que tout fonctionne avec les nouvelles queues.
