# Labels & Textes Centralises — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminer tous les labels/textes hardcodes du frontend et de l'admin en les stockant en DB, exposes via gameConfig.

**Architecture:** Deux nouvelles tables DB (`mission_definitions`, `ui_labels`) + enrichissement de `bonus_definitions` (colonne `statLabel`) et `tutorial_quest_definitions` (colonne `conditionLabel`). L'API charge ces donnees dans `gameConfig.getAll`. Le frontend et l'admin lisent depuis `gameConfig` au lieu de constantes locales. Nouvelles pages admin pour gerer missions et labels.

**Tech Stack:** Drizzle ORM, PostgreSQL, tRPC, React, Zustand

---

## File Structure

### DB Layer (`packages/db/src/`)
- Create: `schema/mission-definitions.ts` — table `mission_definitions`
- Create: `schema/ui-labels.ts` — table `ui_labels`
- Modify: `schema/game-config.ts` — add `statLabel` column to `bonusDefinitions`
- Modify: `schema/tutorial-quest-definitions.ts` — add `conditionLabel` column
- Modify: `schema/index.ts` — export new schemas
- Modify: `seed-game-config.ts` — seed new tables + columns

### API Layer (`apps/api/src/modules/admin/`)
- Modify: `game-config.service.ts` — load new data in `getFullConfig`, add CRUD methods
- Modify: `game-config.router.ts` — add tRPC procedures for missions + labels

### Frontend (`apps/web/src/`)
- Modify: `config/mission-config.ts` — remove label/hint/buttonLabel/color/SHIP_NAMES, add behavioral fields from gameConfig
- Modify: `lib/entity-names.ts` — remove `RESEARCH_NAMES` fallback
- Modify: `lib/game-events.ts` — remove `MISSION_LABELS`, rewrite `eventTypeLabel`/`formatEventText`
- Modify: `pages/Reports.tsx` — remove `MISSION_TYPE_LABELS`, `VISIBILITY_LABELS`, `OUTCOME_STYLES` labels
- Modify: `pages/History.tsx` — remove `EVENT_TYPE_OPTIONS` labels
- Modify: `pages/Overview.tsx` — remove `PHASE_LABELS`, `MISSION_HEX`
- Modify: `pages/Movements.tsx` — remove `PHASE_STYLE` labels, `MINE_PHASES` labels, `DRIVE_LABELS`
- Modify: `pages/Missions.tsx` — remove `TIER_LABELS`
- Modify: `components/fleet/PveMissionBanner.tsx` — remove `DIFFICULTY_LABELS`
- Modify: `components/entity-details/ShipDetailContent.tsx` — remove `DRIVE_LABELS`
- Modify: `components/entity-details/ResearchDetailContent.tsx` — remove `STAT_LABELS`, `DRIVE_LABELS`
- Modify: `components/entity-details/BuildingDetailContent.tsx` — remove `STAT_LABELS`

### Admin (`apps/admin/src/`)
- Create: `pages/Missions.tsx` — CRUD page for `mission_definitions`
- Create: `pages/Labels.tsx` — CRUD page for `ui_labels`
- Modify: `router.tsx` — add routes
- Modify: `components/layout/AdminLayout.tsx` — add nav entries
- Modify: `pages/Buildings.tsx` — read `STAT_OPTIONS` from `gameConfig.bonuses[].statLabel`
- Modify: `pages/Research.tsx` — same
- Modify: `pages/TutorialQuests.tsx` — read condition labels from `gameConfig.tutorialQuests`

---

### Task 1: DB schema — new tables and columns

**Files:**
- Create: `packages/db/src/schema/mission-definitions.ts`
- Create: `packages/db/src/schema/ui-labels.ts`
- Modify: `packages/db/src/schema/game-config.ts`
- Modify: `packages/db/src/schema/tutorial-quest-definitions.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Create `mission-definitions.ts`**

```ts
import { pgTable, varchar, text, integer, boolean, jsonb } from 'drizzle-orm/pg-core';

export const missionDefinitions = pgTable('mission_definitions', {
  id: varchar('id', { length: 64 }).primaryKey(),
  label: varchar('label', { length: 128 }).notNull(),
  hint: text('hint').notNull().default(''),
  buttonLabel: varchar('button_label', { length: 64 }).notNull().default(''),
  color: varchar('color', { length: 16 }).notNull().default('#888888'),
  sortOrder: integer('sort_order').notNull().default(0),
  dangerous: boolean('dangerous').notNull().default(false),
  requiredShipRoles: jsonb('required_ship_roles').$type<string[] | null>().default(null),
  exclusive: boolean('exclusive').notNull().default(false),
  recommendedShipRoles: jsonb('recommended_ship_roles').$type<string[] | null>().default(null),
  requiresPveMission: boolean('requires_pve_mission').notNull().default(false),
});
```

- [ ] **Step 2: Create `ui-labels.ts`**

```ts
import { pgTable, varchar, text } from 'drizzle-orm/pg-core';

