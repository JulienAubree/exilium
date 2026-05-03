# Système de Modules Vaisseau Amiral — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer l'arbre de talents flagship par un système de **9 modules à slots** (5 communs + 3 rares + 1 épique) lootés via anomalies, avec migration + refund Exilium des joueurs existants.

**Architecture :** Tables `module_definitions` (catalog) + `flagship_module_inventory` (collection) + colonnes jsonb sur `flagships` (loadout actif) et `anomalies` (snapshot). Engine pur dans `@exilium/game-engine` pour appliquer les effets. API tRPC standard. Front pattern master/detail réutilisé de l'admin Anomalies. Migration en 2 étapes (créer+seed+refund+starter, puis rename legacy plus tard).

**Tech Stack :** Drizzle/Postgres, tRPC 11, React 19, Vite 6, vitest, Zod, sharp pour upload images.

**Spec source :** `docs/superpowers/specs/2026-05-02-flagship-modules-design.md`

---

## File Structure

### Files to CREATE

| Path | Responsabilité |
|---|---|
| `packages/db/drizzle/0068_modules_init.sql` | Création tables modules + colonnes flagships/anomalies |
| `packages/db/src/schema/module-definitions.ts` | Drizzle schema for `module_definitions` |
| `packages/db/src/schema/flagship-module-inventory.ts` | Drizzle schema for `flagship_module_inventory` |
| `packages/game-engine/src/formulas/modules.ts` | Pure functions: parse loadout, apply effects, charges, abilities |
| `packages/game-engine/src/formulas/modules.test.ts` | 15-20 unit tests |
| `apps/api/src/modules/modules/modules.types.ts` | Zod schemas + ModuleEffect union |
| `apps/api/src/modules/modules/default-modules.seed.ts` | 57 modules seed array |
| `apps/api/src/modules/modules/modules.service.ts` | Inventory/loadout CRUD + drop rolls |
| `apps/api/src/modules/modules/modules.router.ts` | tRPC router |
| `apps/api/src/modules/modules/__tests__/modules.service.test.ts` | Service tests |
| `apps/api/src/scripts/migrate-talents-to-modules.ts` | One-off refund + starter script |
| `apps/admin/src/pages/Modules.tsx` | Admin master/detail page |
| `apps/admin/src/components/ui/ModuleImageSlot.tsx` | Image upload widget |
| `apps/web/src/components/flagship/ModuleLoadoutGrid.tsx` | Silhouette + 9 slots |
| `apps/web/src/components/flagship/ModuleSlot.tsx` | 1 slot (vide ou occupé) |
| `apps/web/src/components/flagship/ModuleInventoryPanel.tsx` | Liste filtrable |
| `apps/web/src/components/flagship/ModuleDetailModal.tsx` | Détail au clic |
| `apps/web/src/components/flagship/ModuleHullTabs.tsx` | Tabs entre coques |
| `apps/web/src/components/anomaly/AnomalyLootSummaryModal.tsx` | Butin de fin de run |

### Files to MODIFY

| Path | Changement |
|---|---|
| `packages/db/src/schema/flagships.ts` | +3 colonnes (loadout, charges) |
| `packages/db/src/schema/anomalies.ts` | +2 colonnes (equipped_modules, pending_epic_effect) |
| `packages/db/src/schema/index.ts` | Export new schemas |
| `packages/shared/src/utils/assets.ts` | Add 'module' to AssetCategory |
| `apps/api/src/lib/image-processing.ts` | +processModuleImage |
| `apps/api/src/modules/admin/asset-upload.route.ts` | +'module' case |
| `apps/api/src/trpc/app-router.ts` | Wire modulesService + modulesRouter |
| `apps/api/src/modules/anomaly/anomaly.service.ts` | Snapshot loadout, drops, applyModules |
| `apps/api/src/modules/anomaly/anomaly.router.ts` | Add `activateEpic` mutation |
| `apps/api/src/modules/flagship/flagship.service.ts` | Return loadout + charges in get() |
| `apps/web/src/pages/Flagship.tsx` | Remove TalentsTab, add ModulesTab |
| `apps/web/src/pages/Anomaly.tsx` | Show loadout in hero, mount loot summary modal |
| `apps/admin/src/router.tsx` | Add /modules route |
| `apps/admin/src/components/layout/AdminLayout.tsx` | Add Modules nav entry |
| `Caddyfile` | Add /assets/module/* to @game_assets matcher |

---

## Task 1 : Migration DB + schémas Drizzle

**Files :**
- Create: `packages/db/drizzle/0068_modules_init.sql`
- Create: `packages/db/src/schema/module-definitions.ts`
- Create: `packages/db/src/schema/flagship-module-inventory.ts`
- Modify: `packages/db/src/schema/flagships.ts`
- Modify: `packages/db/src/schema/anomalies.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Write the migration SQL**

Create `packages/db/drizzle/0068_modules_init.sql`:

```sql
-- Catalog of available modules (admin-edited)
CREATE TABLE IF NOT EXISTS module_definitions (
  id           VARCHAR(64) PRIMARY KEY,
  hull_id      VARCHAR(32) NOT NULL,
  rarity       VARCHAR(16) NOT NULL,
  name         VARCHAR(80) NOT NULL,
  description  TEXT NOT NULL,
  image        VARCHAR(500) NOT NULL DEFAULT '',
  enabled      BOOLEAN NOT NULL DEFAULT true,
  effect       JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_module_rarity CHECK (rarity IN ('common', 'rare', 'epic')),
  CONSTRAINT chk_module_hull CHECK (hull_id IN ('combat', 'scientific', 'industrial'))
);
CREATE INDEX IF NOT EXISTS idx_modules_hull_rarity ON module_definitions(hull_id, rarity) WHERE enabled = true;

-- Player inventory of collected modules (with duplicates)
CREATE TABLE IF NOT EXISTS flagship_module_inventory (
  flagship_id  UUID NOT NULL REFERENCES flagships(id) ON DELETE CASCADE,
  module_id    VARCHAR(64) NOT NULL REFERENCES module_definitions(id) ON DELETE CASCADE,
  count        SMALLINT NOT NULL DEFAULT 1 CHECK (count > 0),
  acquired_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (flagship_id, module_id)
);

-- New columns on flagships for loadout + epic charges
ALTER TABLE flagships
  ADD COLUMN IF NOT EXISTS module_loadout JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS epic_charges_current SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS epic_charges_max SMALLINT NOT NULL DEFAULT 1;

-- New columns on anomalies for in-run snapshot + pending epic effect
ALTER TABLE anomalies
  ADD COLUMN IF NOT EXISTS equipped_modules JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS pending_epic_effect JSONB;

-- Tracking table for one-off scripts (refund idempotence marker)
CREATE TABLE IF NOT EXISTS _migrations_state (
  key   VARCHAR(64) PRIMARY KEY,
  value TEXT NOT NULL,
  set_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: Apply the migration on staging to verify**

Run: `DATABASE_URL=$STAGING_DATABASE_URL /opt/exilium/scripts/apply-migrations.sh`

Expected output: `Applied 0068_modules_init.sql`. No errors.

- [ ] **Step 3: Write the Drizzle schema for module_definitions**

Create `packages/db/src/schema/module-definitions.ts`:

```ts
import { pgTable, varchar, text, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const moduleDefinitions = pgTable('module_definitions', {
  id:          varchar('id', { length: 64 }).primaryKey(),
  hullId:      varchar('hull_id', { length: 32 }).notNull(),
  rarity:      varchar('rarity', { length: 16 }).notNull(),
  name:        varchar('name', { length: 80 }).notNull(),
  description: text('description').notNull(),
  image:       varchar('image', { length: 500 }).notNull().default(''),
  enabled:     boolean('enabled').notNull().default(true),
  effect:      jsonb('effect').notNull(),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ModuleDefinitionRow = typeof moduleDefinitions.$inferSelect;
```

- [ ] **Step 4: Write the Drizzle schema for flagship_module_inventory**

Create `packages/db/src/schema/flagship-module-inventory.ts`:

```ts
import { pgTable, uuid, varchar, smallint, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { flagships } from './flagships.js';
import { moduleDefinitions } from './module-definitions.js';

export const flagshipModuleInventory = pgTable('flagship_module_inventory', {
  flagshipId:  uuid('flagship_id').notNull().references(() => flagships.id, { onDelete: 'cascade' }),
  moduleId:    varchar('module_id', { length: 64 }).notNull().references(() => moduleDefinitions.id, { onDelete: 'cascade' }),
  count:       smallint('count').notNull().default(1),
  acquiredAt:  timestamp('acquired_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.flagshipId, table.moduleId] }),
}));

export type FlagshipModuleInventoryRow = typeof flagshipModuleInventory.$inferSelect;
```

- [ ] **Step 5: Add new columns to flagships schema**

Modify `packages/db/src/schema/flagships.ts` — add 3 new columns at the bottom of the column list (before the indexes):

```ts
  moduleLoadout:        jsonb('module_loadout').notNull().default(sql`'{}'::jsonb`),
  epicChargesCurrent:   smallint('epic_charges_current').notNull().default(0),
  epicChargesMax:       smallint('epic_charges_max').notNull().default(1),
```

Make sure `smallint`, `jsonb` and `sql` are imported at the top.

- [ ] **Step 6: Add new columns to anomalies schema**

Modify `packages/db/src/schema/anomalies.ts` — add 2 columns at the bottom of the column list:

```ts
  equippedModules:    jsonb('equipped_modules').notNull().default(sql`'{}'::jsonb`),
  pendingEpicEffect:  jsonb('pending_epic_effect'),
```

- [ ] **Step 7: Export new schemas in index**

Modify `packages/db/src/schema/index.ts` — add the new exports alphabetically:

```ts
export * from './module-definitions.js';
export * from './flagship-module-inventory.js';
```

- [ ] **Step 8: Build the db package and run typecheck**

Run: `pnpm turbo build typecheck --filter=@exilium/db`
Expected: 2 successful tasks, no errors.

- [ ] **Step 9: Commit**

```bash
git add packages/db/drizzle/0068_modules_init.sql packages/db/src/schema/
git commit -m "$(cat <<'EOF'
feat(db): schémas modules + colonnes loadout/charges flagships+anomalies

Migration 0068 :
- Table module_definitions (catalog admin-edited)
- Table flagship_module_inventory (collection avec duplicates)
- Colonnes flagships : module_loadout, epic_charges_current, epic_charges_max
- Colonnes anomalies : equipped_modules (snapshot), pending_epic_effect
- Table _migrations_state (idempotence des scripts one-off)

Sub-projet 1/5 de la refonte Anomalie & Flagship.
EOF
)"
```

---

## Task 2 : Game engine — modules.ts + tests

**Files:**
- Create: `packages/game-engine/src/formulas/modules.ts`
- Create: `packages/game-engine/src/formulas/modules.test.ts`
- Modify: `packages/game-engine/src/index.ts` (export modules)

- [ ] **Step 1: Write the failing test for parseLoadout**

Create `packages/game-engine/src/formulas/modules.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseLoadout, applyModulesToStats, getMaxCharges, type ModuleDefinitionLite } from './modules.js';

const POOL: ModuleDefinitionLite[] = [
  { id: 'm1', hullId: 'combat', rarity: 'common', enabled: true, effect: { type: 'stat', stat: 'damage', value: 0.05 } },
  { id: 'm2', hullId: 'combat', rarity: 'rare', enabled: true, effect: { type: 'stat', stat: 'hull', value: 0.20 } },
  { id: 'm3', hullId: 'combat', rarity: 'epic', enabled: true, effect: { type: 'active', ability: 'repair', magnitude: 0.50 } },
  { id: 'm4', hullId: 'combat', rarity: 'rare', enabled: true, effect: { type: 'stat', stat: 'epic_charges_max', value: 1 } },
  { id: 'disabled', hullId: 'combat', rarity: 'common', enabled: false, effect: { type: 'stat', stat: 'damage', value: 0.10 } },
];

describe('parseLoadout', () => {
  it('résout les ids vers les définitions complètes', () => {
    const loadout = { combat: { epic: 'm3', rare: ['m2'], common: ['m1'] } };
    const result = parseLoadout(loadout, 'combat', POOL);
    expect(result.equipped.map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
  });

  it('ignore les ids inconnus (silencieux)', () => {
    const loadout = { combat: { epic: 'unknown', rare: ['m2'], common: [] } };
    const result = parseLoadout(loadout, 'combat', POOL);
    expect(result.equipped.map((m) => m.id)).toEqual(['m2']);
  });

  it('ignore les modules disabled', () => {
    const loadout = { combat: { epic: null, rare: [], common: ['disabled', 'm1'] } };
    const result = parseLoadout(loadout, 'combat', POOL);
    expect(result.equipped.map((m) => m.id)).toEqual(['m1']);
  });

  it('retourne loadout vide pour coque inconnue', () => {
    const result = parseLoadout({ combat: { epic: 'm3', rare: [], common: [] } }, 'scientific', POOL);
    expect(result.equipped).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @exilium/game-engine test modules.test.ts`
Expected: FAIL with "Cannot find module './modules.js'"

- [ ] **Step 3: Create modules.ts with types and parseLoadout**

Create `packages/game-engine/src/formulas/modules.ts`:

```ts
/**
 * Pure formulas for the Flagship Modules system.
 * All inputs/outputs are plain data — no DB, no I/O.
 */

export type StatKey =
  | 'damage' | 'hull' | 'shield' | 'armor' | 'cargo' | 'speed' | 'regen' | 'epic_charges_max';

export type TriggerKey = 'first_round' | 'low_hull' | 'enemy_fp_above' | 'last_round';

export type AbilityKey =
  | 'repair' | 'shield_burst' | 'overcharge' | 'scan' | 'skip' | 'damage_burst';

export type ModuleEffect =
  | { type: 'stat'; stat: StatKey; value: number }
  | { type: 'conditional'; trigger: TriggerKey; threshold?: number;
      effect: { stat: StatKey; value: number } }
  | { type: 'active'; ability: AbilityKey; magnitude: number };

export interface ModuleDefinitionLite {
  id: string;
  hullId: string;
  rarity: 'common' | 'rare' | 'epic';
  enabled: boolean;
  effect: ModuleEffect;
}

export interface HullSlot {
  epic: string | null;
  rare: string[];
  common: string[];
}

export type ModuleLoadout = Partial<Record<string, HullSlot>>;

export interface ParsedLoadout {
  equipped: ModuleDefinitionLite[];
}

/**
 * Resolve a loadout (ids) to actual module definitions for one hull.
 * Silently ignores unknown ids and disabled modules.
 */
export function parseLoadout(
  loadout: ModuleLoadout,
  hullId: string,
  pool: ModuleDefinitionLite[],
): ParsedLoadout {
  const slot = loadout[hullId];
  if (!slot) return { equipped: [] };

  const ids: string[] = [
    ...(slot.epic ? [slot.epic] : []),
    ...(slot.rare ?? []),
    ...(slot.common ?? []),
  ];

  const byId = new Map(pool.map((m) => [m.id, m] as const));
  const equipped = ids
    .map((id) => byId.get(id))
    .filter((m): m is ModuleDefinitionLite => m !== undefined && m.enabled);

  return { equipped };
}
```

- [ ] **Step 4: Add export to game-engine index**

Modify `packages/game-engine/src/index.ts` — add line near `anomaly-events`:

```ts
export * from './formulas/modules.js';
```

- [ ] **Step 5: Run parseLoadout tests**

Run: `pnpm --filter @exilium/game-engine test modules.test.ts`
Expected: 4 PASS in `parseLoadout` block.

- [ ] **Step 6: Add tests for applyModulesToStats**

Append to `packages/game-engine/src/formulas/modules.test.ts`:

```ts
describe('applyModulesToStats', () => {
  const baseStats = { damage: 100, hull: 1000, shield: 200, armor: 50, cargo: 5000, speed: 100, regen: 0 };
  const ctx = { roundIndex: 1, currentHullPercent: 1.0, enemyFP: 500, pendingEpicEffect: null };

  it('applique stat passive additif', () => {
    const r = applyModulesToStats(baseStats, [
      { id: 'a', hullId: 'combat', rarity: 'common', enabled: true, effect: { type: 'stat', stat: 'damage', value: 0.10 } },
    ], ctx);
    expect(r.damage).toBeCloseTo(110); // +10%
  });

  it('stack additif simple', () => {
    const r = applyModulesToStats(baseStats, [
      { id: 'a', hullId: 'combat', rarity: 'common', enabled: true, effect: { type: 'stat', stat: 'damage', value: 0.05 } },
      { id: 'b', hullId: 'combat', rarity: 'common', enabled: true, effect: { type: 'stat', stat: 'damage', value: 0.05 } },
      { id: 'c', hullId: 'combat', rarity: 'rare', enabled: true, effect: { type: 'stat', stat: 'damage', value: 0.20 } },
    ], ctx);
    expect(r.damage).toBeCloseTo(130); // 100 × (1 + 0.05+0.05+0.20)
  });

  it('conditional first_round déclenché à round 1', () => {
    const r = applyModulesToStats(baseStats, [
      { id: 'fr', hullId: 'combat', rarity: 'rare', enabled: true,
        effect: { type: 'conditional', trigger: 'first_round',
          effect: { stat: 'damage', value: 0.50 } } },
    ], { ...ctx, roundIndex: 1 });
    expect(r.damage).toBeCloseTo(150);
  });

  it('conditional first_round NON déclenché à round 2', () => {
    const r = applyModulesToStats(baseStats, [
      { id: 'fr', hullId: 'combat', rarity: 'rare', enabled: true,
        effect: { type: 'conditional', trigger: 'first_round',
          effect: { stat: 'damage', value: 0.50 } } },
    ], { ...ctx, roundIndex: 2 });
    expect(r.damage).toBe(100);
  });

  it('conditional low_hull avec threshold déclenché', () => {
    const r = applyModulesToStats(baseStats, [
      { id: 'lh', hullId: 'combat', rarity: 'rare', enabled: true,
        effect: { type: 'conditional', trigger: 'low_hull', threshold: 0.30,
          effect: { stat: 'shield', value: 0.20 } } },
    ], { ...ctx, currentHullPercent: 0.25 });
    expect(r.shield).toBeCloseTo(240); // +20%
  });

  it('conditional low_hull NON déclenché si hull > threshold', () => {
    const r = applyModulesToStats(baseStats, [
      { id: 'lh', hullId: 'combat', rarity: 'rare', enabled: true,
        effect: { type: 'conditional', trigger: 'low_hull', threshold: 0.30,
          effect: { stat: 'shield', value: 0.20 } } },
    ], { ...ctx, currentHullPercent: 0.50 });
    expect(r.shield).toBe(200);
  });

  it('active effect ignoré (utilisé seulement via resolveActiveAbility)', () => {
    const r = applyModulesToStats(baseStats, [
      { id: 'ac', hullId: 'combat', rarity: 'epic', enabled: true,
        effect: { type: 'active', ability: 'repair', magnitude: 0.50 } },
    ], ctx);
    expect(r).toEqual(baseStats); // no change from active alone
  });

  it('épique pending overcharge appliqué via context', () => {
    const r = applyModulesToStats(baseStats, [], {
      ...ctx,
      pendingEpicEffect: { ability: 'overcharge', magnitude: 1.0 },
    });
    expect(r.damage).toBeCloseTo(200); // +100%
  });
});

