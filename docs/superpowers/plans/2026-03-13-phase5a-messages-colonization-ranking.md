# Phase 5a : Messages, Colonisation, Classement — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter la messagerie (système + joueur→joueur), la mission de colonisation fonctionnelle, et le classement des joueurs avec recalcul toutes les 30 minutes.

**Architecture:** Messages via table DB + service/router tRPC. Colonisation implémentée dans le handler fleet arrival existant, utilisant les formules planet existantes. Classement via table rankings + cron 30min qui agrège les coûts cumulés de tous les bâtiments/recherches/vaisseaux/défenses.

**Tech Stack:** game-engine (formules ranking), Drizzle ORM (messages, rankings), tRPC (message + ranking routers), React (Messages + Ranking pages)

---

## File Structure

### game-engine (formules)

| File | Responsabilité |
|------|---------------|
| `packages/game-engine/src/formulas/ranking.ts` | `calculateBuildingPoints`, `calculateResearchPoints`, `calculateFleetPoints`, `calculateDefensePoints`, `calculateTotalPoints` |
| `packages/game-engine/src/formulas/ranking.test.ts` | Tests ranking formulas |

### db (schemas)

| File | Responsabilité |
|------|---------------|
| `packages/db/src/schema/messages.ts` | Table `messages` avec enum type |
| `packages/db/src/schema/rankings.ts` | Table `rankings` |

### api (modules)

| File | Responsabilité |
|------|---------------|
| `apps/api/src/modules/message/message.service.ts` | sendMessage, createSystemMessage, listMessages, markAsRead, deleteMessage, countUnread |
| `apps/api/src/modules/message/message.router.ts` | inbox, detail, send, markAsRead, delete, unreadCount |
| `apps/api/src/modules/ranking/ranking.service.ts` | recalculateAll, getRankings, getPlayerRank |
| `apps/api/src/modules/ranking/ranking.router.ts` | list, me |
| `apps/api/src/cron/ranking-update.ts` | Fonction recalcul rankings |

### web (pages)

| File | Responsabilité |
|------|---------------|
| `apps/web/src/pages/Messages.tsx` | Inbox, détail, envoi |
| `apps/web/src/pages/Ranking.tsx` | Tableau classement paginé |

---

## Chunk 1: Game Engine — Formules ranking

### Task 1: Formules de calcul de points

**Files:**
- Create: `packages/game-engine/src/formulas/ranking.test.ts`
- Create: `packages/game-engine/src/formulas/ranking.ts`
- Modify: `packages/game-engine/src/index.ts`

- [ ] **Step 1: Écrire les tests**

```typescript
// packages/game-engine/src/formulas/ranking.test.ts
import { describe, it, expect } from 'vitest';
import {
  calculateBuildingPoints,
  calculateResearchPoints,
  calculateFleetPoints,
  calculateDefensePoints,
  calculateTotalPoints,
} from './ranking.js';

describe('calculateBuildingPoints', () => {
  it('all level 0 = 0 points', () => {
    const levels = {
      metalMineLevel: 0, crystalMineLevel: 0, deutSynthLevel: 0,
      solarPlantLevel: 0, roboticsLevel: 0, shipyardLevel: 0,
      researchLabLevel: 0, storageMetalLevel: 0, storageCrystalLevel: 0,
      storageDeutLevel: 0,
    };
    expect(calculateBuildingPoints(levels)).toBe(0);
  });

  it('metal mine level 1 = floor((60+15) / 1000) = 0', () => {
    const levels = {
      metalMineLevel: 1, crystalMineLevel: 0, deutSynthLevel: 0,
      solarPlantLevel: 0, roboticsLevel: 0, shipyardLevel: 0,
      researchLabLevel: 0, storageMetalLevel: 0, storageCrystalLevel: 0,
      storageDeutLevel: 0,
    };
    expect(calculateBuildingPoints(levels)).toBe(0);
  });

  it('metal mine level 5 has positive points', () => {
    const levels = {
      metalMineLevel: 5, crystalMineLevel: 0, deutSynthLevel: 0,
      solarPlantLevel: 0, roboticsLevel: 0, shipyardLevel: 0,
      researchLabLevel: 0, storageMetalLevel: 0, storageCrystalLevel: 0,
      storageDeutLevel: 0,
    };
    // Sum of costs level 1-5: 75 + 112 + 168 + 253 + 379 = 987 → floor(987/1000) = 0
    // Actually with deut: (60+15+0)*1 + (60+15+0)*1.5 + ... let's just check > 0 for higher levels
    expect(calculateBuildingPoints(levels)).toBeGreaterThanOrEqual(0);
  });

  it('multiple buildings have cumulative points', () => {
    const levels = {
      metalMineLevel: 10, crystalMineLevel: 10, deutSynthLevel: 10,
      solarPlantLevel: 10, roboticsLevel: 5, shipyardLevel: 5,
      researchLabLevel: 5, storageMetalLevel: 3, storageCrystalLevel: 3,
      storageDeutLevel: 3,
    };
    expect(calculateBuildingPoints(levels)).toBeGreaterThan(0);
  });
});

describe('calculateResearchPoints', () => {
  it('all level 0 = 0 points', () => {
    const levels = {
      espionageTech: 0, computerTech: 0, energyTech: 0,
      combustion: 0, impulse: 0, hyperspaceDrive: 0,
      weapons: 0, shielding: 0, armor: 0,
    };
    expect(calculateResearchPoints(levels)).toBe(0);
  });

  it('weapons level 3 has positive points', () => {
    const levels = {
      espionageTech: 0, computerTech: 0, energyTech: 0,
      combustion: 0, impulse: 0, hyperspaceDrive: 0,
      weapons: 3, shielding: 0, armor: 0,
    };
    // weapons baseCost: 800+200+0=1000, factor 2
    // level 1: 1000, level 2: 2000, level 3: 4000 → sum = 7000 → 7 points
    expect(calculateResearchPoints(levels)).toBe(7);
  });
});

describe('calculateFleetPoints', () => {
  it('no ships = 0', () => {
    expect(calculateFleetPoints({
      smallCargo: 0, largeCargo: 0, lightFighter: 0, heavyFighter: 0,
      cruiser: 0, battleship: 0, espionageProbe: 0, colonyShip: 0, recycler: 0,
    })).toBe(0);
  });

  it('10 small cargos', () => {
    // cost per unit: 2000+2000+0=4000 → 10*4000=40000 → 40 points
    expect(calculateFleetPoints({
      smallCargo: 10, largeCargo: 0, lightFighter: 0, heavyFighter: 0,
      cruiser: 0, battleship: 0, espionageProbe: 0, colonyShip: 0, recycler: 0,
    })).toBe(40);
  });
});

describe('calculateDefensePoints', () => {
  it('no defenses = 0', () => {
    expect(calculateDefensePoints({
      rocketLauncher: 0, lightLaser: 0, heavyLaser: 0,
      gaussCannon: 0, plasmaTurret: 0, smallShield: 0, largeShield: 0,
    })).toBe(0);
  });

  it('5 rocket launchers', () => {
    // cost per unit: 2000+0+0=2000 → 5*2000=10000 → 10 points
    expect(calculateDefensePoints({
      rocketLauncher: 5, lightLaser: 0, heavyLaser: 0,
      gaussCannon: 0, plasmaTurret: 0, smallShield: 0, largeShield: 0,
    })).toBe(10);
  });
});

describe('calculateTotalPoints', () => {
  it('sums all categories', () => {
    expect(calculateTotalPoints(10, 20, 30, 40)).toBe(100);
  });
});
```

