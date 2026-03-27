# Planet Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add planet visuals per type with random assignment at creation, admin upload, and display in Overview/TopBar/Galaxy.

**Architecture:** Images stored on filesystem at `/assets/planets/{type}/{index}.webp` with Sharp-generated variants. A `planetImageIndex` smallint field on the `planets` table stores the assigned visual. A standalone utility scans the filesystem to pick a random index. The Galaxy view uses SVG dots with CSS animation instead of uploaded images.

**Tech Stack:** Drizzle ORM, Sharp, Fastify multipart, React, CSS animations

**Spec:** `docs/superpowers/specs/2026-03-20-planet-images-design.md`

---

### Task 1: Add `planetImageIndex` to DB schema

**Files:**
- Modify: `packages/db/src/schema/planets.ts`

- [ ] **Step 1: Add the column**

In `packages/db/src/schema/planets.ts`, add after line 16 (`planetClassId`):

```typescript
planetImageIndex: smallint('planet_image_index'),
```

- [ ] **Step 2: Generate and apply migration**

```bash
cd packages/db && pnpm drizzle-kit generate && pnpm db:push
```

- [ ] **Step 3: Commit**

```bash
git add packages/db/
git commit -m "feat: add planetImageIndex column to planets table"
```

---

### Task 2: Create planet image utility

**Files:**
- Create: `apps/api/src/lib/planet-image.util.ts`

- [ ] **Step 1: Create the utility**

```typescript
import fs from 'fs';
import path from 'path';

/**
 * Scan /assets/planets/{planetClassId}/ for hero images (N.webp without suffix).
 * Returns a random index from available images, or null if none exist.
 */
export function getRandomPlanetImageIndex(planetClassId: string, assetsDir: string): number | null {
  const dir = path.join(assetsDir, 'planets', planetClassId);
  if (!fs.existsSync(dir)) return null;

  const indexes = fs.readdirSync(dir)
    .filter((f) => /^\d+\.webp$/.test(f))
    .map((f) => parseInt(f, 10))
    .sort((a, b) => a - b);

  if (indexes.length === 0) return null;
  return indexes[Math.floor(Math.random() * indexes.length)];
}

/**
 * Get the next available index for a planet type (for upload).
 */
export function getNextPlanetImageIndex(planetClassId: string, assetsDir: string): number {
  const dir = path.join(assetsDir, 'planets', planetClassId);
  if (!fs.existsSync(dir)) return 1;

  const indexes = fs.readdirSync(dir)
    .filter((f) => /^\d+\.webp$/.test(f))
    .map((f) => parseInt(f, 10));

  if (indexes.length === 0) return 1;
  return Math.max(...indexes) + 1;
}

/**
 * List all available image indexes for a planet type.
 */
export function listPlanetImageIndexes(planetClassId: string, assetsDir: string): number[] {
  const dir = path.join(assetsDir, 'planets', planetClassId);
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter((f) => /^\d+\.webp$/.test(f))
    .map((f) => parseInt(f, 10))
    .sort((a, b) => a - b);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/lib/planet-image.util.ts
git commit -m "feat: add planet image utility (random index, next index, listing)"
```

---

### Task 3: Wire image assignment into planet creation

**Files:**
- Modify: `apps/api/src/modules/planet/planet.service.ts`
- Modify: `apps/api/src/trpc/app-router.ts`

- [ ] **Step 1: Add `assetsDir` parameter to `createPlanetService`**

In `planet.service.ts`, update the function signature and import:

```typescript
import { getRandomPlanetImageIndex } from '../../lib/planet-image.util.js';

export function createPlanetService(db: Database, gameConfigService: GameConfigService, assetsDir: string) {
```

- [ ] **Step 2: Assign image in `createHomePlanet`**

In `createHomePlanet`, add before the `db.insert`:

```typescript
const planetImageIndex = getRandomPlanetImageIndex('homeworld', assetsDir);
```

And add `planetImageIndex` to the `.values({...})` object:

```typescript
planetImageIndex,
```

- [ ] **Step 3: Update app-router to pass `assetsDir`**

