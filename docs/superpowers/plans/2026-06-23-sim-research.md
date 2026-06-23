# Simulateur de rythme — Phase 2b : Recherche

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Ajouter la recherche au simulateur : une file parallèle à la construction, dont les bonus **réinjectent dans la production/énergie** via `resolveBonus` — pour un rythme qui tient compte de la recherche.

**Architecture:** Étend `packages/game-sim`. La recherche est une **file séparée** (on peut bâtir ET chercher en même temps). Les bonus de recherche modifient la production via le game-engine (`resolveBonus`), jamais ré-implémenté. Gated par le niveau de `researchLab`.

## Global Constraints

- Working dir `/opt/exilium`, session démarre dans `/home/ubuntu` → `cd /opt/exilium &&` au début de chaque commande Bash.
- Branche `feat/sim-research`. `git add` chemins précis ; vérifier `git rev-parse --abbrev-ref HEAD` = `feat/sim-research` avant chaque commit.
- Vérif : `pnpm --filter @exilium/game-sim typecheck` + `test` après chaque tâche.
- Réutiliser `@exilium/game-engine` (`researchCost`, `researchTime`, `resolveBonus`) ; jamais ré-implémenter. ESM `.js`.

## Intégration clé (recherche → économie)

La prod réelle (apps/api/.../resource.service.ts) applique, par ressource :
`mult = resolveBonus('production_'+res, null, researchLevels, bonusDefs)` (multiplicateur ≥1), et pour l'énergie `resolveBonus('energy_production'|'energy_consumption', …)`. `researchLevels` = `Record<researchId, level>`. Recherches éco-pertinentes : **`energyTech`** (energy_production +2%/niv), **`semiconductors`** (energy_consumption −2%/niv), **`temperateProduction`** (production_minerai/silicium/hydrogene +2%/niv). Le sim doit mirer ce câblage. `resolveBonus(stat, null, userLevels, defs)` retourne 1 si aucune recherche ne couvre `stat`.

## État de départ (sur main)

`packages/game-sim/src/` : `config.ts` (loadBuildings/loadProductionConfig), `state.ts`, `engine.ts` (SimEngine), `policy.ts`/`optimal-policy.ts`, `recorder.ts`, `reporter.ts`, `run.ts`. `packages/db/src/game-config-data.ts` exporte déjà `BUILDINGS`, `PRODUCTION_CONFIG` (mais PAS `RESEARCH`/`BONUS_DEFINITIONS`, encore inline dans le seed).

---

### Task 1 : Extraire RESEARCH + BONUS_DEFINITIONS ; loader recherche + bonus

**Files:** Modify `packages/db/src/game-config-data.ts` (+`seed-game-config.ts`, `index.ts`) ; Modify `packages/game-sim/src/config.ts` ; Test `config.test.ts`.

**Interfaces produced:** `config.ts` exporte `loadResearch(): Map<string, ResearchDef>` (`ResearchDef { id; costDef: ResearchCostDef; maxLevel; prereqBuildings: {buildingId;level}[]; prereqResearch: {researchId;level}[] }`) et `loadBonuses(): BonusDefinition[]` (type importé de `@exilium/game-engine`).

