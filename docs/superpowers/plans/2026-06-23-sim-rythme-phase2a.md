# Simulateur de rythme — Phase 2a (couverture bâtiments + OptimalPolicy + comparaison)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Rendre les chiffres de rythme **bâtiment** fiables : couvrir tous les bâtiments (jalons chantier/labo atteignables), ajouter une OptimalPolicy, et comparer les profils dans le rapport.

**Architecture:** Étend le package `packages/game-sim` existant (Phase 1 mergée). N'ajoute PAS de nouveau type d'action au moteur (recherche/vaisseaux/colonies = Phase 2b). Tout reste des montées de bâtiments via le `SimEngine` existant.

**Tech Stack:** TypeScript ESM, vitest, `@exilium/game-engine`.

## Global Constraints

- Working dir `/opt/exilium`, session démarre dans `/home/ubuntu` → `cd /opt/exilium &&` au début de chaque commande Bash.
- Branche `feat/sim-rythme-phase2a` (à créer depuis `main`). `git add` chemins précis ; vérifier `git rev-parse --abbrev-ref HEAD` = `feat/sim-rythme-phase2a` avant chaque commit.
- Vérif : `pnpm --filter @exilium/game-sim typecheck` + `test` après chaque tâche.
- Réutiliser les formules `@exilium/game-engine` ; ne jamais ré-implémenter.
- ESM : imports en `.js`.

## État de départ (Phase 1, déjà sur main)