describe('getMaxCharges', () => {
  it('baseline 1 sans bonus', () => {
    expect(getMaxCharges([])).toBe(1);
  });
  it('+1 par module epic_charges_max', () => {
    const r = getMaxCharges([
      { id: 's', hullId: 'combat', rarity: 'rare', enabled: true,
        effect: { type: 'stat', stat: 'epic_charges_max', value: 1 } },
    ]);
    expect(r).toBe(2);
  });
  it('cap à 3 même avec stack', () => {
    const r = getMaxCharges([
      { id: 's1', hullId: 'combat', rarity: 'rare', enabled: true,
        effect: { type: 'stat', stat: 'epic_charges_max', value: 1 } },
      { id: 's2', hullId: 'combat', rarity: 'rare', enabled: true,
        effect: { type: 'stat', stat: 'epic_charges_max', value: 1 } },
      { id: 's3', hullId: 'combat', rarity: 'rare', enabled: true,
        effect: { type: 'stat', stat: 'epic_charges_max', value: 1 } },
    ]);
    expect(r).toBe(3); // cap, not 4
  });
});
```

- [ ] **Step 7: Run tests to verify they fail**

Run: `pnpm --filter @exilium/game-engine test modules.test.ts`
Expected: FAIL with "applyModulesToStats is not defined" or similar.

- [ ] **Step 8: Implement applyModulesToStats and getMaxCharges**

Append to `packages/game-engine/src/formulas/modules.ts`:

```ts
export interface CombatStats {
  damage: number;
  hull: number;
  shield: number;
  armor: number;
  cargo: number;
  speed: number;
  regen: number;
}

export interface CombatContext {
  /** 1-based current round (1 = first round). */
  roundIndex: number;
  /** Current hull percentage (0..1) of the flagship. */
  currentHullPercent: number;
  /** FP of the current enemy fleet, for `enemy_fp_above` conditional. */
  enemyFP: number;
  /** Pending epic effect from a previously-activated ability. */
  pendingEpicEffect: { ability: AbilityKey; magnitude: number } | null;
}

const MAX_EPIC_CHARGES = 3;

/**
 * Apply all module effects (stat passives + conditionals + pending epic
 * effect) to the base flagship stats. Pure function — does not mutate.
 *
 * Active effects (`type: 'active'`) are NOT applied here; they're
 * resolved via the dedicated activation path which sets
 * `context.pendingEpicEffect` for the affected combat.
 */
export function applyModulesToStats(
  baseStats: CombatStats,
  modules: ModuleDefinitionLite[],
  context: CombatContext,
): CombatStats {
  const out = { ...baseStats };

  // Sum additive bonuses per stat across all modules.
  const bonusByStat: Record<string, number> = {};

  for (const m of modules) {
    if (m.effect.type === 'stat') {
      // epic_charges_max is handled separately via getMaxCharges
      if (m.effect.stat === 'epic_charges_max') continue;
      bonusByStat[m.effect.stat] = (bonusByStat[m.effect.stat] ?? 0) + m.effect.value;
    } else if (m.effect.type === 'conditional') {
      const fires = checkTrigger(m.effect.trigger, m.effect.threshold, context);
      if (fires) {
        const { stat, value } = m.effect.effect;
        bonusByStat[stat] = (bonusByStat[stat] ?? 0) + value;
      }
    }
    // active modules are ignored here (handled via pendingEpicEffect)
  }

  // Apply pending epic effect on top.
  if (context.pendingEpicEffect) {
    const eff = context.pendingEpicEffect;
    if (eff.ability === 'overcharge' || eff.ability === 'damage_burst') {
      bonusByStat['damage'] = (bonusByStat['damage'] ?? 0) + eff.magnitude;
    } else if (eff.ability === 'shield_burst') {
      bonusByStat['shield'] = (bonusByStat['shield'] ?? 0) + eff.magnitude;
    }
    // 'repair' / 'scan' / 'skip' are immediate or non-stat — handled in service
  }

  for (const [stat, bonus] of Object.entries(bonusByStat)) {
    if (stat in out) {
      out[stat as keyof CombatStats] = out[stat as keyof CombatStats] * (1 + bonus);
    }
  }

  return out;
}

function checkTrigger(
  trigger: TriggerKey,
  threshold: number | undefined,
  context: CombatContext,
): boolean {
  switch (trigger) {
    case 'first_round': return context.roundIndex === 1;
    case 'last_round':  return context.roundIndex >= 4; // matches combat_max_rounds default
    case 'low_hull':    return context.currentHullPercent <= (threshold ?? 0.30);
    case 'enemy_fp_above': return context.enemyFP > (threshold ?? 0);
    default: return false;
  }
}

/**
 * Compute the maximum epic charges for a loadout. Baseline 1, +1 per
 * module that boosts `epic_charges_max`, hard-capped at 3.
 */
export function getMaxCharges(modules: ModuleDefinitionLite[]): number {
  let bonus = 0;
  for (const m of modules) {
    if (m.effect.type === 'stat' && m.effect.stat === 'epic_charges_max') {
      bonus += m.effect.value;
    }
  }
  return Math.min(MAX_EPIC_CHARGES, 1 + bonus);
}

/**
 * Resolve an active ability into an applied effect descriptor.
 * The actual mutation (e.g. fleet hullPercent += 0.5) happens in
 * the anomaly service, this just classifies the ability for routing.
 */
export interface ActiveAbilityResult {
  ability: AbilityKey;
  magnitude: number;
  /** 'immediate' = mutate state now, 'pending' = persist for next combat */
  applied: 'immediate' | 'pending';
}

export function resolveActiveAbility(
  ability: AbilityKey,
  magnitude: number,
): ActiveAbilityResult {
  // repair, scan, skip → immediate (mutate fleet/anomaly state now)
  // overcharge, shield_burst, damage_burst → pending (apply to next combat)
  const immediate: AbilityKey[] = ['repair', 'scan', 'skip'];
  return {
    ability,
    magnitude,
    applied: immediate.includes(ability) ? 'immediate' : 'pending',
  };
}
```

- [ ] **Step 9: Run all module tests**

Run: `pnpm --filter @exilium/game-engine test modules.test.ts`
Expected: All tests PASS (~15 tests).

- [ ] **Step 10: Run full game-engine test suite to ensure no regression**

Run: `pnpm turbo test --filter=@exilium/game-engine`
Expected: All previous tests still pass + 15 new ones.

- [ ] **Step 11: Commit**

```bash
git add packages/game-engine/src/formulas/modules.ts packages/game-engine/src/formulas/modules.test.ts packages/game-engine/src/index.ts
git commit -m "$(cat <<'EOF'
feat(engine): formules pures pour modules flagship + 15 tests

- parseLoadout : résout ids → définitions, ignore unknown/disabled
- applyModulesToStats : stat passives additif + conditionnels (first_round,
  low_hull, enemy_fp_above, last_round) + pendingEpicEffect
- getMaxCharges : baseline 1, +1 par module epic_charges_max, cap 3
- resolveActiveAbility : classifie immediate vs pending
EOF
)"
```

---

## Task 3 : Module Zod types + 57 default modules seed

**Files :**
- Create: `apps/api/src/modules/modules/modules.types.ts`
- Create: `apps/api/src/modules/modules/default-modules.seed.ts`

- [ ] **Step 1: Write Zod schemas for ModuleEffect**

Create `apps/api/src/modules/modules/modules.types.ts`:

```ts
import { z } from 'zod';
import type { StatKey, TriggerKey, AbilityKey } from '@exilium/game-engine';

const STAT_KEYS = ['damage', 'hull', 'shield', 'armor', 'cargo', 'speed', 'regen', 'epic_charges_max'] as const satisfies readonly StatKey[];
const TRIGGER_KEYS = ['first_round', 'low_hull', 'enemy_fp_above', 'last_round'] as const satisfies readonly TriggerKey[];
const ABILITY_KEYS = ['repair', 'shield_burst', 'overcharge', 'scan', 'skip', 'damage_burst'] as const satisfies readonly AbilityKey[];

const HULL_IDS = ['combat', 'scientific', 'industrial'] as const;
const RARITIES = ['common', 'rare', 'epic'] as const;

export const moduleEffectSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('stat'),
    stat: z.enum(STAT_KEYS),
    value: z.number(),
  }),
  z.object({
    type: z.literal('conditional'),
    trigger: z.enum(TRIGGER_KEYS),
    threshold: z.number().optional(),
    effect: z.object({
      stat: z.enum(STAT_KEYS),
      value: z.number(),
    }),
  }),
  z.object({
    type: z.literal('active'),
    ability: z.enum(ABILITY_KEYS),
    magnitude: z.number(),
  }),
]);

export const moduleDefinitionSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/, 'id must be kebab-case'),
  hullId: z.enum(HULL_IDS),
  rarity: z.enum(RARITIES),
  name: z.string().min(1).max(80),
  description: z.string().min(1),
  image: z.string().max(500).default(''),
  enabled: z.boolean().default(true),
  effect: moduleEffectSchema,
});

export type ModuleDefinitionInput = z.input<typeof moduleDefinitionSchema>;
export type ModuleDefinition = z.infer<typeof moduleDefinitionSchema>;

export const HULL_LIST = HULL_IDS;
export const RARITY_LIST = RARITIES;

// Loadout shape persisted on flagships.module_loadout.
export const hullSlotSchema = z.object({
  epic:   z.string().nullable(),
  rare:   z.array(z.string()).max(3),
  common: z.array(z.string()).max(5),
});

export const moduleLoadoutSchema = z.object({
  combat:     hullSlotSchema.optional(),
  scientific: hullSlotSchema.optional(),
  industrial: hullSlotSchema.optional(),
});

export type ModuleLoadoutDb = z.infer<typeof moduleLoadoutSchema>;
```

- [ ] **Step 2: Write the 57 default modules seed**

Create `apps/api/src/modules/modules/default-modules.seed.ts`:

```ts
import type { ModuleDefinitionInput } from './modules.types.js';

/**
 * Initial pool of 57 modules — 19 per hull (10 communs + 6 rares + 3 épiques).
 * Edited via the admin UI after deploy. Seed is the source of truth at
 * first install + on re-seed for new envs.
 *
 * Conventions :
 *   - id : kebab-case `<hull>-<short-name>`. Stable across versions.
 *   - description : 1-2 phrases flavor text + chiffre clé.
 *   - effect : typed by Zod (stat / conditional / active).
 */