export const uiLabels = pgTable('ui_labels', {
  key: varchar('key', { length: 128 }).primaryKey(),
  label: text('label').notNull(),
});
```

- [ ] **Step 3: Add `statLabel` to `bonusDefinitions` in `game-config.ts`**

Find the `bonusDefinitions` table definition in `packages/db/src/schema/game-config.ts`. Add after the last column:

```ts
statLabel: varchar('stat_label', { length: 128 }),
```

- [ ] **Step 4: Add `conditionLabel` to `tutorialQuestDefinitions`**

In `packages/db/src/schema/tutorial-quest-definitions.ts`, add to the `tutorialQuestDefinitions` table:

```ts
conditionLabel: varchar('condition_label', { length: 128 }),
```

- [ ] **Step 5: Export new schemas from `index.ts`**

In `packages/db/src/schema/index.ts`, add:

```ts
export * from './mission-definitions.js';
export * from './ui-labels.js';
```

- [ ] **Step 6: Generate Drizzle migration**

Run: `cd packages/db && npx drizzle-kit generate`
Expected: A new SQL migration file in the migrations directory.

- [ ] **Step 7: Push schema to DB**

Run: `cd packages/db && npx drizzle-kit push`
Expected: Schema applied successfully.

- [ ] **Step 8: Commit**

```bash
git add packages/db/src/schema/
git commit -m "feat(db): add mission_definitions and ui_labels tables, statLabel and conditionLabel columns"
```

---

### Task 2: Seed — populate new tables and columns

**Files:**
- Modify: `packages/db/src/seed-game-config.ts`

- [ ] **Step 1: Add mission definitions seed data**

Add this constant at the top of the file (after existing constant declarations):

```ts
const MISSION_DEFINITIONS = [
  { id: 'transport', label: 'Transport', hint: 'Envoyez des ressources vers une planète alliée', buttonLabel: 'Envoyer', color: '#3b82f6', sortOrder: 1, dangerous: false, requiredShipRoles: null, exclusive: false, recommendedShipRoles: ['smallCargo', 'largeCargo'], requiresPveMission: false },
  { id: 'station', label: 'Stationner', hint: 'Stationnez votre flotte sur une planète alliée', buttonLabel: 'Envoyer', color: '#10b981', sortOrder: 2, dangerous: false, requiredShipRoles: null, exclusive: false, recommendedShipRoles: null, requiresPveMission: false },
  { id: 'spy', label: 'Espionner', hint: "Envoyez des sondes d'espionnage", buttonLabel: 'Espionner', color: '#8b5cf6', sortOrder: 3, dangerous: false, requiredShipRoles: ['espionageProbe'], exclusive: true, recommendedShipRoles: null, requiresPveMission: false },
  { id: 'attack', label: 'Attaque', hint: 'Attaquez une planète ennemie', buttonLabel: 'Attaquer', color: '#ef4444', sortOrder: 4, dangerous: true, requiredShipRoles: ['lightFighter', 'heavyFighter', 'cruiser', 'battleship'], exclusive: false, recommendedShipRoles: null, requiresPveMission: false },
  { id: 'colonize', label: 'Coloniser', hint: 'Colonisez une position vide', buttonLabel: 'Coloniser', color: '#f97316', sortOrder: 5, dangerous: true, requiredShipRoles: ['colonyShip'], exclusive: true, recommendedShipRoles: null, requiresPveMission: false },
  { id: 'recycle', label: 'Recycler', hint: 'Récupérez les débris en orbite', buttonLabel: 'Recycler', color: '#06b6d4', sortOrder: 6, dangerous: false, requiredShipRoles: ['recycler'], exclusive: true, recommendedShipRoles: null, requiresPveMission: false },
  { id: 'mine', label: 'Miner', hint: "Envoyez des prospecteurs sur une ceinture d'astéroïdes", buttonLabel: 'Envoyer', color: '#f59e0b', sortOrder: 7, dangerous: false, requiredShipRoles: ['prospector'], exclusive: false, recommendedShipRoles: null, requiresPveMission: true },
  { id: 'pirate', label: 'Pirate', hint: 'Attaquez un repaire pirate', buttonLabel: 'Attaquer', color: '#e11d48', sortOrder: 8, dangerous: true, requiredShipRoles: ['lightFighter', 'heavyFighter', 'cruiser', 'battleship'], exclusive: false, recommendedShipRoles: null, requiresPveMission: true },
];
```

- [ ] **Step 2: Add ui_labels seed data**

```ts
const UI_LABELS = [
  // Propulsion
  { key: 'drive.combustion', label: 'Combustion' },
  { key: 'drive.impulse', label: 'Impulsion' },
  { key: 'drive.hyperspaceDrive', label: 'Hyperespace' },
  // Fleet phases
  { key: 'phase.outbound', label: 'En route' },
  { key: 'phase.prospecting', label: 'Prospection' },
  { key: 'phase.mining', label: 'Extraction' },
  { key: 'phase.return', label: 'Retour' },
  { key: 'phase.base', label: 'Base' },
  // PvE tiers
  { key: 'tier.easy', label: 'Facile' },
  { key: 'tier.medium', label: 'Moyen' },
  { key: 'tier.hard', label: 'Difficile' },
  // Event types
  { key: 'event.building-done', label: 'Construction' },
  { key: 'event.research-done', label: 'Recherche' },
  { key: 'event.shipyard-done', label: 'Chantier' },
  { key: 'event.fleet-arrived', label: 'Flotte arrivée' },
  { key: 'event.fleet-returned', label: 'Flotte de retour' },
  { key: 'event.pve-mission-done', label: 'Mission PvE' },
  { key: 'event.tutorial-quest-done', label: 'Tutoriel' },
  // Spy visibility
  { key: 'spy_visibility.resources', label: 'Ressources' },
  { key: 'spy_visibility.fleet', label: 'Flotte' },
  { key: 'spy_visibility.defenses', label: 'Défenses' },
  { key: 'spy_visibility.buildings', label: 'Bâtiments' },
  { key: 'spy_visibility.research', label: 'Recherches' },
  // Combat outcomes
  { key: 'outcome.attacker', label: 'Victoire' },
  { key: 'outcome.defender', label: 'Défaite' },
  { key: 'outcome.draw', label: 'Match nul' },
];
```

- [ ] **Step 3: Add `statLabel` values to existing BONUSES seed data**

Find the `BONUSES` array in the seed file. Add `statLabel` to each entry. The label values are:

| stat | statLabel |
|------|-----------|
| `building_time` | `'Temps de construction'` |
| `research_time` | `'Temps de recherche'` |
| `ship_build_time` | `'Temps de construction des vaisseaux'` |
| `defense_build_time` | `'Temps de construction des défenses'` |
| `ship_speed` | `'Vitesse des vaisseaux'` |
| `weapons` | `'Dégâts des armes'` |
| `shielding` | `'Puissance des boucliers'` |
| `armor` | `'Résistance de la coque'` |
| `fleet_count` | `'Flottes simultanées'` |
| `spy_range` | `'Portée d\'espionnage'` |
| `mining_extraction` | `'Capacité d\'extraction'` |

- [ ] **Step 4: Add `conditionLabel` values to existing TUTORIAL_QUESTS seed data**

Find the `TUTORIAL_QUESTS` array. Add `conditionLabel` based on `conditionType`:

| conditionType | conditionLabel |
|---------------|----------------|
| `building_level` | `'Niveau bâtiment'` |
| `ship_count` | `'Nombre vaisseaux'` |
| `mission_complete` | `'Mission complétée'` |

- [ ] **Step 5: Add seed logic for mission_definitions**

Add at the end of the `seed()` function (before the raw SQL migration), following the existing upsert pattern:

```ts
for (const m of MISSION_DEFINITIONS) {
  const { id: _id, ...mData } = m;
  await db.insert(missionDefinitions).values(m)
    .onConflictDoUpdate({ target: missionDefinitions.id, set: mData });
}
```

Import `missionDefinitions` from `'./schema/mission-definitions.js'` at the top.

- [ ] **Step 6: Add seed logic for ui_labels**

```ts
for (const l of UI_LABELS) {
  const { key: _key, ...lData } = l;
  await db.insert(uiLabels).values(l)
    .onConflictDoUpdate({ target: uiLabels.key, set: lData });
}
```

Import `uiLabels` from `'./schema/ui-labels.js'` at the top.

- [ ] **Step 7: Run seed**

Run: `cd packages/db && npx tsx src/seed-game-config.ts`
Expected: Seed completes without errors. Verify data with: `psql -c "SELECT * FROM mission_definitions ORDER BY sort_order"` and `psql -c "SELECT * FROM ui_labels ORDER BY key"`

- [ ] **Step 8: Commit**

```bash
git add packages/db/src/seed-game-config.ts
git commit -m "feat(db): seed mission_definitions, ui_labels, statLabel, conditionLabel"
```

---

### Task 3: API service — load new data in gameConfig + CRUD methods

**Files:**
- Modify: `apps/api/src/modules/admin/game-config.service.ts`

- [ ] **Step 1: Add interfaces for new data types**

Add near the existing interface declarations (around line 40):

```ts
interface MissionConfig {
  id: string;
  label: string;
  hint: string;
  buttonLabel: string;
  color: string;
  sortOrder: number;
  dangerous: boolean;
  requiredShipRoles: string[] | null;
  exclusive: boolean;
  recommendedShipRoles: string[] | null;
  requiresPveMission: boolean;
}
```

Add `missions: Record<string, MissionConfig>;` and `labels: Record<string, string>;` to the `GameConfig` interface.

Add `statLabel` to `BonusConfig` interface: `statLabel: string | null;`

Also add `statLabel` to the existing `updateBonus` method signature so admins can edit it:
```ts
// In the existing updateBonus method, add statLabel to the accepted data fields
async updateBonus(id: string, data: Partial<{ /* existing fields */ statLabel: string | null }>) { ... }
```

- [ ] **Step 2: Load `missionDefinitions` and `uiLabels` in `getFullConfig`**

In the `Promise.all` call that loads all tables, add:

```ts
db.select().from(missionDefinitions).orderBy(missionDefinitions.sortOrder),
db.select().from(uiLabels),
```

Import `missionDefinitions` and `uiLabels` from `@ogame-clone/db`.

Destructure the results into `missionsRows` and `labelsRows`.

Build the config objects:

```ts
const missions: Record<string, MissionConfig> = {};
for (const m of missionsRows) {
  missions[m.id] = {
    id: m.id,
    label: m.label,
    hint: m.hint,
    buttonLabel: m.buttonLabel,
    color: m.color,
    sortOrder: m.sortOrder,
    dangerous: m.dangerous,
    requiredShipRoles: m.requiredShipRoles as string[] | null,
    exclusive: m.exclusive,
    recommendedShipRoles: m.recommendedShipRoles as string[] | null,
    requiresPveMission: m.requiresPveMission,
  };
}

