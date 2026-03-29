# Conversion Messages Système → Rapports + Combat Espionnage

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supprimer tous les `createSystemMessage` des handlers de flotte et les remplacer par des rapports structurés (`mission_reports`). Ajouter un combat sondes vs défenses lors de la détection d'espionnage.

**Architecture:** Les handlers qui créent déjà un rapport + message perdent le message. Les handlers qui n'ont qu'un message gagnent un rapport. Le spy handler gagne une simulation de combat complète quand les sondes sont détectées et que des défenses existent.

**Tech Stack:** TypeScript, Drizzle ORM, game-engine (`simulateCombat`), BullMQ workers

---

## File Map

| Action | File | Responsabilité |
|--------|------|----------------|
| Modify | `apps/api/src/modules/fleet/handlers/spy.handler.ts` | Ajouter combat détection, supprimer messages, créer rapports |
| Modify | `apps/api/src/modules/fleet/handlers/attack.handler.ts` | Supprimer message "no planet", créer rapport à la place |
| Modify | `apps/api/src/modules/fleet/handlers/colonize.handler.ts` | Supprimer 4 messages, créer 4 rapports |
| Modify | `apps/api/src/modules/fleet/handlers/transport.handler.ts` | Supprimer 2 messages, créer 2 rapports |
| Modify | `apps/api/src/modules/fleet/handlers/station.handler.ts` | Supprimer 2 messages, créer 2 rapports |
| Modify | `apps/api/src/modules/fleet/handlers/mine.handler.ts` | Supprimer message, garder rapport (retirer messageId) |
| Modify | `apps/api/src/modules/fleet/handlers/pirate.handler.ts` | Supprimer message, garder rapport (retirer messageId) |
| Modify | `apps/api/src/modules/fleet/handlers/recycle.handler.ts` | Supprimer message, garder rapport (retirer messageId) |

---

### Task 1: Groupe A — mine.handler.ts (supprimer message, garder rapport)

**Files:**
- Modify: `apps/api/src/modules/fleet/handlers/mine.handler.ts:232-291`

- [ ] **Step 1: Supprimer le bloc createSystemMessage et la variable messageId**

Remplacer les lignes 232-252 et retirer `messageId` du `reportService.create` :

```typescript
// Dans processMineDone(), supprimer ce bloc entier :
// let messageId: string | undefined;
// if (ctx.messageService) {
//   const parts = [...];
//   const msg = await ctx.messageService.createSystemMessage(...);
//   messageId = msg.id;
// }

// Dans reportService.create(), retirer la ligne :
//   messageId,
```

Le rapport reste identique, on ne fait que couper le lien avec le message.

- [ ] **Step 2: Vérifier que le build compile**

Run: `cd /Users/julienaubree/_projet/exilium-game/exilium && npx tsc --noEmit -p apps/api/tsconfig.json 2>&1 | head -20`
Expected: Pas d'erreur liée à mine.handler.ts

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/fleet/handlers/mine.handler.ts
git commit -m "refactor: remove system message from mine handler, keep report only"
```

---

### Task 2: Groupe A — pirate.handler.ts (supprimer message, garder rapport)

**Files:**
- Modify: `apps/api/src/modules/fleet/handlers/pirate.handler.ts:125-151`

- [ ] **Step 1: Supprimer le bloc createSystemMessage et la variable messageId**

Supprimer le bloc `if (ctx.messageService) { ... }` (lignes ~125-151 : construction du body et appel createSystemMessage).
Retirer `messageId` de `reportService.create()` (ligne ~233).

- [ ] **Step 2: Vérifier que le build compile**

Run: `cd /Users/julienaubree/_projet/exilium-game/exilium && npx tsc --noEmit -p apps/api/tsconfig.json 2>&1 | head -20`
Expected: Pas d'erreur

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/fleet/handlers/pirate.handler.ts
git commit -m "refactor: remove system message from pirate handler, keep report only"
```

---

### Task 3: Groupe A — recycle.handler.ts (supprimer message, garder rapport)

**Files:**
- Modify: `apps/api/src/modules/fleet/handlers/recycle.handler.ts:125-142`

- [ ] **Step 1: Supprimer le bloc createSystemMessage et la variable messageId**

Supprimer le bloc `if (ctx.messageService) { ... }` (lignes 125-142) et retirer `messageId` de `reportService.create()` (ligne ~151).

- [ ] **Step 2: Vérifier que le build compile**

Run: `cd /Users/julienaubree/_projet/exilium-game/exilium && npx tsc --noEmit -p apps/api/tsconfig.json 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/fleet/handlers/recycle.handler.ts
git commit -m "refactor: remove system message from recycle handler, keep report only"
```

---

### Task 4: Groupe A — spy.handler.ts (supprimer message attaquant, garder rapport)

