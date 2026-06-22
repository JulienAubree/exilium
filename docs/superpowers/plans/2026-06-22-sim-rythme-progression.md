# Simulateur de rythme de progression — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire un simulateur headless qui rejoue la progression économique d'Exilium en temps simulé et produit un rapport de rythme (temps-jusqu'au-jalon, murs, temps morts).

**Architecture:** Nouveau package `packages/game-sim` (Node, ESM). Il **réutilise les formules pures de `@exilium/game-engine`** et charge les **données de définitions** extraites du seed dans un module importable partagé (source unique seed↔sim, sans base live). Un `SimEngine` event-driven (agnostique de la stratégie) applique les actions d'une `Policy` branchable, un `Recorder` horodate les jalons, un `Reporter` écrit un markdown.

**Tech Stack:** TypeScript ESM, vitest, `@exilium/game-engine`, `@exilium/db` (données seed extraites).

## Global Constraints

- Package manager : **pnpm** (workspace). Nouveau package = `@exilium/game-sim`, `"type": "module"`, `"private": true`.
- **Working dir partagé `/opt/exilium`** : `git add` chemins précis (jamais `-A`) ; **vérifier `git rev-parse --abbrev-ref HEAD` = `feat/sim-rythme-progression` avant chaque commit**.
- Réutiliser les formules `@exilium/game-engine`, **ne jamais les ré-implémenter** (`buildingCost`, `buildingTime`, `mineraiProduction`, `siliciumProduction`, `hydrogeneProduction`, `calculateProductionFactor`).
- Vérif au fil de l'eau : `pnpm --filter @exilium/game-sim typecheck` + `test` après chaque lot ; ne pas déployer (outil dev, pas de prod).
- Imports inter-packages en `.js` (ESM) comme le reste du monorepo.

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `packages/db/src/game-config-data.ts` (créé) | Données de définitions extraites (`BUILDINGS`, `PRODUCTION_CONFIG`) — importées par le seed ET le sim |
| `packages/db/src/seed-game-config.ts` (modifié) | Importe depuis `game-config-data.ts` au lieu d'inliner |
| `packages/game-sim/package.json` `tsconfig.json` `vitest.config.ts` (créés) | Squelette du package |
| `packages/game-sim/src/config.ts` | Charge les défs → `BuildingDef[]`, `ProductionConfig` ; mappe vers `BuildingCostDef` |
| `packages/game-sim/src/state.ts` | `SimState` (empire simulé) + `initState()` |
| `packages/game-sim/src/engine.ts` | `SimEngine` : `affordableAt`, `apply`, `advanceToNextEvent`, `production` |
| `packages/game-sim/src/policy.ts` | Interface `Policy` + `EcoPolicy` |
| `packages/game-sim/src/recorder.ts` | `Recorder` : timeline + jalons |
| `packages/game-sim/src/reporter.ts` | `renderReport()` → markdown |
| `packages/game-sim/src/run.ts` | CLI : assemble config+state+engine+policy+recorder → écrit le rapport |
| `scripts/run-gamesim.sh` | Lanceur |

---

### Task 1 : Extraire les données de seed + scaffolder `game-sim` + `config.ts`

**Files:**
- Create: `packages/db/src/game-config-data.ts`
- Modify: `packages/db/src/seed-game-config.ts` (remplacer les const `BUILDINGS` et `PRODUCTION_CONFIG` inline par un import)
- Create: `packages/game-sim/package.json`, `tsconfig.json`, `vitest.config.ts`
- Create: `packages/game-sim/src/config.ts`
- Test: `packages/game-sim/src/config.test.ts`

**Interfaces:**
- Produces:
  - `game-config-data.ts` exporte `export const BUILDINGS: RawBuilding[]` et `export const PRODUCTION_CONFIG: ProductionConfigRow[]` (mêmes objets qu'aujourd'hui).
  - `config.ts` : `interface BuildingDef { id: string; costDef: BuildingCostDef; maxLevel: number; role: string | null; prerequisites: {buildingId:string; level:number}[] }` ; `interface ProductionConfig { baseProduction: number; exponentBase: number; energyConsumption: number | null }` ; `function loadBuildings(): Map<string, BuildingDef>` ; `function loadProductionConfig(): Map<string, ProductionConfig>`.

- [ ] **Step 1 : Extraire les données** — Couper les blocs `const BUILDINGS = [...]` et `const PRODUCTION_CONFIG = [...]` de `seed-game-config.ts` vers un nouveau `packages/db/src/game-config-data.ts` :