const labels: Record<string, string> = {};
for (const l of labelsRows) {
  labels[l.key] = l.label;
}
```

Add `missions` and `labels` to the returned `GameConfig` object.

Also include `statLabel: bn.statLabel ?? null` in the bonus config mapping.

- [ ] **Step 3: Add CRUD methods for `missionDefinitions`**

Following the existing pattern (e.g., `createPlanetType`/`updatePlanetType`/`deletePlanetType`):

```ts
async createMission(data: {
  id: string; label: string; hint?: string; buttonLabel?: string;
  color?: string; sortOrder?: number; dangerous?: boolean;
  requiredShipRoles?: string[] | null; exclusive?: boolean;
  recommendedShipRoles?: string[] | null; requiresPveMission?: boolean;
}) {
  await db.insert(missionDefinitions).values(data);
  invalidateCache();
},

async updateMission(id: string, data: Partial<Omit<typeof missionDefinitions.$inferInsert, 'id'>>) {
  await db.update(missionDefinitions).set(data).where(eq(missionDefinitions.id, id));
  invalidateCache();
},

async deleteMission(id: string) {
  await db.delete(missionDefinitions).where(eq(missionDefinitions.id, id));
  invalidateCache();
},
```

- [ ] **Step 4: Add CRUD methods for `uiLabels`**

```ts
async createLabel(data: { key: string; label: string }) {
  await db.insert(uiLabels).values(data);
  invalidateCache();
},