In `apps/api/src/trpc/app-router.ts`, find `createPlanetService(db, gameConfigService)` and change to:

```typescript
const planetService = createPlanetService(db, gameConfigService, env.ASSETS_DIR);
```

Add `import { env } from '../config/env.js';` if not already imported.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/planet/planet.service.ts apps/api/src/trpc/app-router.ts
git commit -m "feat: assign random planet image at home planet creation"
```

---

### Task 4: Wire image assignment into colonization

**Files:**
- Modify: `apps/api/src/modules/fleet/handlers/colonize.handler.ts`
- Modify: `apps/api/src/modules/fleet/fleet.types.ts`

- [ ] **Step 1: Add `assetsDir` to `MissionHandlerContext`**

In `fleet.types.ts`, add to the `MissionHandlerContext` interface:

```typescript
assetsDir: string;
```

- [ ] **Step 2: Update colonize handler**

In `colonize.handler.ts`, import the utility:

```typescript
import { getRandomPlanetImageIndex } from '../../lib/planet-image.util.js';
```

In `processArrival`, after `const maxFields = calculateMaxFields(diameter, fieldsBonus);` (line 110), add:

```typescript
const planetImageIndex = getRandomPlanetImageIndex(planetTypeForPos?.id ?? 'homeworld', ctx.assetsDir);
```

And add `planetImageIndex` to the `db.insert(planets).values({...})` object (after `maxTemp,`):

```typescript
planetImageIndex,
```

- [ ] **Step 3: Pass `assetsDir` when building the context**

Find where `MissionHandlerContext` is constructed (in `fleet.service.ts` or the worker that calls handlers). Search for `assetsDir` or the context construction:

```bash
grep -n "MissionHandlerContext\|resourceService," apps/api/src/modules/fleet/fleet.service.ts
```

Add `assetsDir: env.ASSETS_DIR` to the context object, importing `env` if needed.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/fleet/
git commit -m "feat: assign random planet image at colonization"
```

---

### Task 5: Extend upload system for planet images

**Files:**
- Modify: `apps/api/src/lib/image-processing.ts`
- Modify: `apps/api/src/modules/admin/asset-upload.route.ts`

- [ ] **Step 1: Extend `AssetCategory` and add planet processing**

In `image-processing.ts`, update the type and valid categories:

```typescript
export type AssetCategory = 'buildings' | 'research' | 'ships' | 'defenses' | 'planets';

const VALID_CATEGORIES: AssetCategory[] = ['buildings', 'research', 'ships', 'defenses', 'planets'];
```

Add a new function for planet image processing:

```typescript
export async function processPlanetImage(
  buffer: Buffer,
  planetClassId: string,
  imageIndex: number,
  assetsDir: string,
): Promise<string[]> {
  const outputDir = path.join(assetsDir, 'planets', planetClassId);
  fs.mkdirSync(outputDir, { recursive: true });

  const files: string[] = [];

  for (const size of SIZES) {
    const filename = `${imageIndex}${size.suffix}.webp`;
    const outPath = path.join(outputDir, filename);

    let pipeline = sharp(buffer);

    if (size.height) {
      pipeline = pipeline.resize({
        width: size.width,
        height: size.height,
        fit: 'cover',
        position: 'centre',
      });
    } else {
      pipeline = pipeline.resize({ width: size.width });
    }

    await pipeline.webp({ quality: size.quality }).toFile(outPath);
    files.push(filename);
  }

  return files;
}
```

- [ ] **Step 2: Update upload route for planet category**

In `asset-upload.route.ts`, update the error message and add planet-specific handling.

Replace the category validation error message:

```typescript
return reply.status(400).send({ error: 'Invalid category. Must be: buildings, research, ships, defenses, planets' });
```

Import the new function and the utility:

```typescript
import { processImage, processPlanetImage, isValidCategory } from '../../lib/image-processing.js';
import { getNextPlanetImageIndex } from '../../lib/planet-image.util.js';
```

Replace the "Process image" block (lines 64-66) with:

```typescript
let files: string[];
if (category === 'planets') {
  const planetClassId = entityId; // entityId = planet type id for planets
  const nextIndex = getNextPlanetImageIndex(planetClassId, env.ASSETS_DIR);
  files = await processPlanetImage(buffer, planetClassId, nextIndex, env.ASSETS_DIR);
} else {
  files = await processImage(buffer, category, entityId, env.ASSETS_DIR);
}
return reply.send({ success: true, files });
```

- [ ] **Step 3: Add listing route**

In `asset-upload.route.ts`, add a GET route inside `registerAssetUploadRoute`:

```typescript
import { listPlanetImageIndexes } from '../../lib/planet-image.util.js';

// Add after the POST route:
server.get('/admin/planet-images/:planetClassId', async (request, reply) => {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  let userId: string;
  try {
    const { payload } = await jwtVerify(authHeader.slice(7), JWT_SECRET);
    userId = payload.userId as string;
  } catch {
    return reply.status(401).send({ error: 'Invalid token' });
  }

  const [user] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user?.isAdmin) {
    return reply.status(401).send({ error: 'Admin access required' });
  }

  const { planetClassId } = request.params as { planetClassId: string };
  const indexes = listPlanetImageIndexes(planetClassId, env.ASSETS_DIR);
  const images = indexes.map((index) => ({
    index,
    thumbUrl: `/assets/planets/${planetClassId}/${index}-thumb.webp`,
  }));

  return reply.send({ images });
});
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/lib/image-processing.ts apps/api/src/modules/admin/asset-upload.route.ts
git commit -m "feat: extend upload system for planet images with listing endpoint"
```

---

### Task 6: Admin panel — planet image management

**Files:**
- Modify: `apps/admin/src/pages/PlanetTypes.tsx`
- Modify: `apps/admin/src/components/ui/AdminImageUpload.tsx`

- [ ] **Step 1: Update `AdminImageUpload` to support planets category**

In `AdminImageUpload.tsx`, update the type:

```typescript
type AssetCategory = 'buildings' | 'research' | 'ships' | 'defenses' | 'planets';
```

- [ ] **Step 2: Create a `PlanetImagePool` component in `PlanetTypes.tsx`**

Add at the top of the file (before the default export), a component that shows existing planet images and allows uploading new ones:

```typescript
import { AdminImageUpload } from '@/components/ui/AdminImageUpload';
import { fetchWithAuth } from '@/trpc';

function PlanetImagePool({ planetClassId }: { planetClassId: string }) {
  const [images, setImages] = useState<{ index: number; thumbUrl: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const loadImages = async () => {
    try {
      const res = await fetchWithAuth(`/admin/planet-images/${planetClassId}`);
      if (res.ok) {
        const data = await res.json();
        setImages(data.images);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { loadImages(); }, [planetClassId]);

  return (
    <div className="mt-2">
      <div className="text-xs text-gray-500 mb-1">Visuels ({images.length})</div>
      <div className="flex flex-wrap gap-1.5 items-center">
        {images.map((img) => (
          <img
            key={img.index}
            src={`${img.thumbUrl}?t=${Date.now()}`}
            alt={`${planetClassId} ${img.index}`}
            className="w-10 h-10 rounded border border-panel-border object-cover"
          />
        ))}
        <AdminImageUpload
          category="planets"
          entityId={planetClassId}
          entityName={planetClassId}
          onUploadComplete={loadImages}
        />
      </div>
    </div>
  );
}
```

Add `useEffect` to the imports if not already imported.

- [ ] **Step 3: Add `onUploadComplete` callback to `AdminImageUpload`**

In `AdminImageUpload.tsx`, add the optional prop:

```typescript
interface AdminImageUploadProps {
  category: AssetCategory;
  entityId: string;
  entityName: string;
  onUploadComplete?: () => void;
}

export function AdminImageUpload({ category, entityId, entityName, onUploadComplete }: AdminImageUploadProps) {
```

Call `onUploadComplete?.()` after successful upload (after `setCacheBust(String(Date.now()));`):

```typescript
onUploadComplete?.();
```

- [ ] **Step 4: Insert `PlanetImagePool` into the table**