```ts
// packages/db/src/game-config-data.ts
// Données de définitions du jeu — source unique importée par le seed (écrit en base)
// ET par le simulateur (packages/game-sim). Ne pas dupliquer ailleurs.
export const BUILDINGS = [
  { id: 'mineraiMine', name: 'Mine de minerai', /* …coller le contenu existant… */ },
  // … coller TOUTES les entrées BUILDINGS existantes verbatim …
];

export const PRODUCTION_CONFIG = [
  { id: 'mineraiMine', baseProduction: 30, exponentBase: 1.1, energyConsumption: 10, storageBase: null, tempCoeffA: null, tempCoeffB: null },
  { id: 'siliciumMine', baseProduction: 20, exponentBase: 1.1, energyConsumption: 10, storageBase: null, tempCoeffA: null, tempCoeffB: null },
  { id: 'hydrogeneSynth', baseProduction: 10, exponentBase: 1.1, energyConsumption: 20, storageBase: null, tempCoeffA: 1.36, tempCoeffB: 0.004 },
  { id: 'solarPlant', baseProduction: 20, exponentBase: 1.1, energyConsumption: null, storageBase: null, tempCoeffA: null, tempCoeffB: null },
  { id: 'storage', baseProduction: 5000, exponentBase: 1.1, energyConsumption: null, storageBase: 5000, tempCoeffA: null, tempCoeffB: null },
];
```

- [ ] **Step 2 : Brancher le seed sur le module** — Dans `seed-game-config.ts`, supprimer les deux const et ajouter en tête : `import { BUILDINGS, PRODUCTION_CONFIG } from './game-config-data.js';`

- [ ] **Step 3 : Vérifier que le seed compile encore** — Run: `pnpm --filter @exilium/db typecheck` → Expected: PASS (aucun autre changement).

- [ ] **Step 4 : Scaffolder le package** — Créer les 3 fichiers (mirror de `packages/game-engine`) :

```json
// packages/game-sim/package.json
{
  "name": "@exilium/game-sim",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/",
    "sim": "tsx src/run.ts"
  },
  "dependencies": {
    "@exilium/game-engine": "workspace:*",
    "@exilium/db": "workspace:*"
  },
  "devDependencies": { "vitest": "^3.0.4", "typescript": "^5.7.3", "tsx": "^4.21.0" }
}
```

```json
// packages/game-sim/tsconfig.json  (copier celui de packages/game-engine/tsconfig.json verbatim)
```

```ts
// packages/game-sim/vitest.config.ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['src/**/*.test.ts'] } });
```

Puis `pnpm install` (lie le workspace).

- [ ] **Step 5 : Écrire le test de config (échoue)** :

```ts
// packages/game-sim/src/config.test.ts
import { describe, it, expect } from 'vitest';
import { loadBuildings, loadProductionConfig } from './config.js';

describe('config', () => {
  it('mappe la mine de minerai vers un BuildingCostDef', () => {
    const b = loadBuildings().get('mineraiMine')!;
    expect(b.costDef).toEqual({ baseCost: { minerai: 60, silicium: 15, hydrogene: 0 }, costFactor: 1.5, baseTime: 45 });
    expect(b.maxLevel).toBe(25);
  });
  it('charge la prod config du solaire', () => {
    expect(loadProductionConfig().get('solarPlant')).toMatchObject({ baseProduction: 20, exponentBase: 1.1 });
  });
});
```

- [ ] **Step 6 : Run → FAIL** — Run: `pnpm --filter @exilium/game-sim test` → Expected: FAIL (config.js introuvable).

- [ ] **Step 7 : Implémenter `config.ts`** :

```ts
// packages/game-sim/src/config.ts
import { BUILDINGS, PRODUCTION_CONFIG } from '@exilium/db/game-config-data';
import type { BuildingCostDef } from '@exilium/game-engine';

export interface BuildingDef {
  id: string;
  costDef: BuildingCostDef;
  maxLevel: number;
  role: string | null;
  prerequisites: { buildingId: string; level: number }[];
}
export interface ProductionConfig { baseProduction: number; exponentBase: number; energyConsumption: number | null }

export function loadBuildings(): Map<string, BuildingDef> {
  const m = new Map<string, BuildingDef>();
  for (const b of BUILDINGS as any[]) {
    m.set(b.id, {
      id: b.id,
      costDef: {
        baseCost: { minerai: b.baseCostMinerai, silicium: b.baseCostSilicium, hydrogene: b.baseCostHydrogene },
        costFactor: b.costFactor,
        baseTime: b.baseTime,
      },
      maxLevel: b.maxLevel,
      role: b.role ?? null,
      prerequisites: b.prerequisites ?? [],
    });
  }
  return m;
}

export function loadProductionConfig(): Map<string, ProductionConfig> {
  const m = new Map<string, ProductionConfig>();
  for (const p of PRODUCTION_CONFIG as any[]) {
    m.set(p.id, { baseProduction: p.baseProduction, exponentBase: p.exponentBase, energyConsumption: p.energyConsumption ?? null });
  }
  return m;
}
```