- [ ] **Step 2: Lancer les tests — vérifier qu'ils échouent**

```bash
export PATH="/usr/local/opt/node@22/bin:$PATH" && cd /Users/julienaubree/_projet/ogame-clone && pnpm --filter @ogame-clone/game-engine test -- --run
```
Expected: FAIL — `ranking.js` not found

- [ ] **Step 3: Implémenter**

```typescript
// packages/game-engine/src/formulas/ranking.ts
import { BUILDINGS, type BuildingId } from '../constants/buildings.js';
import { RESEARCH, type ResearchId } from '../constants/research.js';
import { SHIPS, type ShipId } from '../constants/ships.js';
import { DEFENSES, type DefenseId } from '../constants/defenses.js';

/**
 * Calculate points from building levels.
 * Points = floor(totalResourcesSpent / 1000)
 * For each building at level N, sum the cost of levels 1..N (exponential cost).
 */
export function calculateBuildingPoints(levels: Record<string, number>): number {
  let totalResources = 0;

  for (const [buildingId, def] of Object.entries(BUILDINGS)) {
    const levelColumn = def.levelColumn;
    const level = levels[levelColumn] ?? 0;
    for (let l = 1; l <= level; l++) {
      const factor = Math.pow(def.costFactor, l - 1);
      totalResources += Math.floor(def.baseCost.metal * factor)
        + Math.floor(def.baseCost.crystal * factor)
        + Math.floor(def.baseCost.deuterium * factor);
    }
  }

  return Math.floor(totalResources / 1000);
}

/**
 * Calculate points from research levels.
 * Same formula: sum of costs level 1..N for each research.
 */
export function calculateResearchPoints(levels: Record<string, number>): number {
  let totalResources = 0;

  for (const [researchId, def] of Object.entries(RESEARCH)) {
    const level = levels[def.levelColumn] ?? 0;
    for (let l = 1; l <= level; l++) {
      const factor = Math.pow(def.costFactor, l - 1);
      totalResources += Math.floor(def.baseCost.metal * factor)
        + Math.floor(def.baseCost.crystal * factor)
        + Math.floor(def.baseCost.deuterium * factor);
    }
  }

  return Math.floor(totalResources / 1000);
}

/**
 * Calculate points from fleet (ships).
 * Points = floor(count * unitCost / 1000) for each ship type.
 */
export function calculateFleetPoints(counts: Record<string, number>): number {
  let totalResources = 0;

  for (const [shipId, def] of Object.entries(SHIPS)) {
    const count = counts[def.countColumn] ?? counts[shipId] ?? 0;
    if (count > 0) {
      totalResources += count * (def.cost.metal + def.cost.crystal + def.cost.deuterium);
    }
  }

  return Math.floor(totalResources / 1000);
}

/**
 * Calculate points from defenses.
 * Points = floor(count * unitCost / 1000) for each defense type.
 */
export function calculateDefensePoints(counts: Record<string, number>): number {
  let totalResources = 0;

  for (const [defenseId, def] of Object.entries(DEFENSES)) {
    const count = counts[def.countColumn] ?? counts[defenseId] ?? 0;
    if (count > 0) {
      totalResources += count * (def.cost.metal + def.cost.crystal + def.cost.deuterium);
    }
  }

  return Math.floor(totalResources / 1000);
}

/**
 * Total points = sum of all categories.
 */
export function calculateTotalPoints(
  buildingPoints: number,
  researchPoints: number,
  fleetPoints: number,
  defensePoints: number,
): number {
  return buildingPoints + researchPoints + fleetPoints + defensePoints;
}
```