**Files:**
- Modify: `apps/api/src/modules/fleet/handlers/spy.handler.ts:154-164`

- [ ] **Step 1: Supprimer le message système de l'attaquant (rapport d'espionnage réussi)**

Supprimer les lignes 154-164 (le bloc `if (ctx.messageService)` qui crée le message d'espionnage pour l'attaquant). Retirer `messageId` du `reportService.create()` (ligne ~182). Supprimer la variable `body` et toute sa construction (lignes 65, 86, 93-103, 110-120, 127-135, 143-151) — ces données sont déjà dans `reportResult`.

- [ ] **Step 2: Vérifier que le build compile**

Run: `cd /Users/julienaubree/_projet/exilium-game/exilium && npx tsc --noEmit -p apps/api/tsconfig.json 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/fleet/handlers/spy.handler.ts
git commit -m "refactor: remove system message from spy handler attacker report"
```

---

### Task 5: Groupe B — attack.handler.ts (rapport "no planet")

**Files:**
- Modify: `apps/api/src/modules/fleet/handlers/attack.handler.ts:104-117`

- [ ] **Step 1: Remplacer le message par un rapport**

Remplacer le bloc lignes 104-117 :

```typescript
    if (!targetPlanet) {
      let reportId: string | undefined;
      if (ctx.reportService) {
        const [originPlanet] = await ctx.db.select({
          galaxy: planets.galaxy, system: planets.system, position: planets.position, name: planets.name,
        }).from(planets).where(eq(planets.id, fleetEvent.originPlanetId)).limit(1);
        const report = await ctx.reportService.create({
          userId: fleetEvent.userId,
          fleetEventId: fleetEvent.id,
          missionType: 'attack',
          title: `Attaque ${coords} — Avortée`,
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
          fleet: { ships, totalCargo: totalCargoCapacity(ships, shipStatsMap) },
          departureTime: fleetEvent.departureTime,
          completionTime: fleetEvent.arrivalTime,
          result: { aborted: true, reason: 'no_planet' },
        });
        reportId = report.id;
      }
      return {
        scheduleReturn: true,
        cargo: { minerai: mineraiCargo, silicium: siliciumCargo, hydrogene: hydrogeneCargo },
        reportId,
      };
    }
```

Note : `shipStatsMap` est déjà construit ligne 43. `totalCargoCapacity` est déjà importé.

- [ ] **Step 2: Vérifier que le build compile**

Run: `cd /Users/julienaubree/_projet/exilium-game/exilium && npx tsc --noEmit -p apps/api/tsconfig.json 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/fleet/handlers/attack.handler.ts
git commit -m "refactor: replace system message with report in attack handler (no planet)"
```

---

### Task 6: Groupe B — colonize.handler.ts (4 rapports)

**Files:**
- Modify: `apps/api/src/modules/fleet/handlers/colonize.handler.ts`

- [ ] **Step 1: Ajouter les imports nécessaires**

Ajouter en haut du fichier :

```typescript
import { totalCargoCapacity } from '@exilium/game-engine';
import { buildShipStatsMap } from '../fleet.types.js';
```

- [ ] **Step 2: Ajouter un helper local pour créer les rapports de colonisation**

Ajouter juste après la classe `ColonizeHandler` opening ou comme méthode privée. Puisqu'il faut le même pattern 4 fois, créer un helper dans `processArrival` :

```typescript
  async processArrival(fleetEvent: FleetEvent, ctx: MissionHandlerContext): Promise<ArrivalResult> {
    const ships = fleetEvent.ships;
    // ... (existant)

    const config = await ctx.gameConfigService.getFullConfig();
    const shipStatsMap = buildShipStatsMap(config);
    // ... (existant, bouger config au début si nécessaire)

    const createColonizeReport = async (title: string, result: Record<string, unknown>) => {
      if (!ctx.reportService) return undefined;
      const [originPlanet] = await ctx.db.select({
        galaxy: planets.galaxy, system: planets.system, position: planets.position, name: planets.name,
      }).from(planets).where(eq(planets.id, fleetEvent.originPlanetId)).limit(1);
      const report = await ctx.reportService.create({
        userId: fleetEvent.userId,
        fleetEventId: fleetEvent.id,
        missionType: 'colonize',
        title,
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
        fleet: { ships, totalCargo: totalCargoCapacity(ships, shipStatsMap) },
        departureTime: fleetEvent.departureTime,
        completionTime: fleetEvent.arrivalTime,
        result,
      });
      return report.id;
    };
```

- [ ] **Step 3: Remplacer les 3 messages d'échec par des rapports**

Remplacer chaque bloc `if (ctx.messageService) { await ctx.messageService.createSystemMessage(...) }` :