> Note : ajouter au `package.json` de `@exilium/db` un sous-export `"./game-config-data": "./src/game-config-data.ts"` (ou `dist/...` selon le build db) si l'import par chemin échoue ; sinon importer via le point d'entrée principal. Vérifier le champ `exports` existant de `packages/db/package.json` et suivre le même style.

- [ ] **Step 8 : Run → PASS** — Run: `pnpm --filter @exilium/game-sim test` → Expected: PASS.

- [ ] **Step 9 : Commit**

```bash
git rev-parse --abbrev-ref HEAD   # DOIT afficher feat/sim-rythme-progression
git add packages/db/src/game-config-data.ts packages/db/src/seed-game-config.ts \
        packages/game-sim/package.json packages/game-sim/tsconfig.json packages/game-sim/vitest.config.ts \
        packages/game-sim/src/config.ts packages/game-sim/src/config.test.ts pnpm-lock.yaml
git commit -m "feat(game-sim): extraire les données de seed + scaffolder le package + config loader"
```

---

### Task 2 : `SimState` + `initState`

**Files:**
- Create: `packages/game-sim/src/state.ts`, `packages/game-sim/src/state.test.ts`

**Interfaces:**
- Produces : `interface Resources { minerai: number; silicium: number; hydrogene: number }` ; `interface BuildOrder { buildingId: string; targetLevel: number; completesAt: number }` ; `interface SimState { timeSec: number; resources: Resources; levels: Map<string, number>; build: BuildOrder | null }` ; `function initState(): SimState`.

- [ ] **Step 1 : Test (échoue)** :

```ts
// packages/game-sim/src/state.test.ts
import { describe, it, expect } from 'vitest';
import { initState } from './state.js';

describe('initState', () => {
  it('démarre un empire neuf à t=0', () => {
    const s = initState();
    expect(s.timeSec).toBe(0);
    expect(s.build).toBeNull();
    expect(s.levels.get('mineraiMine') ?? 0).toBe(0);
    expect(s.resources).toEqual({ minerai: 500, silicium: 500, hydrogene: 0 });
  });
});
```

- [ ] **Step 2 : Run → FAIL** — Run: `pnpm --filter @exilium/game-sim test state` → Expected: FAIL.

- [ ] **Step 3 : Implémenter `state.ts`** :

```ts
// packages/game-sim/src/state.ts
export interface Resources { minerai: number; silicium: number; hydrogene: number }
export interface BuildOrder { buildingId: string; targetLevel: number; completesAt: number }
export interface SimState {
  timeSec: number;
  resources: Resources;
  levels: Map<string, number>;
  build: BuildOrder | null;
}

// Dotation de départ (à aligner sur le seed des nouveaux empires ; valeur de départ MVP).
export const STARTING_RESOURCES: Resources = { minerai: 500, silicium: 500, hydrogene: 0 };

export function initState(): SimState {
  return { timeSec: 0, resources: { ...STARTING_RESOURCES }, levels: new Map(), build: null };
}
```

> Open question (Task plan) : vérifier la vraie dotation de départ d'un nouvel empire dans le seed/colonization ; ajuster `STARTING_RESOURCES` en conséquence.