export const DEFAULT_MODULES: ModuleDefinitionInput[] = [
  // ─── COMBAT (10C / 6R / 3E) ────────────────────────────────────────────
  // Communs
  { id: 'combat-armored-plating',     hullId: 'combat', rarity: 'common',
    name: 'Plaque blindée standard', description: 'Renforcement de la coque par plaque blindée légère. +5% hull.',
    effect: { type: 'stat', stat: 'hull', value: 0.05 } },
  { id: 'combat-power-converter',     hullId: 'combat', rarity: 'common',
    name: 'Convertisseur de puissance', description: 'Optimise la décharge des canons. +8% damage.',
    effect: { type: 'stat', stat: 'damage', value: 0.08 } },
  { id: 'combat-reinforced-shield',   hullId: 'combat', rarity: 'common',
    name: 'Bouclier renforcé', description: 'Capacité supplémentaire de bouclier réactif. +7% shield.',
    effect: { type: 'stat', stat: 'shield', value: 0.07 } },
  { id: 'combat-targeting-stabilizer', hullId: 'combat', rarity: 'common',
    name: 'Stabilisateur de visée', description: 'Améliore la précision des canons. +5% damage.',
    effect: { type: 'stat', stat: 'damage', value: 0.05 } },
  { id: 'combat-light-thruster',      hullId: 'combat', rarity: 'common',
    name: 'Réacteur léger', description: 'Manœuvres améliorées. +5% speed.',
    effect: { type: 'stat', stat: 'speed', value: 0.05 } },
  { id: 'combat-emergency-repair',    hullId: 'combat', rarity: 'common',
    name: 'Régulateur d\'urgence', description: 'Auto-réparation entre combats. +5% regen.',
    effect: { type: 'stat', stat: 'regen', value: 0.05 } },
  { id: 'combat-armored-holds',       hullId: 'combat', rarity: 'common',
    name: 'Soutes blindées', description: 'Capacité de cargaison protégée. +5% cargo.',
    effect: { type: 'stat', stat: 'cargo', value: 0.05 } },
  { id: 'combat-extra-armor',         hullId: 'combat', rarity: 'common',
    name: 'Plaques supplémentaires', description: 'Armure accrue contre les tirs ennemis. +8% armor.',
    effect: { type: 'stat', stat: 'armor', value: 0.08 } },
  { id: 'combat-reinforced-hull',     hullId: 'combat', rarity: 'common',
    name: 'Coque renforcée', description: 'Structure consolidée. +8% hull.',
    effect: { type: 'stat', stat: 'hull', value: 0.08 } },
  { id: 'combat-fuel-bypass',         hullId: 'combat', rarity: 'common',
    name: 'Bypass carburant', description: 'Optimisation du flux énergétique. +5% cargo + tracé carburant amélioré.',
    effect: { type: 'stat', stat: 'cargo', value: 0.05 } },

  // Rares
  { id: 'combat-opening-salvo',       hullId: 'combat', rarity: 'rare',
    name: 'Salve d\'ouverture', description: 'Concentration totale au premier round. +50% damage round 1.',
    effect: { type: 'conditional', trigger: 'first_round', effect: { stat: 'damage', value: 0.50 } } },
  { id: 'combat-survival-protocol',   hullId: 'combat', rarity: 'rare',
    name: 'Protocole de survie', description: 'Régénération boostée en situation critique. Sous 30% hull → +30% shield regen.',
    effect: { type: 'conditional', trigger: 'low_hull', threshold: 0.30, effect: { stat: 'regen', value: 0.30 } } },
  { id: 'combat-veteran-crew',        hullId: 'combat', rarity: 'rare',
    name: 'Équipage vétéran', description: 'Équipage expérimenté. +15% damage et +15% hull.',
    effect: { type: 'stat', stat: 'damage', value: 0.15 } },
  { id: 'combat-strategist',          hullId: 'combat', rarity: 'rare',
    name: 'Stratège', description: 'Tacticien embarqué. +1 charge épique au démarrage de la run.',
    effect: { type: 'stat', stat: 'epic_charges_max', value: 1 } },
  { id: 'combat-anti-debris',         hullId: 'combat', rarity: 'rare',
    name: 'Anti-débris', description: 'Filtres avancés contre les débris. +20% hull.',
    effect: { type: 'stat', stat: 'hull', value: 0.20 } },
  { id: 'combat-counter-attack',      hullId: 'combat', rarity: 'rare',
    name: 'Riposte', description: 'Bonus de damage si l\'ennemi est plus puissant. enemy_fp_above 1000 → +20% damage.',
    effect: { type: 'conditional', trigger: 'enemy_fp_above', threshold: 1000, effect: { stat: 'damage', value: 0.20 } } },

  // Épiques
  { id: 'combat-emergency-repair-epic', hullId: 'combat', rarity: 'epic',
    name: 'Réparation d\'urgence', description: '1 charge → +50% hull immédiat sur la flotte.',
    effect: { type: 'active', ability: 'repair', magnitude: 0.50 } },
  { id: 'combat-overcharge',          hullId: 'combat', rarity: 'epic',
    name: 'Surcharge tactique', description: '1 charge → +100% damage le combat suivant.',
    effect: { type: 'active', ability: 'overcharge', magnitude: 1.00 } },
  { id: 'combat-ablative-shield',     hullId: 'combat', rarity: 'epic',
    name: 'Bouclier ablatif', description: '1 charge → +200% shield le combat suivant.',
    effect: { type: 'active', ability: 'shield_burst', magnitude: 2.00 } },

  // ─── SCIENTIFIC (10C / 6R / 3E) ────────────────────────────────────────
  // Communs
  { id: 'sci-shield-modulator',       hullId: 'scientific', rarity: 'common',
    name: 'Modulateur de bouclier', description: 'Modulation fine du bouclier. +5% shield.',
    effect: { type: 'stat', stat: 'shield', value: 0.05 } },
  { id: 'sci-data-bank',              hullId: 'scientific', rarity: 'common',
    name: 'Banque de données', description: 'Stockage de données accru. +8% regen entre combats.',
    effect: { type: 'stat', stat: 'regen', value: 0.08 } },
  { id: 'sci-stealth-coating',        hullId: 'scientific', rarity: 'common',
    name: 'Revêtement furtif', description: 'Furtivité au premier engagement. +10% damage round 1.',
    effect: { type: 'conditional', trigger: 'first_round', effect: { stat: 'damage', value: 0.10 } } },
  { id: 'sci-research-array',         hullId: 'scientific', rarity: 'common',
    name: 'Réseau de recherche', description: 'Modules de recherche embarqués. +5% damage.',
    effect: { type: 'stat', stat: 'damage', value: 0.05 } },
  { id: 'sci-energy-shield',          hullId: 'scientific', rarity: 'common',
    name: 'Bouclier énergétique', description: 'Surcouche énergétique. +8% shield.',
    effect: { type: 'stat', stat: 'shield', value: 0.08 } },
  { id: 'sci-hull-regen',             hullId: 'scientific', rarity: 'common',
    name: 'Régénération de coque', description: 'Auto-réparation. +6% regen.',
    effect: { type: 'stat', stat: 'regen', value: 0.06 } },
  { id: 'sci-light-armor',            hullId: 'scientific', rarity: 'common',
    name: 'Armure légère', description: 'Plaques composites. +5% armor.',
    effect: { type: 'stat', stat: 'armor', value: 0.05 } },
  { id: 'sci-cargo-bay',              hullId: 'scientific', rarity: 'common',
    name: 'Soute scientifique', description: 'Compartiments échantillonnage. +5% cargo.',
    effect: { type: 'stat', stat: 'cargo', value: 0.05 } },
  { id: 'sci-precision-weapons',      hullId: 'scientific', rarity: 'common',
    name: 'Armes de précision', description: 'Calibres réduits, viseurs accrus. +7% damage.',
    effect: { type: 'stat', stat: 'damage', value: 0.07 } },
  { id: 'sci-extra-thrusters',        hullId: 'scientific', rarity: 'common',
    name: 'Propulseurs supplémentaires', description: 'Manœuvres plus vives. +5% speed.',
    effect: { type: 'stat', stat: 'speed', value: 0.05 } },

  // Rares
  { id: 'sci-deep-scan',              hullId: 'scientific', rarity: 'rare',
    name: 'Scan profond', description: 'Anticipation des dégâts. -25% damage entrant le 1er round (équivalent +25% shield round 1).',
    effect: { type: 'conditional', trigger: 'first_round', effect: { stat: 'shield', value: 0.25 } } },
  { id: 'sci-quantum-research',       hullId: 'scientific', rarity: 'rare',
    name: 'Recherche quantique', description: 'Bonus de stats généralisé. +20% hull.',
    effect: { type: 'stat', stat: 'hull', value: 0.20 } },
  { id: 'sci-energy-weapon',          hullId: 'scientific', rarity: 'rare',
    name: 'Arme à énergie', description: 'Canons à plasma avancés. +20% damage.',
    effect: { type: 'stat', stat: 'damage', value: 0.20 } },
  { id: 'sci-shield-overload',        hullId: 'scientific', rarity: 'rare',
    name: 'Surcharge de bouclier', description: 'Bouclier renforcé en situation critique. Sous 30% hull → +50% shield.',
    effect: { type: 'conditional', trigger: 'low_hull', threshold: 0.30, effect: { stat: 'shield', value: 0.50 } } },
  { id: 'sci-knowledge-bank',         hullId: 'scientific', rarity: 'rare',
    name: 'Banque de savoir', description: 'Tacticien embarqué. +1 charge épique au démarrage.',
    effect: { type: 'stat', stat: 'epic_charges_max', value: 1 } },
  { id: 'sci-precision-strike',       hullId: 'scientific', rarity: 'rare',
    name: 'Frappe chirurgicale', description: 'Bonus contre flotte massive. enemy_fp_above 1500 → +25% damage.',
    effect: { type: 'conditional', trigger: 'enemy_fp_above', threshold: 1500, effect: { stat: 'damage', value: 0.25 } } },

  // Épiques
  { id: 'sci-deep-scan-epic',         hullId: 'scientific', rarity: 'epic',
    name: 'Scan profond — épique', description: '1 charge → révèle les outcomes cachés du prochain event narratif.',
    effect: { type: 'active', ability: 'scan', magnitude: 1.00 } },
  { id: 'sci-time-dilation',          hullId: 'scientific', rarity: 'epic',
    name: 'Dilatation temporelle', description: '1 charge → +150% damage le combat suivant.',
    effect: { type: 'active', ability: 'damage_burst', magnitude: 1.50 } },
  { id: 'sci-knowledge-burst',        hullId: 'scientific', rarity: 'epic',
    name: 'Éclair de savoir', description: '1 charge → +30% hull immédiat.',
    effect: { type: 'active', ability: 'repair', magnitude: 0.30 } },

  // ─── INDUSTRIAL (10C / 6R / 3E) ────────────────────────────────────────
  // Communs
  { id: 'indus-cargo-bay',            hullId: 'industrial', rarity: 'common',
    name: 'Soute cargo', description: 'Capacité de cargaison étendue. +5% cargo.',
    effect: { type: 'stat', stat: 'cargo', value: 0.05 } },
  { id: 'indus-mining-laser',         hullId: 'industrial', rarity: 'common',
    name: 'Laser minier', description: 'Laser de minage reconverti en arme. +5% damage.',
    effect: { type: 'stat', stat: 'damage', value: 0.05 } },
  { id: 'indus-fuel-tanks',           hullId: 'industrial', rarity: 'common',
    name: 'Réservoirs étendus', description: 'Réserves de carburant accrues. +10% speed.',
    effect: { type: 'stat', stat: 'speed', value: 0.10 } },
  { id: 'indus-reinforced-hold',      hullId: 'industrial', rarity: 'common',
    name: 'Soute renforcée', description: 'Plaques de blindage de soute. +8% cargo.',
    effect: { type: 'stat', stat: 'cargo', value: 0.08 } },
  { id: 'indus-mining-drill',         hullId: 'industrial', rarity: 'common',
    name: 'Foreuse industrielle', description: 'Rotation accrue. +7% damage.',
    effect: { type: 'stat', stat: 'damage', value: 0.07 } },
  { id: 'indus-bulk-armor',           hullId: 'industrial', rarity: 'common',
    name: 'Armure massive', description: 'Plaques de blindage industriel. +8% armor.',
    effect: { type: 'stat', stat: 'armor', value: 0.08 } },
  { id: 'indus-thick-hull',           hullId: 'industrial', rarity: 'common',
    name: 'Coque épaisse', description: 'Coque renforcée pour conditions extrêmes. +6% hull.',
    effect: { type: 'stat', stat: 'hull', value: 0.06 } },
  { id: 'indus-shield-extender',      hullId: 'industrial', rarity: 'common',
    name: 'Extension de bouclier', description: 'Capacité bouclier industrielle. +5% shield.',
    effect: { type: 'stat', stat: 'shield', value: 0.05 } },
  { id: 'indus-repair-bay',           hullId: 'industrial', rarity: 'common',
    name: 'Baie de réparation', description: 'Auto-réparation entre combats. +6% regen.',
    effect: { type: 'stat', stat: 'regen', value: 0.06 } },
  { id: 'indus-balanced-systems',     hullId: 'industrial', rarity: 'common',
    name: 'Systèmes équilibrés', description: 'Optimisation globale. +5% hull et résistance accrue.',
    effect: { type: 'stat', stat: 'hull', value: 0.05 } },

  // Rares
  { id: 'indus-salvage-protocol',     hullId: 'industrial', rarity: 'rare',
    name: 'Protocole de récupération', description: 'Bonus loot vaisseaux. +20% hull.',
    effect: { type: 'stat', stat: 'hull', value: 0.20 } },
  { id: 'indus-bulk-loot',            hullId: 'industrial', rarity: 'rare',
    name: 'Cargaison massive', description: 'Cargo industriel massif. +25% cargo.',
    effect: { type: 'stat', stat: 'cargo', value: 0.25 } },
  { id: 'indus-fortress',             hullId: 'industrial', rarity: 'rare',
    name: 'Forteresse', description: 'Bouclier en situation critique. Sous 30% hull → +40% shield.',
    effect: { type: 'conditional', trigger: 'low_hull', threshold: 0.30, effect: { stat: 'shield', value: 0.40 } } },
  { id: 'indus-foreman',              hullId: 'industrial', rarity: 'rare',
    name: 'Chef de chantier', description: 'Coordinateur stratégique. +1 charge épique au démarrage.',
    effect: { type: 'stat', stat: 'epic_charges_max', value: 1 } },
  { id: 'indus-armored-defense',      hullId: 'industrial', rarity: 'rare',
    name: 'Défense blindée', description: 'Plaques additionnelles. +25% armor.',
    effect: { type: 'stat', stat: 'armor', value: 0.25 } },
  { id: 'indus-overdrive',            hullId: 'industrial', rarity: 'rare',
    name: 'Surrégime', description: 'Sortie d\'urgence en force. last_round → +30% damage.',
    effect: { type: 'conditional', trigger: 'last_round', effect: { stat: 'damage', value: 0.30 } } },

  // Épiques
  { id: 'indus-quantum-jump',         hullId: 'industrial', rarity: 'epic',
    name: 'Saut quantique', description: '1 charge → skip le prochain combat (sans loot ni pertes).',
    effect: { type: 'active', ability: 'skip', magnitude: 1.00 } },
  { id: 'indus-megastructure',        hullId: 'industrial', rarity: 'epic',
    name: 'Mégastructure', description: '1 charge → +75% hull immédiat.',
    effect: { type: 'active', ability: 'repair', magnitude: 0.75 } },
  { id: 'indus-resource-lure',        hullId: 'industrial', rarity: 'epic',
    name: 'Appât à ressources', description: '1 charge → +200% shield le combat suivant.',
    effect: { type: 'active', ability: 'shield_burst', magnitude: 2.00 } },
];

/**
 * Starter modules attribués à chaque flagship lors de la migration,
 * selon sa coque actuelle. Doivent exister dans DEFAULT_MODULES.
 */
export const STARTER_MODULES_BY_HULL: Record<string, string> = {
  combat:     'combat-armored-plating',
  scientific: 'sci-shield-modulator',
  industrial: 'indus-cargo-bay',
};
```

- [ ] **Step 3: Verify the seed parses cleanly**

Run: `node -e "import('./apps/api/src/modules/modules/modules.types.js').then(({moduleDefinitionSchema}) => import('./apps/api/src/modules/modules/default-modules.seed.js').then(({DEFAULT_MODULES}) => DEFAULT_MODULES.forEach(m => moduleDefinitionSchema.parse(m))))"`

If the API isn't built yet, just run typecheck:

Run: `pnpm turbo typecheck --filter=@exilium/api`
Expected: 0 errors.

- [ ] **Step 4: Verify pool size correctness via grep**

Run: `grep -c "hullId: 'combat'" apps/api/src/modules/modules/default-modules.seed.ts`
Expected: `19`

Run: `grep -c "hullId: 'scientific'" apps/api/src/modules/modules/default-modules.seed.ts`
Expected: `19`

Run: `grep -c "hullId: 'industrial'" apps/api/src/modules/modules/default-modules.seed.ts`
Expected: `19`

Run: `grep -c "rarity: 'epic'" apps/api/src/modules/modules/default-modules.seed.ts`
Expected: `9`

Run: `grep -c "rarity: 'rare'" apps/api/src/modules/modules/default-modules.seed.ts`
Expected: `18`

Run: `grep -c "rarity: 'common'" apps/api/src/modules/modules/default-modules.seed.ts`
Expected: `30`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/modules/modules.types.ts apps/api/src/modules/modules/default-modules.seed.ts
git commit -m "$(cat <<'EOF'
feat(modules): types Zod + 57 modules seed (19 par coque, 30/18/9 par rareté)

- moduleEffectSchema discriminé : stat/conditional/active
- moduleDefinitionSchema avec id kebab-case validé
- moduleLoadoutSchema pour la persistance flagships.module_loadout
- 57 modules seedés avec descriptions FR + 3 starters (un par coque)
EOF
)"
```

---

## Task 4 : API service + tRPC router (sans intégration anomaly)

**Files:**
- Create: `apps/api/src/modules/modules/modules.service.ts`
- Create: `apps/api/src/modules/modules/modules.router.ts`
- Modify: `apps/api/src/trpc/app-router.ts`

- [ ] **Step 1: Implement modules.service.ts**

Create `apps/api/src/modules/modules/modules.service.ts`:

