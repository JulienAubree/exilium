# Suppression du système Talents — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Retirer entièrement le système de talents flagship en redistribuant les 19 effets vers modules existants / passifs coque / stats baseline / upgrades bâtiment, sans perte de pouvoir joueur et sans toucher aux 30 call sites consommateurs côté backend.

**Architecture :** Migration DB en 1 fichier SQL (rename 4 tables + UPDATE flagships baseline + cleanup universe_config). Backend : `talentService.computeTalentContext()` garde son API publique mais voit son implémentation réduite à un thin wrapper qui retourne uniquement les bonus coque + parallel_build. Toutes les autres méthodes du service + route tRPC + UI talents disparaissent. Admin : la page `Talents.tsx` est renommée `Flagship.tsx` (préserve `FlagshipImagePool` + `HullConfigSection` qui n'étaient pas dédiés aux talents).

**Tech Stack :** Drizzle/Postgres, tRPC 11, React 19, Vite 6, vitest, pnpm turbo.

**Spec source :** `docs/superpowers/specs/2026-05-03-talents-removal-design.md`

---

## File Structure

### Files to CREATE

| Path | Responsabilité |
|---|---|
| `packages/db/drizzle/0069_talents_archive.sql` | Rename 3 tables (NOT flagship_cooldowns — utilisée par scan), baseline UPDATE, universe_config cleanup, marker |
| `apps/api/src/modules/flagship/__tests__/talent.service.test.ts` | Tests parallel_build + hull passives + baseline |

### Files to DELETE

| Path | Raison |
|---|---|
| `apps/api/src/modules/flagship/talent.router.ts` | UI talent supprimée |
| `apps/web/src/pages/FlagshipTalents.tsx` | UI talent supprimée |
| `apps/web/src/components/flagship/TalentTree.tsx` | UI talent supprimée |
| `apps/admin/src/pages/talents/BranchCard.tsx` | UI talent admin supprimée |
| `apps/admin/src/pages/talents/constants.ts` | Constants talent (BRANCH_FIELDS, BRANCH_EDIT_FIELDS) |
| `apps/admin/src/pages/talents/helpers.ts` | Helpers talent (talentFields, talentToForm) |
| `apps/admin/src/pages/player-detail/TalentsSection.tsx` | Section talent dans player detail |

### Files to MOVE/RENAME

| From | To | Raison |
|---|---|---|
| `apps/admin/src/pages/talents/FlagshipImagePool.tsx` | `apps/admin/src/pages/flagship/FlagshipImagePool.tsx` | Pas dédié aux talents — préserver |
| `apps/admin/src/pages/talents/HullConfigSection.tsx` | `apps/admin/src/pages/flagship/HullConfigSection.tsx` | Pas dédié aux talents — préserver |
| `apps/admin/src/pages/talents/HullEditModal.tsx` | `apps/admin/src/pages/flagship/HullEditModal.tsx` | Utilisé par HullConfigSection |
| `apps/admin/src/pages/Talents.tsx` | `apps/admin/src/pages/Flagship.tsx` | Réduit à FlagshipImagePool + HullConfigSection |

### Files to MODIFY

| Path | Changement |
|---|---|
| `packages/db/src/schema/index.ts` | Retirer exports `flagship-talents`, `talent-*` (PAS `flagship-cooldowns` — encore utilisée par scan_mission) |
| `packages/db/src/seed-game-config.ts` | Retirer imports talent, TALENT_BRANCHES, TALENT_DEFINITIONS, seed loops |
| `apps/api/src/modules/flagship/talent.service.ts` | Réduit à `computeTalentContext` thin wrapper |
| `apps/api/src/modules/flagship/flagship.service.ts` | Retirer bloc `if (talentService) { ... }` lignes 119-161, simplifier `effectiveStats` |
| `apps/api/src/modules/admin/game-config.service.ts` | Retirer CRUD talent (lignes 21-22 imports + 700+ handlers) |
| `apps/api/src/trpc/app-router.ts` | Retirer `createTalentService` instantiation + `talentRouter` route + import |
| `apps/web/src/pages/FlagshipProfile.tsx` | Retirer ligne 36 (`trpc.talent.list`) + `<TalentTree showGuide />` |
| `apps/web/src/components/flagship/HullAbilitiesPanel.tsx` | Retirer `trpc.talent.list`, simplifier props AbilityCard |
| `apps/web/src/router.tsx` | Retirer route `/flagship/talents` |
| `apps/admin/src/router.tsx` | Renommer route `/talents` → `/flagship` (lazy import Flagship.tsx) |
| `apps/admin/src/components/layout/AdminLayout.tsx` | Renommer entrée nav "Talents Flagship" → "Flagship" |
| `apps/admin/src/pages/PlayerDetail.tsx` | Retirer import + render `<TalentsSection>` |
| `apps/admin/src/pages/GameplayKeys.tsx` | Retirer 5 catégories talent_*, 9 keys talent_stat, formules sans "+ talent" |
| `docs/processes/talent-creation-process.md` | Bandeau "🗄️ ARCHIVÉ" |
| `docs/superpowers/specs/2026-03-27-flagship-talent-tree-design.md` | Bandeau "🗄️ ARCHIVÉ" |
| `docs/superpowers/specs/2026-03-28-talent-effect-system-design.md` | Bandeau "🗄️ ARCHIVÉ" |
| `docs/superpowers/specs/2026-04-03-sci-energy-talent-design.md` | Bandeau "🗄️ ARCHIVÉ" |
| `docs/superpowers/plans/2026-03-27-phase2-flagship-talents.md` | Bandeau "🗄️ ARCHIVÉ" |

---

## Task 1 : Migration SQL `0069_talents_archive.sql`

**Files:**
- Create: `packages/db/drizzle/0069_talents_archive.sql`

- [ ] **Step 1: Write the migration SQL**

Create `packages/db/drizzle/0069_talents_archive.sql`:

```sql
-- Archive les 3 tables talents (rename, données préservées pour audit)
-- IMPORTANT : flagship_cooldowns N'EST PAS archivée — elle stocke aussi le
-- cooldown du scan_mission (hull ability) via talent_id='scan_mission'.
-- La colonne talent_id devient un identifiant générique d'ability cooldown.
ALTER TABLE flagship_talents              RENAME TO flagship_talents_archive;
ALTER TABLE talent_definitions            RENAME TO talent_definitions_archive;
ALTER TABLE talent_branch_definitions     RENAME TO talent_branch_definitions_archive;
-- flagship_cooldowns conservée telle quelle (utilisée par scan_mission)

-- Stats baseline relevées sur tous les flagships existants
-- GREATEST/LEAST protège ceux qui auraient déjà des valeurs supérieures
UPDATE flagships SET
  cargo_capacity   = GREATEST(cargo_capacity, 8000),
  base_speed       = GREATEST(base_speed, 13000),
  fuel_consumption = LEAST(fuel_consumption, 72),
  shot_count       = GREATEST(shot_count, 5);

-- Cleanup universe_config (clés liées aux talents)
DELETE FROM universe_config
WHERE key IN (
  'talent_cost_tier_1', 'talent_cost_tier_2', 'talent_cost_tier_3',
  'talent_cost_tier_4', 'talent_cost_tier_5',
  'talent_tier_2_threshold', 'talent_tier_3_threshold',
  'talent_tier_4_threshold', 'talent_tier_5_threshold',
  'talent_respec_ratio', 'talent_full_reset_cost'
);

-- Marker idempotence
INSERT INTO _migrations_state (key, value)
VALUES ('flagship_talents_archived', 'done')
ON CONFLICT (key) DO UPDATE SET value = 'done', set_at = now();
```

- [ ] **Step 2: Apply migration locally to verify SQL is valid**

Run: `pnpm --filter @exilium/db exec tsx scripts/apply-migration.ts 0069_talents_archive.sql` (adjust path to actual local migration runner script).

If no local apply tool exists, run via psql:
```bash
psql "$DATABASE_URL" -f packages/db/drizzle/0069_talents_archive.sql
```

Expected: 3 ALTER TABLE OK, 1 UPDATE returning row count (≈13), 1 DELETE returning row count (≈11), 1 INSERT.

- [ ] **Step 3: Verify the migration is idempotent**

Run the same psql command a second time. Expected: errors on ALTER TABLE (already renamed). This is expected — production deploy uses `apply-migrations.sh` which tracks applied migrations via `_drizzle_migrations` table, so re-runs are skipped.

If the migration SHOULD be idempotent at SQL level (defensive), wrap each ALTER in a check:
```sql
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'flagship_talents') THEN
    ALTER TABLE flagship_talents RENAME TO flagship_talents_archive;
  END IF;
END $$;
```

**Decision:** keep the simple version (no DO blocks) — `apply-migrations.sh` handles idempotence via meta tracking.

- [ ] **Step 4: Commit**

```bash
git add packages/db/drizzle/0069_talents_archive.sql
git commit -m "feat(db): archive talents tables + relève stats baseline flagship"
```

---

## Task 2 : Refactor `talent.service.ts` en thin wrapper

**Files:**
- Modify: `apps/api/src/modules/flagship/talent.service.ts`

- [ ] **Step 1: Replace the entire file with the new thin-wrapper implementation**

Overwrite `apps/api/src/modules/flagship/talent.service.ts` with:

```ts
import { eq } from 'drizzle-orm';
import { flagships, planetBuildings } from '@exilium/db';
import type { Database } from '@exilium/db';
import type { GameConfigService } from '../admin/game-config.service.js';

/**
 * Thin wrapper post-talents-removal (2026-05-03). The talent system was
 * archived; only the `computeTalentContext` API is preserved to avoid
 * touching the 30 call sites that consume it. The implementation now
 * returns only hull passive bonuses + parallel_build slot bonuses
 * (commandCenter ≥10 / shipyard ≥10 on the flagship's planet).
 *
 * The other methods (list / invest / respec / resetAll / activate /
 * getStatBonuses / getActiveBuffs / getGlobalBonuses / getPlanetBonuses)
 * have been removed — their UI / mutations no longer exist.
 *
 * Cosmetic rename to `flagshipBonusService` is deferred to a later PR.
 */
export function createTalentService(
  db: Database,
  gameConfigService: GameConfigService,
) {
  return {
    /**
     * Returns a Record of bonus keys → values for the given user/planet.
     * Kept identical in shape to the pre-removal API so all 30 consumers
     * keep working without modification.
     */
    async computeTalentContext(userId: string, planetId?: string): Promise<Record<string, number>> {
      const [flagship] = await db
        .select({
          id: flagships.id,
          planetId: flagships.planetId,
          status: flagships.status,
          hullId: flagships.hullId,
        })
        .from(flagships)
        .where(eq(flagships.userId, userId))
        .limit(1);
      if (!flagship) return {};

      const config = await gameConfigService.getFullConfig();
      const ctx: Record<string, number> = {};

      // 1. Passifs coque (toujours actifs, indépendants de la planète)
      if (flagship.hullId) {
        const hullConfig = config.hulls[flagship.hullId];
        if (hullConfig) {
          for (const [key, value] of Object.entries(hullConfig.passiveBonuses)) {
            // Conserver le préfixe `hull_` pour les bonus de réduction temps
            // (utilisés par les consumers existants comme `hull_combat_build_time_reduction`)
            if (key.endsWith('_time_reduction') || key.endsWith('_build_time_reduction')) {
              ctx[`hull_${key}`] = value as number;
            }
            // Bonus mining/prospection/repair NEW : exposés sans préfixe pour
            // remplacer les anciennes clés talent (mining_speed, prospection_speed,
            // flagship_repair_time).
            if (key === 'mining_speed_bonus')      ctx['mining_speed']         = value as number;
            if (key === 'prospection_speed_bonus') ctx['prospection_speed']    = value as number;
            if (key === 'repair_time_reduction')   ctx['flagship_repair_time'] = value as number;
          }
        }
      }

      // 2. Parallel build via bâtiments (planète flagship uniquement)
      if (planetId && flagship.planetId === planetId) {
        const pbRows = await db
          .select({ buildingId: planetBuildings.buildingId, level: planetBuildings.level })
          .from(planetBuildings)
          .where(eq(planetBuildings.planetId, planetId));
        const cmdLevel = pbRows.find((pb) => pb.buildingId === 'commandCenter')?.level ?? 0;
        const shyLevel = pbRows.find((pb) => pb.buildingId === 'shipyard')?.level ?? 0;
        if (cmdLevel >= 10) ctx['military_parallel_build']   = (ctx['military_parallel_build']   ?? 0) + 1;
        if (shyLevel >= 10) ctx['industrial_parallel_build'] = (ctx['industrial_parallel_build'] ?? 0) + 1;
      }

      return ctx;
    },
  };
}
```

- [ ] **Step 2: Verify the file compiles in isolation**

Run: `pnpm --filter @exilium/api exec tsc --noEmit src/modules/flagship/talent.service.ts`

(Or simpler: `pnpm turbo typecheck --filter=@exilium/api` and rely on the global check at the end of the task.)

Expected: no errors related to `talent.service.ts`. Errors related to OTHER files importing the removed methods (list/invest/etc.) are EXPECTED and will be fixed in Tasks 3-4.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/flagship/talent.service.ts
git commit -m "refactor(flagship): talentService réduit à thin wrapper computeTalentContext"
```

---

## Task 3 : Cleanup `flagshipService` + `gameConfigService`

**Files:**
- Modify: `apps/api/src/modules/flagship/flagship.service.ts`
- Modify: `apps/api/src/modules/admin/game-config.service.ts`

- [ ] **Step 1: Modify `flagship.service.ts` `get()` method**

Replace lines 119-161 (the `if (talentService) { ... }` block) with:

```ts
      const config = await gameConfigService.getFullConfig();

      // Always return hull config + effective stats for display
      const hullConfig = flagship.hullId ? (config.hulls[flagship.hullId] ?? null) : null;

      const effectiveStats = {
        weapons: flagship.weapons,
        shield: flagship.shield,
        hull: flagship.hull,
        baseArmor: flagship.baseArmor,
        shotCount: flagship.shotCount,
        cargoCapacity: flagship.cargoCapacity,
        fuelConsumption: flagship.fuelConsumption,
        baseSpeed: flagship.baseSpeed,
        driveType: flagship.driveType,
      };

      // Apply hull combat bonuses (only when stationed)
      if (hullConfig && flagship.status === 'active') {
        effectiveStats.weapons   += (hullConfig.passiveBonuses.bonus_weapons   ?? 0);
        effectiveStats.baseArmor += (hullConfig.passiveBonuses.bonus_armor     ?? 0);
        effectiveStats.shotCount += (hullConfig.passiveBonuses.bonus_shot_count ?? 0);
      }

      // Fetch active cooldowns for hull abilities (replaces the talent.list cooldowns
      // path used pre-removal). The flagship_cooldowns table is preserved — its
      // talent_id column now stores the ability id (e.g. 'scan_mission') rather
      // than a talent id.
      const cooldownRows = await db
        .select({
          abilityId: flagshipCooldowns.talentId,
          activatedAt: flagshipCooldowns.activatedAt,
          expiresAt: flagshipCooldowns.expiresAt,
          cooldownEnds: flagshipCooldowns.cooldownEnds,
        })
        .from(flagshipCooldowns)
        .where(eq(flagshipCooldowns.flagshipId, flagship.id));

      const cooldowns: Record<string, { activatedAt: string; expiresAt: string; cooldownEnds: string }> = {};
      for (const cd of cooldownRows) {
        cooldowns[cd.abilityId] = {
          activatedAt: cd.activatedAt.toISOString(),
          expiresAt: cd.expiresAt.toISOString(),
          cooldownEnds: cd.cooldownEnds.toISOString(),
        };
      }

      return { ...flagship, talentBonuses: {}, effectiveStats, hullConfig, cooldowns };
```

Notes :
- `talentBonuses: {}` est conservé pour ne pas casser les consumers front qui le lisent.
- `cooldowns` est NOUVEAU dans la réponse — le HullAbilitiesPanel le lira au lieu de `trpc.talent.list().cooldowns` (cf Task 6).
- Si `flagshipCooldowns` n'est pas déjà importé en haut du fichier, vérifier — il l'est probablement déjà (utilisé par scan logic).

- [ ] **Step 2: Verify config is fetched before being used**

Read `flagship.service.ts` lines 100-165 and ensure `const config = await gameConfigService.getFullConfig();` is called before `effectiveStats` block. If it was inside `if (talentService)`, move it out.

Expected pattern:
```ts
      const config = await gameConfigService.getFullConfig();
      const hullConfig = flagship.hullId ? (config.hulls[flagship.hullId] ?? null) : null;
      const effectiveStats = { /* ... */ };
      // ...
      return { ...flagship, talentBonuses: {}, effectiveStats, hullConfig };
```

- [ ] **Step 3: Update `flagship.service.ts` constructor signature**

Line 16-24, the `talentService` parameter becomes optional but unused. Remove it:

Before:
```ts
export function createFlagshipService(
  db: Database,
  exiliumService: ReturnType<typeof createExiliumService>,
  gameConfigService: GameConfigService,
  talentService?: ReturnType<typeof createTalentService>,
  assetsDir?: string,
  resourceService?: ReturnType<typeof createResourceService>,
  reportService?: ReturnType<typeof createReportService>,
) {
```

After:
```ts
export function createFlagshipService(
  db: Database,
  exiliumService: ReturnType<typeof createExiliumService>,
  gameConfigService: GameConfigService,
  assetsDir?: string,
  resourceService?: ReturnType<typeof createResourceService>,
  reportService?: ReturnType<typeof createReportService>,
) {
```

Also remove the import:
```ts
// REMOVE this line at top of file:
import type { createTalentService } from './talent.service.js';
```

Search the file for any other usage of `talentService` and remove (e.g. line 288 was a `talentService.computeTalentContext` call — verify and remove if not needed; if needed, the caller of flagshipService needs to pass talentService separately, OR talentService is no longer accessed via flagshipService).

Actually verify line 288 first:
```bash
grep -n "talentService" /opt/exilium/apps/api/src/modules/flagship/flagship.service.ts
```

If line 288 still uses `talentService`, you have two options:
- **Option A (recommended):** import `talentService` directly via DI (add it back as separate param)
- **Option B:** call `db.select(...)` directly to get the bonus context (duplicate logic — not great)

Use Option A: keep `talentService?` in the signature for line 288's needs, but remove its usage in lines 119-148 (the blocks moved to effectiveStats above). The signature change becomes optional then.

**Decision: keep `talentService?` parameter for now** (backward compat with caller), but remove all usage from `get()` since we no longer need ranks/getStatBonuses. The line 288 call remains valid because computeTalentContext is preserved.

So actually revert the signature change above. Keep:
```ts
  talentService?: ReturnType<typeof createTalentService>,
```
and just remove the `talentService.list / getStatBonuses` block in `get()`.

- [ ] **Step 4: Modify `game-config.service.ts` to remove talent CRUD**

Identify the exact line ranges with:
```bash
grep -n "talentBranchDefinitions\|talentDefinitions\|TalentBranch\|createTalent\|updateTalent\|deleteTalent" /opt/exilium/apps/api/src/modules/admin/game-config.service.ts
```

Expected matches around lines 21-22 (imports), 704-772 (CRUD methods using `talentBranchDefinitions` and `talentDefinitions`).

Delete these blocks:

1. **Imports (lines 21-22)** :
```ts
// REMOVE:
import {
  // ...
  talentBranchDefinitions,
  talentDefinitions,
  // ...
} from '@exilium/db';
```
Keep the other imports from `@exilium/db` in the same statement.

2. **CRUD methods (around lines 704-772)** :
   - `createTalentBranch` / `updateTalentBranch` / `deleteTalentBranch`
   - `createTalent` / `updateTalent` / `deleteTalent`
   
   Delete all 6 methods entirely. They were exposed via tRPC for the admin /admin/talents page (now removed in Task 7).

3. **Verify no remaining references** :
```bash
grep -n "talentBranchDefinitions\|talentDefinitions" /opt/exilium/apps/api/src/modules/admin/game-config.service.ts
```
Expected: 0 results.

- [ ] **Step 5: Modify `getFullConfig()` to return empty talents/talentBranches**

Find the `getFullConfig` method in `game-config.service.ts`. It probably loads `config.talents` and `config.talentBranches` from the (now archived) tables. Replace those two loads with empty constants:

```ts
// Inside getFullConfig:
const talents: Record<string, TalentConfig> = {};
const talentBranches: TalentBranchConfig[] = [];
```

Keep the `TalentConfig` type alias if other code still imports it (the type is harmless even if no values are produced). If TS complains, add a type-only export like:
```ts
export type TalentConfig = { id: string; branchId: string; tier: number; /* etc */ };
export type TalentBranchConfig = { id: string; name: string; /* etc */ };
```

- [ ] **Step 6: Run typecheck**

Run: `pnpm turbo typecheck --filter=@exilium/api`

Expected errors (these are normal at this stage, fixed in subsequent tasks):
- `talentRouter` not found in `app-router.ts` (Task 4)
- `talent.list / invest / etc` not found in talentService (callers fixed in Task 4)

Should NOT error on:
- `flagship.service.ts` (Step 3)
- `game-config.service.ts` (Steps 4-5)

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/flagship/flagship.service.ts apps/api/src/modules/admin/game-config.service.ts
git commit -m "refactor(api): cleanup flagshipService + gameConfigService talent refs"
```

---

## Task 4 : Cleanup `app-router.ts` + delete `talent.router.ts`

**Files:**
- Delete: `apps/api/src/modules/flagship/talent.router.ts`
- Modify: `apps/api/src/trpc/app-router.ts`

- [ ] **Step 1: Delete `talent.router.ts`**

```bash
rm /opt/exilium/apps/api/src/modules/flagship/talent.router.ts
```

- [ ] **Step 2: Modify `app-router.ts`**

Read `apps/api/src/trpc/app-router.ts` to find lines that reference talents:

```ts
// REMOVE the import (line ~58):
import { createTalentService } from '../modules/flagship/talent.service.js';
// → KEEP (still used by Task 2 thin wrapper):
import { createTalentService } from '../modules/flagship/talent.service.js';

// REMOVE the import:
import { createTalentRouter } from '../modules/flagship/talent.router.js';

// REMOVE the instantiation:
const talentService = createTalentService(db, exiliumService, gameConfigService);
// → REPLACE with new signature (only db + gameConfigService):
const talentService = createTalentService(db, gameConfigService);

// REMOVE the router instantiation:
const talentRouter = createTalentRouter(talentService);

// REMOVE the route in appRouter object:
talent: talentRouter,
```

Open the file and apply these changes. **Do NOT remove `talentService` itself** — it's still passed to `flagshipService` and other consumers via DI (the thin wrapper preserves the API).

Verify with:
```bash
grep -n "talentService\|talentRouter" /opt/exilium/apps/api/src/trpc/app-router.ts
```

Expected after edit:
- `import { createTalentService } from '../modules/flagship/talent.service.js';` (kept, no `createTalentRouter`)
- `const talentService = createTalentService(db, gameConfigService);`
- `talentService` passed to flagshipService and any other consumers (look for `talentService` in the constructor calls list)
- NO line `talent: talentRouter`

- [ ] **Step 3: Run typecheck**

Run: `pnpm turbo typecheck --filter=@exilium/api`

Expected: 0 errors related to talents in API. (Some warnings about unused imports may remain — ESLint will flag them in lint phase later.)

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/trpc/app-router.ts apps/api/src/modules/flagship/talent.router.ts
git commit -m "refactor(api): retirer talentRouter + simplifier instantiation talentService"
```

---

## Task 5 : Cleanup schemas Drizzle + `seed-game-config.ts`

**Files:**
- Modify: `packages/db/src/schema/index.ts`
- Modify: `packages/db/src/seed-game-config.ts`

- [ ] **Step 1: Inspect schema index exports**

```bash
grep -n "talent\|cooldown" /opt/exilium/packages/db/src/schema/index.ts
```

Find exports like:
```ts
export * from './flagship-talents.js';
export * from './talent-definitions.js';
export * from './talent-branch-definitions.js';
export * from './flagship-cooldowns.js';
```

- [ ] **Step 2: Remove only the 3 talent-related exports**

Edit `packages/db/src/schema/index.ts` and delete (or comment with `// archived 2026-05-03 — see migration 0069`) **only these 3 export lines** :

```ts
// REMOVE :
export * from './flagship-talents.js';
export * from './talent-definitions.js';
export * from './talent-branch-definitions.js';

// KEEP (still used by scan_mission cooldown via talent_id='scan_mission') :
export * from './flagship-cooldowns.js';
```

**Don't delete the actual schema files** (`packages/db/src/schema/flagship-talents.ts` etc.) — they may be needed if a future migration references them. Just unexport them so they're not picked up by Drizzle's schema diff.

- [ ] **Step 3: Modify `seed-game-config.ts`**

Read `packages/db/src/seed-game-config.ts` and identify these blocks:

**Imports (lines 18-19):**
```ts
import {
  // ...
  talentBranchDefinitions,
  talentDefinitions,
  // ...
} from './schema/index.js';
```

Remove these two import lines.

**Universe config talent keys (lines 651-661):**
```ts
{ key: 'talent_cost_tier_1', value: 1 },
{ key: 'talent_cost_tier_2', value: 2 },
{ key: 'talent_cost_tier_3', value: 3 },
{ key: 'talent_cost_tier_4', value: 4 },
{ key: 'talent_cost_tier_5', value: 5 },
{ key: 'talent_tier_2_threshold', value: 5 },
{ key: 'talent_tier_3_threshold', value: 10 },
{ key: 'talent_tier_4_threshold', value: 15 },
{ key: 'talent_tier_5_threshold', value: 20 },
{ key: 'talent_respec_ratio', value: 0 },
{ key: 'talent_full_reset_cost', value: 0 },
```

Delete all 11 lines.

**TALENT_BRANCHES + TALENT_DEFINITIONS (lines 666-794):**

Delete the entire `const TALENT_BRANCHES = [...]` array (lines 666-670) and `const TALENT_DEFINITIONS: Record<string, unknown>[] = [...]` array (lines 760-794) — both no longer needed.

**Hull bonuses update (lines 666-756 region):**

In the `HULLS` array, update each hull's `passiveBonuses` and `bonusLabels` per spec §4:

```ts
{
  id: 'combat',
  passiveBonuses: {
    combat_build_time_reduction: 0.20,
    repair_time_reduction:       0.45,    // NEW (ex mil_repair max)
    bonus_armor: 6,
    bonus_shot_count: 2,
    bonus_weapons: 8,
  },
  bonusLabels: [
    '+6 blindage',
    '+2 attaques',
    '+8 armes',
    '-20% temps construction vaisseaux militaires',
    '-45% temps de réparation du flagship',  // NEW
  ],
  // ... reste inchangé (changeCost, unavailabilitySeconds, cooldownSeconds, abilities, etc.)
},
```

```ts
{
  id: 'industrial',
  passiveBonuses: {
    industrial_build_time_reduction: 0.20,
    mining_speed_bonus:              0.45,  // NEW
    prospection_speed_bonus:         0.45,  // NEW
  },
  bonusLabels: [
    '-20% temps construction vaisseaux industriels',
    '+45% vitesse de minage',                  // NEW
    '+45% vitesse de prospection',             // NEW
    'Permet le minage et recyclage',
  ],
  // ... reste inchangé
},
```

```ts
{
  id: 'scientific',
  // INCHANGÉ — sci_research_time supprimé en doublon, sci_energy/shield_boost supprimés
},
```

**Talent seed loop (lines 1018-1027):**

Delete the entire block:
```ts
// 16. Talent branches
await db.delete(talentDefinitions);
await db.delete(talentBranchDefinitions);
await db.insert(talentBranchDefinitions).values(TALENT_BRANCHES);
console.log(`  ✓ ${TALENT_BRANCHES.length} talent branches`);
// ...
if (TALENT_DEFINITIONS.length > 0) {
  await db.insert(talentDefinitions).values(...);
  // ...
}
```

- [ ] **Step 4: Run typecheck on db package**

Run: `pnpm turbo typecheck --filter=@exilium/db`

Expected: 0 errors. The unexported schemas are still importable internally from their source files but no longer aggregated through the index.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/index.ts packages/db/src/seed-game-config.ts
git commit -m "refactor(db): unexport talent schemas + cleanup seed + extend hull passives"
```

---

## Task 6 : Cleanup web frontend

**Files:**
- Delete: `apps/web/src/pages/FlagshipTalents.tsx`
- Delete: `apps/web/src/components/flagship/TalentTree.tsx`
- Modify: `apps/web/src/pages/FlagshipProfile.tsx`
- Modify: `apps/web/src/components/flagship/HullAbilitiesPanel.tsx`
- Modify: `apps/web/src/router.tsx`

- [ ] **Step 1: Delete the talent UI files**

```bash
rm /opt/exilium/apps/web/src/pages/FlagshipTalents.tsx
rm /opt/exilium/apps/web/src/components/flagship/TalentTree.tsx
```

Check for sub-components / sibling files that TalentTree was using:
```bash
ls /opt/exilium/apps/web/src/components/flagship/ | grep -i talent
```

If any (e.g. `TalentNode.tsx`, `TalentBranchPanel.tsx`), delete them too.

- [ ] **Step 2: Modify `FlagshipProfile.tsx`**

Read `apps/web/src/pages/FlagshipProfile.tsx` and find:

```tsx
// Line ~36 (location may drift):
const { data: talentTree } = trpc.talent.list.useQuery();
```

Delete this line. Also delete:

```tsx
// Line ~145 (location may drift):
<TalentTree showGuide />
```

And remove the import:
```tsx
import { TalentTree } from '@/components/flagship/TalentTree';
```

Search for any remaining references to `talentTree` variable in the same file and remove them (they may exist for hull-related rendering).

- [ ] **Step 3: Modify `HullAbilitiesPanel.tsx`**

Read `apps/web/src/components/flagship/HullAbilitiesPanel.tsx`. Find:

```tsx
// Line ~34:
const { data: talentData } = trpc.talent.list.useQuery();
// Line ~41:
utils.talent.list.invalidate();
// Line ~103:
cooldownData={talentData?.cooldowns?.[ability.id]}
```

The `cooldowns` mechanism for hull abilities (notably `scan_mission`) is **preserved** server-side via the `flagshipCooldowns` table. The new source is `flagship.cooldowns` returned by `trpc.flagship.get` (cf Task 3 Step 1).

Apply changes:

```tsx
// REPLACE:
const { data: talentData } = trpc.talent.list.useQuery();
// WITH:
const { data: flagship } = trpc.flagship.get.useQuery();
```

```tsx
// REPLACE:
utils.talent.list.invalidate();
// WITH:
utils.flagship.get.invalidate();
```

```tsx
// REPLACE:
cooldownData={talentData?.cooldowns?.[ability.id]}
// WITH:
cooldownData={flagship?.cooldowns?.[ability.id]}
```

If the file already calls `trpc.flagship.get.useQuery()` elsewhere (likely, since this panel is rendered inside FlagshipProfile), reuse that data instead of duplicating the query. Lift the data via props if cleaner.

Important : verify that the `cooldowns` field is now in the flagship.get response shape. If TS complains, check that Task 3 Step 1 actually added the `cooldowns` field in the return object.

- [ ] **Step 4: Modify `router.tsx`**

Read `apps/web/src/router.tsx` and find any route mentioning `flagship/talents`:

```tsx
{ path: 'flagship/talents', lazy: () => import('./pages/FlagshipTalents').then(...) }
```

Delete this route entry.

- [ ] **Step 5: Run typecheck on web**

Run: `pnpm turbo typecheck --filter=@exilium/web`

Expected: 0 errors. If errors mention `trpc.talent.*`, scan for missed references with:
```bash
grep -rn "trpc\.talent" /opt/exilium/apps/web/src
```
and clean them up.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/
git commit -m "refactor(web): supprimer page Talents + cleanup HullAbilitiesPanel cooldowns"
```

---

## Task 7 : Réorganisation admin pages talents → flagship

**Files:**
- Move: `apps/admin/src/pages/talents/FlagshipImagePool.tsx` → `apps/admin/src/pages/flagship/FlagshipImagePool.tsx`
- Move: `apps/admin/src/pages/talents/HullConfigSection.tsx` → `apps/admin/src/pages/flagship/HullConfigSection.tsx`
- Move: `apps/admin/src/pages/talents/HullEditModal.tsx` → `apps/admin/src/pages/flagship/HullEditModal.tsx`
- Delete: `apps/admin/src/pages/talents/BranchCard.tsx`
- Delete: `apps/admin/src/pages/talents/constants.ts`
- Delete: `apps/admin/src/pages/talents/helpers.ts`
- Delete: `apps/admin/src/pages/talents/` (the directory once empty)
- Move: `apps/admin/src/pages/Talents.tsx` → `apps/admin/src/pages/Flagship.tsx`
- Modify: `apps/admin/src/router.tsx`
- Modify: `apps/admin/src/components/layout/AdminLayout.tsx`

- [ ] **Step 1: Create the new `flagship/` directory and move 3 files**

```bash
mkdir -p /opt/exilium/apps/admin/src/pages/flagship
git mv /opt/exilium/apps/admin/src/pages/talents/FlagshipImagePool.tsx /opt/exilium/apps/admin/src/pages/flagship/FlagshipImagePool.tsx
git mv /opt/exilium/apps/admin/src/pages/talents/HullConfigSection.tsx /opt/exilium/apps/admin/src/pages/flagship/HullConfigSection.tsx
git mv /opt/exilium/apps/admin/src/pages/talents/HullEditModal.tsx /opt/exilium/apps/admin/src/pages/flagship/HullEditModal.tsx
```

- [ ] **Step 2: Delete talent-only files**

```bash
rm /opt/exilium/apps/admin/src/pages/talents/BranchCard.tsx
rm /opt/exilium/apps/admin/src/pages/talents/constants.ts
rm /opt/exilium/apps/admin/src/pages/talents/helpers.ts
rmdir /opt/exilium/apps/admin/src/pages/talents
```

- [ ] **Step 3: Move and rewrite `Talents.tsx` → `Flagship.tsx`**

```bash
git mv /opt/exilium/apps/admin/src/pages/Talents.tsx /opt/exilium/apps/admin/src/pages/Flagship.tsx
```

Then overwrite `apps/admin/src/pages/Flagship.tsx` with a simpler version that only contains FlagshipImagePool + HullConfigSection. The original Talents.tsx had ~200 lines mixing talent-CRUD UI and hull UI; the new Flagship.tsx is just:

```tsx
import { trpc } from '../trpc';
import { FlagshipImagePool } from './flagship/FlagshipImagePool';
import { HullConfigSection } from './flagship/HullConfigSection';

export default function Flagship() {
  const { data, refetch } = trpc.gameConfig.getFullConfig.useQuery();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Flagship</h1>
        <p className="text-sm text-gray-500 mt-1">
          Pool d'images des coques + configuration des coques.
        </p>
      </div>

      <FlagshipImagePool />
      <HullConfigSection hulls={data?.hulls ?? {}} onUpdated={refetch} />
    </div>
  );
}
```

Note: replace `trpc.gameConfig.getFullConfig` with the actual query name used in the original Talents.tsx (it might be `trpc.admin.getFullConfig` or similar). Read the original Talents.tsx first to confirm.

- [ ] **Step 4: Update import paths inside the moved files**

The moved files (`FlagshipImagePool.tsx`, `HullConfigSection.tsx`, `HullEditModal.tsx`) may reference each other or sibling files via relative paths like `./HullEditModal`. These should still work since the moves are within the same directory.

But check for any cross-folder imports:
```bash
grep -n "from '\.\./talents\|from '\.\./Talents\|from './talents'" /opt/exilium/apps/admin/src/pages/flagship/*.tsx
```

Fix any imports referring to the old `talents/` folder.

- [ ] **Step 5: Update `router.tsx`**

Read `apps/admin/src/router.tsx`. Find the route around line 41:

```tsx
{ path: 'talents', lazy: () => import('./pages/Talents').then((m) => ({ Component: m.default })) },
```

Replace with:

```tsx
{ path: 'flagship', lazy: () => import('./pages/Flagship').then((m) => ({ Component: m.default })) },
```

- [ ] **Step 6: Update `AdminLayout.tsx` nav**

Read `apps/admin/src/components/layout/AdminLayout.tsx`. Find the nav entry around line 39:

```tsx
{ to: '/talents', label: 'Talents Flagship', icon: Sparkles },
```

Replace with:

```tsx
{ to: '/flagship', label: 'Flagship', icon: Rocket },
```

(Use `Rocket` from lucide-react — already imported. If not, change to whichever icon makes sense among existing imports.)

- [ ] **Step 7: Run typecheck on admin**

Run: `pnpm turbo typecheck --filter=@exilium/admin`

Expected: 0 errors. Common issues:
- Missing imports in the rewritten Flagship.tsx → add them
- `trpc.gameConfig.getFullConfig` doesn't exist → use the right name (check original Talents.tsx)

- [ ] **Step 8: Commit**

```bash
git add apps/admin/src/
git commit -m "refactor(admin): renomme page Talents en Flagship, supprime BranchCard"
```

---

## Task 8 : Cleanup admin `PlayerDetail` + `GameplayKeys`

**Files:**
- Delete: `apps/admin/src/pages/player-detail/TalentsSection.tsx`
- Modify: `apps/admin/src/pages/PlayerDetail.tsx`
- Modify: `apps/admin/src/pages/GameplayKeys.tsx`

- [ ] **Step 1: Delete `TalentsSection.tsx`**

```bash
rm /opt/exilium/apps/admin/src/pages/player-detail/TalentsSection.tsx
```

- [ ] **Step 2: Modify `PlayerDetail.tsx`**

Read `apps/admin/src/pages/PlayerDetail.tsx`. Find the import:

```tsx
import { TalentsSection } from './player-detail/TalentsSection';
```

Delete it. Then find the JSX render:

```tsx
<TalentsSection ... />
```

Delete it.

- [ ] **Step 3: Modify `GameplayKeys.tsx`**

Read `apps/admin/src/pages/GameplayKeys.tsx`. Find the categories block (lines 20-24):

```tsx
{ id: 'talent_stat',   label: 'Stats flagship (talents)', icon: Rocket, color: 'text-red-400' },
{ id: 'talent_global', label: 'Bonus globaux (talents)', icon: Globe, color: 'text-emerald-400' },
{ id: 'talent_planet', label: 'Bonus planetaires (talents)', icon: Factory, color: 'text-amber-400' },
{ id: 'talent_buff',   label: 'Buffs temporaires (talents)', icon: Zap, color: 'text-purple-400' },
{ id: 'talent_unlock', label: 'Deblocages (talents)', icon: Key, color: 'text-blue-400' },
```

Delete all 5 entries.

Find the keys array (lines 32-52) and delete all entries with `category: 'talent_stat'` (9 entries: weapons, shield, hull, baseArmor, shotCount, speedPercent, fuelConsumption, cargoCapacity, damageMultiplier).

Then update the descriptions/formulas of remaining hull_passive keys to remove "+ talent" mentions:

Before (line 32):
```tsx
formula: 'effectiveWeapons = base + talent + bonus_weapons',
```

After:
```tsx
formula: 'effectiveWeapons = base + bonus_weapons',
```

Apply the same cleanup to `bonus_armor`, `bonus_shot_count` formula strings.

For the `_time_reduction` keys (lines 37-39), the formula is `time = baseTime × talentMult × (1 - reduction)`. Update to:
```tsx
formula: 'time = baseTime × (1 - reduction)',
```

- [ ] **Step 4: Run typecheck on admin**

Run: `pnpm turbo typecheck --filter=@exilium/admin`

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/pages/PlayerDetail.tsx apps/admin/src/pages/player-detail/TalentsSection.tsx apps/admin/src/pages/GameplayKeys.tsx
git commit -m "refactor(admin): cleanup PlayerDetail TalentsSection + GameplayKeys talent refs"
```

---

## Task 9 : Tests (parallel_build, hull passives, baseline)

**Files:**
- Create: `apps/api/src/modules/flagship/__tests__/talent.service.test.ts`

- [ ] **Step 1: Write the test file**

Create `apps/api/src/modules/flagship/__tests__/talent.service.test.ts`. Use the queue-based mock pattern already established in `flagship.service.test.ts` (consume successive select() results from a queue):

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTalentService } from '../talent.service.js';

const HULLS_FIXTURE = {
  combat: {
    passiveBonuses: {
      combat_build_time_reduction: 0.20,
      repair_time_reduction: 0.45,
      bonus_weapons: 8,
      bonus_armor: 6,
      bonus_shot_count: 2,
    },
  },
  industrial: {
    passiveBonuses: {
      industrial_build_time_reduction: 0.20,
      mining_speed_bonus: 0.45,
      prospection_speed_bonus: 0.45,
    },
  },
  scientific: {
    passiveBonuses: {
      research_time_reduction: 0.20,
    },
  },
};

/**
 * Queue-based mock: each select() call consumes the next result from the queue.
 * Order matters — for computeTalentContext, the order is :
 *   1. flagship select (always)
 *   2. planetBuildings select (only when planetId provided AND planetId === flagship.planetId)
 */
function createMockDb(selectResults: unknown[][]) {
  const queue = [...selectResults];
  return {
    select: vi.fn().mockImplementation(() => {
      const chain: any = {};
      const result = queue.shift() ?? [];
      chain.from = vi.fn().mockImplementation(() => chain);
      chain.where = vi.fn().mockImplementation(() => {
        chain.then = (resolve: any) => resolve(result);
        return chain;
      });
      chain.limit = vi.fn().mockImplementation(() => {
        chain.then = (resolve: any) => resolve(result);
        return chain;
      });
      chain.then = (resolve: any) => resolve(result);
      return chain;
    }),
  } as unknown as Parameters<typeof createTalentService>[0];
}

const mockGameConfig = {
  getFullConfig: async () => ({ hulls: HULLS_FIXTURE }),
} as unknown as Parameters<typeof createTalentService>[1];

describe('talentService.computeTalentContext (post-talents-removal)', () => {
  function makeService(flagshipRow: object | null, pbRows: object[] = []) {
    const flagshipResult = flagshipRow ? [flagshipRow] : [];
    const queue = pbRows.length > 0 ? [flagshipResult, pbRows] : [flagshipResult];
    return createTalentService(createMockDb(queue), mockGameConfig);
  }

  describe('hull passives', () => {
    it('industrial hull returns mining_speed = 0.45', async () => {
      const svc = makeService({ id: 'f1', planetId: 'p1', status: 'active', hullId: 'industrial' });
      const ctx = await svc.computeTalentContext('user1');
      expect(ctx.mining_speed).toBe(0.45);
      expect(ctx.prospection_speed).toBe(0.45);
      expect(ctx.flagship_repair_time).toBeUndefined();
    });

    it('combat hull returns flagship_repair_time = 0.45', async () => {
      const svc = makeService({ id: 'f1', planetId: 'p1', status: 'active', hullId: 'combat' });
      const ctx = await svc.computeTalentContext('user1');
      expect(ctx.flagship_repair_time).toBe(0.45);
      expect(ctx.mining_speed).toBeUndefined();
    });

    it('combat hull returns hull_combat_build_time_reduction', async () => {
      const svc = makeService({ id: 'f1', planetId: 'p1', status: 'active', hullId: 'combat' });
      const ctx = await svc.computeTalentContext('user1');
      expect(ctx.hull_combat_build_time_reduction).toBe(0.20);
    });

    it('returns {} when no flagship', async () => {
      const svc = makeService(null);
      const ctx = await svc.computeTalentContext('user1');
      expect(ctx).toEqual({});
    });

    it('handles flagship with null hullId', async () => {
      const svc = makeService({ id: 'f1', planetId: 'p1', status: 'active', hullId: null });
      const ctx = await svc.computeTalentContext('user1');
      expect(ctx).toEqual({});
    });
  });

  describe('parallel_build via buildings', () => {
    it('returns +1 mil slot when commandCenter ≥10 and flagship attached', async () => {
      const svc = makeService(
        { id: 'f1', planetId: 'p1', status: 'active', hullId: 'industrial' },
        [{ buildingId: 'commandCenter', level: 10 }, { buildingId: 'shipyard', level: 5 }],
      );
      const ctx = await svc.computeTalentContext('user1', 'p1');
      expect(ctx.military_parallel_build).toBe(1);
      expect(ctx.industrial_parallel_build).toBeUndefined();
    });

    it('returns +1 ind slot when shipyard ≥10 and flagship attached', async () => {
      const svc = makeService(
        { id: 'f1', planetId: 'p1', status: 'active', hullId: 'industrial' },
        [{ buildingId: 'shipyard', level: 12 }, { buildingId: 'commandCenter', level: 9 }],
      );
      const ctx = await svc.computeTalentContext('user1', 'p1');
      expect(ctx.industrial_parallel_build).toBe(1);
      expect(ctx.military_parallel_build).toBeUndefined();
    });

    it('returns no slot bonus when commandCenter <10', async () => {
      const svc = makeService(
        { id: 'f1', planetId: 'p1', status: 'active', hullId: 'industrial' },
        [{ buildingId: 'commandCenter', level: 9 }],
      );
      const ctx = await svc.computeTalentContext('user1', 'p1');
      expect(ctx.military_parallel_build).toBeUndefined();
    });

    it('returns no slot bonus when flagship on a different planet', async () => {
      // pbRows not queried because planetId !== flagship.planetId
      const svc = makeService({ id: 'f1', planetId: 'p_other', status: 'active', hullId: 'industrial' });
      const ctx = await svc.computeTalentContext('user1', 'p1');
      expect(ctx.military_parallel_build).toBeUndefined();
    });

    it('returns no slot bonus when planetId not provided', async () => {
      const svc = makeService({ id: 'f1', planetId: 'p1', status: 'active', hullId: 'industrial' });
      const ctx = await svc.computeTalentContext('user1');
      expect(ctx.military_parallel_build).toBeUndefined();
      expect(ctx.industrial_parallel_build).toBeUndefined();
    });

    it('combines both slot bonuses when both buildings ≥10', async () => {
      const svc = makeService(
        { id: 'f1', planetId: 'p1', status: 'active', hullId: 'industrial' },
        [{ buildingId: 'commandCenter', level: 10 }, { buildingId: 'shipyard', level: 11 }],
      );
      const ctx = await svc.computeTalentContext('user1', 'p1');
      expect(ctx.military_parallel_build).toBe(1);
      expect(ctx.industrial_parallel_build).toBe(1);
    });
  });

  describe('combined output', () => {
    it('industrial hull on its own planet with both buildings ≥10', async () => {
      const svc = makeService(
        { id: 'f1', planetId: 'p1', status: 'active', hullId: 'industrial' },
        [{ buildingId: 'commandCenter', level: 10 }, { buildingId: 'shipyard', level: 10 }],
      );
      const ctx = await svc.computeTalentContext('user1', 'p1');
      expect(ctx).toEqual({
        hull_industrial_build_time_reduction: 0.20,
        mining_speed: 0.45,
        prospection_speed: 0.45,
        military_parallel_build: 1,
        industrial_parallel_build: 1,
      });
    });
  });
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm turbo test --filter=@exilium/api -- talent.service`

Expected: 12 tests pass (5 hull passives + 6 parallel_build + 1 combined).

If the mocking pattern doesn't match the way Drizzle's query builder is actually called (the `select(...).from(...).where(...).limit(...)` chain may behave differently), inspect existing tests in `apps/api/src/modules/anomaly/__tests__/anomaly.activateEpic.test.ts` for the working mock pattern and adapt.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/flagship/__tests__/talent.service.test.ts
git commit -m "test(flagship): couvrir computeTalentContext (hull passives + parallel_build)"
```

---

## Task 10 : Doc cleanup (5 docs à archiver)

**Files:**
- Modify: `docs/processes/talent-creation-process.md`
- Modify: `docs/superpowers/specs/2026-03-27-flagship-talent-tree-design.md`
- Modify: `docs/superpowers/specs/2026-03-28-talent-effect-system-design.md`
- Modify: `docs/superpowers/specs/2026-04-03-sci-energy-talent-design.md`
- Modify: `docs/superpowers/plans/2026-03-27-phase2-flagship-talents.md`

- [ ] **Step 1: Add archive banner to all 5 docs**

For each file, prepend at the very top (before any existing content):

```markdown
> 🗄️ **ARCHIVÉ** — Le système de Talents a été retiré le 2026-05-03. Voir [`docs/superpowers/specs/2026-05-03-talents-removal-design.md`](../../superpowers/specs/2026-05-03-talents-removal-design.md) pour la migration.

---
```

(Adjust the relative path to match each file's location relative to the spec.)

For files in `docs/superpowers/specs/`:
```markdown
> 🗄️ **ARCHIVÉ** — Le système de Talents a été retiré le 2026-05-03. Voir [`2026-05-03-talents-removal-design.md`](2026-05-03-talents-removal-design.md) pour la migration.
```

For `docs/processes/talent-creation-process.md`:
```markdown
> 🗄️ **ARCHIVÉ** — Le système de Talents a été retiré le 2026-05-03. Voir [`../superpowers/specs/2026-05-03-talents-removal-design.md`](../superpowers/specs/2026-05-03-talents-removal-design.md) pour la migration.
```

For `docs/superpowers/plans/2026-03-27-phase2-flagship-talents.md`:
```markdown
> 🗄️ **ARCHIVÉ** — Le système de Talents a été retiré le 2026-05-03. Voir [`../specs/2026-05-03-talents-removal-design.md`](../specs/2026-05-03-talents-removal-design.md) pour la migration.
```

- [ ] **Step 2: Commit**

```bash
git add docs/
git commit -m "docs: archive bannière sur les docs talents (système retiré 2026-05-03)"
```

---

## Task 11 : Final lint + typecheck + tests + smoke + push + deploy + annonce

**Files:** all touched files this sprint.

- [ ] **Step 1: Full lint + typecheck across all packages**

Run: `pnpm turbo lint typecheck --filter=@exilium/api --filter=@exilium/admin --filter=@exilium/web --filter=@exilium/game-engine --filter=@exilium/db --filter=@exilium/shared`

Expected: 0 errors. Pre-existing warnings (any-types) are OK; verify none come from files touched in this sprint.

- [ ] **Step 1b: Audit residual `talent` mentions**

Scan for unexpected references:
```bash
grep -rn "talent" /opt/exilium/apps/{api,web,admin}/src --include="*.ts" --include="*.tsx"
```

Expected legitimate mentions only :
- `talent.service.ts` itself + `__tests__/talent.service.test.ts` (preserved as thin wrapper)
- ~30 calls to `computeTalentContext` across api modules (preserved API)
- `talentBonuses: {}` returned by flagship.service.ts get() (preserved for front compat)
- `flagshipCooldowns.talentId` references in scan.handler.ts and flagship.service.ts cooldowns lookup (preserved — column still named talent_id)
- Type aliases `TalentConfig` / `TalentBranchConfig` if any (harmless)
- Migration filename `0069_talents_archive.sql`
- Comments / documentation banners

Anything else (talent.list, talent.invest, getStatBonuses, BranchCard, etc.) = missed cleanup. Clean before proceeding.

- [ ] **Step 2: Full test suite**

Run: `pnpm turbo test --filter=@exilium/api --filter=@exilium/game-engine`

Expected: All tests pass, including the 12 new tests in `talent.service.test.ts`.

- [ ] **Step 3: Audit consumers haven't broken**

```bash
grep -rn "trpc\.talent\." /opt/exilium/apps/{web,admin}/src
```
Expected: 0 results.

```bash
grep -rn "talentService\." /opt/exilium/apps/api/src
```
Expected: ~30 results, ALL of which call `talentService.computeTalentContext`. Anything else is a missed cleanup.

- [ ] **Step 4: Push and deploy**

```bash
cd /opt/exilium && git push origin main
/opt/exilium/scripts/deploy.sh
```

Expected: Migration 0069 applied, PM2 reload OK, Caddy reload OK. The deploy script runs migrations automatically — verify in output that `0069_talents_archive.sql` is listed as applied.

- [ ] **Step 5: Smoke test in browser**

- Open https://exilium-game.com/flagship
  - Verify: NO TalentTree visible (it was below ModulesTab; should be gone)
  - Verify: Modules tab still works (sprint 1 unchanged)
  - Verify: stats baseline shown match new defaults (cargo 8000+, speed 13000+, fuel 72-, shotCount 5+ depending on hull bonuses)
- Open https://admin.exilium-game.com/flagship (NEW URL — was `/talents`)
  - Verify: page loads with FlagshipImagePool + HullConfigSection
  - Verify: nav shows "Flagship" entry instead of "Talents Flagship"
- Open https://admin.exilium-game.com/players/<id>
  - Verify: PlayerDetail loads without error
  - Verify: NO TalentsSection visible
- Open https://admin.exilium-game.com/gameplay-keys
  - Verify: NO talent_* categories
  - Verify: hull_passive entries have updated formulas
- Visit https://exilium-game.com/anomaly (with industrial hull flagship)
  - Verify: mining bonus mentions reflect +45% (or similar)

- [ ] **Step 6: Verify hull passives apply server-side**

a) **Build time** : on a planet with the flagship attached + industrial hull, queue a build of `cargoShip` (or any industrial ship). Verify in the queue that the time is reduced by ~20% vs. baseline. This validates `industrial_build_time_reduction` still flows through `computeTalentContext` → consumer. (Was already working pre-sprint, this just confirms nothing broke.)

b) **Mining speed** (NEW behaviour) : with industrial hull flagship attached to homeworld, send a mine mission. Verify the extracted resources reflect +45% (compare to a pre-sprint baseline of +0% — talents were the only way to boost mining and 9/13 flagships had 0 ranks invested).

c) **Repair time** (NEW behaviour) : with combat hull flagship that's incapacitated (or simulate by adjusting `repair_ends_at`), check that the displayed remaining repair time is reduced by ~45% vs. the legacy duration. (Less critical — visual check.)

d) **parallel_build slot** (NEW behaviour) : on a planet with `commandCenter` level ≥ 10 AND flagship attached, verify the shipyard queue UI shows 2 parallel slots instead of 1. Same for industrial via shipyard ≥ 10.

- [ ] **Step 7: Publish announcement**

Insert announcement via `/admin/announcements` page. Suggested text (max 280 chars per schema):

> Le système de talents est officiellement retiré. Vos bonus s'appliquent automatiquement (passifs coque, stats baseline relevées, slots de construction parallèle débloqués via centre de commandement / chantier spatial niveau 10).

Set `variant: 'info'` and `active: true`.

- [ ] **Step 8: Monitor logs**

Run on server:
```bash
pm2 logs exilium-api --lines 100
```

Look for any errors related to `talent`, `mining_speed`, `parallel_build`, `commandCenter`, `shipyard`. Should be clean for at least 5 minutes after deploy.

If errors appear, identify root cause:
- "talentService.list is not a function" → consumer missed (search & fix)
- "trpc.talent.list 404" → front consumer missed (search & fix)
- "column flagship_talents does not exist" → SQL migration didn't apply (re-run deploy)

---

## Notes — décisions implémentation différées au plan

1. **Statut flagship pendant un déménagement de coque** (`hull_refit`) : le bonus parallel_build s'applique-t-il ? Décision implémentation : **rester sur `flagship.planetId === planet.id` uniquement, peu importe le statut**. Si on découvre plus tard que c'est gênant pendant les 5 minutes de hull change, on ajoutera une condition `status === 'active'`.

2. **`scan_mission` cooldown** (Task 6 Step 3) : le param `cooldownData` devient inutile si on ne migre pas le mécanisme. Décision : Option A — supprimer purement. Si ça casse le scan_mission, follow-up sprint.

3. **Renommage cosmétique `talentService` → `flagshipBonusService`** : DIFFÉRÉ. À faire dans une PR séparée plus tard via search/replace exhaustif. Hors scope ce sprint.

4. **Suppression définitive des tables `_archive`** : DIFFÉRÉE. Dans 2-3 sprints, quand l'audit historique n'est plus utile.