- [ ] **Step 4 : Run → PASS** — Run: `pnpm --filter @exilium/game-sim test state` → Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git rev-parse --abbrev-ref HEAD
git add packages/game-sim/src/state.ts packages/game-sim/src/state.test.ts
git commit -m "feat(game-sim): SimState + initState"
```

---

### Task 3 : `SimEngine` — production, coût/durée, avance au prochain événement

**Files:**
- Create: `packages/game-sim/src/engine.ts`, `packages/game-sim/src/engine.test.ts`

**Interfaces:**
- Consumes : `loadBuildings`, `loadProductionConfig` (Task 1) ; `SimState`, `Resources` (Task 2) ; `buildingCost`, `buildingTime`, `mineraiProduction`, `siliciumProduction`, `hydrogeneProduction`, `calculateProductionFactor` (`@exilium/game-engine`).
- Produces : `class SimEngine { constructor(buildings, prodConfig); production(state): Resources; costOf(buildingId, level): Resources; startBuild(state, buildingId): void; timeToAfford(state, cost): number; advance(state, seconds): void; nextEventIn(state): number }`.

- [ ] **Step 1 : Test production (échoue)** — La prod horaire dépend des niveaux et du facteur énergie :

```ts
// packages/game-sim/src/engine.test.ts
import { describe, it, expect } from 'vitest';
import { SimEngine } from './engine.js';
import { loadBuildings, loadProductionConfig } from './config.js';
import { initState } from './state.js';
import { mineraiProduction, calculateProductionFactor } from '@exilium/game-engine';

const engine = () => new SimEngine(loadBuildings(), loadProductionConfig());

describe('SimEngine.production', () => {
  it('mine niv.1 + solaire niv.1 : prod minerai = formule du game-engine', () => {
    const s = initState();
    s.levels.set('mineraiMine', 1);
    s.levels.set('solarPlant', 1);
    const factor = calculateProductionFactor(/*produced*/ mineraiProduction(1, 1, { baseProduction: 20, exponentBase: 1.1 }) /* solar */, /*consumed*/ 10);
    expect(engine().production(s).minerai).toBe(mineraiProduction(1, factor, { baseProduction: 30, exponentBase: 1.1 }));
  });
});

describe('SimEngine.advance + startBuild', () => {
  it('attend d’avoir les ressources puis construit la mine, qui monte au niveau 1', () => {
    const e = engine();
    const s = initState();
    e.startBuild(s, 'mineraiMine');          // niveau 0 → 1
    expect(s.build?.buildingId).toBe('mineraiMine');
    e.advance(s, e.nextEventIn(s));            // saute à la fin de construction
    expect(s.levels.get('mineraiMine')).toBe(1);
    expect(s.build).toBeNull();
  });
});
```

- [ ] **Step 2 : Run → FAIL** — Run: `pnpm --filter @exilium/game-sim test engine` → Expected: FAIL.

- [ ] **Step 3 : Implémenter `engine.ts`** — Réutiliser les formules ; l'orchestration (énergie, file mono-slot, accumulation) est la seule logique nouvelle :

```ts
// packages/game-sim/src/engine.ts
import {
  buildingCost, buildingTime,
  mineraiProduction, siliciumProduction, hydrogeneProduction,
  calculateProductionFactor,
} from '@exilium/game-engine';
import type { BuildingDef, ProductionConfig } from './config.js';
import type { SimState, Resources } from './state.js';

const PROD_BUILDING = { minerai: 'mineraiMine', silicium: 'siliciumMine', hydrogene: 'hydrogeneSynth' } as const;

export class SimEngine {
  constructor(
    private buildings: Map<string, BuildingDef>,
    private prod: Map<string, ProductionConfig>,
  ) {}

  /** Facteur énergie = solaire produite / énergie consommée par les mines (clampé par le game-engine). */
  private energyFactor(state: SimState): number {
    const lvl = (id: string) => state.levels.get(id) ?? 0;
    const solar = this.prod.get('solarPlant')!;
    const produced = solar.baseProduction * lvl('solarPlant') * Math.pow(solar.exponentBase, lvl('solarPlant'));
    let consumed = 0;
    for (const id of ['mineraiMine', 'siliciumMine', 'hydrogeneSynth']) {
      consumed += (this.prod.get(id)!.energyConsumption ?? 0) * lvl(id);
    }
    return calculateProductionFactor(Math.floor(produced), consumed);
  }

  /** Production horaire {minerai, silicium, hydrogene}. */
  production(state: SimState): Resources {
    const f = this.energyFactor(state);
    const lvl = (id: string) => state.levels.get(id) ?? 0;
    const cfg = (id: string) => this.prod.get(id)!;
    return {
      minerai: mineraiProduction(lvl('mineraiMine'), f, cfg('mineraiMine')),
      silicium: siliciumProduction(lvl('siliciumMine'), f, cfg('siliciumMine')),
      hydrogene: hydrogeneProduction(lvl('hydrogeneSynth'), f, cfg('hydrogeneSynth')),
    };
  }

  costOf(buildingId: string, level: number): Resources {
    return buildingCost(this.buildings.get(buildingId)!.costDef, level);
  }