**Échec asteroid belt (ligne 37-44) :**
```typescript
    if (beltPositions.includes(fleetEvent.targetPosition)) {
      const reportId = await createColonizeReport(
        `Colonisation échouée ${coords}`,
        { success: false, reason: 'asteroid_belt' },
      );
      return {
        scheduleReturn: true,
        cargo: { minerai: mineraiCargo, silicium: siliciumCargo, hydrogene: hydrogeneCargo },
        reportId,
      };
    }
```

**Échec position occupée (ligne 64-72) :**
```typescript
    if (existing) {
      const reportId = await createColonizeReport(
        `Colonisation échouée ${coords}`,
        { success: false, reason: 'occupied' },
      );
      return {
        scheduleReturn: true,
        cargo: { minerai: mineraiCargo, silicium: siliciumCargo, hydrogene: hydrogeneCargo },
        reportId,
      };
    }
```

**Échec max planets (ligne 85-93) :**
```typescript
    if (userPlanets.length >= maxPlanetsPerPlayer) {
      const reportId = await createColonizeReport(
        `Colonisation échouée ${coords}`,
        { success: false, reason: 'max_planets', maxPlanets: maxPlanetsPerPlayer },
      );
      return {
        scheduleReturn: true,
        cargo: { minerai: mineraiCargo, silicium: siliciumCargo, hydrogene: hydrogeneCargo },
        reportId,
      };
    }
```

- [ ] **Step 4: Remplacer le message de succès par un rapport**

Remplacer le bloc `if (ctx.messageService)` lignes 166-173 :

```typescript
    const reportId = await createColonizeReport(
      `Colonisation réussie ${coords}`,
      { success: true, diameter, maxFields, planetId: newPlanet.id },
    );
```

Ajouter `reportId` dans les return values si `hasRemainingShips` :
```typescript
    if (hasRemainingShips) {
      return {
        scheduleReturn: false,
        cargo: { minerai: 0, silicium: 0, hydrogene: 0 },
        reportId,
        createReturnEvent: { ... }, // inchangé
      };
    }
    return { scheduleReturn: false, reportId };
```

- [ ] **Step 5: Vérifier que le build compile**

Run: `cd /Users/julienaubree/_projet/exilium-game/exilium && npx tsc --noEmit -p apps/api/tsconfig.json 2>&1 | head -20`

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/fleet/handlers/colonize.handler.ts
git commit -m "refactor: replace 4 system messages with reports in colonize handler"
```

---

### Task 7: Groupe B — transport.handler.ts (2 rapports)

**Files:**
- Modify: `apps/api/src/modules/fleet/handlers/transport.handler.ts`

- [ ] **Step 1: Ajouter imports et remplacer les 2 messages par des rapports**

Ajouter les imports :
```typescript
import { totalCargoCapacity } from '@exilium/game-engine';
import { buildShipStatsMap } from '../fleet.types.js';
```

Remplacer le handler complet :

```typescript
  async processArrival(fleetEvent: FleetEvent, ctx: MissionHandlerContext): Promise<ArrivalResult> {
    const mineraiCargo = Number(fleetEvent.mineraiCargo);
    const siliciumCargo = Number(fleetEvent.siliciumCargo);
    const hydrogeneCargo = Number(fleetEvent.hydrogeneCargo);
    const coords = `[${fleetEvent.targetGalaxy}:${fleetEvent.targetSystem}:${fleetEvent.targetPosition}]`;
    const ships = fleetEvent.ships;
    const config = await ctx.gameConfigService.getFullConfig();
    const shipStatsMap = buildShipStatsMap(config);

    const createTransportReport = async (title: string, result: Record<string, unknown>) => {
      if (!ctx.reportService) return undefined;
      const [originPlanet] = await ctx.db.select({
        galaxy: planets.galaxy, system: planets.system, position: planets.position, name: planets.name,
      }).from(planets).where(eq(planets.id, fleetEvent.originPlanetId)).limit(1);
      const report = await ctx.reportService.create({
        userId: fleetEvent.userId,
        fleetEventId: fleetEvent.id,
        missionType: 'transport',
        title,
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
        fleet: { ships, totalCargo: totalCargoCapacity(ships, shipStatsMap) },
        departureTime: fleetEvent.departureTime,
        completionTime: fleetEvent.arrivalTime,
        result,
      });
      return report.id;
    };

    // Check target planet exists
    const [targetPlanet] = fleetEvent.targetPlanetId
      ? await ctx.db.select().from(planets).where(eq(planets.id, fleetEvent.targetPlanetId)).limit(1)
      : [];

    if (!targetPlanet) {
      const reportId = await createTransportReport(
        `Transport échoué ${coords}`,
        { aborted: true, reason: 'no_planet' },
      );
      return {
        scheduleReturn: true,
        cargo: { minerai: mineraiCargo, silicium: siliciumCargo, hydrogene: hydrogeneCargo },
        reportId,
      };
    }

    await ctx.db
      .update(planets)
      .set({
        minerai: String(Number(targetPlanet.minerai) + mineraiCargo),
        silicium: String(Number(targetPlanet.silicium) + siliciumCargo),
        hydrogene: String(Number(targetPlanet.hydrogene) + hydrogeneCargo),
      })
      .where(eq(planets.id, targetPlanet.id));

    const reportId = await createTransportReport(
      `Transport effectué ${coords}`,
      { delivered: { minerai: mineraiCargo, silicium: siliciumCargo, hydrogene: hydrogeneCargo } },
    );

    return {
      scheduleReturn: true,
      cargo: { minerai: 0, silicium: 0, hydrogene: 0 },
      reportId,
    };
  }