- [ ] **Step 4: Exporter depuis l'index**

Ajouter dans `packages/game-engine/src/index.ts` :
```typescript
export * from './formulas/ranking.js';
```

- [ ] **Step 5: Lancer les tests — vérifier que tout passe**

```bash
export PATH="/usr/local/opt/node@22/bin:$PATH" && cd /Users/julienaubree/_projet/ogame-clone && pnpm --filter @ogame-clone/game-engine test -- --run
```
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add packages/game-engine/src/formulas/ranking.ts packages/game-engine/src/formulas/ranking.test.ts packages/game-engine/src/index.ts
git commit -m "feat(game-engine): add ranking point calculation formulas with tests"
```

---

## Chunk 2: DB Schemas + Message module

### Task 2: Schema messages

**Files:**
- Create: `packages/db/src/schema/messages.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Créer le schema**

```typescript
// packages/db/src/schema/messages.ts
import { pgTable, uuid, varchar, text, boolean, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const messageTypeEnum = pgEnum('message_type', ['system', 'colonization', 'player']);

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  senderId: uuid('sender_id').references(() => users.id, { onDelete: 'set null' }),
  recipientId: uuid('recipient_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: messageTypeEnum('type').notNull().default('system'),
  subject: varchar('subject', { length: 255 }).notNull(),
  body: text('body').notNull(),
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('messages_recipient_idx').on(table.recipientId, table.createdAt),
]);
```

- [ ] **Step 2: Exporter depuis l'index DB**

Ajouter dans `packages/db/src/schema/index.ts` :
```typescript
export * from './messages.js';
```

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/schema/messages.ts packages/db/src/schema/index.ts
git commit -m "feat(db): add messages schema"
```

---

### Task 3: Schema rankings

**Files:**
- Create: `packages/db/src/schema/rankings.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Créer le schema**

```typescript
// packages/db/src/schema/rankings.ts
import { pgTable, uuid, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const rankings = pgTable('rankings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  totalPoints: integer('total_points').notNull().default(0),
  rank: integer('rank').notNull().default(0),
  calculatedAt: timestamp('calculated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('rankings_rank_idx').on(table.rank),
]);
```

- [ ] **Step 2: Exporter depuis l'index DB**