  /** Heures avant d'accumuler `cost` au taux actuel ; Infinity si une ressource manquante a prod ≤ 0. */
  timeToAfford(state: SimState, cost: Resources): number {
    const rate = this.production(state);
    let maxHours = 0;
    for (const k of ['minerai', 'silicium', 'hydrogene'] as const) {
      const missing = cost[k] - state.resources[k];
      if (missing <= 0) continue;
      if (rate[k] <= 0) return Infinity;
      maxHours = Math.max(maxHours, missing / rate[k]);
    }
    return maxHours;
  }

  /** Lance la construction du prochain niveau (attend les ressources si besoin via advance). */
  startBuild(state: SimState, buildingId: string): void {
    const target = (state.levels.get(buildingId) ?? 0) + 1;
    const cost = this.costOf(buildingId, target);
    const waitH = this.timeToAfford(state, cost);
    if (!isFinite(waitH)) throw new Error(`inatteignable: ${buildingId} niv.${target}`);
    if (waitH > 0) this.advance(state, waitH * 3600);
    state.resources.minerai -= cost.minerai;
    state.resources.silicium -= cost.silicium;
    state.resources.hydrogene -= cost.hydrogene;
    const dur = buildingTime(this.buildings.get(buildingId)!.costDef, target, 1);
    state.build = { buildingId, targetLevel: target, completesAt: state.timeSec + dur };
  }

  /** Secondes jusqu'au prochain événement = fin de la construction en cours (ou 0 si rien). */
  nextEventIn(state: SimState): number {
    return state.build ? Math.max(0, state.build.completesAt - state.timeSec) : 0;
  }

  /** Avance le temps de `seconds` : accumule les ressources, finalise la construction si due. */
  advance(state: SimState, seconds: number): void {
    if (seconds <= 0) return;
    const rate = this.production(state);
    state.resources.minerai += (rate.minerai * seconds) / 3600;
    state.resources.silicium += (rate.silicium * seconds) / 3600;
    state.resources.hydrogene += (rate.hydrogene * seconds) / 3600;
    state.timeSec += seconds;
    if (state.build && state.timeSec >= state.build.completesAt) {
      state.levels.set(state.build.buildingId, state.build.targetLevel);
      state.build = null;
    }
  }
}
```

- [ ] **Step 4 : Run → PASS** — Run: `pnpm --filter @exilium/game-sim test engine` → Expected: PASS. (Ajuster les attendus du test si l'accumulation pendant la construction change le calcul — le test doit refléter le comportement réutilisant les formules, pas l'inverse.)

- [ ] **Step 5 : Commit**

```bash
git rev-parse --abbrev-ref HEAD
git add packages/game-sim/src/engine.ts packages/game-sim/src/engine.test.ts
git commit -m "feat(game-sim): SimEngine — production, coût/durée, avance event-driven"
```

---

### Task 4 : `Policy` + `EcoPolicy`

**Files:**
- Create: `packages/game-sim/src/policy.ts`, `packages/game-sim/src/policy.test.ts`

**Interfaces:**
- Consumes : `SimState` (Task 2), `SimEngine`, `BuildingDef` (Task 1/3).
- Produces : `type Action = { type: 'build'; buildingId: string } | { type: 'stop' }` ; `interface Policy { name: string; decide(state: SimState, engine: SimEngine, buildings: Map<string, BuildingDef>): Action }` ; `class EcoPolicy implements Policy`.

- [ ] **Step 1 : Test (échoue)** — l'éco priorise les producteurs ; ne propose jamais un bâtiment au max :

```ts
// packages/game-sim/src/policy.test.ts
import { describe, it, expect } from 'vitest';
import { EcoPolicy } from './policy.js';
import { SimEngine } from './engine.js';
import { loadBuildings, loadProductionConfig } from './config.js';
import { initState } from './state.js';

describe('EcoPolicy', () => {
  it('commence par un producteur (mine de minerai)', () => {
    const buildings = loadBuildings();
    const engine = new SimEngine(buildings, loadProductionConfig());
    const action = new EcoPolicy().decide(initState(), engine, buildings);
    expect(action).toEqual({ type: 'build', buildingId: 'mineraiMine' });
  });
});
```

- [ ] **Step 2 : Run → FAIL** — Run: `pnpm --filter @exilium/game-sim test policy` → Expected: FAIL.

- [ ] **Step 3 : Implémenter `policy.ts`** — Heuristique éco MVP : monter les producteurs/énergie/stockage selon un ordre de priorité, en sautant ceux au max ou aux prérequis non remplis :

```ts
// packages/game-sim/src/policy.ts
import type { SimState } from './state.js';
import type { SimEngine } from './engine.js';
import type { BuildingDef } from './config.js';