In the `<tbody>` of `PlanetTypes.tsx`, modify each `<tr>` to include the image pool. After line 147 (`</tr>`), add the pool as a new row below each type:

Replace the `{types.map((pt) => (` block to include the image pool. Each type gets two rows — the data row and an image row:

```tsx
{types.map((pt) => (
  <tr key={pt.id}>
    {/* ... existing td cells stay the same ... */}
  </tr>
  <tr key={`${pt.id}-images`}>
    <td colSpan={11} className="px-2 pb-2">
      <PlanetImagePool planetClassId={pt.id} />
    </td>
  </tr>
))}
```

Note: Since `.map` returns a single element, wrap the two `<tr>` in a `<Fragment>`:

```tsx
import { Fragment } from 'react';
// ...
{types.map((pt) => (
  <Fragment key={pt.id}>
    <tr>
      {/* existing cells */}
    </tr>
    <tr>
      <td colSpan={11} className="px-2 pb-2">
        <PlanetImagePool planetClassId={pt.id} />
      </td>
    </tr>
  </Fragment>
))}
```

- [ ] **Step 5: Commit**

```bash
git add apps/admin/
git commit -m "feat: planet image pool management in admin panel"
```

---

### Task 7: Frontend — planet image helper and Overview display

**Files:**
- Modify: `apps/web/src/lib/assets.ts`
- Modify: `apps/web/src/pages/Overview.tsx`

- [ ] **Step 1: Add planet image URL helper**

In `apps/web/src/lib/assets.ts`, add:

```typescript
const PLANET_SUFFIX: Record<AssetSize, string> = {
  full: '',
  thumb: '-thumb',
  icon: '-icon',
};

export function getPlanetImageUrl(
  planetClassId: string,
  imageIndex: number,
  size: AssetSize = 'full',
): string {
  return `/assets/planets/${planetClassId}/${imageIndex}${PLANET_SUFFIX[size]}.webp`;
}
```

- [ ] **Step 2: Add planet hero to Overview**

In `Overview.tsx`, import the helper:

```typescript
import { getPlanetImageUrl } from '@/lib/assets';
```

Replace the planet header `<section>` (lines 123-160) to include the planet image as a hero:

```tsx
<section className="glass-card overflow-hidden lg:col-span-2 xl:col-span-3">
  {/* Planet hero image */}
  {planet.planetClassId && planet.planetImageIndex != null && (
    <div className="relative h-40 lg:h-56 w-full overflow-hidden">
      <img
        src={getPlanetImageUrl(planet.planetClassId, planet.planetImageIndex)}
        alt={planet.name}
        className="w-full h-full object-cover"
        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
    </div>
  )}

  <div className="p-4">
    {isRenaming ? (
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (newName.trim()) {
            renameMutation.mutate({ planetId: planet.id, name: newName.trim() });
          }
        }}
      >
        <Input
          autoFocus
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={30}
          className="h-8"
        />
        <Button type="submit" size="sm" disabled={renameMutation.isPending}>
          OK
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setIsRenaming(false)}>
          Annuler
        </Button>
      </form>
    ) : (
      <h2
        className={`text-lg font-semibold text-foreground ${!planet.renamed ? 'cursor-pointer hover:text-primary transition-colors' : ''}`}
        onClick={!planet.renamed ? () => { setNewName(planet.name); setIsRenaming(true); } : undefined}
        title={!planet.renamed ? 'Cliquer pour renommer' : undefined}
      >
        {planet.name}
      </h2>
    )}
    <p className="text-sm text-muted-foreground mt-1">
      [{planet.galaxy}:{planet.system}:{planet.position}]
    </p>
  </div>
</section>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/assets.ts apps/web/src/pages/Overview.tsx
git commit -m "feat: display planet hero image on Overview page"
```

---

### Task 8: Frontend — planet icon in TopBar selector

**Files:**
- Modify: `apps/web/src/components/layout/TopBar.tsx`

- [ ] **Step 1: Update Planet interface and add import**

Replace the local `Planet` interface (lines 12-18):