- [ ] **Step 1** — Couper `const RESEARCH = [...]` et `const BONUS_DEFINITIONS = [...]` de `seed-game-config.ts` vers `game-config-data.ts` (verbatim, complet), `export const`. Remettre les imports dans le seed. Re-exporter depuis `packages/db/src/index.ts` (comme BUILDINGS). `pnpm --filter @exilium/db typecheck` → PASS.
- [ ] **Step 2** — Test (échoue) :
```ts
// config.test.ts (ajouter)
import { loadResearch, loadBonuses } from './config.js';
it('charge energyTech avec son coût et son prérequis labo', () => {
  const r = loadResearch().get('energyTech')!;
  expect(r.costDef).toEqual({ baseCost: { minerai: 0, silicium: 800, hydrogene: 400 }, costFactor: 2 });
  expect(r.prereqBuildings).toContainEqual({ buildingId: 'researchLab', level: 1 });
});
it('expose le bonus energyTech→energy_production', () => {
  expect(loadBonuses().some((b) => b.sourceId === 'energyTech' && b.stat === 'energy_production')).toBe(true);
});
```
- [ ] **Step 3** — Implémenter dans `config.ts` : `loadResearch()` mappe chaque `RESEARCH` vers `ResearchDef` (`costDef = { baseCost: {minerai:baseCostMinerai, silicium:baseCostSilicium, hydrogene:baseCostHydrogene}, costFactor }`, `prereqBuildings = r.prerequisites.buildings`, `prereqResearch = r.prerequisites.research`). `loadBonuses(): BonusDefinition[]` retourne `BONUS_DEFINITIONS as BonusDefinition[]`.
- [ ] **Step 4** — `pnpm --filter @exilium/game-sim test config` → PASS, puis suite + typecheck.
- [ ] **Step 5** — Commit (db files + config.ts + config.test.ts + pnpm-lock si besoin).

---

### Task 2 : SimState.techLevels + bonus recherche dans la production (la boucle)

**Files:** Modify `state.ts`, `engine.ts` ; Test `engine.test.ts`.

**Interfaces:** `SimState` gagne `techLevels: Map<string, number>` (init vide). `SimEngine` constructeur prend en plus `bonuses: BonusDefinition[]`. `production()` et l'énergie appliquent les bonus recherche.

