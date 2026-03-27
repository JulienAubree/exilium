# Detail Cards DB-Backed Refactor — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all entity detail cards read from the database (via gameConfig tRPC query) instead of hardcoded game-engine constants, so admin edits are immediately reflected to players.

**Architecture:** Add `flavor_text` columns to 4 entity tables + `effect_description` to research. Extend gameConfig interfaces/mapping. Wire detail components to pass gameConfig to getXxxDetails() functions. Remove hardcoded flavor text dictionaries.

**Tech Stack:** Drizzle ORM (PostgreSQL), tRPC, React, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-18-detail-cards-db-design.md`

---

## Task 1: DB schema — add flavor_text and effect_description columns

**Files:**
- Modify: `packages/db/src/schema/game-config.ts:14-27,39-50,62-79,91-105`
- Create: `packages/db/drizzle/0004_detail_card_texts.sql`
- Modify: `packages/db/drizzle/meta/_journal.json`

- [ ] **Step 1: Add columns to Drizzle schema**

In `packages/db/src/schema/game-config.ts`:

Add `flavorText: text('flavor_text'),` before the closing `});` of each table:
- `buildingDefinitions` (after line 26, before `});`)
- `shipDefinitions` (after line 78, before `});`)
- `defenseDefinitions` (after line 104, before `});`)

For `researchDefinitions`, add both:
- `flavorText: text('flavor_text'),`
- `effectDescription: text('effect_description'),`
(after line 49, before `});`)

- [ ] **Step 2: Create migration SQL**

Create `packages/db/drizzle/0004_detail_card_texts.sql`:

```sql
ALTER TABLE "building_definitions" ADD COLUMN "flavor_text" text;
ALTER TABLE "research_definitions" ADD COLUMN "flavor_text" text;
ALTER TABLE "research_definitions" ADD COLUMN "effect_description" text;
ALTER TABLE "ship_definitions" ADD COLUMN "flavor_text" text;
ALTER TABLE "defense_definitions" ADD COLUMN "flavor_text" text;
```

- [ ] **Step 3: Update migration journal**

In `packages/db/drizzle/meta/_journal.json`, add entry at idx 4:

```json
{
  "idx": 4,
  "version": "7",
  "when": 1774147200001,
  "tag": "0004_detail_card_texts",
  "breakpoints": true
}
```

- [ ] **Step 4: Build DB package and verify**

Run: `pnpm --filter @exilium/db build`
Expected: clean build, no errors

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/game-config.ts packages/db/drizzle/0004_detail_card_texts.sql packages/db/drizzle/meta/_journal.json
git commit -m "feat(db): add flavor_text and effect_description columns"
```

---

## Task 2: Seed flavor texts and effect descriptions

**Files:**
- Modify: `packages/db/src/seed-game-config.ts`

The flavor texts are currently hardcoded in `apps/web/src/lib/entity-details.ts` lines 25-91. Move them into the seed data.

- [ ] **Step 1: Add flavorText to BUILDINGS seed array**

In `packages/db/src/seed-game-config.ts`, add a `flavorText` field to each building entry in the BUILDINGS array. Values to use:

```
mineraiMine: "Creusant profondement dans la croute planetaire, les foreuses extractrices de minerai constituent la colonne vertebrale de toute economie spatiale."
siliciumMine: "Les gisements de silicium, formes sous des pressions immenses, alimentent l'ensemble des technologies avancees de la galaxie."
hydrogeneSynth: "L'hydrogene, element fondamental de l'univers, est extrait des oceans planetaires par un processus de filtration moleculaire."
solarPlant: "D'immenses panneaux photovoltaiques captent l'energie de l'etoile la plus proche pour alimenter l'ensemble des infrastructures planetaires."
robotics: "Les chaines de montage automatisees accelerent la construction de tous les batiments et infrastructures."
shipyard: "Le chantier spatial assemble les vaisseaux industriels necessaires a l'expansion de votre empire."
arsenal: "L'arsenal planetaire fabrique les systemes de defense qui protegent vos installations contre les attaques ennemies."
commandCenter: "Le centre de commandement coordonne la construction des vaisseaux militaires les plus puissants de votre flotte."
researchLab: "Au coeur de ce laboratoire, les meilleurs scientifiques de l'empire repoussent les frontieres de la connaissance."
storageMinerai: "De vastes entrepots blindes permettent de stocker des quantites croissantes de minerai en toute securite."
storageSilicium: "Ces chambres a environnement controle preservent le silicium dans des conditions optimales."
storageHydrogene: "Des reservoirs cryogeniques haute pression maintiennent l'hydrogene a l'etat liquide pour un stockage maximal."
missionCenter: "Le centre de missions coordonne les operations PvE, deverrouillant l'acces aux missions d'extraction et de combat contre les pirates."
```

- [ ] **Step 2: Add flavorText and effectDescription to RESEARCH seed array**

Add `flavorText` and `effectDescription` fields to each research entry:

Flavor texts:
```
espionageTech: "Des sondes furtives equipees de capteurs toujours plus performants permettent de percer les secrets de vos adversaires."
computerTech: "L'augmentation de la puissance de calcul permet de coordonner un nombre croissant de flottes simultanement."
energyTech: "La maitrise des flux energetiques ouvre la voie aux technologies de propulsion avancees."
combustion: "Les moteurs a combustion interne propulsent les premiers vaisseaux a travers l'espace interstellaire."
impulse: "Le reacteur a impulsion utilise le principe de reaction nucleaire pour atteindre des vitesses superieures."
hyperspaceDrive: "En pliant l'espace-temps, la propulsion hyperespace permet de parcourir des distances autrefois inimaginables."
weapons: "Chaque avancee en technologie des armes augmente de 10% la puissance de feu de toutes vos unites."
shielding: "Les generateurs de bouclier creent des champs de force protegeant vos unites des impacts ennemis."
armor: "Des alliages toujours plus resistants renforcent la coque de toutes vos unites de 10% par niveau."
```

Effect descriptions:
```
espionageTech: "Chaque niveau ameliore la quantite d'informations obtenues par sonde et la resistance au contre-espionnage."
computerTech: "Chaque niveau permet de controler une flotte supplementaire simultanement."
energyTech: "Prerequis pour les technologies de propulsion avancees."
combustion: "Chaque niveau augmente la vitesse des vaisseaux a combustion de 10%."
impulse: "Chaque niveau augmente la vitesse des vaisseaux a impulsion de 20%."
hyperspaceDrive: "Chaque niveau augmente la vitesse des vaisseaux hyperespace de 30%."
weapons: "Chaque niveau augmente les degats de toutes les unites de 10%."
shielding: "Chaque niveau augmente les boucliers de toutes les unites de 10%."
armor: "Chaque niveau augmente la coque de toutes les unites de 10%."
```

- [ ] **Step 3: Add flavorText to SHIPS seed array**

```
prospector: "Le prospecteur est un vaisseau minier leger concu pour l'extraction de ressources sur les asteroides et planetes voisines."
explorer: "L'explorateur est un vaisseau rapide equipe de scanners avances pour cartographier les systemes stellaires inconnus."
smallCargo: "Rapide et maniable, le petit transporteur est le cheval de trait de toute flotte commerciale."
largeCargo: "Avec sa soute massive, le grand transporteur peut deplacer d'enormes quantites de ressources en un seul voyage."
lightFighter: "Le chasseur leger, pilier des premieres flottes, compense sa fragilite par son faible cout de production."
heavyFighter: "Blindage renforce et armement superieur font du chasseur lourd un adversaire redoutable en combat rapproche."
cruiser: "Polyvalent et puissamment arme, le croiseur domine les escarmouches grace a son tir rapide devastateur."
battleship: "Le vaisseau de bataille, colosse d'acier et de feu, est la piece maitresse de toute flotte d'invasion."
espionageProbe: "Quasiment indetectable, la sonde d'espionnage collecte des renseignements precieux sur les planetes adverses."
colonyShip: "Ce vaisseau transporte tout le necessaire pour etablir une nouvelle colonie sur une planete inhabite."
recycler: "Equipe de puissants aimants et de bras mecaniques, le recycleur collecte les debris des batailles spatiales."
```