```typescript
import { getPlanetImageUrl } from '@/lib/assets';

interface Planet {
  id: string;
  name: string;
  galaxy: number;
  system: number;
  position: number;
  planetClassId: string | null;
  planetImageIndex: number | null;
}
```

- [ ] **Step 2: Add icon next to planet name in the selector button**

Replace the selector button content (lines 134-141):

```tsx
<button
  onClick={() => setDropdownOpen(!dropdownOpen)}
  className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent"
>
  {activePlanet?.planetClassId && activePlanet.planetImageIndex != null ? (
    <img
      src={getPlanetImageUrl(activePlanet.planetClassId, activePlanet.planetImageIndex, 'icon')}
      alt=""
      className="w-5 h-5 rounded-full object-cover"
    />
  ) : (
    <span className="w-5 h-5 rounded-full bg-primary/30 inline-block" />
  )}
  <span className="font-medium">
    {activePlanet ? activePlanet.name : 'Planete'}
    {activePlanet && (
      <span className="hidden lg:inline"> [{activePlanet.galaxy}:{activePlanet.system}:{activePlanet.position}]</span>
    )}
  </span>
  <span className="text-xs">&#9660;</span>
</button>
```

- [ ] **Step 3: Add icons in the dropdown list**

Replace the dropdown button content (lines 154-156):

```tsx
<button
  key={planet.id}
  onClick={() => handleSelectPlanet(planet.id)}
  className={cn(
    'flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent',
    planet.id === planetId && 'bg-primary/10 text-primary',
  )}
>
  {planet.planetClassId && planet.planetImageIndex != null ? (
    <img
      src={getPlanetImageUrl(planet.planetClassId, planet.planetImageIndex, 'icon')}
      alt=""
      className="w-5 h-5 rounded-full object-cover"
    />
  ) : (
    <span className="w-5 h-5 rounded-full bg-primary/30 inline-block" />
  )}
  {planet.name} [{planet.galaxy}:{planet.system}:{planet.position}]
</button>
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/layout/TopBar.tsx
git commit -m "feat: planet icon in TopBar planet selector"
```

---

### Task 9: Frontend — PlanetDot SVG in Galaxy view

**Files:**
- Create: `apps/web/src/components/galaxy/PlanetDot.tsx`
- Modify: `apps/web/src/pages/Galaxy.tsx`
- Modify: `apps/api/src/modules/galaxy/galaxy.service.ts`

- [ ] **Step 1: Expose `planetClassId` for all players**

In `galaxy.service.ts`, remove lines 34-37 (the block that nulls out `planetClassId` for other players):

```typescript
// DELETE these lines:
// Only show planetClassId for the current user's own planets
if (planet.userId !== currentUserId) {
  planet.planetClassId = null;
}
```

- [ ] **Step 2: Create PlanetDot component**

Create `apps/web/src/components/galaxy/PlanetDot.tsx`:

```tsx
const TYPE_COLORS: Record<string, { from: string; to: string; accent: string }> = {
  volcanic:  { from: '#ef4444', to: '#f97316', accent: '#fbbf24' },
  arid:      { from: '#d97706', to: '#92400e', accent: '#fbbf24' },
  temperate: { from: '#22c55e', to: '#3b82f6', accent: '#86efac' },
  glacial:   { from: '#93c5fd', to: '#e0f2fe', accent: '#ffffff' },
  gaseous:   { from: '#a855f7', to: '#ec4899', accent: '#e879f9' },
  homeworld: { from: '#22d3ee', to: '#10b981', accent: '#a7f3d0' },
};

const DEFAULT_COLORS = { from: '#6b7280', to: '#9ca3af', accent: '#d1d5db' };

export function PlanetDot({ planetClassId, size = 20 }: { planetClassId: string | null; size?: number }) {
  const colors = (planetClassId && TYPE_COLORS[planetClassId]) || DEFAULT_COLORS;
  const id = `planet-${planetClassId ?? 'unknown'}-${Math.random().toString(36).slice(2, 6)}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      className="planet-dot"
    >
      <defs>
        <radialGradient id={id} cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor={colors.accent} />
          <stop offset="50%" stopColor={colors.from} />
          <stop offset="100%" stopColor={colors.to} />
        </radialGradient>
      </defs>
      <circle cx="10" cy="10" r="9" fill={`url(#${id})`} />
      <circle cx="10" cy="10" r="9" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
    </svg>
  );
}
```

- [ ] **Step 3: Add CSS animation**

Add to `apps/web/src/index.css` (or the main CSS file) the rotation animation:

```css
.planet-dot {
  animation: planet-rotate 8s linear infinite;
}