`packages/game-sim/src/` : `config.ts` (`loadBuildings`, `loadProductionConfig`, `BuildingDef`), `state.ts` (`SimState`, `initState`), `engine.ts` (`SimEngine` : `production`, `costOf`, `timeToAfford`, `startBuild`, `nextEventIn`, `advance`), `policy.ts` (`Action`, `Policy`, `EcoPolicy` — `ECO_ORDER` à 5 bâtiments, stratégie « plus bas niveau d'abord, priorité en départage »), `recorder.ts` (`Milestone`, `RunResult`, `Recorder`), `reporter.ts` (`renderReport`), `run.ts` (runner mono-profil EcoPolicy). 8 tests verts.

---

### Task 1 : Couverture tous-bâtiments + jalons atteignables

**Files:**
- Modify: `packages/game-sim/src/policy.ts` (étendre `ECO_ORDER`)
- Modify: `packages/game-sim/src/run.ts` (ajouter les jalons manquants + horizon)
- Test: `packages/game-sim/src/policy.test.ts` (ajouter un cas), `packages/game-sim/src/run.test.ts` (créé)

**Interfaces:**
- Produces : `EcoPolicy` couvre désormais `robotics`, `shipyard`, `researchLab`, `arsenal` en plus des 5 producteurs/stockage ; les jalons `firstShipyard`/`firstResearchLab` du runner deviennent atteignables.

- [ ] **Step 1 : Test (échoue)** — après assez d'itérations, l'EcoPolicy doit finir par proposer `robotics` (prérequis du chantier) puis `shipyard`. Ajouter à `run.test.ts` :

```ts
// packages/game-sim/src/run.test.ts
import { describe, it, expect } from 'vitest';
import { runEco } from './run.js';

describe('runEco (intégration)', () => {
  it('atteint les jalons bâtiment firstShipyard et firstResearchLab', () => {
    const r = runEco();
    const ids = r.milestones.map((m) => m.id);
    expect(ids).toContain('firstShipyard');
    expect(ids).toContain('firstResearchLab');
  });
});
```

- [ ] **Step 2 : Run → FAIL** — `cd /opt/exilium && pnpm --filter @exilium/game-sim test run` → FAIL (runEco non exporté / jalons non atteints).

- [ ] **Step 3 : Implémenter** — (a) Dans `policy.ts`, étendre `ECO_ORDER` pour inclure tous les bâtiments constructibles MVP, robotics avant chantier/arsenal : `['solarPlant', 'mineraiMine', 'siliciumMine', 'hydrogeneSynth', 'storageMinerai', 'storageSilicium', 'storageHydrogene', 'robotics', 'researchLab', 'shipyard', 'arsenal']`. La stratégie « plus bas niveau d'abord » gère déjà l'entrelacement et les prérequis (robotics niv.1 → shipyard, robotics niv.2 → arsenal). (b) Dans `run.ts`, exporter une fonction `runEco(): RunResult` réutilisable (extraire la logique de boucle déjà présente) avec les jalons `firstMine`, `firstShipyard` (shipyard≥1), `firstResearchLab` (researchLab≥1), `robotics` (robotics≥1) et un horizon suffisant (ex. 120 jours).

> Note : ne PAS toucher au moteur. Si la boucle plafonne (toutes les cibles au max), `EcoPolicy.decide` renvoie déjà `{type:'stop'}`.

- [ ] **Step 4 : Run → PASS** — `pnpm --filter @exilium/game-sim test run` → PASS. Puis `pnpm --filter @exilium/game-sim test` (toute la suite) → vérifier que le test policy existant tient (ajuster si l'ordre étendu change le 1er choix attendu — garder une assertion qui a du sens).

- [ ] **Step 5 : Commit**

```bash
cd /opt/exilium && git rev-parse --abbrev-ref HEAD   # feat/sim-rythme-phase2a
git add packages/game-sim/src/policy.ts packages/game-sim/src/run.ts \
        packages/game-sim/src/policy.test.ts packages/game-sim/src/run.test.ts
git commit -m "feat(game-sim): EcoPolicy couvre tous les bâtiments, jalons chantier/labo atteignables"
```

---

### Task 2 : OptimalPolicy (greedy maximisant la croissance de production)

**Files:**
- Create: `packages/game-sim/src/optimal-policy.ts`, `packages/game-sim/src/optimal-policy.test.ts`

**Interfaces:**
- Consumes : `SimState`, `SimEngine` (`production`, `costOf`, `timeToAfford`), `BuildingDef`, `Policy`/`Action` (policy.ts).
- Produces : `class OptimalPolicy implements Policy` (`name = 'optimal'`).

**Objectif de l'algorithme** (le « optimal » MVP est un greedy myope, pas un solveur exhaustif — c'est une borne basse *pratique*, meilleure que l'éco naïve) : à chaque décision, parmi les bâtiments éligibles (prérequis OK, pas au max), choisir celui qui **maximise le gain de production net par heure d'investissement**, c.-à-d. `(Δproduction_totale_horaire) / (timeToAfford + tempsDeConstruction)`, où Δproduction est la hausse de prod minerai+silicium+hydrogène (pondérée également) qu'apporte la montée d'un niveau. Le stockage et les bâtiments non-producteurs (robotics/shipyard/researchLab/arsenal) ont un gain de production nul → ne les construire que s'ils sont **prérequis d'un jalon** non encore atteint, ou si la capacité de stockage bloque (cap atteint) — pour le MVP, se limiter à : producteurs + énergie par ROI, et construire robotics/shipyard/researchLab/arsenal uniquement quand aucun producteur n'améliore le ROI au-dessus d'un epsilon (afin que les jalons restent atteignables).

- [ ] **Step 1 : Test (échoue)** — l'optimal doit atteindre `firstShipyard` **au plus tard** que l'éco (borne basse ≤ éco) :

```ts
// packages/game-sim/src/optimal-policy.test.ts
import { describe, it, expect } from 'vitest';
import { OptimalPolicy } from './optimal-policy.js';
import { EcoPolicy } from './policy.js';
import { SimEngine } from './engine.js';
import { loadBuildings, loadProductionConfig } from './config.js';
import { initState } from './state.js';
import { Recorder } from './recorder.js';

function timeToShipyard(policy: { decide: any; name: string }): number {
  const buildings = loadBuildings();
  const engine = new SimEngine(buildings, loadProductionConfig());
  const rec = new Recorder([{ id: 'shipyard', reach: (s) => (s.levels.get('shipyard') ?? 0) >= 1 }]);
  const s = initState();
  for (let i = 0; i < 3000 && s.timeSec < 200 * 24 * 3600; i++) {
    const a = policy.decide(s, engine, buildings);
    if (a.type === 'stop') break;
    const waitH = engine.timeToAfford(s, engine.costOf(a.buildingId, (s.levels.get(a.buildingId) ?? 0) + 1));
    if (!isFinite(waitH)) break;
    engine.startBuild(s, a.buildingId);
    rec.onAction(s, a, waitH);
    engine.advance(s, engine.nextEventIn(s));
    if ((s.levels.get('shipyard') ?? 0) >= 1) break;
  }
  return rec.result(policy.name).milestones.find((m) => m.id === 'shipyard')?.timeSec ?? Infinity;
}

describe('OptimalPolicy', () => {
  it('atteint le chantier au plus tard aussi vite que l’éco (borne basse)', () => {
    expect(timeToShipyard(new OptimalPolicy())).toBeLessThanOrEqual(timeToShipyard(new EcoPolicy()));
  });
  it('ne propose jamais un bâtiment au max ou aux prérequis non remplis', () => {
    const buildings = loadBuildings();
    const engine = new SimEngine(buildings, loadProductionConfig());
    const a = new OptimalPolicy().decide(initState(), engine, buildings);
    expect(a.type).toBe('build');
    if (a.type === 'build') {
      const def = buildings.get(a.buildingId)!;
      expect(def.prerequisites.every((p) => 0 >= p.level)).toBe(true); // niveaux à 0 au départ
    }
  });
});
```

- [ ] **Step 2 : Run → FAIL** — `pnpm --filter @exilium/game-sim test optimal` → FAIL.

- [ ] **Step 3 : Implémenter `optimal-policy.ts`** — Implémenter le greedy décrit dans « Objectif de l'algorithme » ci-dessus. Réutiliser `engine.production(state)` pour mesurer la prod avant/après une montée hypothétique (cloner l'état ou calculer le delta via les formules), `engine.timeToAfford` et `engine.costOf`. Garder le code lisible et la fonction `decide` pure (ne pas muter `state`). Si aucun producteur n'a de ROI positif, retomber sur l'ordre des prérequis de jalon (robotics→shipyard, researchLab) pour garder les jalons atteignables, puis `{type:'stop'}` si plus rien.

> Latitude : l'algorithme exact est laissé à l'implémenteur tant que (a) les deux tests passent, (b) `decide` est pure, (c) le code réutilise les formules/engine sans ré-implémenter la production. Garder les assertions des tests significatives.

- [ ] **Step 4 : Run → PASS** — `pnpm --filter @exilium/game-sim test optimal` → PASS, puis suite complète.

- [ ] **Step 5 : Commit**

```bash
cd /opt/exilium && git rev-parse --abbrev-ref HEAD
git add packages/game-sim/src/optimal-policy.ts packages/game-sim/src/optimal-policy.test.ts
git commit -m "feat(game-sim): OptimalPolicy — greedy ROI de production (borne basse)"
```

---

### Task 3 : Run multi-profils + comparaison dans le rapport + golden file

**Files:**
- Modify: `packages/game-sim/src/run.ts` (lancer eco + optimal, passer les deux RunResult au reporter)
- Test: `packages/game-sim/src/reporter.golden.test.ts` (créé)

**Interfaces:**
- Produces : `run.ts` exporte `runAll(): RunResult[]` (eco + optimal) ; le rapport contient une colonne par profil (déjà supporté par `renderReport`).

- [ ] **Step 1 : Test golden (échoue)** — Figer le rapport d'une stratégie déterministe pour qu'une régression d'équilibrage devienne un diff visible. Comme les vrais chiffres dépendent du seed, le golden teste la **structure + le déterminisme** (deux runs identiques) plutôt que des valeurs en dur :

```ts
// packages/game-sim/src/reporter.golden.test.ts
import { describe, it, expect } from 'vitest';
import { runAll } from './run.js';
import { renderReport } from './reporter.js';

describe('rapport multi-profils', () => {
  it('contient les colonnes eco et optimal et est déterministe', () => {
    const a = renderReport(runAll());
    const b = renderReport(runAll());
    expect(a).toBe(b);                       // déterminisme
    expect(a).toContain('| eco |') || expect(a).toContain('eco');
    expect(a).toContain('optimal');
    expect(a).toContain('Temps jusqu’au jalon');
  });
});
```

- [ ] **Step 2 : Run → FAIL** — `pnpm --filter @exilium/game-sim test golden` → FAIL (runAll non exporté).

- [ ] **Step 3 : Implémenter** — Dans `run.ts`, extraire une fonction générique `runPolicy(policy)` et exporter `runAll(): RunResult[]` = `[runPolicy(new EcoPolicy()), runPolicy(new OptimalPolicy())]`. Le bloc principal (écriture du fichier) utilise `renderReport(runAll())`. `renderReport` gère déjà N profils en colonnes.

- [ ] **Step 4 : Run → PASS** — `pnpm --filter @exilium/game-sim test golden`, puis suite complète, puis `bash scripts/run-gamesim.sh` et OUVRIR le rapport : vérifier qu'il y a **deux colonnes** (eco, optimal) et que l'optimal atteint les jalons **≤** l'éco. Coller le tableau dans le rapport de tâche.

- [ ] **Step 5 : Commit**

```bash
cd /opt/exilium && git rev-parse --abbrev-ref HEAD
git add packages/game-sim/src/run.ts packages/game-sim/src/reporter.golden.test.ts
git commit -m "feat(game-sim): run multi-profils (eco vs optimal) + golden déterministe"
```

---

## Phase 2b (plan suivant)

Recherche (`researchCost`/`researchTime` — nouveau type d'action `research` + niveaux de tech dans `SimState`), vaisseaux (`unitCost`/`unitTime` — action `buildShip`, file du chantier, jalon « 1er vaisseau » réel = un vaisseau produit, pas juste le bâtiment), colonisation (multi-planètes → production agrégée), vrai jalon `empireLevel` (modéliser l'accrual d'XP d'empire via `empire-progression`), métriques temps-morts / courbe d'engagement enrichies. Chacun étend le moteur → spec/plan dédié.

## Self-review

- Couverture bâtiments + jalons atteignables : Task 1 ✓
- OptimalPolicy (borne basse, comparable) : Task 2 ✓ (test optimal ≤ eco)
- Comparaison multi-profils + golden/déterminisme : Task 3 ✓
- Réutilisation formules, pas d'extension moteur : respecté (tout = montées de bâtiments) ✓
- Recherche/vaisseaux/colonies/empireXP : Phase 2b (décomposition assumée, nécessite extension moteur) ✓
- Placeholders : aucun (l'OptimalPolicy donne l'objectif + tests ; latitude d'algo explicite et bornée par des tests significatifs) ✓