```ts
import { and, eq, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import {
  flagships, flagshipModuleInventory, moduleDefinitions,
} from '@exilium/db';
import type { Database } from '@exilium/db';
import { parseLoadout, getMaxCharges, type ModuleDefinitionLite } from '@exilium/game-engine';
import {
  moduleDefinitionSchema, moduleLoadoutSchema, hullSlotSchema,
  type ModuleDefinition, type ModuleLoadoutDb,
} from './modules.types.js';
import { DEFAULT_MODULES } from './default-modules.seed.js';

type SlotType = 'epic' | 'rare' | 'common';

export function createModulesService(db: Database) {
  /** Fetch all enabled modules for use as the engine pool. */
  async function getPool(): Promise<ModuleDefinitionLite[]> {
    const rows = await db.select().from(moduleDefinitions).where(eq(moduleDefinitions.enabled, true));
    return rows.map((r) => ({
      id: r.id,
      hullId: r.hullId,
      rarity: r.rarity as 'common' | 'rare' | 'epic',
      enabled: r.enabled,
      effect: r.effect as ModuleDefinitionLite['effect'],
    }));
  }

  return {
    /** Public: list of all enabled modules (for inventory display, lookups). */
    async listAll(): Promise<ModuleDefinition[]> {
      const rows = await db.select().from(moduleDefinitions).orderBy(moduleDefinitions.hullId, moduleDefinitions.rarity, moduleDefinitions.name);
      return rows.map((r) => moduleDefinitionSchema.parse(r));
    },

    /** Returns the player's inventory grouped by hull/rarity. */
    async getInventory(userId: string) {
      const [flagship] = await db.select({ id: flagships.id }).from(flagships).where(eq(flagships.userId, userId)).limit(1);
      if (!flagship) return { items: [] };
      const rows = await db.select({
        moduleId: flagshipModuleInventory.moduleId,
        count: flagshipModuleInventory.count,
        hullId: moduleDefinitions.hullId,
        rarity: moduleDefinitions.rarity,
        name: moduleDefinitions.name,
        description: moduleDefinitions.description,
        image: moduleDefinitions.image,
        enabled: moduleDefinitions.enabled,
        effect: moduleDefinitions.effect,
      })
        .from(flagshipModuleInventory)
        .innerJoin(moduleDefinitions, eq(moduleDefinitions.id, flagshipModuleInventory.moduleId))
        .where(eq(flagshipModuleInventory.flagshipId, flagship.id));
      return { items: rows };
    },

    /** Returns the loadout for a given hull. */
    async getLoadout(userId: string, hullId: string) {
      const [flagship] = await db.select({ loadout: flagships.moduleLoadout, current: flagships.epicChargesCurrent, max: flagships.epicChargesMax })
        .from(flagships).where(eq(flagships.userId, userId)).limit(1);
      if (!flagship) throw new TRPCError({ code: 'NOT_FOUND', message: 'Flagship introuvable' });
      const parsed = moduleLoadoutSchema.safeParse(flagship.loadout);
      const loadout = parsed.success ? parsed.data : {};
      return {
        hullId,
        slot: loadout[hullId as keyof typeof loadout] ?? { epic: null, rare: [], common: [] },
        epicChargesCurrent: flagship.current,
        epicChargesMax: flagship.max,
      };
    },

    /**
     * Equip a module in a slot. Validates rarity, hull, ownership,
     * not-already-equipped, not-in-mission. Atomic via transaction.
     */
    async equip(userId: string, input: { hullId: string; slotType: SlotType; slotIndex: number; moduleId: string }) {
      return await db.transaction(async (tx) => {
        const [flagship] = await tx.select().from(flagships).where(eq(flagships.userId, userId)).for('update').limit(1);
        if (!flagship) throw new TRPCError({ code: 'NOT_FOUND', message: 'Flagship introuvable' });
        if (flagship.status === 'in_mission') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Loadout verrouillé : flagship en mission' });
        }

        const [moduleDef] = await tx.select().from(moduleDefinitions).where(eq(moduleDefinitions.id, input.moduleId)).limit(1);
        if (!moduleDef || !moduleDef.enabled) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `Module "${input.moduleId}" introuvable ou désactivé` });
        }
        if (moduleDef.hullId !== input.hullId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `Module incompatible avec la coque ${input.hullId}` });
        }
        if (moduleDef.rarity !== input.slotType) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `Module rareté ${moduleDef.rarity} ne va pas dans slot ${input.slotType}` });
        }

        const [inv] = await tx.select({ count: flagshipModuleInventory.count }).from(flagshipModuleInventory)
          .where(and(
            eq(flagshipModuleInventory.flagshipId, flagship.id),
            eq(flagshipModuleInventory.moduleId, input.moduleId),
          )).limit(1);
        if (!inv || inv.count < 1) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Module non possédé' });
        }

        const loadout = (moduleLoadoutSchema.safeParse(flagship.moduleLoadout).success
          ? moduleLoadoutSchema.parse(flagship.moduleLoadout)
          : {}) as ModuleLoadoutDb;
        const slot = loadout[input.hullId as keyof ModuleLoadoutDb] ?? { epic: null, rare: [], common: [] };

        // Reject if already equipped in another slot of same hull (no double-equip even with duplicates)
        const allEquipped = [
          ...(slot.epic ? [slot.epic] : []),
          ...slot.rare,
          ...slot.common,
        ];
        if (allEquipped.includes(input.moduleId)) {
          // Allow if it's THIS exact slot being overridden (same module already there)
          const existing = input.slotType === 'epic'
            ? slot.epic
            : input.slotType === 'rare'
              ? slot.rare[input.slotIndex]
              : slot.common[input.slotIndex];
          if (existing !== input.moduleId) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Module déjà équipé dans un autre slot' });
          }
        }

        // Apply slot mutation
        const newSlot = { ...slot };
        if (input.slotType === 'epic') {
          newSlot.epic = input.moduleId;
        } else if (input.slotType === 'rare') {
          if (input.slotIndex < 0 || input.slotIndex > 2) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'slotIndex doit être 0..2 pour rare' });
          }
          const rare = [...newSlot.rare];
          rare[input.slotIndex] = input.moduleId;
          newSlot.rare = rare;
        } else {
          if (input.slotIndex < 0 || input.slotIndex > 4) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'slotIndex doit être 0..4 pour common' });
          }
          const common = [...newSlot.common];
          common[input.slotIndex] = input.moduleId;
          newSlot.common = common;
        }

        const newLoadout = { ...loadout, [input.hullId]: newSlot };

        // Recompute epic_charges_max from new equipped modules
        const pool = await getPool();
        const equipped = parseLoadout(newLoadout, input.hullId, pool).equipped;
        const newMax = getMaxCharges(equipped);

        await tx.update(flagships).set({
          moduleLoadout: newLoadout,
          epicChargesMax: newMax,
        }).where(eq(flagships.id, flagship.id));

        return { loadout: newLoadout, epicChargesMax: newMax };
      });
    },

    /** Remove a module from a slot. */
    async unequip(userId: string, input: { hullId: string; slotType: SlotType; slotIndex: number }) {
      return await db.transaction(async (tx) => {
        const [flagship] = await tx.select().from(flagships).where(eq(flagships.userId, userId)).for('update').limit(1);
        if (!flagship) throw new TRPCError({ code: 'NOT_FOUND', message: 'Flagship introuvable' });
        if (flagship.status === 'in_mission') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Loadout verrouillé : flagship en mission' });
        }

        const loadout = (moduleLoadoutSchema.safeParse(flagship.moduleLoadout).success
          ? moduleLoadoutSchema.parse(flagship.moduleLoadout)
          : {}) as ModuleLoadoutDb;
        const slot = loadout[input.hullId as keyof ModuleLoadoutDb] ?? { epic: null, rare: [], common: [] };
        const newSlot = { ...slot };
        if (input.slotType === 'epic') {
          newSlot.epic = null;
        } else if (input.slotType === 'rare') {
          const rare = [...newSlot.rare];
          delete rare[input.slotIndex];
          newSlot.rare = rare.filter((x): x is string => typeof x === 'string');
        } else {
          const common = [...newSlot.common];
          delete common[input.slotIndex];
          newSlot.common = common.filter((x): x is string => typeof x === 'string');
        }

        const newLoadout = { ...loadout, [input.hullId]: newSlot };
        const pool = await getPool();
        const equipped = parseLoadout(newLoadout, input.hullId, pool).equipped;
        const newMax = getMaxCharges(equipped);

        await tx.update(flagships).set({
          moduleLoadout: newLoadout,
          epicChargesMax: newMax,
        }).where(eq(flagships.id, flagship.id));

        return { loadout: newLoadout, epicChargesMax: newMax };
      });
    },

    /**
     * Roll a per-combat module drop for a flagship after a combat win.
     * Returns the granted module id (with hull side info) or null.
     * Caller is responsible for inserting into flagship_module_inventory.
     */
    async rollPerCombatDrop(args: { flagshipHullId: string; rng?: () => number }): Promise<string | null> {
      const rng = args.rng ?? Math.random;
      const roll = rng();
      const pool = await getPool();
      const otherHulls = ['combat', 'scientific', 'industrial'].filter((h) => h !== args.flagshipHullId);

      if (roll < 0.30) {
        // 30% : commun de la coque du flagship
        const candidates = pool.filter((m) => m.hullId === args.flagshipHullId && m.rarity === 'common');
        if (candidates.length === 0) return null;
        return candidates[Math.floor(rng() * candidates.length)].id;
      } else if (roll < 0.35) {
        // 5% : commun d'une autre coque (uniforme parmi les 2 autres)
        const otherHull = otherHulls[Math.floor(rng() * otherHulls.length)];
        const candidates = pool.filter((m) => m.hullId === otherHull && m.rarity === 'common');
        if (candidates.length === 0) return null;
        return candidates[Math.floor(rng() * candidates.length)].id;
      }
      // 65% : rien
      return null;
    },

    /**
     * Roll the per-run final drop based on depth reached. Returns array of
     * granted module ids (could be empty). Caller inserts to inventory.
     */
    async rollPerRunFinalDrop(args: { flagshipHullId: string; depth: number; rng?: () => number }): Promise<string[]> {
      const rng = args.rng ?? Math.random;
      const pool = await getPool();
      const own = (rarity: 'common' | 'rare' | 'epic') => pool.filter((m) => m.hullId === args.flagshipHullId && m.rarity === rarity);

      const out: string[] = [];
      const drawOne = (rarity: 'common' | 'rare' | 'epic') => {
        const cands = own(rarity);
        if (cands.length > 0) out.push(cands[Math.floor(rng() * cands.length)].id);
      };

      if (args.depth >= 13) {
        drawOne('rare');
        drawOne('epic');
      } else if (args.depth >= 8) {
        drawOne('rare');
        if (rng() < 0.30) drawOne('epic');
      } else if (args.depth >= 4) {
        drawOne('rare');
      } else if (args.depth >= 1) {
        drawOne('common');
      }
      return out;
    },

    /** Insert (or count++) a module in a flagship's inventory. */
    async grantModule(flagshipId: string, moduleId: string) {
      await db.insert(flagshipModuleInventory).values({
        flagshipId, moduleId, count: 1,
      }).onConflictDoUpdate({
        target: [flagshipModuleInventory.flagshipId, flagshipModuleInventory.moduleId],
        set: { count: sql`${flagshipModuleInventory.count} + 1` },
      });
    },

    /**
     * Admin: upsert a module definition. Validates Zod, replaces enabled state.
     */
    async adminUpsert(input: ModuleDefinition) {
      const parsed = moduleDefinitionSchema.parse(input);
      await db.insert(moduleDefinitions).values(parsed).onConflictDoUpdate({
        target: moduleDefinitions.id,
        set: {
          hullId: parsed.hullId,
          rarity: parsed.rarity,
          name: parsed.name,
          description: parsed.description,
          image: parsed.image,
          enabled: parsed.enabled,
          effect: parsed.effect,
        },
      });
      return parsed;
    },

    async adminDelete(id: string) {
      await db.delete(moduleDefinitions).where(eq(moduleDefinitions.id, id));
    },

    /** Internal helper for tests + scripts. */
    _getPool: getPool,
    _SLOT_TYPES: ['epic', 'rare', 'common'] as const,
  };
}

export type ModulesService = ReturnType<typeof createModulesService>;
export { hullSlotSchema };
```

- [ ] **Step 2: Implement modules.router.ts**

Create `apps/api/src/modules/modules/modules.router.ts`:

```ts
import { z } from 'zod';
import { protectedProcedure, router } from '../../trpc/router.js';
import type { createAdminProcedure } from '../../trpc/router.js';
import type { createModulesService } from './modules.service.js';
import { moduleDefinitionSchema } from './modules.types.js';

export function createModulesRouter(
  service: ReturnType<typeof createModulesService>,
  adminProcedure: ReturnType<typeof createAdminProcedure>,
) {
  const adminRouter = router({
    list: adminProcedure.query(() => service.listAll()),
    upsert: adminProcedure.input(moduleDefinitionSchema).mutation(({ input }) => service.adminUpsert(input)),
    delete: adminProcedure.input(z.object({ id: z.string() })).mutation(({ input }) => service.adminDelete(input.id)),
  });

  const inventoryRouter = router({
    list: protectedProcedure.query(({ ctx }) => service.getInventory(ctx.userId!)),
  });

  const loadoutRouter = router({
    get: protectedProcedure.input(z.object({ hullId: z.string() })).query(({ ctx, input }) => service.getLoadout(ctx.userId!, input.hullId)),
    equip: protectedProcedure.input(z.object({
      hullId: z.string(),
      slotType: z.enum(['epic', 'rare', 'common']),
      slotIndex: z.number().int().min(0).max(4),
      moduleId: z.string(),
    })).mutation(({ ctx, input }) => service.equip(ctx.userId!, input)),
    unequip: protectedProcedure.input(z.object({
      hullId: z.string(),
      slotType: z.enum(['epic', 'rare', 'common']),
      slotIndex: z.number().int().min(0).max(4),
    })).mutation(({ ctx, input }) => service.unequip(ctx.userId!, input)),
  });

  return router({
    list: protectedProcedure.query(() => service.listAll()),
    inventory: inventoryRouter,
    loadout: loadoutRouter,
    admin: adminRouter,
  });
}
```

- [ ] **Step 3: Wire the new router in app-router.ts**

Modify `apps/api/src/trpc/app-router.ts`:

After the imports section, add:
```ts
import { createModulesService } from '../modules/modules/modules.service.js';
import { createModulesRouter } from '../modules/modules/modules.router.js';
```

Inside `buildAppRouter`, alongside other service constructions:
```ts
  const modulesService = createModulesService(db);
```

Alongside other router constructions:
```ts
  const modulesRouter = createModulesRouter(modulesService, adminProcedure);
```

In the final `router({...})` call, add:
```ts
    modules: modulesRouter,
```

- [ ] **Step 4: Add service tests for drop rolls (deterministic via seeded RNG)**

Create `apps/api/src/modules/modules/__tests__/modules.service.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createModulesService } from '../modules.service.js';
import type { ModuleDefinitionLite } from '@exilium/game-engine';

// Mock DB stub : we only test pure logic (rollPerCombatDrop, rollPerRunFinalDrop).
// Real equip/unequip tested in E2E because they require a real flagship row.
const FAKE_POOL: ModuleDefinitionLite[] = [
  { id: 'c-c1', hullId: 'combat',     rarity: 'common', enabled: true, effect: { type: 'stat', stat: 'damage', value: 0.05 } },
  { id: 'c-c2', hullId: 'combat',     rarity: 'common', enabled: true, effect: { type: 'stat', stat: 'hull', value: 0.05 } },
  { id: 'c-r1', hullId: 'combat',     rarity: 'rare',   enabled: true, effect: { type: 'stat', stat: 'damage', value: 0.20 } },
  { id: 'c-e1', hullId: 'combat',     rarity: 'epic',   enabled: true, effect: { type: 'active', ability: 'repair', magnitude: 0.5 } },
  { id: 's-c1', hullId: 'scientific', rarity: 'common', enabled: true, effect: { type: 'stat', stat: 'shield', value: 0.05 } },
  { id: 'i-c1', hullId: 'industrial', rarity: 'common', enabled: true, effect: { type: 'stat', stat: 'cargo', value: 0.05 } },
];

function makeStubDb(pool: ModuleDefinitionLite[]) {
  // Minimal stub — only `select().from(moduleDefinitions).where(...)` is called by getPool
  return {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(pool.map((m) => ({
          id: m.id, hullId: m.hullId, rarity: m.rarity, enabled: m.enabled, effect: m.effect,
          name: m.id, description: '', image: '', createdAt: new Date(),
        }))),
      }),
    }),
  } as unknown as Parameters<typeof createModulesService>[0];
}

describe('rollPerCombatDrop', () => {
  it('30% : commun de la coque own (roll < 0.30)', async () => {
    const svc = createModulesService(makeStubDb(FAKE_POOL));
    let counter = 0;
    const rng = () => {
      const seq = [0.10, 0.50]; // first call = 0.10 (< 0.30 → own), second call = pick index
      return seq[counter++];
    };
    const result = await svc.rollPerCombatDrop({ flagshipHullId: 'combat', rng });
    expect(['c-c1', 'c-c2']).toContain(result);
  });

  it('5% : commun d\'autre coque (0.30 ≤ roll < 0.35)', async () => {
    const svc = createModulesService(makeStubDb(FAKE_POOL));
    let counter = 0;
    const rng = () => {
      const seq = [0.32, 0.99, 0.00]; // 0.32 → other coque, 0.99 → pick last in array (industrial), 0.00 → pick first
      return seq[counter++];
    };
    const result = await svc.rollPerCombatDrop({ flagshipHullId: 'combat', rng });
    expect(['s-c1', 'i-c1']).toContain(result);
  });

  it('65% : rien (roll >= 0.35)', async () => {
    const svc = createModulesService(makeStubDb(FAKE_POOL));
    const result = await svc.rollPerCombatDrop({ flagshipHullId: 'combat', rng: () => 0.50 });
    expect(result).toBeNull();
  });

  it('distribution sur 10000 rolls match les pourcentages cibles ±2%', async () => {
    const svc = createModulesService(makeStubDb(FAKE_POOL));
    let own = 0, other = 0, none = 0;
    for (let i = 0; i < 10000; i++) {
      const result = await svc.rollPerCombatDrop({ flagshipHullId: 'combat' });
      if (result === null) none++;
      else if (result.startsWith('c-')) own++;
      else other++;
    }
    expect(own).toBeGreaterThan(2800);   // ~3000 (30%)
    expect(own).toBeLessThan(3200);
    expect(other).toBeGreaterThan(350);  // ~500 (5%)
    expect(other).toBeLessThan(650);
    expect(none).toBeGreaterThan(6300);  // ~6500 (65%)
    expect(none).toBeLessThan(6700);
  });
});

describe('rollPerRunFinalDrop', () => {
  it('depth 1-3 : 1 commun', async () => {
    const svc = createModulesService(makeStubDb(FAKE_POOL));
    const result = await svc.rollPerRunFinalDrop({ flagshipHullId: 'combat', depth: 2, rng: () => 0 });
    expect(result.length).toBe(1);
    expect(['c-c1', 'c-c2']).toContain(result[0]);
  });

  it('depth 4-7 : 1 rare', async () => {
    const svc = createModulesService(makeStubDb(FAKE_POOL));
    const result = await svc.rollPerRunFinalDrop({ flagshipHullId: 'combat', depth: 5, rng: () => 0 });
    expect(result).toEqual(['c-r1']);
  });

  it('depth 13+ : 1 rare + 1 epic garanti', async () => {
    const svc = createModulesService(makeStubDb(FAKE_POOL));
    const result = await svc.rollPerRunFinalDrop({ flagshipHullId: 'combat', depth: 15, rng: () => 0 });
    expect(result).toEqual(['c-r1', 'c-e1']);
  });

  it('depth 8-12 : 1 rare, épique conditionné par 30%', async () => {
    const svc = createModulesService(makeStubDb(FAKE_POOL));
    // rng=0.10 < 0.30 → epic dropped
    let counter = 0;
    const rngWithEpic = () => [0, 0.10, 0][counter++]; // pick rare, roll for epic, pick epic
    const r1 = await svc.rollPerRunFinalDrop({ flagshipHullId: 'combat', depth: 10, rng: rngWithEpic });
    expect(r1.length).toBe(2);

    counter = 0;
    const rngNoEpic = () => [0, 0.50][counter++]; // pick rare, roll for epic (fail)
    const r2 = await svc.rollPerRunFinalDrop({ flagshipHullId: 'combat', depth: 10, rng: rngNoEpic });
    expect(r2.length).toBe(1);
  });
});
```

- [ ] **Step 5: Run service tests**

Run: `pnpm --filter @exilium/api test modules.service.test.ts`
Expected: 6 tests PASS.

- [ ] **Step 6: Run typecheck**