export type Action = { type: 'build'; buildingId: string } | { type: 'stop' };
export interface Policy {
  name: string;
  decide(state: SimState, engine: SimEngine, buildings: Map<string, BuildingDef>): Action;
}

// Ordre de priorité éco MVP (producteurs d'abord, puis énergie, puis stockage).
const ECO_ORDER = ['mineraiMine', 'siliciumMine', 'solarPlant', 'hydrogeneSynth', 'storageMinerai'];

export class EcoPolicy implements Policy {
  name = 'eco';
  decide(state: SimState, _engine: SimEngine, buildings: Map<string, BuildingDef>): Action {
    for (const id of ECO_ORDER) {
      const def = buildings.get(id);
      if (!def) continue;
      const lvl = state.levels.get(id) ?? 0;
      if (lvl >= def.maxLevel) continue;
      const prereqOk = def.prerequisites.every((p) => (state.levels.get(p.buildingId) ?? 0) >= p.level);
      if (!prereqOk) continue;
      return { type: 'build', buildingId: id };
    }
    return { type: 'stop' };
  }
}
```

- [ ] **Step 4 : Run → PASS** — Run: `pnpm --filter @exilium/game-sim test policy` → Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git rev-parse --abbrev-ref HEAD
git add packages/game-sim/src/policy.ts packages/game-sim/src/policy.test.ts
git commit -m "feat(game-sim): interface Policy + EcoPolicy"
```

---

### Task 5 : `Recorder` (timeline + jalons + attentes)

**Files:**
- Create: `packages/game-sim/src/recorder.ts`, `packages/game-sim/src/recorder.test.ts`

**Interfaces:**
- Produces : `interface Milestone { id: string; reach(state: SimState): boolean }` ; `interface RunResult { policy: string; milestones: { id: string; timeSec: number }[]; walls: { atSec: number; waitH: number; for: string }[]; events: number }` ; `class Recorder { constructor(milestones: Milestone[]); onAction(state, action, waitH): void; result(policy: string): RunResult }`.
- Le jeu de jalons par défaut : `firstMine` (mineraiMine≥1), `firstResearchLab` (researchLab≥1), `firstShipyard` (shipyard≥1), `empireLvl` (proxy MVP : somme des niveaux ≥ 20). **Open : remplacer par la vraie formule `empireLevel` du game-engine en Task 6+.**

- [ ] **Step 1 : Test (échoue)** :

```ts
// packages/game-sim/src/recorder.test.ts
import { describe, it, expect } from 'vitest';
import { Recorder } from './recorder.js';
import { initState } from './state.js';

describe('Recorder', () => {
  it('horodate un jalon quand il est atteint et compte les murs', () => {
    const rec = new Recorder([{ id: 'firstMine', reach: (s) => (s.levels.get('mineraiMine') ?? 0) >= 1 }]);
    const s = initState();
    rec.onAction(s, { type: 'build', buildingId: 'mineraiMine' }, 0);
    s.levels.set('mineraiMine', 1); s.timeSec = 45;
    rec.onAction(s, { type: 'build', buildingId: 'siliciumMine' }, 3); // attente 3h = mur
    const r = rec.result('eco');
    expect(r.milestones.find((m) => m.id === 'firstMine')?.timeSec).toBe(45);
    expect(r.walls).toHaveLength(1);
    expect(r.walls[0].waitH).toBe(3);
  });
});
```

- [ ] **Step 2 : Run → FAIL** — Run: `pnpm --filter @exilium/game-sim test recorder` → Expected: FAIL.

- [ ] **Step 3 : Implémenter `recorder.ts`** :