async updateLabel(key: string, data: { label: string }) {
  await db.update(uiLabels).set(data).where(eq(uiLabels.key, key));
  invalidateCache();
},

async deleteLabel(key: string) {
  await db.delete(uiLabels).where(eq(uiLabels.key, key));
  invalidateCache();
},
```

- [ ] **Step 5: Verify compilation**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/admin/game-config.service.ts
git commit -m "feat(api): load missions and labels in gameConfig, add CRUD methods"
```

---

### Task 4: API router — tRPC procedures

**Files:**
- Modify: `apps/api/src/modules/admin/game-config.router.ts`

- [ ] **Step 1: Add mission CRUD procedures**

Inside the `adminRouter` definition, add:

```ts
createMission: adminProcedure
  .input(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    hint: z.string().optional(),
    buttonLabel: z.string().optional(),
    color: z.string().optional(),
    sortOrder: z.number().int().optional(),
    dangerous: z.boolean().optional(),
    requiredShipRoles: z.array(z.string()).nullable().optional(),
    exclusive: z.boolean().optional(),
    recommendedShipRoles: z.array(z.string()).nullable().optional(),
    requiresPveMission: z.boolean().optional(),
  }))
  .mutation(async ({ input }) => {
    await gameConfigService.createMission(input);
    return { success: true };
  }),

updateMission: adminProcedure
  .input(z.object({
    id: z.string(),
    data: z.object({
      label: z.string().min(1).optional(),
      hint: z.string().optional(),
      buttonLabel: z.string().optional(),
      color: z.string().optional(),
      sortOrder: z.number().int().optional(),
      dangerous: z.boolean().optional(),
      requiredShipRoles: z.array(z.string()).nullable().optional(),
      exclusive: z.boolean().optional(),
      recommendedShipRoles: z.array(z.string()).nullable().optional(),
      requiresPveMission: z.boolean().optional(),
    }),
  }))
  .mutation(async ({ input }) => {
    await gameConfigService.updateMission(input.id, input.data);
    return { success: true };
  }),

deleteMission: adminProcedure
  .input(z.object({ id: z.string() }))
  .mutation(async ({ input }) => {
    await gameConfigService.deleteMission(input.id);
    return { success: true };
  }),
```