Run: `pnpm turbo typecheck --filter=@exilium/api`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/modules/modules.service.ts apps/api/src/modules/modules/modules.router.ts apps/api/src/modules/modules/__tests__/modules.service.test.ts apps/api/src/trpc/app-router.ts
git commit -m "$(cat <<'EOF'
feat(api): service + router modules (inventory, loadout, admin CRUD)

Pas encore d'intégration anomaly (drops déclenchés par anomaly.service)
ni de migration script (refund). Routes tRPC exposées :
  - module.list / module.inventory.list
  - module.loadout.get / equip / unequip
  - module.admin.list / upsert / delete

Validation slot/coque/rareté/ownership/not-in-mission via transaction.
EOF
)"
```

---

## Task 5 : Image upload pipeline ('module' category)

**Files:**
- Modify: `packages/shared/src/utils/assets.ts`
- Modify: `apps/api/src/lib/image-processing.ts`
- Modify: `apps/api/src/modules/admin/asset-upload.route.ts`
- Modify: `Caddyfile`

- [ ] **Step 1: Add 'module' to AssetCategory**

Modify `packages/shared/src/utils/assets.ts` line 1:

```ts
export type AssetCategory = 'buildings' | 'research' | 'ships' | 'defenses' | 'planets' | 'flagships' | 'avatars' | 'landing' | 'anomaly' | 'module';
```

- [ ] **Step 2: Add processModuleImage to image-processing.ts**

Modify `apps/api/src/lib/image-processing.ts`:

In the `VALID_CATEGORIES` array, add `'module'`.

After `processAnomalyImage`, add:
```ts
const MODULE_SIZES: readonly { suffix: string; width: number; quality: number }[] = [
  { suffix: '', width: 800, quality: 85 },
  { suffix: '-thumb', width: 200, quality: 80 },
];