```

- [ ] **Step 2: Vérifier que le build compile**

Run: `cd /Users/julienaubree/_projet/exilium-game/exilium && npx tsc --noEmit -p apps/api/tsconfig.json 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/fleet/handlers/transport.handler.ts
git commit -m "refactor: replace 2 system messages with reports in transport handler"
```

---

### Task 8: Groupe B — station.handler.ts (2 rapports)

**Files:**
- Modify: `apps/api/src/modules/fleet/handlers/station.handler.ts`

- [ ] **Step 1: Ajouter imports et remplacer les 2 messages par des rapports**

Ajouter les imports :
```typescript
import { totalCargoCapacity } from '@exilium/game-engine';
import { buildShipStatsMap } from '../fleet.types.js';
```

Remplacer le handler complet :

```typescript
  async processArrival(fleetEvent: FleetEvent, ctx: MissionHandlerContext): Promise<ArrivalResult> {
    const mineraiCargo = Number(fleetEvent.mineraiCargo);
    const siliciumCargo = Number(fleetEvent.siliciumCargo);
    const hydrogeneCargo = Number(fleetEvent.hydrogeneCargo);
    const coords = `[${fleetEvent.targetGalaxy}:${fleetEvent.targetSystem}:${fleetEvent.targetPosition}]`;
    const ships = fleetEvent.ships;
    const config = await ctx.gameConfigService.getFullConfig();
    const shipStatsMap = buildShipStatsMap(config);

    const createStationReport = async (title: string, result: Record<string, unknown>) => {
      if (!ctx.reportService) return undefined;
      const [originPlanet] = await ctx.db.select({
        galaxy: planets.galaxy, system: planets.system, position: planets.position, name: planets.name,
      }).from(planets).where(eq(planets.id, fleetEvent.originPlanetId)).limit(1);
      const report = await ctx.reportService.create({
        userId: fleetEvent.userId,
        fleetEventId: fleetEvent.id,
        missionType: 'station',
        title,
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
        fleet: { ships, totalCargo: totalCargoCapacity(ships, shipStatsMap) },
        departureTime: fleetEvent.departureTime,
        completionTime: fleetEvent.arrivalTime,
        result,
      });
      return report.id;
    };

    // Check target planet exists
    const [targetPlanet] = fleetEvent.targetPlanetId
      ? await ctx.db.select().from(planets).where(eq(planets.id, fleetEvent.targetPlanetId)).limit(1)
      : [];

    if (!targetPlanet) {
      const reportId = await createStationReport(
        `Stationnement échoué ${coords}`,
        { aborted: true, reason: 'no_planet' },
      );
      return {
        scheduleReturn: true,
        cargo: { minerai: mineraiCargo, silicium: siliciumCargo, hydrogene: hydrogeneCargo },
        reportId,
      };
    }

    // Deposit resources
    await ctx.db
      .update(planets)
      .set({
        minerai: String(Number(targetPlanet.minerai) + mineraiCargo),
        silicium: String(Number(targetPlanet.silicium) + siliciumCargo),
        hydrogene: String(Number(targetPlanet.hydrogene) + hydrogeneCargo),
      })
      .where(eq(planets.id, targetPlanet.id));

    // Transfer ships
    const [targetShips] = await ctx.db
      .select()
      .from(planetShips)
      .where(eq(planetShips.planetId, targetPlanet.id))
      .limit(1);

    if (targetShips) {
      const shipUpdates: Record<string, number> = {};
      for (const [shipId, count] of Object.entries(fleetEvent.ships)) {
        if (count > 0 && shipId !== 'flagship') {
          const current = (targetShips[shipId as keyof typeof targetShips] ?? 0) as number;
          shipUpdates[shipId] = current + count;
        }
      }
      if (Object.keys(shipUpdates).length > 0) {
        await ctx.db
          .update(planetShips)
          .set(shipUpdates)
          .where(eq(planetShips.planetId, targetPlanet.id));
      }
    }

    const reportId = await createStationReport(
      `Flotte stationnée ${coords}`,
      {
        stationed: Object.fromEntries(
          Object.entries(fleetEvent.ships).filter(([, count]) => count > 0),
        ),
        deposited: { minerai: mineraiCargo, silicium: siliciumCargo, hydrogene: hydrogeneCargo },
      },
    );

    // Station: no return trip
    return { scheduleReturn: false, reportId };
  }