- [ ] **Step 2: Add `statLabel` to existing `updateBonus` procedure**

In the existing `updateBonus` mutation's Zod schema, add:
```ts
statLabel: z.string().nullable().optional(),
```

- [ ] **Step 3: Add `conditionLabel` to existing `updateTutorialQuest` procedure**

In the existing `updateTutorialQuest` mutation's Zod schema, add:
```ts
conditionLabel: z.string().nullable().optional(),
```

- [ ] **Step 4: Add label CRUD procedures**

```ts
createLabel: adminProcedure
  .input(z.object({ key: z.string().min(1), label: z.string().min(1) }))
  .mutation(async ({ input }) => {
    await gameConfigService.createLabel(input);
    return { success: true };
  }),

updateLabel: adminProcedure
  .input(z.object({ key: z.string(), data: z.object({ label: z.string().min(1) }) }))
  .mutation(async ({ input }) => {
    await gameConfigService.updateLabel(input.key, input.data);
    return { success: true };
  }),

deleteLabel: adminProcedure
  .input(z.object({ key: z.string() }))
  .mutation(async ({ input }) => {
    await gameConfigService.deleteLabel(input.key);
    return { success: true };
  }),
```

- [ ] **Step 5: Verify compilation**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/admin/game-config.router.ts
git commit -m "feat(api): add tRPC procedures for missions and labels CRUD, statLabel and conditionLabel editing"
```

---

### Task 5: Frontend — refactor `mission-config.ts`

**Files:**
- Modify: `apps/web/src/config/mission-config.ts`

**Context:** This file currently exports `MISSION_CONFIG` (label/hint/buttonLabel + behavioral fields), `SHIP_NAMES` (dead code), `getCargoCapacity`, and `categorizeShip`. After this task:
- `SHIP_NAMES` is deleted (dead code)
- Labels (label/hint/buttonLabel) are removed from `MISSION_CONFIG` — consumers will read from `gameConfig.missions`
- Behavioral fields (dangerous/requiredShips/exclusive/recommendedShips/requiresPveMission) are kept temporarily in `MISSION_CONFIG` until gameConfig.missions is consumed everywhere
- Actually, since `gameConfig.missions` now carries everything, we can remove `MISSION_CONFIG` entirely and make `categorizeShip` read from gameConfig

- [ ] **Step 1: Rewrite `mission-config.ts`**

Replace the entire file content. Keep only `Mission` type, `getCargoCapacity`, and `categorizeShip` — but `categorizeShip` now takes a mission config object from gameConfig:

```ts
import { MissionType } from '@ogame-clone/shared';

export type Mission = `${MissionType}`;

export type ShipCategory = 'required' | 'optional' | 'disabled';

interface MissionDef {
  dangerous: boolean;
  requiredShipRoles: string[] | null;
  exclusive: boolean;
  recommendedShipRoles: string[] | null;
  requiresPveMission: boolean;
}

export function getCargoCapacity(
  selectedShips: Record<string, number>,
  shipConfigs: Record<string, { cargoCapacity: number }>,
): number {
  return Object.entries(selectedShips).reduce((sum, [id, count]) => {
    const stats = shipConfigs[id];
    return sum + (stats ? stats.cargoCapacity * count : 0);
  }, 0);
}

export function categorizeShip(
  shipId: string,
  shipCount: number,
  missionDef: MissionDef | undefined,
  shipConfig?: { isStationary?: boolean },
): ShipCategory {
  if (shipConfig?.isStationary) return 'disabled';
  if (!missionDef) return 'disabled';
  if (shipCount === 0) return 'disabled';

  if (missionDef.exclusive && missionDef.requiredShipRoles) {
    return missionDef.requiredShipRoles.includes(shipId) ? 'required' : 'disabled';
  }

  if (missionDef.requiredShipRoles?.includes(shipId)) return 'required';
  if (missionDef.recommendedShipRoles?.includes(shipId)) return 'required';

  return 'optional';
}
```

- [ ] **Step 2: Fix all import sites that used `MISSION_CONFIG`**

Search for all imports of `MISSION_CONFIG` across `apps/web/src/`. Each consumer needs to be updated to read from `gameConfig.missions[missionType]` instead. Key files:
- `pages/Fleet.tsx` — uses `MISSION_CONFIG[mission]` for labels, hints, categorization. Replace `MISSION_CONFIG[mission].label` with `gameConfig?.missions[mission]?.label ?? mission`, etc.
- `components/fleet/FleetSummaryBar.tsx` — uses `MISSION_CONFIG[mission].buttonLabel`. Replace with `gameConfig?.missions[mission]?.buttonLabel ?? 'Envoyer'`.
- `components/fleet/MissionSelector.tsx` — uses `MISSION_CONFIG` to list missions with labels. Replace with `Object.entries(gameConfig?.missions ?? {})`.
- `components/fleet/FleetComposition.tsx` — uses `categorizeShip(ship.id, ship.count, mission, ...)`. The third parameter was a `Mission` string, now it must be the mission definition object. Change to `categorizeShip(ship.id, ship.count, gameConfig?.missions[mission], ...)`. The component must either receive `gameConfig` as a prop or call `useGameConfig()` directly.

- [ ] **Step 3: Verify compilation**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/
git commit -m "refactor(web): read mission config from gameConfig instead of hardcoded MISSION_CONFIG"
```