@keyframes planet-rotate {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
```

Find the correct CSS file:

```bash
ls apps/web/src/*.css
```

- [ ] **Step 4: Replace dot in Galaxy mobile view**

In `Galaxy.tsx`, import the component:

```typescript
import { PlanetDot } from '@/components/galaxy/PlanetDot';
```

Replace the static dot in mobile view (line 152):

```tsx
// Replace: <div className="h-2 w-2 rounded-full bg-primary" />
// With:
<PlanetDot planetClassId={(slot as any).planetClassId} size={20} />
```

Also replace the empty slot dot (line 177):

```tsx
// Replace: <div className="h-2 w-2 rounded-full bg-muted" />
// With:
<div className="h-5 w-5 rounded-full bg-muted/30" />
```

- [ ] **Step 5: Add PlanetDot to desktop table**

In the desktop table, add a planet dot before the planet name in the `<td>` (line 218). Replace:

```tsx
<td className="px-2 py-1">{(slot as any).planetName}</td>
```

With:

```tsx
<td className="px-2 py-1">
  <span className="inline-flex items-center gap-2">
    <PlanetDot planetClassId={(slot as any).planetClassId} size={18} />
    {(slot as any).planetName}
  </span>
</td>
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/galaxy/PlanetDot.tsx apps/web/src/pages/Galaxy.tsx apps/api/src/modules/galaxy/galaxy.service.ts apps/web/src/
git commit -m "feat: animated PlanetDot SVG in Galaxy view"
```

---

### Task 10: Migration script for existing planets

**Files:**
- Create: `packages/db/src/scripts/assign-planet-images.ts`

- [ ] **Step 1: Create the migration script**

```typescript
import { createDb } from '../index.js';
import { planets } from '../schema/planets.js';
import { isNull } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

const DATABASE_URL = process.env.DATABASE_URL;
const ASSETS_DIR = process.env.ASSETS_DIR;

if (!DATABASE_URL || !ASSETS_DIR) {
  console.error('DATABASE_URL and ASSETS_DIR env vars required');
  process.exit(1);
}

const db = createDb(DATABASE_URL);

async function main() {
  const allPlanets = await db
    .select()
    .from(planets)
    .where(isNull(planets.planetImageIndex));

  console.log(`Found ${allPlanets.length} planets without image index`);

  let updated = 0;
  for (const planet of allPlanets) {
    const classId = planet.planetClassId ?? 'homeworld';
    const dir = path.join(ASSETS_DIR, 'planets', classId);

    if (!fs.existsSync(dir)) continue;

    const indexes = fs.readdirSync(dir)
      .filter((f) => /^\d+\.webp$/.test(f))
      .map((f) => parseInt(f, 10));

    if (indexes.length === 0) continue;

    const imageIndex = indexes[Math.floor(Math.random() * indexes.length)];

    await db
      .update(planets)
      .set({ planetImageIndex: imageIndex })
      .where(isNull(planets.planetImageIndex));

    updated++;
  }

  console.log(`Updated ${updated} planets`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Add script command to package.json**

In `packages/db/package.json`, add to scripts:

```json
"assign-planet-images": "tsx src/scripts/assign-planet-images.ts"
```

- [ ] **Step 3: Commit**

```bash
git add packages/db/
git commit -m "feat: migration script to assign images to existing planets"
```

---

### Task 11: Final integration — push and deploy

- [ ] **Step 1: Build check**

```bash
cd /Users/julienaubree/_projet/exilium && pnpm build
```

- [ ] **Step 2: Push**

```bash
git push
```
