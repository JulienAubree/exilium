# Planet-Type Building & Defense Variants — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins upload per-planet-type illustration variants for buildings and defenses; let the game render the matching variant when the entity is displayed in a planet context, falling back to the base illustration otherwise.

**Architecture:** DB column `variantPlanetTypes: string[]` on `buildingDefinitions` and `defenseDefinitions` tracks which variants exist. A new `processBuildingVariant` function writes variants to `/assets/{category}/{id}/{planetType}{size}.webp`. `getAssetUrl` switches to the variant path when caller passes `planetType` + `hasVariant`. The `GameImage` component receives these as optional props; call sites in planet-scoped pages (`Buildings.tsx`, `Defense.tsx`) pass them using the active planet's `planetClassId` (surfaced via outlet context) and the `variantPlanetTypes` from the global game config. Admin UI adds a 6-slot accordion under the base upload.

**Tech Stack:** Drizzle ORM, PostgreSQL (`jsonb`), Fastify multipart, Sharp (webp), React + Vite, tRPC v11, React Router outlet context.

**Source spec:** `docs/superpowers/specs/2026-04-23-planet-type-building-variants-design.md`

---

## Parallelisation map

- Phase 1 (sequential): Task 1 — DB schema + migration. Must land first.
- Phase 2 (parallel): Tasks 2, 3, 5 — three independent tracks after the migration.
- Phase 3 (parallel): Tasks 4 (depends on 3), 6 (depends on 5), 7 (no dep).
- Phase 4 (sequential): Tasks 8 (depends on 2, 6, 7), 9 (depends on 2, 4).

---

### Task 1: DB schema & migration for `variantPlanetTypes`

**Files:**
- Modify: `packages/db/src/schema/game-config.ts`
- Create: `packages/db/drizzle/0056_building_defense_planet_variants.sql`

- [ ] **Step 1: Add the column to both table definitions**

Edit `packages/db/src/schema/game-config.ts`, `buildingDefinitions` (after `allowedPlanetTypes`, around line 27):

```ts
  allowedPlanetTypes: jsonb('allowed_planet_types'),
  variantPlanetTypes: jsonb('variant_planet_types').notNull().default([]),
});
```

Same for `defenseDefinitions` (after `flavorText`, around line 132):

```ts
  flavorText: text('flavor_text'),
  variantPlanetTypes: jsonb('variant_planet_types').notNull().default([]),
});
```

- [ ] **Step 2: Write the SQL migration**

Create `packages/db/drizzle/0056_building_defense_planet_variants.sql`:

```sql
ALTER TABLE "building_definitions"
  ADD COLUMN "variant_planet_types" jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "defense_definitions"
  ADD COLUMN "variant_planet_types" jsonb NOT NULL DEFAULT '[]'::jsonb;
```

- [ ] **Step 3: Add the migration journal entry**

Open `packages/db/drizzle/meta/_journal.json` and append a new entry mirroring the last one, bumping `idx` and setting `tag` to `0056_building_defense_planet_variants`. The `when` field uses `Date.now()`.

- [ ] **Step 4: Run the migration**

From repo root:

```bash
pnpm --filter @exilium/db run migrate
```

Expected: migration applied without error. Verify with:

```bash
psql "$DATABASE_URL" -c "\\d building_definitions" | grep variant_planet_types
psql "$DATABASE_URL" -c "\\d defense_definitions" | grep variant_planet_types
```