---

### Task 6: Frontend — remove hardcoded label maps from lib files

**Files:**
- Modify: `apps/web/src/lib/entity-names.ts`
- Modify: `apps/web/src/lib/game-events.ts`

- [ ] **Step 1: Remove `RESEARCH_NAMES` from `entity-names.ts`**

In `apps/web/src/lib/entity-names.ts` (lines 20-32), delete the `RESEARCH_NAMES` constant. Update `getResearchName` and `getEntityName` to remove the `RESEARCH_NAMES[id]` fallback step. The fallback chain becomes:
1. `config?.research?.[id]?.name` (DB)
2. game-engine constants (if still imported — will be removed in sous-projet 5)
3. `id` (raw ID as last resort)

- [ ] **Step 2: Rewrite `game-events.ts` to use `gameConfig`**

The functions `eventTypeLabel` and `formatEventText` currently use hardcoded maps. They need to accept `gameConfig` (or just `labels: Record<string, string>` and `missions: Record<string, { label: string }>`) as parameters.

Rewrite `eventTypeLabel`:
```ts
export function eventTypeLabel(type: string, labels?: Record<string, string>): string {
  return labels?.[`event.${type}`] ?? type;
}
```

Rewrite `formatEventText` to use `missions` param instead of `MISSION_LABELS`:
```ts
// Replace: const mLabel = MISSION_LABELS[p.missionType] ?? p.missionType;
// With:    const mLabel = missions?.[p.missionType]?.label ?? p.missionType;
```

Delete the `MISSION_LABELS` constant (lines 29-38).

Also fix the `pve-mission-done` branch of `formatEventText` (around line 50): replace the inline `p.missionType === 'pirate' ? 'Pirate' : 'Minage'` with `missions?.[p.missionType]?.label ?? p.missionType`.

Update all callers of `eventTypeLabel` and `formatEventText` to pass `gameConfig.labels` and `gameConfig.missions`.