```

- [ ] **Step 2: Vérifier que le build compile**

Run: `cd /Users/julienaubree/_projet/exilium-game/exilium && npx tsc --noEmit -p apps/api/tsconfig.json 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/fleet/handlers/station.handler.ts
git commit -m "refactor: replace 2 system messages with reports in station handler"
```

---

### Task 9: Groupe B — spy.handler.ts (rapport "no planet")

**Files:**
- Modify: `apps/api/src/modules/fleet/handlers/spy.handler.ts:42-51`

- [ ] **Step 1: Remplacer le message "no planet" par un rapport**

Remplacer le bloc lignes 42-51 :

```typescript
    if (!targetPlanet) {
      let reportId: string | undefined;
      if (ctx.reportService) {
        const config2 = await ctx.gameConfigService.getFullConfig();
        const shipStatsMap = buildShipStatsMap(config2);
        const [originPlanet] = await ctx.db.select({
          galaxy: planets.galaxy, system: planets.system, position: planets.position, name: planets.name,
        }).from(planets).where(eq(planets.id, fleetEvent.originPlanetId)).limit(1);
        const report = await ctx.reportService.create({
          userId: fleetEvent.userId,
          fleetEventId: fleetEvent.id,
          missionType: 'spy',
          title: `Espionnage ${coords} — Avortée`,
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
          fleet: { ships, totalCargo: totalCargoCapacity(ships, shipStatsMap) },
          departureTime: fleetEvent.departureTime,
          completionTime: fleetEvent.arrivalTime,
          result: { aborted: true, reason: 'no_planet' },
        });
        reportId = report.id;
      }
      return { scheduleReturn: true, cargo: { minerai: 0, silicium: 0, hydrogene: 0 }, reportId };
    }