- [ ] **Step 1** — Test (échoue) : energyTech niv.5 augmente la production (via plus d'énergie / facteur) ; temperateProduction niv.10 multiplie la prod minerai par `resolveBonus('production_minerai', null, {temperateProduction:10}, bonuses)`.
```ts
// engine.test.ts (ajouter) — vérifie la réutilisation de resolveBonus
import { resolveBonus } from '@exilium/game-engine';
import { loadBonuses } from './config.js';
it('temperateProduction booste la prod minerai via resolveBonus', () => {
  const bonuses = loadBonuses();
  const e = new SimEngine(loadBuildings(), loadProductionConfig(), bonuses);
  const base = (() => { const s = initState(); s.levels.set('mineraiMine', 5); s.levels.set('solarPlant', 5); return e.production(s).minerai; })();
  const boosted = (() => { const s = initState(); s.levels.set('mineraiMine', 5); s.levels.set('solarPlant', 5); s.techLevels.set('temperateProduction', 10); return e.production(s).minerai; })();
  const mult = resolveBonus('production_minerai', null, { temperateProduction: 10 }, bonuses);
  expect(mult).toBeGreaterThan(1);
  expect(boosted).toBe(Math.floor(base * mult)); // ou la relation exacte choisie ; doit refléter resolveBonus
});
```
- [ ] **Step 2** — Run → FAIL (constructeur engine signature / pas de bonus appliqué).
- [ ] **Step 3** — Implémenter : `state.ts` ajoute `techLevels: new Map()` à `initState`. `engine.ts` : constructeur `(buildings, prod, bonuses)`. Helper `techObj(state) = Object.fromEntries(state.techLevels)`. Dans `production()`, après le calcul de base par ressource, multiplier par `resolveBonus('production_'+res, null, techObj, bonuses)` (clamp via Math.floor comme le jeu). Dans `energyFactor()`, multiplier l'énergie produite par `resolveBonus('energy_production', null, techObj, bonuses)` et la consommation par `resolveBonus('energy_consumption', null, techObj, bonuses)`. Mettre à jour tous les appels `new SimEngine(...)` (run.ts, optimal, tests) pour passer `loadBonuses()`.
- [ ] **Step 4** — Run → PASS + suite + typecheck (corriger les sites d'appel du constructeur).
- [ ] **Step 5** — Commit.

---

### Task 3 : Action `research` + file de recherche parallèle

**Files:** Modify `state.ts`, `engine.ts`, `policy.ts` (type Action) ; Test `engine.test.ts`.

**Interfaces:** `Action` gagne `{ type: 'research'; researchId: string }`. `SimState` gagne `research: { researchId; targetLevel; completesAt } | null`. `SimEngine` : `costOfResearch(id, level)`, `startResearch(state, id)` (gated : researchLab≥prereq, recherches prérequises OK ; coût via researchCost ; durée via researchTime avec bonus `research_time` du labo via `resolveBonus('research_time', null, {researchLab:level}, bonuses)` ; timeDivisor depuis une constante MVP = 1000). `nextEventIn` = min(fin build, fin research). `advance` finalise les DEUX files.

- [ ] **Step 1** — Test (échoue) : `startResearch(s,'energyTech')` met une recherche en file ; après `advance(nextEventIn)`, `techLevels.get('energyTech')===1` et la file research se vide ; la file build reste indépendante.
- [ ] **Step 2** — Run → FAIL.
- [ ] **Step 3** — Implémenter (mirroir de startBuild/advance mais pour la file research ; `nextEventIn` = plus petit délai non-nul parmi build/research ; `advance` complète chaque file dont `completesAt<=timeSec`). `startResearch` lève si prérequis (labo/recherche) non remplis ou coût inatteignable. La durée : `researchTime(costDef, target, resolveBonus('research_time', null, {researchLab: lvl}, bonuses), { timeDivisor: 1000 })`.
- [ ] **Step 4** — Run → PASS + suite + typecheck.
- [ ] **Step 5** — Commit.

---

### Task 4 : Politiques recherche + jalons + rapport

**Files:** Modify `policy.ts`, `optimal-policy.ts`, `run.ts` ; Test `policy.test.ts` / `run.test.ts`.

**Interfaces:** Les politiques peuvent renvoyer une action `research`. Jalons ajoutés : `firstResearch` (toute recherche≥1), `energyTech` (energyTech≥1).

- [ ] **Step 1** — Test (échoue) : un run optimal atteint le jalon `firstResearch` ; et `energyTech` finit par être recherché quand le labo est dispo.
- [ ] **Step 2** — Run → FAIL.
- [ ] **Step 3** — Implémenter : EcoPolicy — après les producteurs, si la file research est libre et le labo dispo, lancer la prochaine recherche éco-pertinente non maxée (`energyTech`, `semiconductors`, `temperateProduction` si prérequis OK) en priorité. OptimalPolicy — intégrer la recherche dans le ROI : une recherche éco a un `ΔProd` = hausse de prod via son bonus (mesuré par clone+`production`), ROI = ΔProd/(waitH+researchTimeH) ; la lancer si la file research est libre et son ROI bat l'epsilon. `run.ts` : ajouter les jalons `firstResearch`/`energyTech`. Garder `decide` pure (ne pas muter state).
- [ ] **Step 4** — Run → PASS + suite + typecheck ; `bash scripts/run-gamesim.sh` → vérifier que le rapport montre `firstResearch`/`energyTech` avec des temps finis et que l'optimal recherche bien l'éco-pertinent. Coller le tableau.
- [ ] **Step 5** — Commit.

## Self-review

- Extraction data + loaders recherche/bonus : Task 1 ✓
- Boucle recherche→production via resolveBonus réutilisé : Task 2 ✓
- File de recherche parallèle (build ET research) + action : Task 3 ✓
- Politiques + jalons + rapport recherche-aware : Task 4 ✓
- Hors scope (autres sous-systèmes 2b) : vaisseaux, colonies, empireXP, recherches non-éco (combat/propulsion modélisées comme simples puits si une politique les choisit, mais les politiques MVP ne ciblent que l'éco-pertinent) — plans suivants.