- [ ] **Step 3: Verify compilation**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/
git commit -m "refactor(web): remove RESEARCH_NAMES and MISSION_LABELS, read from gameConfig"
```

---

### Task 7: Frontend — replace hardcoded label maps in pages

**Files:**
- Modify: `apps/web/src/pages/Reports.tsx`
- Modify: `apps/web/src/pages/History.tsx`
- Modify: `apps/web/src/pages/Overview.tsx`
- Modify: `apps/web/src/pages/Movements.tsx`
- Modify: `apps/web/src/pages/Missions.tsx`
- Modify: `apps/web/src/components/fleet/PveMissionBanner.tsx`
- Modify: `apps/web/src/components/entity-details/ShipDetailContent.tsx`
- Modify: `apps/web/src/components/entity-details/ResearchDetailContent.tsx`
- Modify: `apps/web/src/components/entity-details/BuildingDetailContent.tsx`

- [ ] **Step 1: `Reports.tsx` — replace 3 label maps**

Remove `MISSION_TYPE_LABELS` (lines 10-19). Replace usages with `gameConfig?.missions[type]?.label ?? type`.

Remove `VISIBILITY_LABELS` (lines 281-287). Replace with `gameConfig?.labels[\`spy_visibility.${key}\`] ?? key`.

Remove label strings from `OUTCOME_STYLES` (lines 407-411). Replace with `gameConfig?.labels[\`outcome.${key}\`] ?? key`. Keep the className mappings — those are UI styling, not game data.

Add `const { data: gameConfig } = useGameConfig();` if not already present.

- [ ] **Step 2: `History.tsx` — replace `EVENT_TYPE_OPTIONS`**

Remove `EVENT_TYPE_OPTIONS` (lines 6-14). Derive the options from `gameConfig.labels`:

```ts
const eventTypeOptions = useMemo(() => {
  if (!gameConfig?.labels) return [];
  return Object.entries(gameConfig.labels)
    .filter(([k]) => k.startsWith('event.'))
    .map(([k, label]) => ({ value: k.replace('event.', ''), label }));
}, [gameConfig?.labels]);
```

- [ ] **Step 3: `Overview.tsx` — replace `PHASE_LABELS` and `MISSION_HEX`**

Remove inline `PHASE_LABELS` (line 403). Replace with `gameConfig?.labels[\`phase.${phase}\`] ?? phase`.

Remove inline `MISSION_HEX` (lines 406-409). Replace with `gameConfig?.missions[missionType]?.color ?? '#888'`.

- [ ] **Step 4: `Movements.tsx` — replace `PHASE_STYLE`, `MINE_PHASES`, `DRIVE_LABELS`**

For `PHASE_STYLE` (lines 29-34): keep the styling classes but replace the `label` field with `gameConfig?.labels[\`phase.${key}\`]`. Restructure to separate styling from labels.

For `MINE_PHASES` (lines 70-76): derive from a static key list + `gameConfig.labels`:
```ts
const MINE_PHASE_KEYS = ['outbound', 'prospecting', 'mining', 'return', 'base'] as const;
// In component: MINE_PHASE_KEYS.map(key => ({ key, label: gameConfig?.labels[`phase.${key}`] ?? key }))
```

For `DRIVE_LABELS` (lines 38-42): replace with `gameConfig?.labels[\`drive.${driveType}\`] ?? driveType`.

Also replace `MISSION_STYLE` hex values (lines 18-27): each mission type has a `.hex` field. Replace with `gameConfig?.missions[mission]?.color ?? '#888'`. Keep the CSS class styling (`.classes`, `.dot`) — those are UI-only.

- [ ] **Step 5: `Missions.tsx` — replace `TIER_LABELS`**

Remove `TIER_LABELS` (lines 8-12). Replace usages with `gameConfig?.labels[\`tier.${tier}\`] ?? tier`. **Keep `TIER_COLORS`** (lines 14-18) — those are CSS class mappings, not game data.

- [ ] **Step 6: `PveMissionBanner.tsx` — replace `DIFFICULTY_LABELS`**

Remove `DIFFICULTY_LABELS` (lines 14-18). Replace with `gameConfig?.labels[\`tier.${difficulty}\`] ?? difficulty`. **Keep `DIFFICULTY_COLORS`** (lines 8-12) — those are CSS class mappings, not game data.

- [ ] **Step 7: `ShipDetailContent.tsx` — replace `DRIVE_LABELS`**

Remove `DRIVE_LABELS` (lines 10-14). Replace on line 138 with `gameConfig?.labels[\`drive.${details.stats.driveType}\`] ?? details.stats.driveType`. The component already has `gameConfig` available.

- [ ] **Step 8: `ResearchDetailContent.tsx` — replace `STAT_LABELS` and `DRIVE_LABELS`**

Remove `STAT_LABELS` (lines 7-20). Replace usages with:
- For bonus stat labels: read from `bonus.statLabel ?? bonus.stat` (the `statLabel` field we added)
- The `gameConfig.bonuses` array now carries `statLabel`

Remove `DRIVE_LABELS` (lines 22-26). Replace with `gameConfig?.labels[\`drive.${driveType}\`] ?? driveType`.

- [ ] **Step 9: `BuildingDetailContent.tsx` — replace `STAT_LABELS`**

Remove the inline `STAT_LABELS` in the `useMemo` (lines 145-151). Replace with `bonus.statLabel ?? bonus.stat` from the bonus config.

- [ ] **Step 10: Verify compilation**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/
git commit -m "refactor(web): replace all hardcoded label maps with gameConfig data"
```

---

### Task 8: Admin — new Missions page

**Files:**
- Create: `apps/admin/src/pages/Missions.tsx`
- Modify: `apps/admin/src/router.tsx`
- Modify: `apps/admin/src/components/layout/AdminLayout.tsx`

- [ ] **Step 1: Create `Missions.tsx`**

Follow the `PlanetTypes.tsx` CRUD pattern. The page manages `mission_definitions` via tRPC.

Key fields for `EditModal`:

```ts
const FIELDS: Field[] = [
  { key: 'id', label: 'ID', type: 'text' },
  { key: 'label', label: 'Label', type: 'text' },
  { key: 'hint', label: 'Description', type: 'textarea' },
  { key: 'buttonLabel', label: 'Bouton', type: 'text' },
  { key: 'color', label: 'Couleur (hex)', type: 'text' },
  { key: 'sortOrder', label: 'Ordre', type: 'number' },
];
```

Note: behavioral fields (`dangerous`, `exclusive`, `requiredShipRoles`, etc.) are displayed as read-only columns in the table for now. Full editing via EditModal would require a `boolean` field type and a JSON editor — keep it simple for this iteration. The admin can edit them via direct DB or a future enhancement.

Table columns: ID, Label, Hint (truncated), Button, Color (with swatch), Order, Actions.

Default form:
```ts
function defaultForm() {
  return { id: '', label: '', hint: '', buttonLabel: '', color: '#888888', sortOrder: '0' };
}
```

- [ ] **Step 2: Add route in `router.tsx`**

Add to the `children` array:

```ts
{ path: 'missions', lazy: () => import('./pages/Missions').then((m) => ({ Component: m.default })) },
```

- [ ] **Step 3: Add nav entry in `AdminLayout.tsx`**

Add to the "Config Jeu" section in `NAV_SECTIONS`:

```ts
{ to: '/missions', label: 'Missions', icon: Rocket },
```

Import `Rocket` from `lucide-react`.

- [ ] **Step 4: Verify compilation**

Run: `cd apps/admin && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/
git commit -m "feat(admin): add Missions management page"
```

---

### Task 9: Admin — new Labels page

**Files:**
- Create: `apps/admin/src/pages/Labels.tsx`
- Modify: `apps/admin/src/router.tsx`
- Modify: `apps/admin/src/components/layout/AdminLayout.tsx`

- [ ] **Step 1: Create `Labels.tsx`**

Simple CRUD page for `ui_labels`. Two fields: `key` (text PK) and `label` (text).

```ts
const FIELDS: Field[] = [
  { key: 'key', label: 'Clé', type: 'text' },
  { key: 'label', label: 'Label', type: 'text' },
];

function defaultForm() {
  return { key: '', label: '' };
}
```

Table: group labels visually by prefix (drive.*, phase.*, tier.*, event.*, spy_visibility.*, outcome.*).

Mutations: `createLabel`, `updateLabel`, `deleteLabel` — note the `key` field is the PK (not `id`), so the mutation shape is slightly different: `updateLabel({ key, data: { label } })`.

- [ ] **Step 2: Add route in `router.tsx`**

```ts
{ path: 'labels', lazy: () => import('./pages/Labels').then((m) => ({ Component: m.default })) },
```

- [ ] **Step 3: Add nav entry in `AdminLayout.tsx`**

Add to the "Config Jeu" section:

```ts
{ to: '/labels', label: 'Labels', icon: Tag },
```

Import `Tag` from `lucide-react`.

- [ ] **Step 4: Verify compilation**

Run: `cd apps/admin && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/
git commit -m "feat(admin): add Labels management page"
```

---

### Task 10: Admin — replace STAT_OPTIONS and CONDITION_LABELS with gameConfig data

**Files:**
- Modify: `apps/admin/src/pages/Buildings.tsx`
- Modify: `apps/admin/src/pages/Research.tsx`
- Modify: `apps/admin/src/pages/TutorialQuests.tsx`

- [ ] **Step 1: `Buildings.tsx` — derive `STAT_OPTIONS` from gameConfig**

Remove the hardcoded `STAT_OPTIONS` (lines 11-26). Replace with dynamic computation from `gameConfig.bonuses`:

```ts
const statOptions = useMemo(() => {
  if (!data?.bonuses) return [];
  const seen = new Map<string, string>();
  for (const b of data.bonuses) {
    if (!seen.has(b.stat)) {
      seen.set(b.stat, b.statLabel ?? b.stat);
    }
  }
  return Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
}, [data?.bonuses]);
```

Replace all references to `STAT_OPTIONS` with `statOptions`.

**Note:** The hardcoded `STAT_OPTIONS` included 4 entries (`mining_duration`, `cargo_capacity`, `fuel_consumption`, `resource_production`) that have no corresponding bonus row in the seed. These entries were never used in practice (no bonus definition uses them) and are intentionally dropped. The dynamic derivation only shows stats that actually exist as bonuses in the DB.

- [ ] **Step 2: `Research.tsx` — same replacement**

Apply the same change as Buildings.tsx. Remove `STAT_OPTIONS` (lines 11-26), replace with the `useMemo` derivation.

- [ ] **Step 3: `TutorialQuests.tsx` — derive condition labels from gameConfig + make editable**

Remove `CONDITION_LABELS` (lines 9-13). Replace usages in the table cell with `quest.conditionLabel ?? quest.conditionType`.

Add `conditionLabel` to the `FIELDS` and `EDIT_FIELDS` arrays:
```ts
{ key: 'conditionLabel', label: 'Label condition', type: 'text' },
```

Add `conditionLabel` to `defaultForm()`, `questToForm()`, `formToCreateData()`, and `formToUpdateData()` helper functions so the field flows through create/edit correctly.

- [ ] **Step 4: Verify compilation**

Run: `cd apps/admin && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/pages/
git commit -m "refactor(admin): replace hardcoded STAT_OPTIONS and CONDITION_LABELS with gameConfig data"
```

---

### Task 11: Final verification and push

- [ ] **Step 1: Full compilation check**

```bash
cd /Users/julienaubree/_projet/ogame-clone
npx tsc --noEmit -p apps/web/tsconfig.json
npx tsc --noEmit -p apps/api/tsconfig.json
npx tsc --noEmit -p apps/admin/tsconfig.json
```

Expected: All pass with no errors.

- [ ] **Step 2: Lint check**

```bash
npx eslint apps/web/src/ apps/admin/src/ apps/api/src/ --ext .ts,.tsx
```

Fix any lint issues.

- [ ] **Step 3: Push all commits**

```bash
git push
```