```

Ajouter les imports nécessaires en haut du fichier :
```typescript
import { simulateCombat, totalCargoCapacity, computeFleetFP } from '@exilium/game-engine';
import type { CombatConfig, ShipCategory, CombatInput, UnitCombatStats, FPConfig } from '@exilium/game-engine';
import { buildShipStatsMap, buildShipCombatConfigs, buildShipCosts, getCombatMultipliers } from '../fleet.types.js';
import { debrisFields } from '@exilium/db';
import { publishNotification } from '../../notification/notification.publisher.js';
```

- [ ] **Step 2: Vérifier que le build compile**

Run: `cd /Users/julienaubree/_projet/exilium-game/exilium && npx tsc --noEmit -p apps/api/tsconfig.json 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/fleet/handlers/spy.handler.ts
git commit -m "refactor: replace system message with report in spy handler (no planet)"
```

---

### Task 10: Combat espionnage — refonte de la détection dans spy.handler.ts

C'est la tâche la plus complexe. La détection d'espionnage déclenche maintenant un combat si des défenses existent.

**Files:**
- Modify: `apps/api/src/modules/fleet/handlers/spy.handler.ts`

**Nouvelle logique de détection (remplace lignes 207-218) :**

1. Si `detected` ET des défenses existent → combat via `simulateCombat`
2. Si `detected` ET aucune défense → sondes passent, rapport d'espionnage normal
3. Si pas `detected` → rapport d'espionnage normal (inchangé)

- [ ] **Step 1: Remplacer le bloc de détection par le combat**

Après la création du rapport d'espionnage (existant), remplacer le bloc `if (detected)` (ancien lignes 207-218) par :

```typescript
    if (detected) {
      // Fetch defender defenses and ships
      const [defDefs] = await ctx.db.select().from(planetDefenses)
        .where(eq(planetDefenses.planetId, targetPlanet.id)).limit(1);
      const [defShips] = await ctx.db.select().from(planetShips)
        .where(eq(planetShips.planetId, targetPlanet.id)).limit(1);

      const defenderDefensesMap: Record<string, number> = {};
      const defenderFleetMap: Record<string, number> = {};
      if (defDefs) {
        for (const [key, val] of Object.entries(defDefs)) {
          if (key === 'planetId') continue;
          if (typeof val === 'number' && val > 0) defenderDefensesMap[key] = val;
        }
      }
      if (defShips) {
        for (const [key, val] of Object.entries(defShips)) {
          if (key === 'planetId') continue;
          if (typeof val === 'number' && val > 0) defenderFleetMap[key] = val;
        }
      }

      const hasDefenders = Object.values(defenderDefensesMap).some(v => v > 0) ||
                           Object.values(defenderFleetMap).some(v => v > 0);

      if (!hasDefenders) {
        // Detected but no defenses — probes pass, normal spy report
        return { scheduleReturn: true, cargo: { minerai: 0, silicium: 0, hydrogene: 0 }, reportId };
      }

      // === COMBAT: probes vs defenses ===
      const config2 = await ctx.gameConfigService.getFullConfig();
      const shipStatsMap = buildShipStatsMap(config2);
      const shipCombatConfigs = buildShipCombatConfigs(config2);
      const shipCostsMap = buildShipCosts(config2);
      const shipIdSet = new Set(Object.keys(config2.ships));
      const defenseIdSet = new Set(Object.keys(config2.defenses));

      const categories: ShipCategory[] = [
        { id: 'light', name: 'Léger', targetable: true, targetOrder: 1 },
        { id: 'medium', name: 'Moyen', targetable: true, targetOrder: 2 },
        { id: 'heavy', name: 'Lourd', targetable: true, targetOrder: 3 },
        { id: 'support', name: 'Support', targetable: false, targetOrder: 4 },
      ];

      const combatConfig: CombatConfig = {
        maxRounds: Number(config2.universe['combat_max_rounds']) || 4,
        debrisRatio: Number(config2.universe['combat_debris_ratio']) || 0.3,
        defenseRepairRate: Number(config2.universe['combat_defense_repair_rate']) || 0.7,
        pillageRatio: 0, // No pillage for spy combat
        minDamagePerHit: Number(config2.universe['combat_min_damage_per_hit']) || 1,
        researchBonusPerLevel: Number(config2.universe['combat_research_bonus_per_level']) || 0.1,
        categories,
      };

      const attackerTalentCtx = ctx.talentService
        ? await ctx.talentService.computeTalentContext(fleetEvent.userId)
        : {};
      const defenderTalentCtx = ctx.talentService
        ? await ctx.talentService.computeTalentContext(targetPlanet.userId, targetPlanet.id)
        : {};

      const attackerMultipliers = await getCombatMultipliers(ctx.db, fleetEvent.userId, config2.bonuses, attackerTalentCtx);
      const defenderMultipliers = await getCombatMultipliers(ctx.db, targetPlanet.userId, config2.bonuses, defenderTalentCtx);

      const defenseBonus = 1 + (defenderTalentCtx['defense_strength'] ?? 0);
      defenderMultipliers.weapons *= defenseBonus;
      defenderMultipliers.shielding *= defenseBonus;
      defenderMultipliers.armor *= defenseBonus;

      const combatInput: CombatInput = {
        attackerFleet: ships,
        defenderFleet: defenderFleetMap,
        defenderDefenses: defenderDefensesMap,
        attackerMultipliers,
        defenderMultipliers,
        attackerTargetPriority: 'light',
        defenderTargetPriority: 'light',
        combatConfig,
        shipConfigs: shipCombatConfigs,
        shipCosts: shipCostsMap,
        shipIds: shipIdSet,
        defenseIds: defenseIdSet,
      };

      const combatResult = simulateCombat(combatInput);
      const combatOutcome = combatResult.outcome;

      // Apply defender losses (ships)
      if (defShips) {
        const shipUpdates: Record<string, number> = {};
        for (const [key, val] of Object.entries(defShips)) {
          if (key === 'planetId') continue;
          const lost = combatResult.defenderLosses[key] ?? 0;
          if (lost > 0) shipUpdates[key] = (val as number) - lost;
        }
        if (Object.keys(shipUpdates).length > 0) {
          await ctx.db.update(planetShips).set(shipUpdates).where(eq(planetShips.planetId, targetPlanet.id));
        }
      }

      // Apply defender defense losses (minus repairs)
      if (defDefs) {
        const defUpdates: Record<string, number> = {};
        for (const [key, val] of Object.entries(defDefs)) {
          if (key === 'planetId') continue;
          const lost = combatResult.defenderLosses[key] ?? 0;
          const repaired = combatResult.repairedDefenses[key] ?? 0;
          const netLoss = lost - repaired;
          if (netLoss > 0) defUpdates[key] = (val as number) - netLoss;
        }
        if (Object.keys(defUpdates).length > 0) {
          await ctx.db.update(planetDefenses).set(defUpdates).where(eq(planetDefenses.planetId, targetPlanet.id));
        }
      }

      // Create/accumulate debris field
      const debris = combatResult.debris;
      if (debris.minerai > 0 || debris.silicium > 0) {
        const [existingDebris] = await ctx.db
          .select().from(debrisFields)
          .where(and(
            eq(debrisFields.galaxy, fleetEvent.targetGalaxy),
            eq(debrisFields.system, fleetEvent.targetSystem),
            eq(debrisFields.position, fleetEvent.targetPosition),
          )).limit(1);

        if (existingDebris) {
          await ctx.db.update(debrisFields).set({
            minerai: String(Number(existingDebris.minerai) + debris.minerai),
            silicium: String(Number(existingDebris.silicium) + debris.silicium),
            updatedAt: new Date(),
          }).where(eq(debrisFields.id, existingDebris.id));
        } else {
          await ctx.db.insert(debrisFields).values({
            galaxy: fleetEvent.targetGalaxy,
            system: fleetEvent.targetSystem,
            position: fleetEvent.targetPosition,
            minerai: String(debris.minerai),
            silicium: String(debris.silicium),
          });
        }
      }

      // Compute FP and shots per round for combat reports
      const unitCombatStats: Record<string, UnitCombatStats> = {};
      for (const [id, ship] of Object.entries(config2.ships)) {
        unitCombatStats[id] = { weapons: ship.weapons, shotCount: ship.shotCount ?? 1, shield: ship.shield, hull: ship.hull };
      }
      for (const [id, def] of Object.entries(config2.defenses)) {
        unitCombatStats[id] = { weapons: def.weapons, shotCount: def.shotCount ?? 1, shield: def.shield, hull: def.hull };
      }
      const fpConfig: FPConfig = {
        shotcountExponent: Number(config2.universe.fp_shotcount_exponent) || 1.5,
        divisor: Number(config2.universe.fp_divisor) || 100,
      };
      const attackerFP = computeFleetFP(ships, unitCombatStats, fpConfig);
      const defenderCombinedForFP: Record<string, number> = { ...defenderFleetMap, ...defenderDefensesMap };
      const defenderFP = computeFleetFP(defenderCombinedForFP, unitCombatStats, fpConfig);

      const rounds = combatResult.rounds;
      const shotsPerRound = rounds.map((round, i) => {
        const attFleet = i === 0 ? ships : rounds[i - 1].attackerShips;
        const defFleetRound = i === 0 ? { ...defenderFleetMap, ...defenderDefensesMap } : rounds[i - 1].defenderShips;
        const attShots = Object.entries(attFleet).reduce((sum, [id, count]) => {
          const sc = config2.ships[id]?.shotCount ?? config2.defenses[id]?.shotCount ?? 1;
          return sum + count * sc;
        }, 0);
        const defShots = Object.entries(defFleetRound).reduce((sum, [id, count]) => {
          const sc = config2.ships[id]?.shotCount ?? config2.defenses[id]?.shotCount ?? 1;
          return sum + count * sc;
        }, 0);
        return { attacker: attShots, defender: defShots };
      });

      // Fetch usernames
      const [attackerUser] = await ctx.db.select({ username: users.username })
        .from(users).where(eq(users.id, fleetEvent.userId)).limit(1);
      const [defenderUser] = await ctx.db.select({ username: users.username })
        .from(users).where(eq(users.id, targetPlanet.userId)).limit(1);
      const attackerUsername = attackerUser?.username ?? 'Inconnu';
      const defenderUsername = defenderUser?.username ?? 'Inconnu';

      const combatOutcomeText = combatOutcome === 'attacker' ? 'Victoire' :
                                combatOutcome === 'defender' ? 'Défaite' : 'Match nul';
      const defenderOutcomeText = combatOutcome === 'attacker' ? 'Défaite' :
                                  combatOutcome === 'defender' ? 'Victoire' : 'Match nul';

      // Surviving probes
      const survivingShips: Record<string, number> = { ...ships };
      for (const [type, lost] of Object.entries(combatResult.attackerLosses)) {
        survivingShips[type] = (survivingShips[type] ?? 0) - lost;
        if (survivingShips[type] <= 0) delete survivingShips[type];
      }
      const probesSurvived = Object.values(survivingShips).some(v => v > 0);

      // Build combat report data (same structure as attack handler)
      const combatReportBase: Record<string, unknown> = {
        outcome: combatOutcome,
        attackerUsername,
        defenderUsername,
        targetPlanetName: targetPlanet.name,
        roundCount: rounds.length,
        attackerFleet: ships,
        attackerLosses: combatResult.attackerLosses,
        attackerSurvivors: survivingShips,
        defenderFleet: defenderFleetMap,
        defenderDefenses: defenderDefensesMap,
        defenderLosses: combatResult.defenderLosses,
        defenderSurvivors: (() => {
          const combined: Record<string, number> = { ...defenderFleetMap, ...defenderDefensesMap };
          const survivors: Record<string, number> = {};
          for (const [type, count] of Object.entries(combined)) {
            const remaining = count - (combatResult.defenderLosses[type] ?? 0) + (combatResult.repairedDefenses[type] ?? 0);
            if (remaining > 0) survivors[type] = remaining;
          }
          return survivors;
        })(),
        repairedDefenses: combatResult.repairedDefenses,
        debris,
        rounds,
        attackerStats: combatResult.attackerStats,
        defenderStats: combatResult.defenderStats,
        attackerFP,
        defenderFP,
        shotsPerRound,
        spyCombat: true, // Flag pour identifier un combat d'espionnage
      };

      // Fetch origin planet for report coordinates
      const [originPlanet] = await ctx.db.select({
        galaxy: planets.galaxy, system: planets.system, position: planets.position, name: planets.name,
      }).from(planets).where(eq(planets.id, fleetEvent.originPlanetId)).limit(1);

      // Create attacker combat report
      let combatReportId: string | undefined;
      let defenderCombatReportId: string | undefined;
      if (ctx.reportService) {
        const attackerReport = await ctx.reportService.create({
          userId: fleetEvent.userId,
          fleetEventId: fleetEvent.id,
          missionType: 'spy',
          title: `Espionnage ${coords} — Combat ${combatOutcomeText}`,
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
          fleet: { ships, totalCargo: totalCargoCapacity(ships, shipStatsMap) },
          departureTime: fleetEvent.departureTime,
          completionTime: fleetEvent.arrivalTime,
          result: { ...combatReportBase, perspective: 'attacker' },
        });
        combatReportId = attackerReport.id;

        // Create defender combat report
        const defenderReport = await ctx.reportService.create({
          userId: targetPlanet.userId,
          missionType: 'spy',
          title: `Espionnage détecté ${coords} — ${defenderOutcomeText}`,
          coordinates: {
            galaxy: fleetEvent.targetGalaxy,
            system: fleetEvent.targetSystem,
            position: fleetEvent.targetPosition,
          },
          fleet: { ships: {}, totalCargo: 0 },
          departureTime: fleetEvent.departureTime,
          completionTime: fleetEvent.arrivalTime,
          result: { ...combatReportBase, perspective: 'defender' },
        });
        defenderCombatReportId = defenderReport.id;
      }

      // Notify defender
      if (ctx.redis) {
        publishNotification(ctx.redis, targetPlanet.userId, {
          type: 'fleet-attack-landed',
          payload: {
            targetCoords: coords,
            reportId: defenderCombatReportId,
            attackerUsername,
            outcome: defenderOutcomeText,
          },
        });
      }

      if (probesSurvived) {
        // Probes survived: return with spy report + combat report
        // reportId already set from spy report above
        return {
          scheduleReturn: true,
          cargo: { minerai: 0, silicium: 0, hydrogene: 0 },
          shipsAfterArrival: survivingShips,
          reportId, // spy report
          defenderReportId: defenderCombatReportId,
          attackerUsername,
          defenderOutcomeText,
        };
      } else {
        // All probes destroyed: no return, no spy report
        // Delete spy report if it was created (probes were destroyed before transmitting)
        if (reportId && ctx.reportService) {
          await ctx.reportService.deleteReport(fleetEvent.userId, reportId);
        }
        return {
          scheduleReturn: false,
          shipsAfterArrival: {},
          reportId: combatReportId, // combat report for attacker
          defenderReportId: defenderCombatReportId,
          attackerUsername,
          defenderOutcomeText,
        };
      }
    }

    // Not detected — normal spy report
    return { scheduleReturn: true, cargo: { minerai: 0, silicium: 0, hydrogene: 0 }, reportId };
```

- [ ] **Step 2: Vérifier que le build compile**

Run: `cd /Users/julienaubree/_projet/exilium-game/exilium && npx tsc --noEmit -p apps/api/tsconfig.json 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/fleet/handlers/spy.handler.ts
git commit -m "feat: add combat simulation on spy detection, replace system messages with reports"
```

---

### Task 11: Vérification finale — plus aucun createSystemMessage dans les handlers de flotte

- [ ] **Step 1: Vérifier qu'il n'y a plus de createSystemMessage dans les handlers de flotte**

Run: `grep -r "createSystemMessage" apps/api/src/modules/fleet/`
Expected: Aucun résultat

- [ ] **Step 2: Vérifier que les seuls createSystemMessage restants sont dans alliance.service.ts**

Run: `grep -rn "createSystemMessage" apps/api/src/`
Expected: Seuls les fichiers `message.service.ts` (définition) et `alliance.service.ts` (3 appels)

- [ ] **Step 3: Build complet**

Run: `cd /Users/julienaubree/_projet/exilium-game/exilium && npx tsc --noEmit -p apps/api/tsconfig.json`
Expected: 0 erreur

- [ ] **Step 4: Push**

```bash
git push
```