- [ ] **Step 4: Add flavorText to DEFENSES seed array**

```
rocketLauncher: "Simple mais efficace, le lanceur de missiles constitue la premiere ligne de defense de toute planete."
lightLaser: "Le laser leger offre un excellent rapport cout-efficacite pour les defenses planetaires de base."
heavyLaser: "Concentrant une energie devastatrice, le laser lourd peut percer le blindage des vaisseaux moyens."
gaussCannon: "Propulsant des projectiles a une fraction de la vitesse de la lumiere, le canon de Gauss inflige des degats considerables."
plasmaTurret: "La tourelle a plasma genere un flux de particules ionisees capable de vaporiser les blindages les plus epais."
smallShield: "Un dome energetique enveloppe la planete, absorbant une partie des degats lors des attaques ennemies."
largeShield: "Le grand bouclier genere un champ de force puissant qui protege l'ensemble des installations planetaires."
```

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/seed-game-config.ts
git commit -m "feat(seed): add flavor texts and effect descriptions to seed data"
```

---

## Task 3: Extend gameConfig service interfaces and mapping

**Files:**
- Modify: `apps/api/src/modules/admin/game-config.service.ts:44-110,212-298`

- [ ] **Step 1: Add flavorText to BuildingConfig interface**

At `apps/api/src/modules/admin/game-config.service.ts:56`, before `prerequisites`, add:
```typescript
  flavorText: string | null;
```

- [ ] **Step 2: Add flavorText and effectDescription to ResearchConfig interface**

At line ~70, before `prerequisites`, add:
```typescript
  flavorText: string | null;
  effectDescription: string | null;
```

- [ ] **Step 3: Add flavorText to ShipConfig interface**

At line ~91, before `prerequisites`, add:
```typescript
  flavorText: string | null;
```

- [ ] **Step 4: Add flavorText to DefenseConfig interface**

At line ~109, before `prerequisites`, add:
```typescript
  flavorText: string | null;