export async function processModuleImage(
  buffer: Buffer,
  slot: string,
  assetsDir: string,
): Promise<string[]> {
  if (!/^[a-z0-9_-]+$/i.test(slot)) {
    throw new Error(`Invalid module slot "${slot}"`);
  }
  const outputDir = path.join(assetsDir, 'module');
  fs.mkdirSync(outputDir, { recursive: true });
  const files: string[] = [];
  for (const size of MODULE_SIZES) {
    const filename = `${slot}${size.suffix}.webp`;
    const outPath = path.join(outputDir, filename);
    await sharp(buffer)
      .resize({ width: size.width, withoutEnlargement: true })
      .webp({ quality: size.quality })
      .toFile(outPath);
    files.push(filename);
  }
  return files;
}
```

- [ ] **Step 3: Wire 'module' case in upload route**

Modify `apps/api/src/modules/admin/asset-upload.route.ts`:

Update the import line to add `processModuleImage`.

In the error message of the category check, replace the list with:
```
'Invalid category. Must be: buildings, research, ships, defenses, planets, flagships, avatars, landing, anomaly, module'
```

In the entityId check error message, update parenthetical to mention modules too.

After the `else if (category === 'anomaly')` block, add:
```ts
      } else if (category === 'module') {
        if (!/^[a-z0-9_-]+$/i.test(entityId!)) {
          return reply.status(400).send({ error: 'Invalid module slot' });
        }
        files = await processModuleImage(buffer, entityId!, env.ASSETS_DIR);
```

- [ ] **Step 4: Add /assets/module/* to Caddyfile**

Use Edit with `replace_all: true` :

old_string:
```
	@game_assets path /assets/buildings/* /assets/buildings/*/* /assets/research/* /assets/ships/* /assets/defenses/* /assets/defenses/*/* /assets/planets/* /assets/planets/*/* /assets/flagships/* /assets/avatars/* /assets/landing/* /assets/anomaly/*
```

new_string:
```
	@game_assets path /assets/buildings/* /assets/buildings/*/* /assets/research/* /assets/ships/* /assets/defenses/* /assets/defenses/*/* /assets/planets/* /assets/planets/*/* /assets/flagships/* /assets/avatars/* /assets/landing/* /assets/anomaly/* /assets/module/*
```

Cela touche les 4 hosts (prod game, prod admin, staging game, staging admin) en une seule opération.

- [ ] **Step 5: Validate Caddyfile**

Run: `sudo caddy validate --config /opt/exilium/Caddyfile`
Expected: `Valid configuration`.

- [ ] **Step 6: Build the api package**

Run: `pnpm turbo build typecheck --filter=@exilium/api --filter=@exilium/shared`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/utils/assets.ts apps/api/src/lib/image-processing.ts apps/api/src/modules/admin/asset-upload.route.ts Caddyfile
git commit -m "$(cat <<'EOF'
feat(modules): pipeline upload images modules + route Caddy

- Catégorie 'module' ajoutée à AssetCategory
- processModuleImage : 800px hero + 200px thumb (compact pour list view)
- Route /admin/upload-asset gère 'module'
- Caddyfile : /assets/module/* sur tous les hosts
EOF
)"
```

---

## Task 6 : Admin /admin/modules — page master/detail

**Files:**
- Create: `apps/admin/src/components/ui/ModuleImageSlot.tsx`
- Create: `apps/admin/src/pages/Modules.tsx`
- Modify: `apps/admin/src/router.tsx`
- Modify: `apps/admin/src/components/layout/AdminLayout.tsx`

- [ ] **Step 1: Create ModuleImageSlot component**

Create `apps/admin/src/components/ui/ModuleImageSlot.tsx`. Copy the code from `AnomalyImageSlot.tsx` and replace:
- `category: 'anomaly'` → `category: 'module'`
- `slot: 'event-foo'` → `slot: 'module-id'`
- All `/assets/anomaly/` references → `/assets/module/`
- Component name `AnomalyImageSlot` → `ModuleImageSlot`

(See file `apps/admin/src/components/ui/AnomalyImageSlot.tsx` for the template — pattern strictly identical, just the category and path differ.)

- [ ] **Step 2: Create the Modules admin page (master/detail)**

Create `apps/admin/src/pages/Modules.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@exilium/api/trpc';
import { trpc } from '@/trpc';
import { PageSkeleton } from '@/components/ui/LoadingSpinner';
import { ModuleImageSlot } from '@/components/ui/ModuleImageSlot';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Save, Plus, Trash2, ChevronRight, Atom } from 'lucide-react';

type ModuleDef = inferRouterOutputs<AppRouter>['modules']['admin']['list'][number];

const HULLS = ['combat', 'scientific', 'industrial'] as const;
type Hull = typeof HULLS[number];
const RARITIES = ['common', 'rare', 'epic'] as const;
type Rarity = typeof RARITIES[number];

const HULL_TONE: Record<Hull, string> = {
  combat:     'text-rose-300',
  scientific: 'text-hull-300',
  industrial: 'text-amber-300',
};

const EFFECT_TEMPLATES = {
  stat:        '{ "type": "stat", "stat": "damage", "value": 0.05 }',
  conditional: '{ "type": "conditional", "trigger": "first_round", "effect": { "stat": "damage", "value": 0.50 } }',
  active:      '{ "type": "active", "ability": "repair", "magnitude": 0.50 }',
};

export default function Modules() {
  const { data: modules, isLoading, refetch } = trpc.modules.admin.list.useQuery();
  const upsertMutation = trpc.modules.admin.upsert.useMutation();
  const deleteMutation = trpc.modules.admin.delete.useMutation();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ModuleDef | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (selectedId && modules) {
      const found = modules.find((m) => m.id === selectedId);
      if (found) setDraft(structuredClone(found));
    } else {
      setDraft(null);
    }
  }, [selectedId, modules]);

  const grouped = useMemo(() => {
    const out: Record<Hull, Record<Rarity, ModuleDef[]>> = {
      combat: { common: [], rare: [], epic: [] },
      scientific: { common: [], rare: [], epic: [] },
      industrial: { common: [], rare: [], epic: [] },
    };
    for (const m of modules ?? []) {
      const h = m.hullId as Hull;
      const r = m.rarity as Rarity;
      if (out[h] && out[h][r]) out[h][r].push(m);
    }
    return out;
  }, [modules]);

  if (isLoading || !modules) return <PageSkeleton />;

  function newModule(hull: Hull, rarity: Rarity) {
    const id = `${hull}-new-${Math.random().toString(36).slice(2, 7)}`;
    setSelectedId(null);
    setDraft({
      id,
      hullId: hull,
      rarity,
      name: 'Nouveau module',
      description: 'À remplir',
      image: '',
      enabled: true,
      effect: { type: 'stat', stat: 'damage', value: 0.05 } as ModuleDef['effect'],
    });
  }

  async function handleSave() {
    if (!draft) return;
    setSaveError(null);
    try {
      await upsertMutation.mutateAsync(draft);
      setSavedAt(Date.now());
      await refetch();
      setSelectedId(draft.id);
      setTimeout(() => setSavedAt(null), 2500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erreur inconnue');
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMutation.mutateAsync({ id });
      setDeleteConfirm(null);
      setSelectedId(null);
      await refetch();
    } catch (err) {
      alert(`Suppression échouée : ${err instanceof Error ? err.message : 'inconnue'}`);
    }
  }

  return (
    <div className="-m-4 md:-m-6 flex h-[calc(100vh-3.5rem)] md:h-screen flex-col bg-bg/40">
      <header className="shrink-0 border-b border-panel-border bg-bg/95 backdrop-blur px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Atom className="h-5 w-5 text-hull-300" />
          <div>
            <h1 className="text-sm font-bold uppercase tracking-[0.18em] text-hull-300">Modules / Catalogue</h1>
            <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500">
              {modules.length} modules · 3 coques · 3 raretés
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[340px_1fr] overflow-hidden">
        {/* Rail */}
        <aside className="border-r border-panel-border bg-bg/60 overflow-y-auto p-2 space-y-3">
          {HULLS.map((hull) => (
            <div key={hull} className="space-y-1">
              <div className={`px-2 py-1 text-[10px] font-mono uppercase tracking-[0.18em] ${HULL_TONE[hull]}`}>
                {hull}
              </div>
              {RARITIES.map((rarity) => (
                <div key={rarity} className="ml-2">
                  <div className="flex items-center justify-between px-1 py-0.5">
                    <span className="text-[9px] uppercase tracking-wider text-gray-500">
                      {rarity} ({grouped[hull][rarity].length})
                    </span>
                    <button onClick={() => newModule(hull, rarity)} className="text-hull-300 hover:text-hull-200" title="Nouveau">
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  {grouped[hull][rarity].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedId(m.id)}
                      className={`w-full text-left px-2 py-1 text-xs rounded ${
                        selectedId === m.id ? 'bg-hull-950/40 text-hull-200' : 'text-gray-400 hover:bg-panel/40'
                      } ${!m.enabled ? 'line-through opacity-60' : ''} flex items-center gap-1`}
                    >
                      <span className="truncate flex-1">{m.name}</span>
                      {selectedId === m.id && <ChevronRight className="h-3 w-3" />}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </aside>

        {/* Detail */}
        <main className="overflow-y-auto bg-bg/40 p-5 space-y-4">
          {!draft ? (
            <div className="flex h-full items-center justify-center text-gray-500 text-sm">
              Sélectionne un module à gauche, ou crée-en un nouveau.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-mono text-sm uppercase tracking-wider text-hull-300">
                  {draft.name}
                </h2>
                <div className="flex items-center gap-2">
                  {selectedId && (
                    <button onClick={() => setDeleteConfirm(draft.id)} className="text-gray-500 hover:text-red-400 text-xs flex items-center gap-1">
                      <Trash2 className="h-3 w-3" /> Supprimer
                    </button>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={upsertMutation.isPending}
                    className="inline-flex items-center gap-1 rounded bg-hull-600 hover:bg-hull-500 px-4 py-1.5 text-xs font-semibold text-white"
                  >
                    <Save className="h-3 w-3" />
                    {upsertMutation.isPending ? 'Enregistrement…' : savedAt ? 'Enregistré' : 'Enregistrer'}
                  </button>
                </div>
              </div>

              {saveError && (
                <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">
                  <span className="font-semibold">Erreur :</span> {saveError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">ID (immutable)</span>
                  <input
                    type="text" value={draft.id}
                    onChange={(e) => setDraft({ ...draft, id: e.target.value })}
                    disabled={!!selectedId}
                    className="w-full rounded border border-panel-border bg-bg/60 px-2 py-1 text-sm disabled:opacity-50"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">Coque</span>
                  <select
                    value={draft.hullId}
                    onChange={(e) => setDraft({ ...draft, hullId: e.target.value as Hull })}
                    className="w-full rounded border border-panel-border bg-bg/60 px-2 py-1 text-sm"
                  >
                    {HULLS.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">Rareté</span>
                  <select
                    value={draft.rarity}
                    onChange={(e) => setDraft({ ...draft, rarity: e.target.value as Rarity })}
                    className="w-full rounded border border-panel-border bg-bg/60 px-2 py-1 text-sm"
                  >
                    {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </label>
                <label className="block flex items-center gap-2 mt-4">
                  <input
                    type="checkbox" checked={draft.enabled}
                    onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
                  />
                  <span className="text-xs text-gray-400">Actif</span>
                </label>
              </div>

              <label className="block">
                <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">Nom (max 80)</span>
                <input
                  type="text" value={draft.name} maxLength={80}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="w-full rounded border border-panel-border bg-bg/60 px-2 py-1 text-sm"
                />
              </label>

              <label className="block">
                <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">Description</span>
                <textarea
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  rows={3}
                  className="w-full rounded border border-panel-border bg-bg/60 px-2 py-1 text-sm"
                />
              </label>

              <ModuleImageSlot
                slot={draft.id}
                value={draft.image}
                aspect="1/1"
                label="Image"
                hint="Optionnel — 800×800 recommandé"
                onChange={(path) => setDraft({ ...draft, image: path })}
              />

              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">Effet (JSON)</span>
                <div className="flex gap-1 mb-1">
                  {(Object.keys(EFFECT_TEMPLATES) as Array<keyof typeof EFFECT_TEMPLATES>).map((tpl) => (
                    <button
                      key={tpl}
                      onClick={() => {
                        try {
                          setDraft({ ...draft, effect: JSON.parse(EFFECT_TEMPLATES[tpl]) });
                        } catch { /* unreachable */ }
                      }}
                      className="text-[10px] rounded border border-panel-border bg-panel/30 px-2 py-0.5 hover:bg-hull-900/30"
                    >
                      Template: {tpl}
                    </button>
                  ))}
                </div>
                <textarea
                  value={JSON.stringify(draft.effect, null, 2)}
                  onChange={(e) => {
                    try {
                      setDraft({ ...draft, effect: JSON.parse(e.target.value) });
                      setSaveError(null);
                    } catch (err) {
                      setSaveError(`JSON invalide : ${err instanceof Error ? err.message : 'parse error'}`);
                    }
                  }}
                  rows={6}
                  className="w-full rounded border border-panel-border bg-bg/60 px-2 py-1 text-xs font-mono"
                />
              </div>
            </>
          )}
        </main>
      </div>

      <ConfirmDialog
        open={!!deleteConfirm}
        title="Supprimer ce module ?"
        message="Le module sera retiré du catalogue et désinventaire des joueurs qui le possédaient (cascade)."
        confirmLabel="Supprimer"
        danger
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
```

- [ ] **Step 3: Add /modules to admin router**

Modify `apps/admin/src/router.tsx` — add route at the end of the children array:

```tsx
      { path: 'modules', lazy: () => import('./pages/Modules').then((m) => ({ Component: m.default })) },
```

- [ ] **Step 4: Add Modules to admin nav**

Modify `apps/admin/src/components/layout/AdminLayout.tsx`:

In the imports, add `Atom` (it should already be there from anomalies — verify).

Add to the "Gameplay" section, between Anomalies and Talents:

```ts
      { to: '/modules', label: 'Modules Flagship', icon: Atom },
```

- [ ] **Step 5: Lint + typecheck admin**

Run: `pnpm turbo lint typecheck --filter=@exilium/admin`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/components/ui/ModuleImageSlot.tsx apps/admin/src/pages/Modules.tsx apps/admin/src/router.tsx apps/admin/src/components/layout/AdminLayout.tsx
git commit -m "$(cat <<'EOF'
feat(admin): page /admin/modules master/detail + nav

- Rail gauche : 3 sections coques × 3 raretés, modules listés
- Detail droite : id/coque/rareté/nom/desc/image/effet (JSON + templates)
- ModuleImageSlot pour upload (pattern AnomalyImageSlot)
- Route ajoutée + nav 'Modules Flagship' dans la section Gameplay
EOF
)"
```

---

## Task 7 : Front /flagship Modules tab

**Files:**
- Create: `apps/web/src/components/flagship/ModuleSlot.tsx`
- Create: `apps/web/src/components/flagship/ModuleLoadoutGrid.tsx`
- Create: `apps/web/src/components/flagship/ModuleInventoryPanel.tsx`
- Create: `apps/web/src/components/flagship/ModuleDetailModal.tsx`
- Create: `apps/web/src/components/flagship/ModuleHullTabs.tsx`
- Modify: `apps/web/src/pages/Flagship.tsx`

- [ ] **Step 1: Create ModuleSlot component**

Create `apps/web/src/components/flagship/ModuleSlot.tsx`:

```tsx
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  size: 'epic' | 'rare' | 'common';
  module: { id: string; name: string; image: string; rarity: string } | null;
  onClick: () => void;
  onUnequip?: () => void;
}

const SIZE_CLASSES = {
  epic:   'h-20 w-20 border-violet-400/60 ring-2 ring-violet-500/30 shadow-lg shadow-violet-500/20',
  rare:   'h-14 w-14 border-blue-400/40',
  common: 'h-12 w-12 border-border/50',
};

const RARITY_BORDER = {
  epic:   'border-violet-400',
  rare:   'border-blue-400',
  common: 'border-gray-400',
};

export function ModuleSlot({ size, module, onClick, onUnequip }: Props) {
  return (
    <button
      type="button"
      onClick={module && onUnequip ? onUnequip : onClick}
      className={cn(
        'relative rounded-md border-2 bg-card/40 transition-all hover:bg-card/70',
        SIZE_CLASSES[size],
        module && RARITY_BORDER[module.rarity as 'epic' | 'rare' | 'common'],
        !module && 'border-dashed',
      )}
      title={module ? `${module.name} — clic pour déséquiper` : 'Clic pour équiper'}
    >
      {module ? (
        module.image ? (
          <img src={`${module.image}-thumb.webp`} alt={module.name} className="absolute inset-1 rounded object-cover" />
        ) : (
          <div className={cn('absolute inset-1 rounded flex items-center justify-center text-xs font-mono',
            size === 'epic' ? 'bg-violet-900/50 text-violet-200' :
            size === 'rare' ? 'bg-blue-900/40 text-blue-200' :
            'bg-card text-foreground/70')}>
            {module.name.slice(0, 3).toUpperCase()}
          </div>
        )
      ) : (
        <Plus className="absolute inset-0 m-auto h-4 w-4 text-muted-foreground/50" />
      )}
    </button>
  );
}
```

- [ ] **Step 2: Create ModuleLoadoutGrid**

Create `apps/web/src/components/flagship/ModuleLoadoutGrid.tsx`:

```tsx
import { ModuleSlot } from './ModuleSlot';

interface ModuleLite {
  id: string;
  name: string;
  image: string;
  rarity: string;
}

interface Slot {
  epic: string | null;
  rare: string[];
  common: string[];
}

interface Props {
  slot: Slot;
  inventory: Map<string, ModuleLite>;
  onSlotClick: (slotType: 'epic' | 'rare' | 'common', slotIndex: number) => void;
  onUnequip: (slotType: 'epic' | 'rare' | 'common', slotIndex: number) => void;
}

export function ModuleLoadoutGrid({ slot, inventory, onSlotClick, onUnequip }: Props) {
  const epicMod = slot.epic ? inventory.get(slot.epic) ?? null : null;
  return (
    <div className="relative aspect-square w-full max-w-md mx-auto bg-gradient-to-br from-violet-950/30 via-slate-900 to-indigo-950/40 rounded-lg p-6">
      {/* Épique au centre */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <ModuleSlot
          size="epic"
          module={epicMod}
          onClick={() => onSlotClick('epic', 0)}
          onUnequip={epicMod ? () => onUnequip('epic', 0) : undefined}
        />
      </div>

      {/* 3 rares en triangle (top, bottom-left, bottom-right) */}
      {[0, 1, 2].map((idx) => {
        const angle = (idx * 120 - 90) * (Math.PI / 180);
        const x = 50 + 28 * Math.cos(angle);
        const y = 50 + 28 * Math.sin(angle);
        const m = slot.rare[idx] ? inventory.get(slot.rare[idx]) ?? null : null;
        return (
          <div key={idx} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ top: `${y}%`, left: `${x}%` }}>
            <ModuleSlot size="rare" module={m} onClick={() => onSlotClick('rare', idx)} onUnequip={m ? () => onUnequip('rare', idx) : undefined} />
          </div>
        );
      })}

      {/* 5 communs en couronne externe */}
      {[0, 1, 2, 3, 4].map((idx) => {
        const angle = (idx * 72 - 90) * (Math.PI / 180);
        const x = 50 + 42 * Math.cos(angle);
        const y = 50 + 42 * Math.sin(angle);
        const m = slot.common[idx] ? inventory.get(slot.common[idx]) ?? null : null;
        return (
          <div key={idx} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ top: `${y}%`, left: `${x}%` }}>
            <ModuleSlot size="common" module={m} onClick={() => onSlotClick('common', idx)} onUnequip={m ? () => onUnequip('common', idx) : undefined} />
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Create ModuleInventoryPanel**

Create `apps/web/src/components/flagship/ModuleInventoryPanel.tsx`:

```tsx
import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InventoryItem {
  moduleId: string;
  count: number;
  hullId: string;
  rarity: string;
  name: string;
  description: string;
  image: string;
  enabled: boolean;
  effect: unknown;
}

interface Props {
  items: InventoryItem[];
  hullFilter: string;
  selectedSlotType: 'epic' | 'rare' | 'common' | null;
  equippedIds: Set<string>;
  onEquip: (moduleId: string) => void;
  onDetails: (moduleId: string) => void;
}

const RARITY_TONE: Record<string, string> = {
  common: 'text-gray-400 border-gray-400/30',
  rare:   'text-blue-300 border-blue-400/40',
  epic:   'text-violet-300 border-violet-400/50',
};

export function ModuleInventoryPanel({ items, hullFilter, selectedSlotType, equippedIds, onEquip, onDetails }: Props) {
  const [search, setSearch] = useState('');
  const [rarityFilter, setRarityFilter] = useState<'all' | 'common' | 'rare' | 'epic'>('all');

  const filtered = useMemo(() => {
    return items
      .filter((m) => m.hullId === hullFilter)
      .filter((m) => rarityFilter === 'all' || m.rarity === rarityFilter)
      .filter((m) => !search || m.name.toLowerCase().includes(search.toLowerCase()))
      .filter((m) => !selectedSlotType || m.rarity === selectedSlotType)
      .sort((a, b) => {
        const order = { epic: 0, rare: 1, common: 2 };
        if (a.rarity !== b.rarity) return (order[a.rarity as keyof typeof order] ?? 3) - (order[b.rarity as keyof typeof order] ?? 3);
        return a.name.localeCompare(b.name);
      });
  }, [items, hullFilter, rarityFilter, search, selectedSlotType]);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
          <input
            type="text" placeholder="Rechercher un module..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-border/40 bg-card/30 pl-7 pr-2 py-1.5 text-xs"
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'common', 'rare', 'epic'] as const).map((r) => (
            <button
              key={r} onClick={() => setRarityFilter(r)}
              className={cn(
                'flex-1 rounded text-[10px] uppercase font-mono py-1 border',
                rarityFilter === r ? 'border-hull-500/60 bg-hull-950/40 text-hull-200' : 'border-border/30 bg-card/20 text-muted-foreground',
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <ul className="space-y-1 max-h-[60vh] overflow-y-auto">
        {filtered.length === 0 ? (
          <li className="text-xs text-muted-foreground italic text-center p-4">Aucun module disponible avec ces filtres.</li>
        ) : (
          filtered.map((m) => {
            const equipped = equippedIds.has(m.moduleId);
            return (
              <li key={m.moduleId} className={cn(
                'flex items-center gap-2 p-1.5 rounded border',
                RARITY_TONE[m.rarity] ?? '',
                equipped && 'opacity-50',
              )}>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-foreground/90 truncate flex items-center gap-1">
                    {m.name}
                    {m.count > 1 && <span className="text-[9px] text-muted-foreground">×{m.count}</span>}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">{m.description}</div>
                </div>
                <button
                  onClick={() => onDetails(m.moduleId)}
                  className="text-[10px] text-muted-foreground hover:text-foreground"
                >Détails</button>
                <button
                  onClick={() => onEquip(m.moduleId)}
                  disabled={equipped}
                  className="text-[10px] rounded bg-hull-600/80 hover:bg-hull-600 disabled:opacity-40 px-2 py-1 text-white"
                >{equipped ? '✓' : 'Équiper'}</button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Create ModuleDetailModal**

Create `apps/web/src/components/flagship/ModuleDetailModal.tsx`:

```tsx
import { X } from 'lucide-react';

interface Props {
  module: {
    id: string;
    name: string;
    description: string;
    rarity: string;
    hullId: string;
    image: string;
    effect: unknown;
    count?: number;
  } | null;
  onClose: () => void;
}

const RARITY_LABEL: Record<string, string> = { common: 'Commun', rare: 'Rare', epic: 'Épique' };

export function ModuleDetailModal({ module, onClose }: Props) {
  if (!module) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="glass-card w-full max-w-md p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-violet-300">
              {RARITY_LABEL[module.rarity]} · {module.hullId}
            </div>
            <h3 className="text-base font-bold text-foreground/95">{module.name}</h3>
          </div>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground hover:text-foreground" /></button>
        </div>
        {module.image && (
          <img src={`${module.image}.webp`} alt={module.name} className="rounded-md w-full h-40 object-cover" />
        )}
        <p className="text-sm text-foreground/80 italic">{module.description}</p>
        <div className="rounded border border-border/30 bg-card/20 p-2 text-[11px] font-mono text-muted-foreground">
          <pre className="whitespace-pre-wrap">{JSON.stringify(module.effect, null, 2)}</pre>
        </div>
        {module.count && module.count > 1 && (
          <div className="text-xs text-muted-foreground">Tu en possèdes {module.count}.</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create ModuleHullTabs**

Create `apps/web/src/components/flagship/ModuleHullTabs.tsx`:

```tsx
import { cn } from '@/lib/utils';

interface Props {
  activeHullId: string;
  selectedHull: string;
  onSelect: (hullId: string) => void;
}

const HULLS: Array<{ id: string; label: string }> = [
  { id: 'combat',     label: 'Combat' },
  { id: 'scientific', label: 'Scientifique' },
  { id: 'industrial', label: 'Industrielle' },
];

export function ModuleHullTabs({ activeHullId, selectedHull, onSelect }: Props) {
  return (
    <div className="flex gap-1 border-b border-border/40">
      {HULLS.map((h) => {
        const isSelected = h.id === selectedHull;
        const isActive = h.id === activeHullId;
        return (
          <button
            key={h.id}
            onClick={() => onSelect(h.id)}
            className={cn(
              'px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors relative',
              isSelected ? 'text-hull-300' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {h.label}
            {isActive && <span className="ml-1.5 rounded-sm bg-emerald-500/20 border border-emerald-500/40 px-1 py-0 text-[8px] text-emerald-300">ACTIF</span>}
            {isSelected && <span className="absolute inset-x-1 -bottom-px h-px bg-hull-400" />}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 6: Modify Flagship.tsx to add Modules tab**

Modify `apps/web/src/pages/Flagship.tsx` — ADD a new "Modules" tab. Locate the tabs/navigation pattern in the existing file (look for "talent" usage). Add a `ModulesTab` component inside the same file, or as a separate file at `apps/web/src/components/flagship/ModulesTab.tsx`. The simplest approach:

Add to `Flagship.tsx`:

```tsx
import { ModuleLoadoutGrid } from '@/components/flagship/ModuleLoadoutGrid';
import { ModuleInventoryPanel } from '@/components/flagship/ModuleInventoryPanel';
import { ModuleDetailModal } from '@/components/flagship/ModuleDetailModal';
import { ModuleHullTabs } from '@/components/flagship/ModuleHullTabs';
import { trpc } from '@/trpc';
```

Define a `ModulesTab` component:

```tsx
function ModulesTab({ activeHullId }: { activeHullId: string }) {
  const [selectedHull, setSelectedHull] = useState(activeHullId);
  const [pendingSlot, setPendingSlot] = useState<{ slotType: 'epic' | 'rare' | 'common'; slotIndex: number } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: inventory } = trpc.modules.inventory.list.useQuery();
  const { data: loadout, refetch: refetchLoadout } = trpc.modules.loadout.get.useQuery({ hullId: selectedHull });
  const { data: allModules } = trpc.modules.list.useQuery();
  const utils = trpc.useUtils();

  const equipMutation = trpc.modules.loadout.equip.useMutation({
    onSuccess: () => { utils.modules.loadout.get.invalidate(); refetchLoadout(); setPendingSlot(null); },
  });
  const unequipMutation = trpc.modules.loadout.unequip.useMutation({
    onSuccess: () => { utils.modules.loadout.get.invalidate(); refetchLoadout(); },
  });

  const inventoryMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string; image: string; rarity: string }>();
    for (const m of allModules ?? []) map.set(m.id, { id: m.id, name: m.name, image: m.image, rarity: m.rarity });
    return map;
  }, [allModules]);

  const slot = loadout?.slot ?? { epic: null, rare: [], common: [] };
  const equippedIds = new Set([
    ...(slot.epic ? [slot.epic] : []),
    ...slot.rare,
    ...slot.common,
  ]);

  const detailModule = detailId
    ? (inventory?.items ?? []).find((i) => i.moduleId === detailId)
    : null;

  return (
    <div className="space-y-4">
      <ModuleHullTabs activeHullId={activeHullId} selectedHull={selectedHull} onSelect={setSelectedHull} />
      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-4">
        <div>
          <ModuleLoadoutGrid
            slot={slot}
            inventory={inventoryMap}
            onSlotClick={(slotType, slotIndex) => setPendingSlot({ slotType, slotIndex })}
            onUnequip={(slotType, slotIndex) => unequipMutation.mutate({ hullId: selectedHull, slotType, slotIndex })}
          />
          {loadout && (
            <div className="mt-4 text-center text-xs text-muted-foreground font-mono">
              ⚡ Charges épiques : {loadout.epicChargesCurrent} / {loadout.epicChargesMax}
            </div>
          )}
        </div>
        <ModuleInventoryPanel
          items={(inventory?.items ?? []).filter((i) => i.hullId === selectedHull)}
          hullFilter={selectedHull}
          selectedSlotType={pendingSlot?.slotType ?? null}
          equippedIds={equippedIds}
          onEquip={(moduleId) => {
            if (pendingSlot) {
              equipMutation.mutate({ hullId: selectedHull, ...pendingSlot, moduleId });
            }
          }}
          onDetails={(moduleId) => setDetailId(moduleId)}
        />
      </div>
      <ModuleDetailModal
        module={detailModule ? {
          id: detailModule.moduleId, name: detailModule.name, description: detailModule.description,
          rarity: detailModule.rarity, hullId: detailModule.hullId, image: detailModule.image,
          effect: detailModule.effect, count: detailModule.count,
        } : null}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}
```

In the existing tab structure of Flagship.tsx, replace the `Talents` tab content with `<ModulesTab activeHullId={flagship.hullId ?? 'combat'} />`. Remove all references to `TalentTree` / `TalentBranch` / `TalentNode` if they exist.

- [ ] **Step 7: Lint + typecheck web**

Run: `pnpm turbo lint typecheck --filter=@exilium/web`
Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/flagship/Module*.tsx apps/web/src/pages/Flagship.tsx
git commit -m "$(cat <<'EOF'
feat(flagship): page Modules — loadout grid + inventory + détails

- ModuleSlot : 3 tailles (epic/rare/common), border colorée par rareté
- ModuleLoadoutGrid : silhouette avec slots disposés (épique centre,
  3 rares triangle, 5 communs couronne externe)
- ModuleInventoryPanel : filtres rareté + recherche, équiper/détails
- ModuleDetailModal : détail au clic
- ModuleHullTabs : tabs combat/sci/indus avec badge "ACTIF" sur la
  coque persistée du flagship

Talents tab remplacé. Refund Exilium des points investis dans script
de migration séparé (Task 8).
EOF
)"
```

---

## Task 8 : Migration script — refund Exilium + starter pack

**Files:**
- Create: `apps/api/src/scripts/migrate-talents-to-modules.ts`

- [ ] **Step 1: Write the migration script**

Create `apps/api/src/scripts/migrate-talents-to-modules.ts`:

```ts
/**
 * One-off script: migrate from talents to modules.
 *
 * Steps:
 *   1. Seed module_definitions from DEFAULT_MODULES (idempotent via ON CONFLICT)
 *   2. Refund Exilium for each flagship based on talent ranks × tier cost
 *   3. Insert 1 starter common module per flagship (matching their hull)
 *   4. Set _migrations_state.flagship_modules_refund = 'done' (idempotence)
 *
 * Usage:
 *   pnpm --filter @exilium/api tsx src/scripts/migrate-talents-to-modules.ts
 *
 * Safe to re-run : the marker prevents double-refund. Module seed uses
 * ON CONFLICT DO UPDATE. Starter pack uses ON CONFLICT DO NOTHING.
 */
import { sql, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {
  flagships, flagshipModuleInventory, moduleDefinitions, userExilium, exiliumLog,
} from '@exilium/db';
import { DEFAULT_MODULES, STARTER_MODULES_BY_HULL } from '../modules/modules/default-modules.seed.js';
import { moduleDefinitionSchema } from '../modules/modules/modules.types.js';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  try {
    // ── Idempotence check ─────────────────────────────────────────────────
    const [existing] = await db.execute<{ value: string }>(sql`
      SELECT value FROM _migrations_state WHERE key = 'flagship_modules_refund' LIMIT 1
    `);
    if (existing && existing.value === 'done') {
      console.log('✓ Migration already applied (marker present). Skipping refund + starter.');
    }

    // ── Step 1: seed modules ───────────────────────────────────────────────
    console.log(`Seeding ${DEFAULT_MODULES.length} modules...`);
    for (const m of DEFAULT_MODULES) {
      const parsed = moduleDefinitionSchema.parse(m);
      await db.insert(moduleDefinitions).values(parsed).onConflictDoUpdate({
        target: moduleDefinitions.id,
        set: {
          hullId: parsed.hullId, rarity: parsed.rarity, name: parsed.name,
          description: parsed.description, image: parsed.image,
          enabled: parsed.enabled, effect: parsed.effect,
        },
      });
    }
    console.log('✓ Modules seeded');

    if (existing && existing.value === 'done') {
      await client.end();
      return;
    }

    // ── Step 2: refund Exilium ─────────────────────────────────────────────
    console.log('Computing Exilium refund per flagship...');
    const refunds = await db.execute<{ flagship_id: string; user_id: string; total_exilium: number }>(sql`
      SELECT
        f.id AS flagship_id,
        f.user_id,
        COALESCE(SUM(ft.current_rank * (
          CASE td.tier
            WHEN 1 THEN COALESCE((SELECT value::int FROM universe_config WHERE key='talent_cost_tier_1'), 1)
            WHEN 2 THEN COALESCE((SELECT value::int FROM universe_config WHERE key='talent_cost_tier_2'), 2)
            WHEN 3 THEN COALESCE((SELECT value::int FROM universe_config WHERE key='talent_cost_tier_3'), 3)
            WHEN 4 THEN COALESCE((SELECT value::int FROM universe_config WHERE key='talent_cost_tier_4'), 4)
            WHEN 5 THEN COALESCE((SELECT value::int FROM universe_config WHERE key='talent_cost_tier_5'), 5)
            ELSE 1
          END
        )), 0) AS total_exilium
      FROM flagships f
      LEFT JOIN flagship_talents ft ON ft.flagship_id = f.id AND ft.current_rank > 0
      LEFT JOIN talent_definitions td ON td.id = ft.talent_id
      GROUP BY f.id, f.user_id
    `);

    let totalRefunded = 0;
    let countRefunded = 0;
    for (const row of refunds) {
      if (row.total_exilium <= 0) continue;
      await db.transaction(async (tx) => {
        await tx.update(userExilium).set({
          balance: sql`${userExilium.balance} + ${row.total_exilium}`,
          totalEarned: sql`${userExilium.totalEarned} + ${row.total_exilium}`,
          updatedAt: new Date(),
        }).where(eq(userExilium.userId, row.user_id));
        await tx.insert(exiliumLog).values({
          userId: row.user_id,
          amount: row.total_exilium,
          source: 'talent_refund',
          details: { flagshipId: row.flagship_id, computedExilium: row.total_exilium },
        });
      });
      totalRefunded += row.total_exilium;
      countRefunded++;
    }
    console.log(`✓ Refunded ${totalRefunded} Exilium across ${countRefunded} flagships`);

    // ── Step 3: starter pack ───────────────────────────────────────────────
    console.log('Inserting starter modules...');
    const allFlagships = await db.select({ id: flagships.id, hullId: flagships.hullId })
      .from(flagships).where(sql`${flagships.hullId} IS NOT NULL`);

    let starterCount = 0;
    for (const f of allFlagships) {
      const starterId = STARTER_MODULES_BY_HULL[f.hullId!];
      if (!starterId) {
        console.warn(`  ! No starter for hull "${f.hullId}" (flagship ${f.id})`);
        continue;
      }
      const result = await db.insert(flagshipModuleInventory).values({
        flagshipId: f.id, moduleId: starterId, count: 1,
      }).onConflictDoNothing();
      starterCount++;
    }
    console.log(`✓ Starter pack distributed (${starterCount} flagships)`);

    // ── Step 4: set marker ─────────────────────────────────────────────────
    await db.execute(sql`
      INSERT INTO _migrations_state (key, value) VALUES ('flagship_modules_refund', 'done')
      ON CONFLICT (key) DO UPDATE SET value = 'done', set_at = now()
    `);
    console.log('✓ Marker set — script will skip refund/starter on re-run');

  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run on staging to verify**

Run:
```bash
DATABASE_URL=$STAGING_DATABASE_URL pnpm --filter @exilium/api tsx src/scripts/migrate-talents-to-modules.ts
```
Expected output:
```
Seeding 57 modules...
✓ Modules seeded
Computing Exilium refund per flagship...
✓ Refunded N Exilium across M flagships
Inserting starter modules...
✓ Starter pack distributed (X flagships)
✓ Marker set — script will skip refund/starter on re-run
```

- [ ] **Step 3: Re-run to verify idempotence**

Run the same command again.
Expected output (should NOT refund again):
```
✓ Migration already applied (marker present). Skipping refund + starter.
Seeding 57 modules...
✓ Modules seeded
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/scripts/migrate-talents-to-modules.ts
git commit -m "$(cat <<'EOF'
feat(modules): script de migration talents → modules + refund Exilium

- Seed les 57 modules (idempotent ON CONFLICT)
- Refund Exilium par flagship = SUM(rank × tier_cost), source='talent_refund'
- Insert 1 starter par flagship selon hull_id
- Marker _migrations_state.flagship_modules_refund='done' bloque le re-run

À exécuter une fois post-déploiement, avant le rename des tables legacy
(qui sera fait dans une migration SQL séparée plus tard).
EOF
)"
```

---

## Task 9 : Anomaly integration — snapshot loadout + drops + applyModulesToStats

**Files:**
- Modify: `apps/api/src/modules/anomaly/anomaly.combat.ts`
- Modify: `apps/api/src/modules/anomaly/anomaly.service.ts`
- Modify: `apps/api/src/modules/anomaly/anomaly.router.ts`
- Modify: `apps/api/src/trpc/app-router.ts` (pass modulesService to anomaly)

- [ ] **Step 1: Pass modulesService to createAnomalyService**

Modify `apps/api/src/trpc/app-router.ts` — find the line `const anomalyService = createAnomalyService(...)` and add `modulesService` as last arg:

```ts
const anomalyService = createAnomalyService(db, gameConfigService, exiliumService, flagshipService, reportService, anomalyContentService, modulesService);
```

- [ ] **Step 2: Update createAnomalyService signature**

Modify `apps/api/src/modules/anomaly/anomaly.service.ts`:

In imports, add:
```ts
import type { createModulesService } from '../modules/modules.service.js';
import { parseLoadout, applyModulesToStats, getMaxCharges, resolveActiveAbility } from '@exilium/game-engine';
```

Update the `createAnomalyService` function signature:
```ts
export function createAnomalyService(
  db: Database,
  gameConfigService: GameConfigService,
  exiliumService: ReturnType<typeof createExiliumService>,
  flagshipService: ReturnType<typeof createFlagshipService>,
  reportService: ReturnType<typeof createReportService>,
  anomalyContentService: ReturnType<typeof createAnomalyContentService>,
  modulesService: ReturnType<typeof createModulesService>,
) {
```

- [ ] **Step 3: Snapshot loadout at engage**

Modify `apps/api/src/modules/anomaly/anomaly.service.ts` — in the `engage` method, find the line where `nextNodeAt` is computed and the row is inserted. Modify the insert to include the snapshot:

Before the `tx.insert(anomalies).values(...)` call, add:
```ts
        const [flagshipRow] = await tx.select({
          loadout: flagships.moduleLoadout,
          chargesMax: flagships.epicChargesMax,
          hullId: flagships.hullId,
        }).from(flagships).where(eq(flagships.userId, userId)).limit(1);
        const equippedSnapshot = flagshipRow?.loadout ?? {};

        // Reset epic charges to max for this run
        await tx.update(flagships).set({
          epicChargesCurrent: flagshipRow?.chargesMax ?? 1,
        }).where(eq(flagships.userId, userId));
```

Then in the values of the insert, add:
```ts
          equippedModules: equippedSnapshot,
          pendingEpicEffect: null,
```

(Make sure to import `flagships` from `@exilium/db` if not already done.)

- [ ] **Step 4: Apply modules to flagship stats in combat preparation**

Modify `apps/api/src/modules/anomaly/anomaly.combat.ts` — first update the static imports at the top of the file. Find :
```ts
import {
  simulateCombat,
  computeFleetFP,
  scaleFleetToFP,
  anomalyEnemyFP,
  type CombatInput,
  type ShipCombatConfig,
  ...
} from '@exilium/game-engine';
```

Replace with (add `applyModulesToStats`, `parseLoadout`, types) :
```ts
import {
  simulateCombat,
  computeFleetFP,
  scaleFleetToFP,
  anomalyEnemyFP,
  applyModulesToStats,
  parseLoadout,
  type CombatInput,
  type ShipCombatConfig,
  type ModuleDefinitionLite,
  type CombatContext,
  ...
} from '@exilium/game-engine';
```

Then update `loadFlagshipCombatConfig` :

```ts
async function loadFlagshipCombatConfig(
  db: Database,
  userId: string,
  hullPercent: number,
  modulesContext?: {
    equippedModules: ModuleDefinitionLite[];
    combatContext: CombatContext;
  },
): Promise<ShipCombatConfig | null> {
  const [flagship] = await db.select().from(flagships).where(eq(flagships.userId, userId)).limit(1);
  if (!flagship) return null;

  let baseDamage = flagship.weapons;
  let baseShield = flagship.shield;
  let baseHull = Math.max(1, Math.floor(flagship.hull * hullPercent));
  let baseArmor = flagship.baseArmor ?? 0;

  if (modulesContext) {
    const modified = applyModulesToStats(
      { damage: baseDamage, hull: baseHull, shield: baseShield, armor: baseArmor, cargo: 0, speed: 0, regen: 0 },
      modulesContext.equippedModules,
      modulesContext.combatContext,
    );
    baseDamage = Math.round(modified.damage);
    baseShield = Math.round(modified.shield);
    baseHull = Math.round(modified.hull);
    baseArmor = Math.round(modified.armor);
  }

  return {
    shipType: 'flagship',
    categoryId: 'capital',
    baseShield,
    baseArmor,
    baseHull,
    baseWeaponDamage: baseDamage,
    baseShotCount: flagship.shotCount ?? 1,
  };
}
```

- [ ] **Step 5: Wire modulesContext in runAnomalyNode**

Modify `apps/api/src/modules/anomaly/anomaly.combat.ts` — find `runAnomalyNode` function. After loading the row's equipped modules and pending effect, build the context.

In the function body, add early (using static imports from Step 4) :
```ts
  // Build modules context for this combat
  const pool = await modulesService._getPool();
  const flagshipRow = await db.select({ hullId: flagships.hullId }).from(flagships).where(eq(flagships.userId, args.userId)).limit(1);
  const hullId = flagshipRow[0]?.hullId ?? 'combat';
  const equippedSnapshot = (args.equippedModules ?? {}) as Record<string, unknown>;
  const equipped = parseLoadout(equippedSnapshot as never, hullId, pool).equipped;
  const combatContext = {
    roundIndex: 1,
    currentHullPercent: args.fleet['flagship']?.hullPercent ?? 1,
    enemyFP: args.predefinedEnemy.fp,
    pendingEpicEffect: args.pendingEpicEffect ?? null,
  };
```

This requires extending `runAnomalyNode`'s args type to include `equippedModules` and `pendingEpicEffect`. Update the type:

Find `args: { userId: string; fleet: ...; depth: number; predefinedEnemy: ...; }` and add:
```ts
  equippedModules?: unknown;
  pendingEpicEffect?: { ability: string; magnitude: number } | null;
```

Then at the call site of `loadFlagshipCombatConfig`, pass the `modulesContext`:

```ts
  const flagshipConfig = await loadFlagshipCombatConfig(db, args.userId, flagshipEntry.hullPercent, {
    equippedModules: equipped,
    combatContext,
  });
```

(Note: this is called once for the FP calc and once for combat. Pass the context both times.)

ALSO: add `modulesService` as a param to `runAnomalyNode` so it can call `_getPool`:
```ts
export async function runAnomalyNode(
  db: Database,
  gameConfigService: GameConfigService,
  modulesService: ReturnType<typeof import('../modules/modules.service.js').createModulesService>,
  args: { ... },
)
```

Update the caller in `anomaly.service.ts` to pass modulesService.

- [ ] **Step 6: Roll per-combat drop + extend mutation response for UI**

Modify `apps/api/src/modules/anomaly/anomaly.service.ts` — in the `advance` method, in the `survived` branch, after the loot is computed, roll the drop AND fetch the module def to return :

```ts
        // Roll per-combat module drop
        const flagshipForDrop = await tx.select({ id: flagships.id, hullId: flagships.hullId }).from(flagships).where(eq(flagships.userId, userId)).limit(1);
        const dropHullId = flagshipForDrop[0]?.hullId ?? 'combat';
        const droppedModuleId = await modulesService.rollPerCombatDrop({ flagshipHullId: dropHullId });
        let droppedModule: { id: string; name: string; rarity: string; image: string } | null = null;
        if (droppedModuleId && flagshipForDrop[0]) {
          await modulesService.grantModule(flagshipForDrop[0].id, droppedModuleId);
          const [def] = await tx.select({
            id: moduleDefinitions.id, name: moduleDefinitions.name,
            rarity: moduleDefinitions.rarity, image: moduleDefinitions.image,
          }).from(moduleDefinitions).where(eq(moduleDefinitions.id, droppedModuleId)).limit(1);
          if (def) droppedModule = def;
        }
```

Then update the survived return object to include `droppedModule`:

```ts
        return {
          outcome: 'survived' as const,
          // ... existing fields ...
          droppedModule, // null or { id, name, rarity, image }
        };
```

(Make sure `moduleDefinitions` is imported from `@exilium/db` at the top of the file.)

- [ ] **Step 7: Roll per-run final drop on retreat / success — return finalDrops**

In the `retreat` method, AND in `advance` survived branch when `currentDepth + 1 >= MAX_DEPTH` (run auto-complete), AND in forced_retreat branch :

```ts
        // Roll per-run final drop (no drop on wipe)
        const flagshipForFinal = await tx.select({ id: flagships.id, hullId: flagships.hullId }).from(flagships).where(eq(flagships.userId, userId)).limit(1);
        const finalDropDefs: Array<{ id: string; name: string; rarity: string; image: string; isFinal: true }> = [];
        if (flagshipForFinal[0]) {
          const finalDropIds = await modulesService.rollPerRunFinalDrop({
            flagshipHullId: flagshipForFinal[0].hullId ?? 'combat',
            depth: row.currentDepth,
          });
          for (const moduleId of finalDropIds) {
            await modulesService.grantModule(flagshipForFinal[0].id, moduleId);
            const [def] = await tx.select({
              id: moduleDefinitions.id, name: moduleDefinitions.name,
              rarity: moduleDefinitions.rarity, image: moduleDefinitions.image,
            }).from(moduleDefinitions).where(eq(moduleDefinitions.id, moduleId)).limit(1);
            if (def) finalDropDefs.push({ ...def, isFinal: true });
          }
        }
```

Add `finalDrops: finalDropDefs` to the return objects of `retreat`, `forced_retreat`, and `survived` (when run completes at max depth).

For wipe : `finalDrops: []` (consistent shape, just empty).

The mutations API now returns enough data for `AnomalyLootSummaryModal` to render directly without diffing inventory.

- [ ] **Step 8: Add anomaly.activateEpic mutation**

Modify `apps/api/src/modules/anomaly/anomaly.router.ts` — add:

```ts
    activateEpic: protectedProcedure
      .input(z.object({ hullId: z.string() }))
      .mutation(({ ctx, input }) => anomalyService.activateEpic(ctx.userId!, input.hullId)),
```

In `anomaly.service.ts`, add the `activateEpic` method:

```ts
    /**
     * Activate the epic ability of the equipped module on the active anomaly.
     * Consumes 1 charge from `flagships.epic_charges_current`. Routes to
     * immediate effect (mutates fleet) or pending effect (next combat).
     */
    async activateEpic(userId: string, hullId: string) {
      return await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}::text))`);

        const [flagship] = await tx.select().from(flagships).where(eq(flagships.userId, userId)).for('update').limit(1);
        if (!flagship) throw new TRPCError({ code: 'NOT_FOUND', message: 'Flagship introuvable' });
        if (flagship.epicChargesCurrent <= 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Aucune charge épique disponible' });
        }

        const [active] = await tx.select().from(anomalies).where(and(eq(anomalies.userId, userId), eq(anomalies.status, 'active'))).for('update').limit(1);
        if (!active) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Pas d\'anomaly active' });

        const loadout = (flagship.moduleLoadout ?? {}) as Record<string, { epic: string | null }>;
        const epicId = loadout[hullId]?.epic;
        if (!epicId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Aucun module épique équipé' });

        const pool = await modulesService._getPool();
        const epicMod = pool.find((m) => m.id === epicId);
        if (!epicMod || epicMod.effect.type !== 'active') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Module épique invalide' });
        }

        const resolved = resolveActiveAbility(epicMod.effect.ability, epicMod.effect.magnitude);

        // Consume charge
        await tx.update(flagships).set({
          epicChargesCurrent: sql`${flagships.epicChargesCurrent} - 1`,
        }).where(eq(flagships.id, flagship.id));

        if (resolved.applied === 'immediate') {
          // Apply directly to anomaly fleet
          if (resolved.ability === 'repair') {
            const fleet = (active.fleet ?? {}) as Record<string, { count: number; hullPercent: number }>;
            const newFleet = { ...fleet };
            for (const [shipId, entry] of Object.entries(fleet)) {
              newFleet[shipId] = { ...entry, hullPercent: Math.min(1, entry.hullPercent + resolved.magnitude) };
            }
            await tx.update(anomalies).set({ fleet: newFleet }).where(eq(anomalies.id, active.id));
          } else if (resolved.ability === 'skip') {
            // skip = mark next combat as skipped (clear nextEnemyFleet, force combat result)
            // For V1 simplicity, just advance the depth without combat.
            await tx.update(anomalies).set({
              currentDepth: active.currentDepth + 1,
              nextEnemyFleet: null,
              nextEnemyFp: null,
              nextNodeAt: new Date(),
            }).where(eq(anomalies.id, active.id));
          }
          // 'scan' has no game effect in V1 — pure UI hint (would reveal hidden event outcomes)
          await tx.update(anomalies).set({ pendingEpicEffect: null }).where(eq(anomalies.id, active.id));
        } else {
          // Persist for next combat
          await tx.update(anomalies).set({
            pendingEpicEffect: { ability: resolved.ability, magnitude: resolved.magnitude },
          }).where(eq(anomalies.id, active.id));
        }

        return {
          ability: resolved.ability,
          magnitude: resolved.magnitude,
          applied: resolved.applied,
          remainingCharges: flagship.epicChargesCurrent - 1,
        };
      });
    },
```

- [ ] **Step 9: Clear pendingEpicEffect after combat consumes it**

In the `advance` method, after the combat resolves and before returning, add:
```ts
        // Clear pending epic effect (consumed by this combat)
        if (row.pendingEpicEffect) {
          await tx.update(anomalies).set({ pendingEpicEffect: null }).where(eq(anomalies.id, row.id));
        }
```

- [ ] **Step 10: Lint + typecheck + test**

Run: `pnpm turbo lint typecheck test --filter=@exilium/api`
Expected: 0 errors. All existing tests still pass.

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/modules/anomaly/ apps/api/src/trpc/app-router.ts
git commit -m "$(cat <<'EOF'
feat(anomaly): intégration modules — snapshot, drops, applyStats, epic

- engage : snapshot du loadout actif sur anomalies.equipped_modules,
  reset epic_charges_current à epic_charges_max
- runAnomalyNode : applyModulesToStats sur le flagship (damage/hull/
  shield/armor) + applique pending_epic_effect (overcharge, shield_burst)
- advance survived : roll per-combat drop (30% own + 5% other coque)
- retreat / depth-max : roll per-run drop selon profondeur (1c → 1c +
  1r + chance épique)
- activateEpic : nouvelle mutation anomaly.activateEpic
  - immediate (repair, scan, skip) → mutate fleet/anomaly state
  - pending (overcharge, shield_burst, damage_burst) → persiste sur
    pending_epic_effect, consommé au prochain combat
- Cleanup pendingEpicEffect après combat
EOF
)"
```

---

## Task 10 : Front loot toast + AnomalyLootSummaryModal

**Files:**
- Create: `apps/web/src/components/anomaly/AnomalyLootSummaryModal.tsx`
- Modify: `apps/web/src/pages/Anomaly.tsx`

- [ ] **Step 1: Create AnomalyLootSummaryModal**

Create `apps/web/src/components/anomaly/AnomalyLootSummaryModal.tsx`:

```tsx
import { Link } from 'react-router';
import { X, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DroppedModule {
  id: string;
  name: string;
  rarity: string;
  image: string;
  isFinal?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  drops: DroppedModule[];
  resources: { minerai: number; silicium: number; hydrogene: number };
  exiliumRefunded: number;
  outcome: 'survived' | 'wiped' | 'forced_retreat';
}

const RARITY_TONE: Record<string, string> = {
  common: 'border-gray-400/50 bg-gray-500/10 text-gray-200',
  rare:   'border-blue-400/50 bg-blue-500/10 text-blue-200',
  epic:   'border-violet-400/60 bg-violet-500/15 text-violet-200',
};

export function AnomalyLootSummaryModal({ open, onClose, drops, resources, exiliumRefunded, outcome }: Props) {
  if (!open) return null;
  const totalRes = resources.minerai + resources.silicium + resources.hydrogene;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-400" />
            <h2 className="text-lg font-bold">
              {outcome === 'wiped' ? 'Run terminée — wipe' : 'Butin de fin de run'}
            </h2>
          </div>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground hover:text-foreground" /></button>
        </div>

        {drops.length > 0 && (
          <div>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Modules récupérés</h3>
            <div className="grid grid-cols-3 gap-2">
              {drops.map((m, i) => (
                <div key={i} className={`rounded-md border-2 p-2 ${RARITY_TONE[m.rarity] ?? ''} ${m.isFinal ? 'ring-2 ring-yellow-500/30' : ''}`}>
                  {m.image && <img src={`${m.image}-thumb.webp`} className="w-full h-12 rounded object-cover mb-1" alt="" />}
                  <div className="text-xs font-semibold truncate">{m.name}</div>
                  <div className="text-[10px] uppercase tracking-wider opacity-70">{m.rarity}{m.isFinal && ' · final'}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {totalRes > 0 && (
          <div>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Ressources</h3>
            <div className="flex gap-3 text-sm">
              {resources.minerai > 0 && <span className="text-minerai">+{resources.minerai} M</span>}
              {resources.silicium > 0 && <span className="text-silicium">+{resources.silicium} Si</span>}
              {resources.hydrogene > 0 && <span className="text-hydrogene">+{resources.hydrogene} H</span>}
            </div>
          </div>
        )}

        {exiliumRefunded > 0 && (
          <div className="text-sm text-purple-300">
            ⚡ +{exiliumRefunded} Exilium remboursé
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Fermer</Button>
          <Link to="/flagship"><Button>Voir mes modules →</Button></Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Mount the modal in Anomaly.tsx**

Modify `apps/web/src/pages/Anomaly.tsx`:

Add import:
```tsx
import { AnomalyLootSummaryModal } from '@/components/anomaly/AnomalyLootSummaryModal';
```

Add state in the main `Anomaly` component:
```tsx
  const [lootSummary, setLootSummary] = useState<{
    drops: Array<{ id: string; name: string; rarity: string; image: string; isFinal?: boolean }>;
    resources: { minerai: number; silicium: number; hydrogene: number };
    exiliumRefunded: number;
    outcome: 'survived' | 'wiped' | 'forced_retreat';
  } | null>(null);
```

In `advanceMutation.onSuccess`, after the toast, if `data.outcome === 'wiped'` or `data.outcome === 'forced_retreat'` (run ended), set the loot summary. Same for `retreatMutation.onSuccess`.

Mount the modal at end of JSX:
```tsx
      <AnomalyLootSummaryModal
        open={!!lootSummary}
        onClose={() => setLootSummary(null)}
        drops={lootSummary?.drops ?? []}
        resources={lootSummary?.resources ?? { minerai: 0, silicium: 0, hydrogene: 0 }}
        exiliumRefunded={lootSummary?.exiliumRefunded ?? 0}
        outcome={lootSummary?.outcome ?? 'survived'}
      />
```

(The exact wiring — extracting `drops` from API response — depends on what the anomaly mutations return. For V1, the drops are inserted in the DB by the service but not necessarily returned in the mutation response. Simplest path : fetch the new modules from `inventory.list` after the mutation and diff against previous state. Or extend the mutation response to include `dropsThisRun: []`. Document this for the implementer to choose.)

- [ ] **Step 3: Add in-run drop toast**

In `Anomaly.tsx` advanceMutation onSuccess, when there's a per-combat drop in the response (extend the API to return `droppedModule: { id, name, rarity }` or null), add:

```tsx
if (data.droppedModule) {
  addToast(`✨ +1 module : ${data.droppedModule.name} (${data.droppedModule.rarity})`, 'success');
}
```

(This requires extending `anomaly.advance` return type to include `droppedModule`. Update `anomaly.service.ts` survived branch to return it.)

- [ ] **Step 4: Lint + typecheck**

Run: `pnpm turbo lint typecheck --filter=@exilium/web`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/anomaly/AnomalyLootSummaryModal.tsx apps/web/src/pages/Anomaly.tsx
git commit -m "$(cat <<'EOF'
feat(anomaly): toast in-run + modal butin fin de run

- AnomalyLootSummaryModal : grille modules récupérés (final highlighted),
  ressources, Exilium remboursé, CTA vers /flagship
- Toast in-run pour chaque drop per-combat
- Mounted dans Anomaly.tsx, déclenché sur outcome wiped/forced_retreat/
  survived (depth max)

Note : anomaly.advance et .retreat retournent maintenant droppedModule
et finalDrops dans leur response pour piloter ces UI.
EOF
)"
```

---

## Task 11 : Final lint + tests + commit + deploy

- [ ] **Step 1: Full lint + typecheck across all packages**

Run: `pnpm turbo lint typecheck --filter=@exilium/api --filter=@exilium/admin --filter=@exilium/web --filter=@exilium/game-engine --filter=@exilium/db --filter=@exilium/shared`
Expected: 0 errors.

- [ ] **Step 2: Full test suite**

Run: `pnpm turbo test --filter=@exilium/api --filter=@exilium/game-engine`
Expected: All tests pass (~340+ existing + 15 new modules tests).

- [ ] **Step 3: Push and deploy**

Run:
```bash
git push origin main
/opt/exilium/scripts/deploy.sh
```

Expected: Migration 0068 applied, PM2 reload OK, Caddy reload OK.

- [ ] **Step 4: Run the migration script post-deploy**

Run on the server:
```bash
cd /opt/exilium && pnpm --filter @exilium/api tsx src/scripts/migrate-talents-to-modules.ts
```

Expected output:
```
Seeding 57 modules...
✓ Modules seeded
Computing Exilium refund per flagship...
✓ Refunded N Exilium across M flagships
Inserting starter modules...
✓ Starter pack distributed (X flagships)
✓ Marker set
```

- [ ] **Step 5: Smoke test in browser**

- Open https://exilium-game.com/flagship
- Verify Modules tab is visible
- Verify the 3 hull tabs (Combat / Scientific / Industrial)
- Verify the loadout grid shows 9 slots
- Verify the inventory shows the starter module
- Try equipping the starter (should succeed)
- Try unequipping (should succeed)

- Open https://admin.exilium-game.com/modules
- Verify the 57 modules appear (3 sections × 3 raretés)
- Try editing a module (change description, save)
- Try toggling enabled

- [ ] **Step 6: Publish announcement**

Insert announcement via the admin announcements page OR direct SQL :

```sql
INSERT INTO announcements (id, title, message, severity, published_at, expires_at)
VALUES (
  gen_random_uuid(),
  'Talents → Modules : nouvelle progression flagship',
  'Le système de talents a évolué. Votre Exilium investi a été remboursé. Découvrez la nouvelle page Modules sur l''écran flagship — vous démarrez avec 1 module starter et il y en a 56 autres à looter via les anomalies !',
  'info',
  now(),
  now() + interval '14 days'
);
```

(Adapt to actual `announcements` schema if columns differ.)

- [ ] **Step 7: Monitor logs**

Run on server: `pm2 logs exilium-api --lines 100`
Look for any errors related to modules / equip / loadout. Should be clean.

Also check: `psql ... -c "SELECT COUNT(*) FROM flagship_module_inventory"` — should be ≈ count of flagships with hull (each got their starter).

---

## Task 12 (FUTURE) : Rename legacy talents tables

> **À exécuter 1-2 sprints APRÈS le déploiement initial**, une fois que tu confirmes que tout fonctionne (refund OK, modules opérationnels, aucun rollback nécessaire). Cette task est une **migration séparée**, pas dans le sprint initial.

**Files:**
- Create: `packages/db/drizzle/0069_archive_talents.sql`

- [ ] **Step 1: Write the rename migration**

Create `packages/db/drizzle/0069_archive_talents.sql`:

```sql
-- Archive (rename) legacy talents tables. Pas de DROP — on garde 1-2 sprints
-- de plus pour audit/rollback éventuel. La suppression définitive sera dans
-- une migration ultérieure (0070+) après confirmation que rien n'en dépend.
ALTER TABLE IF EXISTS flagship_talents RENAME TO flagship_talents_archive;
ALTER TABLE IF EXISTS talent_definitions RENAME TO talent_definitions_archive;
ALTER TABLE IF EXISTS talent_branch_definitions RENAME TO talent_branch_definitions_archive;
```

- [ ] **Step 2: Remove Drizzle schema files for talents**

Delete (or rename to .archive.ts):
- `packages/db/src/schema/flagship-talents.ts`
- `packages/db/src/schema/talent-definitions.ts`
- `packages/db/src/schema/talent-branch-definitions.ts`

Remove their exports from `packages/db/src/schema/index.ts`.

- [ ] **Step 3: Remove dead service code**

Delete `apps/api/src/modules/flagship/talent.service.ts`, `talent.router.ts` (and their test files if any). Remove imports/wiring from `apps/api/src/trpc/app-router.ts`.

- [ ] **Step 4: Lint + typecheck + test**

Run: `pnpm turbo lint typecheck test --filter=@exilium/api --filter=@exilium/db`
Expected: 0 errors.

- [ ] **Step 5: Deploy + verify**

Apply migration via deploy.sh. Verify the renamed tables still exist (`\dt *_archive`) and no app errors are logged.

- [ ] **Step 6: Commit**

```bash
git add packages/db/drizzle/0069_archive_talents.sql packages/db/src/schema/ apps/api/src/modules/flagship/ apps/api/src/trpc/app-router.ts
git commit -m "$(cat <<'EOF'
refactor(talents): archive legacy talent tables (rename _archive)

Migration 0069 : rename flagship_talents, talent_definitions et
talent_branch_definitions vers _archive. Suppression définitive dans
une migration ultérieure (après audit complet).

Suppression du code service/router talents (mort depuis le déploiement
des modules en sub-projet 1).
EOF
)"
```

---

## Self-Review Checklist (post-write, pre-handoff)

After writing this plan, verify against the spec :

**Spec coverage check :**
- ✅ §2.1 slots & raretés → Tasks 1, 7
- ✅ §2.2 stacking additif → Task 2 (applyModulesToStats)
- ✅ §2.3 hull binding → Task 4 (equip validation)
- ✅ §2.4 charges épiques → Tasks 2, 7, 9
- ✅ §2.5 pool size 57 → Task 3
- ✅ §3.1 drops per-combat + per-run → Task 4 (rolls), Task 9 (intégration)
- ✅ §3.3 permanence (count++) → Task 4 (grantModule)
- ✅ §4 équipement règles + verrou in_mission → Task 4 (equip)
- ✅ §5.1 page flagship → Task 7
- ✅ §5.2 page anomaly modules display → Task 9 (snapshot)
- ✅ §5.3 toast in-run → Task 10
- ✅ §5.4 modal butin → Task 10
- ✅ §5.5 admin → Task 6
- ✅ §6 schema → Task 1
- ✅ §6.6 effect Zod → Task 3
- ✅ §7 migration (refund + starter + idempotence) → Task 8
- ✅ §8.1 game engine → Task 2
- ✅ §8.2 API service + router → Tasks 4, 9
- ✅ §8.3 front → Tasks 7, 10
- ✅ §8.4 image upload → Task 5
- ✅ §9 tests → Task 2 (engine), Task 11 (smoke)
- ✅ §10 edge cases → couverts dans equip validation + parseLoadout silent ignores

**Placeholder scan :** aucun "TBD" ni "implement later".

**Type consistency :**
- `ModuleDefinition` (Zod-inferred) used uniformly
- `ModuleLoadoutDb` (jsonb shape) consistent across service + types
- Engine types `ModuleDefinitionLite`, `CombatStats`, `CombatContext` match service builds

**Couverture des tests :**
- 15 tests engine (parseLoadout, applyModulesToStats, getMaxCharges) — Task 2
- 6 tests service (rollPerCombatDrop distribution + rollPerRunFinalDrop par depth) — Task 4 step 4
- Smoke E2E manuel post-deploy — Task 11
- Tests d'équipement (validation slot/coque/rareté) skippés en V1 — couverts par smoke

---

## Notes pour l'exécutant

- **Sub-skill recommended :** `superpowers:subagent-driven-development` (1 subagent par task, review entre tasks)
- **Risque le plus élevé :** Task 9 (anomaly integration) — modifie le combat existant, demande prudence sur les snapshots et les pendingEpicEffect
- **Workload contenu (12-14h) :** la majorité du temps est dans Task 3 (rédaction des 57 modules), Task 7 (UI flagship), Task 9 (anomaly integration)
- **Migration safe :** Task 8 est idempotent + n'efface jamais de tables (rename des legacy = Task 12, **explicitement reportée à un sprint ultérieur** après validation que tout tourne)
- **Tasks parallélisables avec subagent-driven** : 5 (image upload), 6 (admin), 7 (front flagship) sont indépendantes une fois Tasks 1-4 terminées
- **Ordre critique** : Task 8 (script migration) doit s'exécuter APRÈS le déploiement (Task 11), pas avant — sinon les nouvelles colonnes flagships n'existent pas encore