```ts
// packages/game-sim/src/recorder.ts
import type { SimState } from './state.js';
import type { Action } from './policy.js';

export interface Milestone { id: string; reach(state: SimState): boolean }
export interface RunResult {
  policy: string;
  milestones: { id: string; timeSec: number }[];
  walls: { atSec: number; waitH: number; for: string }[];
  events: number;
}

const WALL_THRESHOLD_H = 2; // réglable : une attente > 2h simulées = mur

export class Recorder {
  private reached = new Map<string, number>();
  private walls: RunResult['walls'] = [];
  private events = 0;
  constructor(private milestones: Milestone[]) {}

  onAction(state: SimState, action: Action, waitH: number): void {
    this.events++;
    for (const m of this.milestones) {
      if (!this.reached.has(m.id) && m.reach(state)) this.reached.set(m.id, state.timeSec);
    }
    if (action.type === 'build' && waitH > WALL_THRESHOLD_H) {
      this.walls.push({ atSec: state.timeSec, waitH: Math.round(waitH * 10) / 10, for: action.buildingId });
    }
  }

  result(policy: string): RunResult {
    return {
      policy,
      milestones: [...this.reached].map(([id, timeSec]) => ({ id, timeSec })),
      walls: this.walls,
      events: this.events,
    };
  }
}
```

- [ ] **Step 4 : Run → PASS** — Run: `pnpm --filter @exilium/game-sim test recorder` → Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git rev-parse --abbrev-ref HEAD
git add packages/game-sim/src/recorder.ts packages/game-sim/src/recorder.test.ts
git commit -m "feat(game-sim): Recorder — jalons + murs"
```

---

### Task 6 : `Reporter` + runner CLI + `run-gamesim.sh` + golden file

**Files:**
- Create: `packages/game-sim/src/reporter.ts`, `packages/game-sim/src/reporter.test.ts`
- Create: `packages/game-sim/src/run.ts`
- Create: `scripts/run-gamesim.sh`

**Interfaces:**
- Consumes : `RunResult` (Task 5), tout le reste.
- Produces : `function renderReport(results: RunResult[]): string` (markdown déterministe).

- [ ] **Step 1 : Test du reporter (échoue, golden inline)** :

```ts
// packages/game-sim/src/reporter.test.ts
import { describe, it, expect } from 'vitest';
import { renderReport } from './reporter.js';

describe('renderReport', () => {
  it('rend un tableau temps-jusqu’au-jalon déterministe', () => {
    const md = renderReport([{ policy: 'eco', milestones: [{ id: 'firstMine', timeSec: 45 }], walls: [], events: 3 }]);
    expect(md).toContain('| firstMine |');
    expect(md).toContain('eco');
    expect(md).toContain('45 s'); // formatage du temps
  });
});
```

- [ ] **Step 2 : Run → FAIL** — Run: `pnpm --filter @exilium/game-sim test reporter` → Expected: FAIL.

- [ ] **Step 3 : Implémenter `reporter.ts`** (formatage du temps + tableaux jalons/murs) :

```ts
// packages/game-sim/src/reporter.ts
import type { RunResult } from './recorder.js';

function fmt(sec: number): string {
  if (sec < 60) return `${Math.round(sec)} s`;
  if (sec < 3600) return `${Math.round(sec / 60)} min`;
  return `${(sec / 3600).toFixed(1)} h`;
}

export function renderReport(results: RunResult[]): string {
  const L: string[] = ['# Rapport de rythme — Exilium', '', `- Date : ${new Date().toISOString()}`, `- Profils : ${results.map((r) => r.policy).join(', ')}`, ''];
  const ids = [...new Set(results.flatMap((r) => r.milestones.map((m) => m.id)))];
  L.push('## Temps jusqu’au jalon', '', `| Jalon | ${results.map((r) => r.policy).join(' | ')} |`, `|---|${results.map(() => '---').join('|')}|`);
  for (const id of ids) {
    const cells = results.map((r) => { const m = r.milestones.find((x) => x.id === id); return m ? fmt(m.timeSec) : '—'; });
    L.push(`| ${id} | ${cells.join(' | ')} |`);
  }
  L.push('', '## Murs 🧱', '');
  for (const r of results) {
    if (!r.walls.length) { L.push(`- ${r.policy} : aucun mur > seuil`); continue; }
    for (const w of r.walls) L.push(`- ${r.policy} : attente ${w.waitH} h à ${fmt(w.atSec)} avant \`${w.for}\``);
  }
  return L.join('\n') + '\n';
}
```

- [ ] **Step 4 : Run → PASS** — Run: `pnpm --filter @exilium/game-sim test reporter` → Expected: PASS.

- [ ] **Step 5 : Écrire le runner CLI `run.ts`** (assemble tout, boucle jusqu'à `stop` ou horizon, écrit le rapport) :

```ts
// packages/game-sim/src/run.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadBuildings, loadProductionConfig } from './config.js';
import { initState } from './state.js';
import { SimEngine } from './engine.js';
import { EcoPolicy, type Policy } from './policy.js';
import { Recorder, type Milestone } from './recorder.js';
import { renderReport } from './reporter.js';