```

- [ ] **Step 5: Add flavorText to buildings mapping in getFullConfig()**

At line ~228 (inside `buildings[b.id] = {`), add before `prerequisites`:
```typescript
        flavorText: b.flavorText ?? null,
```

- [ ] **Step 6: Add fields to research mapping**

At line ~248 (inside `research[r.id] = {`), add before `prerequisites`:
```typescript
        flavorText: r.flavorText ?? null,
        effectDescription: r.effectDescription ?? null,
```

- [ ] **Step 7: Add flavorText to ships mapping**

At line ~274 (inside `ships[s.id] = {`), add before `prerequisites`:
```typescript
        flavorText: s.flavorText ?? null,
```

- [ ] **Step 8: Add flavorText to defenses mapping**

At line ~297 (inside `defenses[d.id] = {`), add before `prerequisites`:
```typescript
        flavorText: d.flavorText ?? null,
```

- [ ] **Step 9: Build and verify**

Run: `pnpm --filter @exilium/db build && npx tsc --noEmit -p apps/api/tsconfig.json`
Expected: no errors

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/modules/admin/game-config.service.ts
git commit -m "feat(api): extend gameConfig interfaces and mapping with flavor texts"
```

---

## Task 4: Extend admin Zod schemas (create + update mutations)

**Files:**
- Modify: `apps/api/src/modules/admin/game-config.router.ts`

- [ ] **Step 1: Add flavorText to createBuilding and updateBuilding schemas**

In `createBuilding` input (~line 56), add:
```typescript
        flavorText: z.string().nullable().optional(),
```

In `updateBuilding` data (~line 84), add:
```typescript
          flavorText: z.string().nullable().optional(),
```

- [ ] **Step 2: Add fields to createResearch and updateResearch**

In `createResearch` input (~line 116), add:
```typescript
        flavorText: z.string().nullable().optional(),
        effectDescription: z.string().nullable().optional(),
```

In `updateResearch` data (~line 140), add:
```typescript
          flavorText: z.string().nullable().optional(),
          effectDescription: z.string().nullable().optional(),
```

- [ ] **Step 3: Add flavorText to createShip and updateShip**

In `createShip` input (~line 180), add:
```typescript
        flavorText: z.string().nullable().optional(),
```

In `updateShip` data (~line 210), add:
```typescript
          flavorText: z.string().nullable().optional(),
```

- [ ] **Step 4: Add flavorText to createDefense and updateDefense**

In `createDefense` input (~line 247), add:
```typescript
        flavorText: z.string().nullable().optional(),
```

In `updateDefense` data (~line 275), add:
```typescript
          flavorText: z.string().nullable().optional(),
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p apps/api/tsconfig.json`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/admin/game-config.router.ts
git commit -m "feat(api): add flavorText/effectDescription to admin Zod schemas"
```

---

## Task 5: Add flavor text fields to admin pages

**Files:**
- Modify: `apps/admin/src/pages/Buildings.tsx:10-23`
- Modify: `apps/admin/src/pages/Ships.tsx:10-23`
- Modify: `apps/admin/src/pages/Defenses.tsx:10-21`
- Modify: `apps/admin/src/pages/Research.tsx:10-18`

- [ ] **Step 1: Add flavorText field to Buildings admin page**

In `apps/admin/src/pages/Buildings.tsx`, in the `getFields()` function (line 11-22), add before the closing `];`:
```typescript
    { key: 'flavorText', label: "Texte d'ambiance", type: 'textarea' as const },
```

- [ ] **Step 2: Add flavorText field to Ships admin page**

In `apps/admin/src/pages/Ships.tsx`, in the `FIELDS` array (line 10-23), add before `sortOrder`:
```typescript
  { key: 'flavorText', label: "Texte d'ambiance", type: 'textarea' as const },
```

- [ ] **Step 3: Add flavorText field to Defenses admin page**

In `apps/admin/src/pages/Defenses.tsx`, in the `FIELDS` array (line 10-21), add before `sortOrder`:
```typescript
  { key: 'flavorText', label: "Texte d'ambiance", type: 'textarea' as const },
```

- [ ] **Step 4: Add flavorText and effectDescription to Research admin page**

In `apps/admin/src/pages/Research.tsx`, in the `FIELDS` array (line 10-18), add before `sortOrder`:
```typescript
  { key: 'flavorText', label: "Texte d'ambiance", type: 'textarea' as const },
  { key: 'effectDescription', label: "Description d'effet", type: 'textarea' as const },
```

- [ ] **Step 5: Type-check admin app**

Run: `npx tsc --noEmit -p apps/admin/tsconfig.json`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/pages/Buildings.tsx apps/admin/src/pages/Ships.tsx apps/admin/src/pages/Defenses.tsx apps/admin/src/pages/Research.tsx
git commit -m "feat(admin): add flavor text and effect description fields to edit modals"
```

---

## Task 6: Wire detail components to gameConfig and remove hardcoded texts

**Files:**
- Modify: `apps/web/src/lib/entity-details.ts:13-19,25-91,225,235,274,282-283,290,304,314,325`
- Modify: `apps/web/src/components/entity-details/BuildingDetailContent.tsx:1,11`
- Modify: `apps/web/src/components/entity-details/ShipDetailContent.tsx:1,12`
- Modify: `apps/web/src/components/entity-details/DefenseDetailContent.tsx:1,6`
- Modify: `apps/web/src/components/entity-details/ResearchDetailContent.tsx:1,6`

- [ ] **Step 1: Extend GameConfigData interface in entity-details.ts**

In `apps/web/src/lib/entity-details.ts`, replace the `GameConfigData` interface (lines 13-19) with:

```typescript
interface GameConfigData {
  buildings: Record<string, { id: string; name: string; description: string; flavorText?: string | null; baseCost: { minerai: number; silicium: number; hydrogene: number }; costFactor: number; prerequisites: { buildingId: string; level: number }[] }>;
  research: Record<string, { id: string; name: string; description: string; flavorText?: string | null; effectDescription?: string | null; baseCost: { minerai: number; silicium: number; hydrogene: number }; costFactor: number; prerequisites: { buildings: { buildingId: string; level: number }[]; research: { researchId: string; level: number }[] } }>;
  ships: Record<string, { id: string; name: string; description: string; flavorText?: string | null; cost: { minerai: number; silicium: number; hydrogene: number }; baseSpeed: number; fuelConsumption: number; cargoCapacity: number; driveType: string; weapons: number; shield: number; armor: number; prerequisites: { buildings: { buildingId: string; level: number }[]; research: { researchId: string; level: number }[] } }>;
  defenses: Record<string, { id: string; name: string; description: string; flavorText?: string | null; cost: { minerai: number; silicium: number; hydrogene: number }; weapons: number; shield: number; armor: number; maxPerPlanet: number | null; prerequisites: { buildings: { buildingId: string; level: number }[]; research: { researchId: string; level: number }[] } }>;
  rapidFire: Record<string, Record<string, number>>;
}
```

- [ ] **Step 2: Delete hardcoded flavor text dictionaries**

Delete lines 21-91 of `entity-details.ts` (the `BUILDING_FLAVOR`, `RESEARCH_FLAVOR`, `SHIP_FLAVOR`, `DEFENSE_FLAVOR`, and `RESEARCH_EFFECTS` constants plus their section comments).

- [ ] **Step 3: Update getBuildingDetails() to use config flavorText**

In `getBuildingDetails()` (line ~235), change:
```typescript
    flavorText: BUILDING_FLAVOR[id as BuildingId] ?? '',
```
to:
```typescript
    flavorText: cfgDef?.flavorText ?? '',
```

- [ ] **Step 4: Update getResearchDetails() to use config fields**

In `getResearchDetails()` (lines ~282-283), change:
```typescript
    flavorText: RESEARCH_FLAVOR[id as ResearchId] ?? '',
    effect: RESEARCH_EFFECTS[id as ResearchId] ?? '',
```
to:
```typescript
    flavorText: cfgDef?.flavorText ?? '',
    effect: cfgDef?.effectDescription ?? '',
```

- [ ] **Step 5: Update getShipDetails() to use config flavorText**

In `getShipDetails()` (line ~304), change:
```typescript
    flavorText: SHIP_FLAVOR[id as ShipId] ?? '',
```
to:
```typescript
    flavorText: cfgDef?.flavorText ?? '',
```

- [ ] **Step 6: Update getDefenseDetails() to use config flavorText**

In `getDefenseDetails()` (line ~325), change:
```typescript
    flavorText: DEFENSE_FLAVOR[id as DefenseId] ?? '',
```
to:
```typescript
    flavorText: cfgDef?.flavorText ?? '',
```

- [ ] **Step 7: Remove unused imports from entity-details.ts**

In line 1-10, the following imports are no longer needed for flavor texts but ARE still needed as fallbacks in the getXxxDetails functions and name resolvers. Remove only imports that are no longer referenced anywhere:

Remove from line 6: `COMBAT_STATS, RAPID_FIRE, SHIP_STATS` (these are already handled by config fallback in getShipDetails/getDefenseDetails and getRapidFire* functions).

Keep: `BUILDINGS, RESEARCH, SHIPS, DEFENSES` and all type imports (used in name resolvers and fallback).

Actually, check usage: `COMBAT_STATS` is used as fallback in `getShipDetails` and `getDefenseDetails`. `SHIP_STATS` is used as fallback in `getShipDetails`. `RAPID_FIRE` is used as fallback in `getRapidFireAgainst` and `getRapidFireFrom`. These should be kept as fallback. **Do not remove any imports** — they all serve as fallback when config is unavailable.

- [ ] **Step 8: Wire BuildingDetailContent to use gameConfig**

In `apps/web/src/components/entity-details/BuildingDetailContent.tsx`:

Add import:
```typescript
import { useGameConfig } from '@/hooks/useGameConfig';
```

In the component body (line 10), add:
```typescript
  const { data: gameConfig } = useGameConfig();
```

Change line 11 from:
```typescript
  const details: BuildingDetails = getBuildingDetails(buildingId, undefined, planetContext);
```
to:
```typescript
  const details: BuildingDetails = getBuildingDetails(buildingId, gameConfig ?? undefined, planetContext);
```

Also pass config to `resolveBuildingName` calls (line 65):
```typescript
  {resolveBuildingName(p.buildingId, gameConfig ?? undefined)} niveau {p.level}
```

- [ ] **Step 9: Wire ShipDetailContent to use gameConfig**

In `apps/web/src/components/entity-details/ShipDetailContent.tsx`:

Add import:
```typescript
import { useGameConfig } from '@/hooks/useGameConfig';
```

In the component body (line 11), add:
```typescript
  const { data: gameConfig } = useGameConfig();
```

Change line 12 from:
```typescript
  const details: ShipDetails = getShipDetails(shipId);
```
to:
```typescript
  const details: ShipDetails = getShipDetails(shipId, gameConfig ?? undefined);
```

Also pass config to `resolveBuildingName` (line 78) and `resolveResearchName` (line 84):
```typescript
  {resolveBuildingName(p.buildingId, gameConfig ?? undefined)} niveau {p.level}
  {resolveResearchName(p.researchId, gameConfig ?? undefined)} niveau {p.level}
```

- [ ] **Step 10: Wire DefenseDetailContent to use gameConfig**

In `apps/web/src/components/entity-details/DefenseDetailContent.tsx`:

Add import:
```typescript
import { useGameConfig } from '@/hooks/useGameConfig';
```

In the component body (line 5), add:
```typescript
  const { data: gameConfig } = useGameConfig();
```

Change line 6 from:
```typescript
  const details: DefenseDetails = getDefenseDetails(defenseId);
```
to:
```typescript
  const details: DefenseDetails = getDefenseDetails(defenseId, gameConfig ?? undefined);
```

Also pass config to `resolveBuildingName` (line 58) and `resolveResearchName` (line 64).

- [ ] **Step 11: Wire ResearchDetailContent to use gameConfig**

In `apps/web/src/components/entity-details/ResearchDetailContent.tsx`:

Add import:
```typescript
import { useGameConfig } from '@/hooks/useGameConfig';
```

In the component body (line 5), add:
```typescript
  const { data: gameConfig } = useGameConfig();
```

Change line 6 from:
```typescript
  const details: ResearchDetails = getResearchDetails(researchId);
```
to:
```typescript
  const details: ResearchDetails = getResearchDetails(researchId, gameConfig ?? undefined);
```

Also pass config to `resolveBuildingName` (line 36) and `resolveResearchName` (line 42).

- [ ] **Step 12: Type-check both apps**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json && npx tsc --noEmit -p apps/api/tsconfig.json`
Expected: no errors

- [ ] **Step 13: Commit**

```bash
git add apps/web/src/lib/entity-details.ts apps/web/src/components/entity-details/
git commit -m "feat: wire detail cards to gameConfig DB data, remove hardcoded texts"
```

---

## Task 7: Final commit and push

- [ ] **Step 1: Push all commits**

```bash
git push
```