Both should show `variant_planet_types | jsonb`.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/game-config.ts packages/db/drizzle/0056_building_defense_planet_variants.sql packages/db/drizzle/meta/
git commit -m "feat(db): add variantPlanetTypes to buildings & defenses"
git push
```

---

### Task 2: Surface `variantPlanetTypes` in game-config service

**Files:**
- Modify: `apps/api/src/modules/admin/game-config.service.ts`

- [ ] **Step 1: Extend the `BuildingConfig` interface**

Line ~141. Add field after `allowedPlanetTypes`:

```ts
export interface BuildingConfig {
  // … existing fields
  allowedPlanetTypes: string[] | null;
  variantPlanetTypes: string[];
  prerequisites: { buildingId: string; level: number }[];
}
```

- [ ] **Step 2: Extend the `DefenseConfig` interface**

Line ~203. Add field after `sortOrder`:

```ts
export interface DefenseConfig {
  // … existing fields
  sortOrder: number;
  variantPlanetTypes: string[];
  prerequisites: { … };
}
```

- [ ] **Step 3: Populate the field in `getFullConfig`**

Line ~370 (buildings mapping) — add to the object spread:

```ts
allowedPlanetTypes: (b.allowedPlanetTypes as string[] | null) ?? null,
variantPlanetTypes: (b.variantPlanetTypes as string[] | null) ?? [],
```

In the defenses mapping (~line 434 onwards — find the `defenses[d.id] = { ... }` block), add:

```ts
variantPlanetTypes: (d.variantPlanetTypes as string[] | null) ?? [],
```

- [ ] **Step 4: Extend `createBuilding` / `updateBuilding` / `createDefense` / `updateDefense`**

Grep for `createBuilding`, `updateBuilding`, `createDefense`, `updateDefense` in the same file. Each sets a row in `buildingDefinitions` or `defenseDefinitions`. Add `variantPlanetTypes: []` to the default when creating; **do not** overwrite it on update (the upload endpoints manage that field). If the update accepts a partial, explicitly exclude `variantPlanetTypes` from the updatable keys so admins can't corrupt it through the regular edit form.

- [ ] **Step 5: Type-check and commit**

```bash
pnpm --filter @exilium/api exec tsc --noEmit
```

Expected: no errors.

```bash
git add apps/api/src/modules/admin/game-config.service.ts
git commit -m "feat(api): expose variantPlanetTypes in BuildingConfig & DefenseConfig"
git push
```

---

### Task 3: `processBuildingVariant` image processor

**Files:**
- Modify: `apps/api/src/lib/image-processing.ts`
- Create: `apps/api/src/lib/image-processing.test.ts` (if missing — otherwise append)

- [ ] **Step 1: Write the failing test**

Create or append to `apps/api/src/lib/image-processing.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { mkdtempSync, existsSync, rmSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import sharp from 'sharp';
import { processBuildingVariant } from './image-processing.js';

describe('processBuildingVariant', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'variant-')); });
  afterAll(() => { /* cleanup handled per test */ });

  it('writes hero/thumb/icon webp files under {category}/{id}/{planetType}*.webp', async () => {
    const src = await sharp({ create: { width: 1400, height: 1400, channels: 3, background: '#888' } }).png().toBuffer();
    const files = await processBuildingVariant(src, 'buildings', 'mineraiMine', 'volcanic', dir);

    expect(existsSync(join(dir, 'buildings', 'minerai-mine', 'volcanic.webp'))).toBe(true);
    expect(existsSync(join(dir, 'buildings', 'minerai-mine', 'volcanic-thumb.webp'))).toBe(true);
    expect(existsSync(join(dir, 'buildings', 'minerai-mine', 'volcanic-icon.webp'))).toBe(true);
    expect(files).toEqual(expect.arrayContaining(['volcanic.webp', 'volcanic-thumb.webp', 'volcanic-icon.webp']));
    rmSync(dir, { recursive: true });
  });

  it('works for defenses too', async () => {
    const src = await sharp({ create: { width: 800, height: 800, channels: 3, background: '#333' } }).png().toBuffer();
    await processBuildingVariant(src, 'defenses', 'rocketLauncher', 'arid', dir);
    expect(existsSync(join(dir, 'defenses', 'rocket-launcher', 'arid-icon.webp'))).toBe(true);
    rmSync(dir, { recursive: true });
  });

  it('rejects categories other than buildings|defenses', async () => {
    const src = await sharp({ create: { width: 100, height: 100, channels: 3, background: '#fff' } }).png().toBuffer();
    await expect(processBuildingVariant(src, 'ships' as never, 'x', 'volcanic', dir)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm --filter @exilium/api test -- image-processing.test
```

Expected: FAIL with "processBuildingVariant is not a function" or similar.

- [ ] **Step 3: Implement `processBuildingVariant`**

Append to `apps/api/src/lib/image-processing.ts`:

```ts
export async function processBuildingVariant(
  buffer: Buffer,
  category: 'buildings' | 'defenses',
  entityId: string,
  planetType: string,
  assetsDir: string,
): Promise<string[]> {
  if (category !== 'buildings' && category !== 'defenses') {
    throw new Error(`processBuildingVariant only supports buildings|defenses, got "${category}"`);
  }
  if (!/^[a-z0-9_-]+$/i.test(planetType)) {
    throw new Error(`Invalid planetType "${planetType}"`);
  }

  const slug = toKebab(entityId);
  const outputDir = path.join(assetsDir, category, slug);
  fs.mkdirSync(outputDir, { recursive: true });

  const files: string[] = [];
  for (const size of SIZES) {
    const filename = `${planetType}${size.suffix}.webp`;
    const outPath = path.join(outputDir, filename);

    let pipeline = sharp(buffer);
    if (size.height) {
      pipeline = pipeline.resize({ width: size.width, height: size.height, fit: 'cover', position: 'centre' });
    } else {
      pipeline = pipeline.resize({ width: size.width });
    }
    await pipeline.webp({ quality: size.quality }).toFile(outPath);
    files.push(filename);
  }
  return files;
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm --filter @exilium/api test -- image-processing.test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/image-processing.ts apps/api/src/lib/image-processing.test.ts
git commit -m "feat(api): add processBuildingVariant for per-planet-type illustrations"
git push
```

---

### Task 4: Upload & delete endpoints for variants

**Files:**
- Modify: `apps/api/src/modules/admin/asset-upload.route.ts`

- [ ] **Step 1: Extend the POST multipart handling**

In `server.post('/admin/upload-asset', …)`, right after the existing `entityId` / `category` extraction (~line 49), read an optional `planetType` field:

```ts
const planetType = (data.fields.planetType as { value: string } | undefined)?.value;
```

- [ ] **Step 2: Branch to the variant processor when `planetType` is present**

Replace the final "process image" branch (~line 82 `else { files = await processImage(...) }`) with:

```ts
} else if (planetType) {
  if (category !== 'buildings' && category !== 'defenses') {
    return reply.status(400).send({ error: 'planetType only supported for buildings|defenses' });
  }
  if (!/^[a-z0-9_-]+$/.test(planetType)) {
    return reply.status(400).send({ error: 'Invalid planetType' });
  }
  const [pt] = await db.select({ id: planetTypes.id }).from(planetTypes).where(eq(planetTypes.id, planetType)).limit(1);
  if (!pt) return reply.status(400).send({ error: 'Unknown planetType' });

  files = await processBuildingVariant(buffer, category, entityId!, planetType, env.ASSETS_DIR);

  const table = category === 'buildings' ? buildingDefinitions : defenseDefinitions;
  const [row] = await db.select({ variants: table.variantPlanetTypes }).from(table).where(eq(table.id, entityId!)).limit(1);
  if (!row) return reply.status(404).send({ error: 'Entity not found' });
  const current = Array.isArray(row.variants) ? (row.variants as string[]) : [];
  const updated = Array.from(new Set([...current, planetType]));
  await db.update(table).set({ variantPlanetTypes: updated }).where(eq(table.id, entityId!));
} else {
  files = await processImage(buffer, category, entityId!, env.ASSETS_DIR);
}
```

Imports at the top of the file:

```ts
import { planetTypes, buildingDefinitions, defenseDefinitions } from '@exilium/db';
import { processBuildingVariant } from '../../lib/image-processing.js';
```

- [ ] **Step 3: Add the DELETE endpoint**

Append in the same `registerAssetUploadRoute` function, after the existing routes:

```ts
server.delete('/admin/asset-variant/:category/:entityId/:planetType', async (request, reply) => {
  // auth (copy the 20-line auth block used in the other admin routes)
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return reply.status(401).send({ error: 'Unauthorized' });
  let userId: string;
  try {
    const { payload } = await jwtVerify(authHeader.slice(7), JWT_SECRET);
    userId = payload.userId as string;
  } catch {
    return reply.status(401).send({ error: 'Invalid token' });
  }
  const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.isAdmin) return reply.status(403).send({ error: 'Admin access required' });

  const { category, entityId, planetType } = request.params as { category: string; entityId: string; planetType: string };
  if (category !== 'buildings' && category !== 'defenses') return reply.status(400).send({ error: 'Invalid category' });
  if (!/^[a-z0-9_-]+$/i.test(entityId)) return reply.status(400).send({ error: 'Invalid entityId' });
  if (!/^[a-z0-9_-]+$/i.test(planetType)) return reply.status(400).send({ error: 'Invalid planetType' });

  const slug = toKebab(entityId);
  const dir = join(env.ASSETS_DIR, category, slug);
  const heroPath = join(dir, `${planetType}.webp`);
  if (!existsSync(heroPath)) return reply.status(404).send({ error: 'Variant not found' });

  for (const suffix of ['', '-thumb', '-icon']) {
    const fp = join(dir, `${planetType}${suffix}.webp`);
    if (existsSync(fp)) unlinkSync(fp);
  }

  const table = category === 'buildings' ? buildingDefinitions : defenseDefinitions;
  const [row] = await db.select({ variants: table.variantPlanetTypes }).from(table).where(eq(table.id, entityId)).limit(1);
  const current = Array.isArray(row?.variants) ? (row.variants as string[]) : [];
  const updated = current.filter((t) => t !== planetType);
  await db.update(table).set({ variantPlanetTypes: updated }).where(eq(table.id, entityId));

  return reply.send({ success: true });
});
```

Add `import { toKebab } from '@exilium/shared';` if not already imported.

- [ ] **Step 4: Type-check**

```bash
pnpm --filter @exilium/api exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Smoke test manually**

Start the API and upload a variant:

```bash
# Requires ADMIN_TOKEN exported with a valid admin JWT
curl -F 'category=buildings' -F 'entityId=mineraiMine' -F 'planetType=volcanic' \
  -F 'file=@/tmp/test.png' -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3001/admin/upload-asset
```

Check that `public/assets/buildings/minerai-mine/volcanic-icon.webp` exists and `buildingDefinitions.variantPlanetTypes` now contains `['volcanic']`.

Delete it:

```bash
curl -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3001/admin/asset-variant/buildings/mineraiMine/volcanic
```

Both file and DB array should be cleared.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/admin/asset-upload.route.ts
git commit -m "feat(api): planet-type variant upload & delete endpoints"
git push
```

---

### Task 5: Extend `getAssetUrl`

**Files:**
- Modify: `apps/web/src/lib/assets.ts`
- Create: `apps/web/src/lib/assets.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/lib/assets.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getAssetUrl } from './assets';

describe('getAssetUrl', () => {
  it('returns base URL when no options', () => {
    expect(getAssetUrl('buildings', 'mineraiMine', 'icon')).toBe('/assets/buildings/minerai-mine-icon.webp');
  });

  it('returns base URL when planetType given but hasVariant=false', () => {
    expect(getAssetUrl('buildings', 'mineraiMine', 'icon', { planetType: 'volcanic', hasVariant: false }))
      .toBe('/assets/buildings/minerai-mine-icon.webp');
  });

  it('returns variant URL when planetType given and hasVariant=true', () => {
    expect(getAssetUrl('buildings', 'mineraiMine', 'icon', { planetType: 'volcanic', hasVariant: true }))
      .toBe('/assets/buildings/minerai-mine/volcanic-icon.webp');
  });

  it('handles defenses', () => {
    expect(getAssetUrl('defenses', 'rocketLauncher', 'thumb', { planetType: 'arid', hasVariant: true }))
      .toBe('/assets/defenses/rocket-launcher/arid-thumb.webp');
  });

  it('falls back to base for non-supported categories even with hasVariant=true', () => {
    expect(getAssetUrl('ships', 'heavyFighter', 'full', { planetType: 'arid', hasVariant: true }))
      .toBe('/assets/ships/heavy-fighter.webp');
  });

  it('handles full size suffix empty string', () => {
    expect(getAssetUrl('buildings', 'mineraiMine', 'full', { planetType: 'volcanic', hasVariant: true }))
      .toBe('/assets/buildings/minerai-mine/volcanic.webp');
  });
});
```

- [ ] **Step 2: Run the tests — they should fail**

```bash
pnpm --filter @exilium/web test -- assets.test
```

Expected: FAIL (new signature not implemented).

- [ ] **Step 3: Update `getAssetUrl`**

Replace `getAssetUrl` in `apps/web/src/lib/assets.ts`:

```ts
export interface VariantOptions {
  planetType?: string;
  hasVariant?: boolean;
}

export function getAssetUrl(
  category: AssetCategory,
  id: string,
  size: AssetSize = 'full',
  options?: VariantOptions,
): string {
  const slug = toKebab(id);
  const sfx = SUFFIX[size];
  if (options?.planetType && options.hasVariant && (category === 'buildings' || category === 'defenses')) {
    return `/assets/${category}/${slug}/${options.planetType}${sfx}.webp`;
  }
  return `/assets/${category}/${slug}${sfx}.webp`;
}
```

- [ ] **Step 4: Run the tests — should pass**

```bash
pnpm --filter @exilium/web test -- assets.test
```

Expected: PASS (6/6).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/assets.ts apps/web/src/lib/assets.test.ts
git commit -m "feat(web): getAssetUrl supports per-planet-type variants"
git push
```

---

### Task 6: `GameImage` accepts `planetType` + `hasVariant`

**Files:**
- Modify: `apps/web/src/components/common/GameImage.tsx`

**Depends on:** Task 5.

- [ ] **Step 1: Extend props and forward to `getAssetUrl`**

Replace the relevant parts of `apps/web/src/components/common/GameImage.tsx`:

```tsx
interface GameImageProps {
  category: AssetCategory;
  id: string;
  size?: AssetSize;
  alt: string;
  className?: string;
  planetType?: string;
  hasVariant?: boolean;
}

export function GameImage({
  category, id, size = 'full', alt, className,
  planetType, hasVariant,
}: GameImageProps) {
  // … existing error/loading state …

  const src = getAssetUrl(category, id, size, { planetType, hasVariant });
  // pass `src` to the <img> element below
```

Only the `src={getAssetUrl(category, id, size)}` line (currently line 53) changes — everything else stays (error fallback, skeleton, onError handler).

- [ ] **Step 2: Verify existing call sites still compile**

```bash
pnpm --filter @exilium/web exec tsc --noEmit
```

Expected: no errors. All existing call sites not passing the new props still work (optional).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/common/GameImage.tsx
git commit -m "feat(web): GameImage accepts planetType & hasVariant"
git push
```

---

### Task 7: Add `planetClassId` to the outlet context

**Files:**
- Modify: `apps/web/src/components/layout/Layout.tsx`

- [ ] **Step 1: Pass `planetClassId` in the `Outlet` context**

In `apps/web/src/components/layout/Layout.tsx` (~line 85), update the `Outlet` element. Use the already-computed `activePlanet` (line ~47):

```tsx
<Outlet context={{ planetId: resolvedPlanetId, planetClassId: activePlanet?.planetClassId ?? null }} />
```

If `planetClassId` is not on the `planets` list entries returned by `trpc.planet.list.useQuery()`, inspect the return type of that endpoint (`apps/api/src/modules/planet/planet.service.ts` → `listPlanets`) and add `planetClassId` to the select if missing. The field exists on the underlying `planets` table.

- [ ] **Step 2: Type-check**

```bash
pnpm --filter @exilium/web exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/layout/Layout.tsx apps/api/src/modules/planet/planet.service.ts
git commit -m "feat(web): expose planetClassId in planet outlet context"
git push
```

---

### Task 8: Use variants in `Buildings.tsx` and `Defense.tsx`

**Files:**
- Modify: `apps/web/src/pages/Buildings.tsx`
- Modify: `apps/web/src/pages/Defense.tsx`

**Depends on:** Tasks 2, 6, 7.

- [ ] **Step 1: Read `planetClassId` and config in Buildings.tsx**

Line 146 (`const { planetId } = useOutletContext<…>()`) — widen the type and destructure:

```tsx
const { planetId, planetClassId } = useOutletContext<{ planetId?: string; planetClassId?: string | null }>();
```

`gameConfig` is already fetched on line 151 via `useGameConfig()`. Define a helper just above the return:

```tsx
const getBuildingVariantProps = (buildingId: string) => {
  const def = gameConfig?.buildings?.[buildingId];
  const variants = def?.variantPlanetTypes ?? [];
  const hasVariant = !!planetClassId && variants.includes(planetClassId);
  return { planetType: planetClassId ?? undefined, hasVariant };
};
```

- [ ] **Step 2: Pass variant props to every `GameImage category="buildings"` in this file**

Locate the two `GameImage` usages (lines 319 and 442). Change:

```tsx
<GameImage category="buildings" id={b.id} size="thumb" alt={b.name} className="…" />
```

to:

```tsx
<GameImage category="buildings" id={b.id} size="thumb" alt={b.name} className="…" {...getBuildingVariantProps(b.id)} />
```

(Adjust the local variable name — `b` is a placeholder for whatever loop variable is in scope.)

- [ ] **Step 3: Same work for `Defense.tsx`**

Top of the component:

```tsx
const { planetId, planetClassId } = useOutletContext<{ planetId?: string; planetClassId?: string | null }>();
const { data: gameConfig } = useGameConfig();
const getDefenseVariantProps = (defenseId: string) => {
  const def = gameConfig?.defenses?.[defenseId];
  const variants = def?.variantPlanetTypes ?? [];
  const hasVariant = !!planetClassId && variants.includes(planetClassId);
  return { planetType: planetClassId ?? undefined, hasVariant };
};
```

If `useGameConfig` isn't already imported, add `import { useGameConfig } from '@/hooks/useGameConfig';`.

Apply the spread to the two `GameImage category="defenses"` usages (lines 305 and 404):

```tsx
<GameImage category="defenses" id={defense.id} size="icon" alt={defense.name} className="…" {...getDefenseVariantProps(defense.id)} />
```

- [ ] **Step 4: Visual smoke test**

```bash
pnpm --filter @exilium/web dev
```

1. Upload a variant for `mineraiMine` × `volcanic` (via admin, Task 9 — alternatively craft one manually: copy an image to `public/assets/buildings/minerai-mine/volcanic-icon.webp` and update the DB row: `UPDATE building_definitions SET variant_planet_types='["volcanic"]' WHERE id='mineraiMine';`).
2. On a volcanic planet, open `/buildings` — the Minerai Mine thumbnail must be the variant.
3. On a non-volcanic planet (arid, etc.) the base illustration shows.
4. On an empire-wide page (`/empire`, `/fleet`) nothing changes.

Revert the manual DB change after testing if Task 9 isn't merged yet.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/Buildings.tsx apps/web/src/pages/Defense.tsx
git commit -m "feat(web): use planet-type variants in Buildings & Defense pages"
git push
```

---

### Task 9: Admin UI — variants accordion

**Files:**
- Create: `apps/admin/src/components/ui/PlanetTypeVariantsPanel.tsx`
- Create: `apps/admin/src/components/ui/PlanetTypeVariantSlot.tsx`
- Modify: `apps/admin/src/pages/Buildings.tsx`
- Modify: `apps/admin/src/pages/Defenses.tsx`

**Depends on:** Tasks 2 and 4.

- [ ] **Step 1: Build the single-slot component**

Create `apps/admin/src/components/ui/PlanetTypeVariantSlot.tsx`:

```tsx
import { useState, useRef } from 'react';
import { fetchWithAuth } from '@/trpc';
import { Loader2 } from 'lucide-react';

interface PlanetTypeVariantSlotProps {
  category: 'buildings' | 'defenses';
  entityId: string;
  planetTypeId: string;
  planetTypeName: string;
  hasVariant: boolean;
  onChange: () => void;
}

export function PlanetTypeVariantSlot({
  category, entityId, planetTypeId, planetTypeName, hasVariant, onChange,
}: PlanetTypeVariantSlotProps) {
  const [uploading, setUploading] = useState(false);
  const [cacheBust, setCacheBust] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const iconUrl = hasVariant
    ? `/assets/${category}/${entityId.replace(/([A-Z])/g, '-$1').toLowerCase()}/${planetTypeId}-icon.webp${cacheBust ? `?t=${cacheBust}` : ''}`
    : null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('category', category);
    fd.append('entityId', entityId);
    fd.append('planetType', planetTypeId);
    fd.append('file', file);
    const res = await fetchWithAuth('/admin/upload-asset', { method: 'POST', body: fd });
    setUploading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Upload failed');
      return;
    }
    setCacheBust(String(Date.now()));
    onChange();
  };

  const handleDelete = async () => {
    if (!confirm(`Supprimer la variante ${planetTypeName} ?`)) return;
    const res = await fetchWithAuth(`/admin/asset-variant/${category}/${entityId}/${planetTypeId}`, { method: 'DELETE' });
    if (!res.ok) { alert('Delete failed'); return; }
    onChange();
  };

  return (
    <div className="flex items-center gap-3 py-2">
      <span className="w-28 text-sm">{planetTypeName}</span>
      {hasVariant && iconUrl ? (
        <>
          <img src={iconUrl} alt={planetTypeName} className="w-12 h-12 rounded object-cover" />
          <button type="button" onClick={handleDelete} className="text-red-500 text-xs hover:underline">Supprimer</button>
        </>
      ) : (
        <>
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFileChange} />
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
                  className="text-xs px-2 py-1 border rounded hover:bg-accent">
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Uploader'}
          </button>
        </>
      )}
    </div>
  );
}
```

(The slug computation inline is a placeholder — prefer importing `toKebab` from `@exilium/shared` to match the rest of the codebase.)

- [ ] **Step 2: Build the panel**

Create `apps/admin/src/components/ui/PlanetTypeVariantsPanel.tsx`:

```tsx
import { useState } from 'react';
import { PlanetTypeVariantSlot } from './PlanetTypeVariantSlot';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface PlanetTypeVariantsPanelProps {
  category: 'buildings' | 'defenses';
  entityId: string;
  variantPlanetTypes: string[];
  planetTypes: Array<{ id: string; name: string }>;
  onChange: () => void;
}

export function PlanetTypeVariantsPanel({
  category, entityId, variantPlanetTypes, planetTypes, onChange,
}: PlanetTypeVariantsPanelProps) {
  const [open, setOpen] = useState(false);
  const count = variantPlanetTypes.length;

  return (
    <div className="border rounded mt-3">
      <button type="button" onClick={() => setOpen((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent/30">
        <span>Variantes par type de planète ({count}/{planetTypes.length})</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <div className="px-3 pb-3 border-t">
          {planetTypes.map((pt) => (
            <PlanetTypeVariantSlot
              key={pt.id}
              category={category}
              entityId={entityId}
              planetTypeId={pt.id}
              planetTypeName={pt.name}
              hasVariant={variantPlanetTypes.includes(pt.id)}
              onChange={onChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Integrate into Buildings admin page**

In `apps/admin/src/pages/Buildings.tsx` around line 241 (where `<AdminImageUpload category="buildings" … />` is rendered), add the panel just below. `gameConfig` is already fetched on this page (check the existing query — if not, use `trpc.gameConfig.get.useQuery()` or whatever the admin tRPC uses for config; grep `gameConfig` in the same file). Planet types list is in `gameConfig.planetTypes` (array).

```tsx
<AdminImageUpload category="buildings" entityId={b.id} entityName={b.name} />
<PlanetTypeVariantsPanel
  category="buildings"
  entityId={b.id}
  variantPlanetTypes={b.variantPlanetTypes ?? []}
  planetTypes={gameConfig?.planetTypes?.map((pt) => ({ id: pt.id, name: pt.name })) ?? []}
  onChange={() => utils.gameConfig.get.invalidate()}
/>
```

Exact query-invalidation call depends on the admin tRPC shape — follow the existing pattern used after `AdminImageUpload` in the same page.

- [ ] **Step 4: Same integration in Defenses admin page**

`apps/admin/src/pages/Defenses.tsx` around line 116. Swap `buildings` → `defenses`:

```tsx
<AdminImageUpload category="defenses" entityId={d.id} entityName={d.name} />
<PlanetTypeVariantsPanel
  category="defenses"
  entityId={d.id}
  variantPlanetTypes={d.variantPlanetTypes ?? []}
  planetTypes={gameConfig?.planetTypes?.map((pt) => ({ id: pt.id, name: pt.name })) ?? []}
  onChange={() => utils.gameConfig.get.invalidate()}
/>
```

- [ ] **Step 5: Confirm admin config endpoints return `variantPlanetTypes`**

The admin Buildings / Defenses pages list rows — the tRPC route backing them is typically `gameConfig.get` in `apps/api/src/modules/admin/game-config.router.ts`. Since Task 2 already added `variantPlanetTypes` to `BuildingConfig` / `DefenseConfig`, this should propagate for free. Sanity-check by opening the admin network tab and verifying the field is present in the response.

- [ ] **Step 6: Type-check**

```bash
pnpm --filter @exilium/admin exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Browser smoke test**

```bash
pnpm --filter @exilium/admin dev
```

1. Open the admin Buildings page, pick `mineraiMine`.
2. Expand "Variantes par type de planète", upload a PNG for `volcanic`.
3. Thumbnail appears, file exists at `public/assets/buildings/minerai-mine/volcanic-icon.webp`, DB array contains `["volcanic"]`.
4. Click Supprimer — slot returns to upload state, files gone, array empty.
5. Repeat on a defense.

- [ ] **Step 8: Commit**

```bash
git add apps/admin/src/components/ui/PlanetTypeVariantsPanel.tsx apps/admin/src/components/ui/PlanetTypeVariantSlot.tsx apps/admin/src/pages/Buildings.tsx apps/admin/src/pages/Defenses.tsx
git commit -m "feat(admin): planet-type variant upload UI for buildings & defenses"
git push
```

---

## Self-review checklist (completed)

- Spec coverage: all 8 spec units map to tasks (1 → schema, 2 → config service, 3 → image proc, 4 → endpoints, 5 → URL builder, 6 → GameImage, 7 → outlet context, 8 → call sites, 9 → admin UI). ✓
- No placeholders except the two documented "follow existing pattern" hand-offs in Task 9 (invalidation key + possible toKebab import) — both have concrete guidance on what to look for. ✓
- Type consistency: `variantPlanetTypes: string[]` used identically in DB, `BuildingConfig`, `DefenseConfig`, frontend props. ✓
- Property `planetClassId` confirmed to be the planet-type id (schema link in service `def.allowedPlanetTypes.includes(planet.planetClassId)` — same namespace as `planetTypes.id`). ✓