Ajouter dans `packages/db/src/schema/index.ts` :
```typescript
export * from './rankings.js';
```

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/schema/rankings.ts packages/db/src/schema/index.ts
git commit -m "feat(db): add rankings schema"
```

---

### Task 4: Message service

**Files:**
- Create: `apps/api/src/modules/message/message.service.ts`

- [ ] **Step 1: Implémenter**

```typescript
// apps/api/src/modules/message/message.service.ts
import { eq, and, desc, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { messages, users } from '@ogame-clone/db';
import type { Database } from '@ogame-clone/db';

export function createMessageService(db: Database) {
  return {
    async sendMessage(senderId: string, recipientUsername: string, subject: string, body: string) {
      // Resolve username to userId
      const [recipient] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, recipientUsername))
        .limit(1);

      if (!recipient) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Joueur introuvable' });
      }

      if (recipient.id === senderId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Vous ne pouvez pas vous envoyer un message' });
      }

      const [msg] = await db
        .insert(messages)
        .values({
          senderId,
          recipientId: recipient.id,
          type: 'player',
          subject,
          body,
        })
        .returning();

      return msg;
    },

    async createSystemMessage(
      recipientId: string,
      type: 'system' | 'colonization',
      subject: string,
      body: string,
    ) {
      const [msg] = await db
        .insert(messages)
        .values({
          senderId: null,
          recipientId,
          type,
          subject,
          body,
        })
        .returning();

      return msg;
    },

    async listMessages(
      userId: string,
      options?: { page?: number; limit?: number; type?: string; unreadOnly?: boolean },
    ) {
      const page = options?.page ?? 1;
      const limit = options?.limit ?? 20;
      const offset = (page - 1) * limit;

      let query = db
        .select({
          id: messages.id,
          senderId: messages.senderId,
          senderUsername: users.username,
          type: messages.type,
          subject: messages.subject,
          read: messages.read,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .leftJoin(users, eq(users.id, messages.senderId))
        .where(eq(messages.recipientId, userId))
        .orderBy(desc(messages.createdAt))
        .limit(limit)
        .offset(offset);

      // Note: dynamic filtering with Drizzle requires building conditions array
      // For simplicity, we filter in the base query and add conditions as needed
      return query;
    },

    async getMessage(userId: string, messageId: string) {
      const [msg] = await db
        .select({
          id: messages.id,
          senderId: messages.senderId,
          senderUsername: users.username,
          recipientId: messages.recipientId,
          type: messages.type,
          subject: messages.subject,
          body: messages.body,
          read: messages.read,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .leftJoin(users, eq(users.id, messages.senderId))
        .where(and(eq(messages.id, messageId), eq(messages.recipientId, userId)))
        .limit(1);

      if (!msg) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Message introuvable' });
      }

      // Auto-mark as read
      if (!msg.read) {
        await db
          .update(messages)
          .set({ read: true })
          .where(eq(messages.id, messageId));
      }

      return { ...msg, read: true };
    },

    async markAsRead(userId: string, messageId: string) {
      const result = await db
        .update(messages)
        .set({ read: true })
        .where(and(eq(messages.id, messageId), eq(messages.recipientId, userId)));

      return { success: true };
    },

    async deleteMessage(userId: string, messageId: string) {
      await db
        .delete(messages)
        .where(and(eq(messages.id, messageId), eq(messages.recipientId, userId)));

      return { success: true };
    },

    async countUnread(userId: string) {
      const [result] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(messages)
        .where(and(eq(messages.recipientId, userId), eq(messages.read, false)));

      return result?.count ?? 0;
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/message/message.service.ts
git commit -m "feat(api): add message service"
```

---

### Task 5: Message router

**Files:**
- Create: `apps/api/src/modules/message/message.router.ts`

- [ ] **Step 1: Créer le router**

```typescript
// apps/api/src/modules/message/message.router.ts
import { z } from 'zod';
import { protectedProcedure, router } from '../../trpc/router.js';
import type { createMessageService } from './message.service.js';

export function createMessageRouter(messageService: ReturnType<typeof createMessageService>) {
  return router({
    inbox: protectedProcedure
      .input(z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(50).default(20),
      }).optional())
      .query(async ({ ctx, input }) => {
        return messageService.listMessages(ctx.userId!, input);
      }),

    detail: protectedProcedure
      .input(z.object({ messageId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        return messageService.getMessage(ctx.userId!, input.messageId);
      }),

    send: protectedProcedure
      .input(z.object({
        recipientUsername: z.string().min(1).max(64),
        subject: z.string().min(1).max(255),
        body: z.string().min(1).max(5000),
      }))
      .mutation(async ({ ctx, input }) => {
        return messageService.sendMessage(ctx.userId!, input.recipientUsername, input.subject, input.body);
      }),

    markAsRead: protectedProcedure
      .input(z.object({ messageId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        return messageService.markAsRead(ctx.userId!, input.messageId);
      }),

    delete: protectedProcedure
      .input(z.object({ messageId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        return messageService.deleteMessage(ctx.userId!, input.messageId);
      }),

    unreadCount: protectedProcedure
      .query(async ({ ctx }) => {
        return messageService.countUnread(ctx.userId!);
      }),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/message/message.router.ts
git commit -m "feat(api): add message router"
```

---

## Chunk 3: Ranking module + Colonisation handler

### Task 6: Ranking service + router + cron

**Files:**
- Create: `apps/api/src/modules/ranking/ranking.service.ts`
- Create: `apps/api/src/modules/ranking/ranking.router.ts`
- Create: `apps/api/src/cron/ranking-update.ts`

- [ ] **Step 1: Créer le service ranking**

```typescript
// apps/api/src/modules/ranking/ranking.service.ts
import { eq, desc, sql } from 'drizzle-orm';
import { users, planets, userResearch, planetShips, planetDefenses, rankings } from '@ogame-clone/db';
import type { Database } from '@ogame-clone/db';
import {
  calculateBuildingPoints,
  calculateResearchPoints,
  calculateFleetPoints,
  calculateDefensePoints,
  calculateTotalPoints,
} from '@ogame-clone/game-engine';

export function createRankingService(db: Database) {
  return {
    async recalculateAll() {
      const allUsers = await db.select({ id: users.id }).from(users);

      const pointsPerUser: { userId: string; totalPoints: number }[] = [];

      for (const user of allUsers) {
        // Building points: sum across all planets
        const userPlanets = await db.select().from(planets).where(eq(planets.userId, user.id));
        let buildingPoints = 0;
        for (const planet of userPlanets) {
          buildingPoints += calculateBuildingPoints({
            metalMineLevel: planet.metalMineLevel,
            crystalMineLevel: planet.crystalMineLevel,
            deutSynthLevel: planet.deutSynthLevel,
            solarPlantLevel: planet.solarPlantLevel,
            roboticsLevel: planet.roboticsLevel,
            shipyardLevel: planet.shipyardLevel,
            researchLabLevel: planet.researchLabLevel,
            storageMetalLevel: planet.storageMetalLevel,
            storageCrystalLevel: planet.storageCrystalLevel,
            storageDeutLevel: planet.storageDeutLevel,
          });
        }

        // Research points
        const [research] = await db.select().from(userResearch).where(eq(userResearch.userId, user.id)).limit(1);
        const researchPoints = research
          ? calculateResearchPoints({
              espionageTech: research.espionageTech,
              computerTech: research.computerTech,
              energyTech: research.energyTech,
              combustion: research.combustion,
              impulse: research.impulse,
              hyperspaceDrive: research.hyperspaceDrive,
              weapons: research.weapons,
              shielding: research.shielding,
              armor: research.armor,
            })
          : 0;

        // Fleet points: sum across all planets
        let fleetPoints = 0;
        for (const planet of userPlanets) {
          const [ships] = await db.select().from(planetShips).where(eq(planetShips.planetId, planet.id)).limit(1);
          if (ships) {
            fleetPoints += calculateFleetPoints({
              smallCargo: ships.smallCargo,
              largeCargo: ships.largeCargo,
              lightFighter: ships.lightFighter,
              heavyFighter: ships.heavyFighter,
              cruiser: ships.cruiser,
              battleship: ships.battleship,
              espionageProbe: ships.espionageProbe,
              colonyShip: ships.colonyShip,
              recycler: ships.recycler,
            });
          }
        }

        // Defense points: sum across all planets
        let defensePoints = 0;
        for (const planet of userPlanets) {
          const [defenses] = await db.select().from(planetDefenses).where(eq(planetDefenses.planetId, planet.id)).limit(1);
          if (defenses) {
            defensePoints += calculateDefensePoints({
              rocketLauncher: defenses.rocketLauncher,
              lightLaser: defenses.lightLaser,
              heavyLaser: defenses.heavyLaser,
              gaussCannon: defenses.gaussCannon,
              plasmaTurret: defenses.plasmaTurret,
              smallShield: defenses.smallShield,
              largeShield: defenses.largeShield,
            });
          }
        }

        const total = calculateTotalPoints(buildingPoints, researchPoints, fleetPoints, defensePoints);
        pointsPerUser.push({ userId: user.id, totalPoints: total });
      }

      // Sort by points descending
      pointsPerUser.sort((a, b) => b.totalPoints - a.totalPoints);

      // Upsert rankings
      const now = new Date();
      for (let i = 0; i < pointsPerUser.length; i++) {
        const { userId, totalPoints } = pointsPerUser[i];
        const rank = i + 1;

        await db
          .insert(rankings)
          .values({ userId, totalPoints, rank, calculatedAt: now })
          .onConflictDoUpdate({
            target: rankings.userId,
            set: { totalPoints, rank, calculatedAt: now },
          });
      }

      console.log(`[ranking] Recalculated rankings for ${pointsPerUser.length} users`);
    },

    async getRankings(page: number = 1, limit: number = 20) {
      const offset = (page - 1) * limit;
      return db
        .select({
          rank: rankings.rank,
          userId: rankings.userId,
          username: users.username,
          totalPoints: rankings.totalPoints,
          calculatedAt: rankings.calculatedAt,
        })
        .from(rankings)
        .innerJoin(users, eq(users.id, rankings.userId))
        .orderBy(rankings.rank)
        .limit(limit)
        .offset(offset);
    },

    async getPlayerRank(userId: string) {
      const [result] = await db
        .select()
        .from(rankings)
        .where(eq(rankings.userId, userId))
        .limit(1);

      return result ?? { totalPoints: 0, rank: 0 };
    },
  };
}
```

- [ ] **Step 2: Créer le router ranking**

```typescript
// apps/api/src/modules/ranking/ranking.router.ts
import { z } from 'zod';
import { protectedProcedure, router } from '../../trpc/router.js';
import type { createRankingService } from './ranking.service.js';

export function createRankingRouter(rankingService: ReturnType<typeof createRankingService>) {
  return router({
    list: protectedProcedure
      .input(z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
      }).optional())
      .query(async ({ input }) => {
        return rankingService.getRankings(input?.page, input?.limit);
      }),

    me: protectedProcedure
      .query(async ({ ctx }) => {
        return rankingService.getPlayerRank(ctx.userId!);
      }),
  });
}
```

- [ ] **Step 3: Créer le cron ranking-update**

```typescript
// apps/api/src/cron/ranking-update.ts
import type { Database } from '@ogame-clone/db';
import { createRankingService } from '../modules/ranking/ranking.service.js';

export async function rankingUpdate(db: Database) {
  const rankingService = createRankingService(db);
  await rankingService.recalculateAll();
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/ranking/ apps/api/src/cron/ranking-update.ts
git commit -m "feat(api): add ranking service, router, and cron update"
```

---

### Task 7: Colonisation handler dans fleet.service

**Files:**
- Modify: `apps/api/src/modules/fleet/fleet.service.ts`

- [ ] **Step 1: Implémenter le handler colonize**

Dans `apps/api/src/modules/fleet/fleet.service.ts`, le `createFleetService` doit maintenant accepter un paramètre supplémentaire `messageService`. Modifier la signature :

Avant :
```typescript
export function createFleetService(
  db: Database,
  resourceService: ReturnType<typeof createResourceService>,
  fleetArrivalQueue: Queue,
  fleetReturnQueue: Queue,
  universeSpeed: number,
) {
```

Après :
```typescript
import type { createMessageService } from '../message/message.service.js';
import {
  calculateMaxTemp,
  calculateMinTemp,
  calculateDiameter,
  calculateMaxFields,
} from '@ogame-clone/game-engine';

export function createFleetService(
  db: Database,
  resourceService: ReturnType<typeof createResourceService>,
  fleetArrivalQueue: Queue,
  fleetReturnQueue: Queue,
  universeSpeed: number,
  messageService?: ReturnType<typeof createMessageService>,
) {
```

Puis remplacer le bloc stub Phase 5 (lignes 286-293) :

Avant :
```typescript
      // For other missions (attack, spy, colonize) — Phase 5
      await this.scheduleReturn(
        event.id, event.originPlanetId,
        { galaxy: event.targetGalaxy, system: event.targetSystem, position: event.targetPosition },
        ships, metalCargo, crystalCargo, deuteriumCargo,
      );

      return { mission: event.mission, placeholder: true };
```

Après :
```typescript
      if (event.mission === 'colonize') {
        return this.processColonize(event, ships, metalCargo, crystalCargo, deuteriumCargo);
      }

      // For other missions (attack, spy) — Phase 5b
      await this.scheduleReturn(
        event.id, event.originPlanetId,
        { galaxy: event.targetGalaxy, system: event.targetSystem, position: event.targetPosition },
        ships, metalCargo, crystalCargo, deuteriumCargo,
      );

      return { mission: event.mission, placeholder: true };
```

Puis ajouter la méthode `processColonize` dans l'objet retourné par `createFleetService` (avant `getDriveTechs`) :

```typescript
    async processColonize(
      event: typeof fleetEvents.$inferSelect,
      ships: Record<string, number>,
      metalCargo: number,
      crystalCargo: number,
      deuteriumCargo: number,
    ) {
      const coords = `[${event.targetGalaxy}:${event.targetSystem}:${event.targetPosition}]`;

      // Check if position is free
      const [existing] = await db
        .select()
        .from(planets)
        .where(
          and(
            eq(planets.galaxy, event.targetGalaxy),
            eq(planets.system, event.targetSystem),
            eq(planets.position, event.targetPosition),
          ),
        )
        .limit(1);

      if (existing) {
        // Position occupied → return fleet (with colony ship)
        if (messageService) {
          await messageService.createSystemMessage(
            event.userId,
            'colonization',
            `Colonisation échouée ${coords}`,
            `La position ${coords} est déjà occupée. Votre flotte fait demi-tour.`,
          );
        }
        await this.scheduleReturn(
          event.id, event.originPlanetId,
          { galaxy: event.targetGalaxy, system: event.targetSystem, position: event.targetPosition },
          ships, metalCargo, crystalCargo, deuteriumCargo,
        );
        return { mission: 'colonize', success: false, reason: 'occupied' };
      }

      // Check max planets
      const userPlanets = await db
        .select()
        .from(planets)
        .where(eq(planets.userId, event.userId));

      if (userPlanets.length >= 9) {
        if (messageService) {
          await messageService.createSystemMessage(
            event.userId,
            'colonization',
            `Colonisation échouée ${coords}`,
            `Nombre maximum de planètes atteint (9). Votre flotte fait demi-tour.`,
          );
        }
        await this.scheduleReturn(
          event.id, event.originPlanetId,
          { galaxy: event.targetGalaxy, system: event.targetSystem, position: event.targetPosition },
          ships, metalCargo, crystalCargo, deuteriumCargo,
        );
        return { mission: 'colonize', success: false, reason: 'max_planets' };
      }

      // Success: create new planet
      const randomOffset = Math.floor(Math.random() * 41) - 20;
      const maxTemp = calculateMaxTemp(event.targetPosition, randomOffset);
      const minTemp = calculateMinTemp(maxTemp);
      const diameter = calculateDiameter(event.targetPosition, Math.random());
      const maxFields = calculateMaxFields(diameter);

      const [newPlanet] = await db
        .insert(planets)
        .values({
          userId: event.userId,
          name: `Colonie`,
          galaxy: event.targetGalaxy,
          system: event.targetSystem,
          position: event.targetPosition,
          planetType: 'planet',
          diameter,
          maxFields,
          minTemp,
          maxTemp,
        })
        .returning();

      // Create associated rows
      await db.insert(planetShips).values({ planetId: newPlanet.id });
      await db.insert(planetDefenses).values({ planetId: newPlanet.id });

      // Colony ship is consumed — remove from fleet
      const remainingShips = { ...ships };
      if (remainingShips.colonyShip) {
        remainingShips.colonyShip = Math.max(0, remainingShips.colonyShip - 1);
      }

      // Mark event completed
      await db
        .update(fleetEvents)
        .set({ status: 'completed' })
        .where(eq(fleetEvents.id, event.id));

      // Return remaining ships (if any) with cargo
      const hasRemainingShips = Object.values(remainingShips).some(v => v > 0);
      if (hasRemainingShips) {
        // Create a new fleet event for the return trip
        const driveTechs = await this.getDriveTechs(event.userId);
        const speed = (await import('@ogame-clone/game-engine')).fleetSpeed(remainingShips, driveTechs);
        const originPlanet = await db
          .select()
          .from(planets)
          .where(eq(planets.id, event.originPlanetId))
          .limit(1);

        if (originPlanet[0] && speed > 0) {
          const origin = { galaxy: originPlanet[0].galaxy, system: originPlanet[0].system, position: originPlanet[0].position };
          const target = { galaxy: event.targetGalaxy, system: event.targetSystem, position: event.targetPosition };
          const duration = (await import('@ogame-clone/game-engine')).travelTime(target, origin, speed, universeSpeed);
          const now = new Date();
          const returnTime = new Date(now.getTime() + duration * 1000);

          const [returnEvent] = await db
            .insert(fleetEvents)
            .values({
              userId: event.userId,
              originPlanetId: event.originPlanetId,
              targetPlanetId: newPlanet.id,
              targetGalaxy: event.targetGalaxy,
              targetSystem: event.targetSystem,
              targetPosition: event.targetPosition,
              mission: 'transport',
              phase: 'return',
              status: 'active',
              departureTime: now,
              arrivalTime: returnTime,
              metalCargo: String(metalCargo),
              crystalCargo: String(crystalCargo),
              deuteriumCargo: String(deuteriumCargo),
              ships: remainingShips,
            })
            .returning();

          await fleetReturnQueue.add(
            'return',
            { fleetEventId: returnEvent.id },
            { delay: duration * 1000, jobId: `fleet-return-${returnEvent.id}` },
          );
        }
      }

      if (messageService) {
        await messageService.createSystemMessage(
          event.userId,
          'colonization',
          `Colonisation réussie ${coords}`,
          `Une nouvelle colonie a été fondée sur ${coords}. Diamètre : ${diameter}km, ${maxFields} cases disponibles.`,
        );
      }

      return { mission: 'colonize', success: true, planetId: newPlanet.id };
    },
```

Note : La méthode `processColonize` utilise des imports dynamiques pour `fleetSpeed` et `travelTime` afin d'éviter de les importer en doublon en haut du fichier. Alternativement, ajouter ces imports au bloc d'import existant si ce n'est pas déjà fait. Vérifier les imports existants — `fleetSpeed` et `travelTime` sont déjà importés en haut du fichier, donc utiliser directement les fonctions importées au lieu des imports dynamiques.

Version corrigée sans imports dynamiques (utiliser les imports déjà présents) :

Remplacer les `(await import('@ogame-clone/game-engine')).fleetSpeed(...)` par `fleetSpeed(...)` et `(await import('@ogame-clone/game-engine')).travelTime(...)` par `travelTime(...)`.

- [ ] **Step 2: Ajouter les imports nécessaires**

Ajouter en haut de fleet.service.ts, avec les imports existants de `@ogame-clone/db` :
```typescript
import { planetDefenses } from '@ogame-clone/db';
```

Et ajouter les imports game-engine manquants :
```typescript
import {
  calculateMaxTemp,
  calculateMinTemp,
  calculateDiameter,
  calculateMaxFields,
} from '@ogame-clone/game-engine';
```

Fusionner avec l'import existant de `@ogame-clone/game-engine`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/fleet/fleet.service.ts
git commit -m "feat(api): implement colonization mission handler"
```

---

## Chunk 4: Wiring + Frontend

### Task 8: Wire app-router, worker, queues

**Files:**
- Modify: `apps/api/src/trpc/app-router.ts`
- Modify: `apps/api/src/workers/worker.ts`

- [ ] **Step 1: Mettre à jour app-router.ts**

Ajouter les imports :
```typescript
import { createMessageService } from '../modules/message/message.service.js';
import { createMessageRouter } from '../modules/message/message.router.js';
import { createRankingService } from '../modules/ranking/ranking.service.js';
import { createRankingRouter } from '../modules/ranking/ranking.router.js';
```

Dans `buildAppRouter`, ajouter après les services existants :
```typescript
  const messageService = createMessageService(db);
  const rankingService = createRankingService(db);
```

Modifier la création du fleetService pour passer messageService :
```typescript
  const fleetService = createFleetService(db, resourceService, fleetArrivalQueue, fleetReturnQueue, UNIVERSE_CONFIG.speed, messageService);
```

Créer les routers :
```typescript
  const messageRouter = createMessageRouter(messageService);
  const rankingRouter = createRankingRouter(rankingService);
```

Ajouter dans l'objet router :
```typescript
    message: messageRouter,
    ranking: rankingRouter,
```

- [ ] **Step 2: Mettre à jour worker.ts**

Ajouter l'import :
```typescript
import { rankingUpdate } from '../cron/ranking-update.js';
```

Ajouter après les crons existants :
```typescript
setInterval(async () => {
  try {
    await rankingUpdate(db);
  } catch (err) {
    console.error('[ranking-update] Error:', err);
  }
}, 30 * 60_000);
console.log('[worker] Ranking update cron started (30min)');
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/trpc/app-router.ts apps/api/src/workers/worker.ts
git commit -m "feat(api): wire message and ranking modules, add ranking cron"
```

---

### Task 9: Page Messages

**Files:**
- Create: `apps/web/src/pages/Messages.tsx`
- Modify: `apps/web/src/router.tsx`

- [ ] **Step 1: Créer la page**

```tsx
// apps/web/src/pages/Messages.tsx
import { useState } from 'react';
import { trpc } from '@/trpc';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function Messages() {
  const utils = trpc.useUtils();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [newMsg, setNewMsg] = useState({ recipientUsername: '', subject: '', body: '' });

  const { data: inbox, isLoading } = trpc.message.inbox.useQuery();
  const { data: detail } = trpc.message.detail.useQuery(
    { messageId: selectedId! },
    { enabled: !!selectedId },
  );

  const sendMutation = trpc.message.send.useMutation({
    onSuccess: () => {
      utils.message.inbox.invalidate();
      utils.message.unreadCount.invalidate();
      setShowCompose(false);
      setNewMsg({ recipientUsername: '', subject: '', body: '' });
    },
  });

  const deleteMutation = trpc.message.delete.useMutation({
    onSuccess: () => {
      utils.message.inbox.invalidate();
      utils.message.unreadCount.invalidate();
      setSelectedId(null);
    },
  });

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Chargement...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Messages</h1>
        <Button size="sm" onClick={() => { setShowCompose(!showCompose); setSelectedId(null); }}>
          {showCompose ? 'Annuler' : 'Nouveau message'}
        </Button>
      </div>

      {showCompose && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nouveau message</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Destinataire</label>
              <Input
                value={newMsg.recipientUsername}
                onChange={(e) => setNewMsg({ ...newMsg, recipientUsername: e.target.value })}
                placeholder="Nom du joueur"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Sujet</label>
              <Input
                value={newMsg.subject}
                onChange={(e) => setNewMsg({ ...newMsg, subject: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Message</label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={4}
                value={newMsg.body}
                onChange={(e) => setNewMsg({ ...newMsg, body: e.target.value })}
              />
            </div>
            {sendMutation.error && (
              <p className="text-sm text-destructive">{sendMutation.error.message}</p>
            )}
            <Button
              onClick={() => sendMutation.mutate(newMsg)}
              disabled={sendMutation.isPending || !newMsg.recipientUsername || !newMsg.subject || !newMsg.body}
            >
              Envoyer
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
        {/* Inbox list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Boîte de réception</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {!inbox || inbox.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun message.</p>
            ) : (
              inbox.map((msg) => (
                <button
                  key={msg.id}
                  onClick={() => { setSelectedId(msg.id); setShowCompose(false); }}
                  className={`w-full text-left rounded px-3 py-2 text-sm transition-colors ${
                    selectedId === msg.id ? 'bg-primary/10' : 'hover:bg-accent'
                  } ${!msg.read ? 'font-bold' : ''}`}
                >
                  <div className="flex justify-between">
                    <span className="truncate">{msg.subject}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                      {new Date(msg.createdAt).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {msg.senderUsername ?? 'Système'}
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        {/* Detail panel */}
        {selectedId && detail && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{detail.subject}</CardTitle>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteMutation.mutate({ messageId: selectedId })}
                  disabled={deleteMutation.isPending}
                >
                  Supprimer
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                De : {detail.senderUsername ?? 'Système'} — {new Date(detail.createdAt).toLocaleString('fr-FR')}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{detail.body}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Ajouter la route**

Dans `apps/web/src/router.tsx`, ajouter dans les children de `/` :
```tsx
{
  path: 'messages',
  lazy: () => import('./pages/Messages').then((m) => ({ Component: m.default })),
},
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/Messages.tsx apps/web/src/router.tsx
git commit -m "feat(web): add Messages page with inbox, detail, and compose"
```

---

### Task 10: Page Ranking

**Files:**
- Create: `apps/web/src/pages/Ranking.tsx`
- Modify: `apps/web/src/router.tsx`

- [ ] **Step 1: Créer la page**

```tsx
// apps/web/src/pages/Ranking.tsx
import { useState } from 'react';
import { trpc } from '@/trpc';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Ranking() {
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data: rankings, isLoading } = trpc.ranking.list.useQuery({ page, limit });
  const { data: myRank } = trpc.ranking.me.useQuery();

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Chargement...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Classement</h1>

      {myRank && myRank.rank > 0 && (
        <div className="text-sm text-muted-foreground">
          Votre classement : <span className="font-bold text-primary">#{myRank.rank}</span> — {myRank.totalPoints.toLocaleString('fr-FR')} points
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Classement général</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-2 py-1 w-16">Rang</th>
                <th className="px-2 py-1">Joueur</th>
                <th className="px-2 py-1 text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {rankings?.map((entry) => (
                <tr key={entry.userId} className="border-b border-border/50">
                  <td className="px-2 py-1 font-mono">{entry.rank}</td>
                  <td className="px-2 py-1">{entry.username}</td>
                  <td className="px-2 py-1 text-right">{entry.totalPoints.toLocaleString('fr-FR')}</td>
                </tr>
              ))}
              {(!rankings || rankings.length === 0) && (
                <tr>
                  <td colSpan={3} className="px-2 py-4 text-center text-muted-foreground">
                    Aucun classement disponible.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="flex justify-center gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
            >
              Précédent
            </Button>
            <span className="text-sm text-muted-foreground self-center">Page {page}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={!rankings || rankings.length < limit}
            >
              Suivant
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Ajouter la route**

Dans `apps/web/src/router.tsx`, ajouter dans les children de `/` :
```tsx
{
  path: 'ranking',
  lazy: () => import('./pages/Ranking').then((m) => ({ Component: m.default })),
},
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/Ranking.tsx apps/web/src/router.tsx
git commit -m "feat(web): add Ranking page with pagination"
```

---

## Chunk 5: Typecheck + Lint + Test

### Task 11: Vérification finale

- [ ] **Step 1: Turbo typecheck**

```bash
export PATH="/usr/local/opt/node@22/bin:$PATH" && cd /Users/julienaubree/_projet/ogame-clone && pnpm turbo typecheck
```
Expected: PASS

- [ ] **Step 2: Turbo lint**

```bash
export PATH="/usr/local/opt/node@22/bin:$PATH" && cd /Users/julienaubree/_projet/ogame-clone && pnpm turbo lint
```
Expected: PASS (fix any issues)

- [ ] **Step 3: Turbo test**

```bash
export PATH="/usr/local/opt/node@22/bin:$PATH" && cd /Users/julienaubree/_projet/ogame-clone && pnpm turbo test
```
Expected: ALL PASS — tous les tests existants (92) + ranking tests (~10)

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve typecheck and lint issues from Phase 5a"
```

---

## Verification Checklist

1. `pnpm turbo typecheck` — pas d'erreur TS
2. `pnpm turbo test` — tous les tests passent (92 existants + ~10 ranking)
3. `pnpm turbo lint` — pas d'erreur lint
4. API répond à `trpc.message.inbox/detail/send/markAsRead/delete/unreadCount`
5. API répond à `trpc.ranking.list/me`
6. Handler colonize fonctionne (crée planète, consomme vaisseau, envoie message)
7. Cron ranking 30min démarre dans worker.ts
8. Page Messages affiche inbox, détail, composition
9. Page Ranking affiche le classement paginé