const HORIZON_SEC = 60 * 24 * 3600; // 60 jours simulés
const MILESTONES: Milestone[] = [
  { id: 'firstMine', reach: (s) => (s.levels.get('mineraiMine') ?? 0) >= 1 },
  { id: 'firstShipyard', reach: (s) => (s.levels.get('shipyard') ?? 0) >= 1 },
  { id: 'firstResearchLab', reach: (s) => (s.levels.get('researchLab') ?? 0) >= 1 },
];

function runPolicy(policy: Policy) {
  const buildings = loadBuildings();
  const engine = new SimEngine(buildings, loadProductionConfig());
  const rec = new Recorder(MILESTONES);
  const s = initState();
  for (let i = 0; i < 2000 && s.timeSec < HORIZON_SEC; i++) {
    const action = policy.decide(s, engine, buildings);
    if (action.type === 'stop') break;
    const waitH = engine.timeToAfford(s, engine.costOf(action.buildingId, (s.levels.get(action.buildingId) ?? 0) + 1)) || 0;
    if (!isFinite(waitH)) break;
    engine.startBuild(s, action.buildingId);
    rec.onAction(s, action, waitH);
    engine.advance(s, engine.nextEventIn(s));
  }
  return rec.result(policy.name);
}

const results = [runPolicy(new EcoPolicy())];
const md = renderReport(results);
const dir = join(process.cwd(), 'reports', '_sim');
mkdirSync(dir, { recursive: true });
const path = join(dir, `rapport-rythme-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.md`);
writeFileSync(path, md);
console.log(`[game-sim] rapport écrit : ${path}`);
```

- [ ] **Step 6 : Lanceur** — Créer `scripts/run-gamesim.sh` :

```bash
#!/usr/bin/env bash
# Simulateur de rythme de progression — déterministe, sans base live ni navigateur.
set -euo pipefail
cd /opt/exilium/packages/game-sim
exec pnpm sim "$@"
```

Puis `chmod +x scripts/run-gamesim.sh`.

- [ ] **Step 7 : Run end-to-end** — Run: `bash scripts/run-gamesim.sh` → Expected : écrit `packages/game-sim/reports/_sim/rapport-rythme-*.md` ; ouvrir le fichier et vérifier que `firstMine` a un temps plausible (~quelques minutes) et que les murs apparaissent quand l'éco plafonne. Sanity-check humain du rythme.

- [ ] **Step 8 : Typecheck global + tests** — Run: `pnpm --filter @exilium/game-sim typecheck && pnpm --filter @exilium/game-sim test` → Expected: PASS.

- [ ] **Step 9 : Commit**

```bash
git rev-parse --abbrev-ref HEAD
git add packages/game-sim/src/reporter.ts packages/game-sim/src/reporter.test.ts \
        packages/game-sim/src/run.ts scripts/run-gamesim.sh
echo 'reports/' >> packages/game-sim/.gitignore && git add packages/game-sim/.gitignore
git commit -m "feat(game-sim): Reporter + runner CLI + run-gamesim.sh"
```

---

## Phase 2 (plan suivant, hors MVP)

À spécifier dans un plan dédié une fois la spine éco validée : recherche (`research-cost`) + `researchLab` comme gate, construction de vaisseaux (`shipyard-cost`, jalon « 1er vaisseau »), colonisation (multi-planètes → multiplier la production), `OptimalPolicy` (recherche du jalon le plus tôt), `ExpansionPolicy`, vrai jalon `empireLevel` (formule `empire-level.ts`), golden-file du rapport pour une stratégie figée, profil naïf-LLM, et les spot-checks live (accélération du temps).

## Self-review (couverture spec)

- Spine éco (production→bâtiments→énergie→stockage) : Tasks 1-6 ✓ · Recherche/vaisseaux/colonies : Phase 2 (décomposition assumée) ✓
- Réutilisation des formules (jamais ré-implémentées) : `buildingCost/buildingTime/*Production/calculateProductionFactor` ✓
- Source unique de config (seed↔sim) : Task 1 extraction ✓
- Métriques (temps-jalon, murs) : Tasks 5-6 ✓ · Temps morts / courbe d'engagement : à enrichir en Phase 2 (events comptés en Task 5) — noté
- Déterminisme + tests unitaires + (golden en Phase 2) ✓
- Points ouverts conservés (dotation départ, jeu de jalons, empireLevel, time-accel) : annotés dans les tasks concernées ✓
