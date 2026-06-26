# Refonte recherche S1 — Arbres + forks + respec — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (un subagent par tâche, review entre tâches). Steps en checkbox (`- [ ]`).

**Goal:** Restructurer les recherches en 5 branches/tiers avec **forks exclusifs** + **respec** (exilium), niveaux empire-wide, vue arbre sur l'onglet recherche empire — exécution inchangée.

**Architecture:** Métadonnées d'arbre additives sur `research_definitions` (admin-éditables) ; choix de fork par joueur dans `user_research_choices` ; gating + chooseFork/respec dans le service recherche ; nouveau stat combat `shield_pierce` (fork Armement) symétrique à `armor_pierce` ; bascule one-time des joueurs existants par script TS. Spec : [docs/superpowers/specs/2026-06-26-research-trees-s1-design.md](../specs/2026-06-26-research-trees-s1-design.md).

**Tech Stack:** Drizzle (Postgres), tRPC (Fastify), pnpm/turbo monorepo, React (web/admin), Vitest.

## Global Constraints

- Working dir = `/opt/exilium` (session démarre dans `/home/ubuntu` → préfixer chaque Bash par `cd /opt/exilium &&`). **Implémentation en worktree isolé** (multi-agents) — cf. handoff.
- **Repo PARTAGÉ** → `git add` **chemins précis** uniquement ; `git rev-parse --abbrev-ref HEAD` avant chaque commit ; ⚠️ **ne jamais lister un fichier `git rm` dans un `git add <chemins>`** ; `git status --short` APRÈS chaque commit.
- Branche : `feat/research-s1-trees` (déjà créée, spec dedans).
- Vérif après CHAQUE tâche : `pnpm typecheck` (11/11) + `pnpm --filter @exilium/api test` + `pnpm --filter @exilium/web lint`. Gate final = `pnpm typecheck && pnpm -r lint && pnpm -r test && pnpm -r build` vert.
- ⚠️ **SÉCURITÉ DB** : `exilium` = PROD. Ne jamais y toucher. Filet = `exilium_test` (`bash scripts/setup-test-db.sh`, à relancer après tout changement de schéma). Tests DB importent `testDb`/`closeTestDb` de `apps/api/src/test/test-db.ts`, nettoient leurs données (IDs uniques).
- Migrations = `packages/db/drizzle/NNNN_*.sql` (prochaine = `0104`), appliquées par `scripts/apply-migrations.sh` (table `_migrations`, filename-based). Drizzle journal vestigial.
- ESM `.js` dans les imports. `researchId === level_column === colonne camelCase` (invariant conservé).
- **Calibrage chiffré hors scope** (coûts respec, valeurs `shield_pierce`) : valeurs initiales prudentes, ajustables.

## File Structure

- `packages/db/src/schema/game-config.ts` — colonnes `research_definitions`.
- `packages/db/src/schema/user-research-choices.ts` — **nouvelle** table.
- `packages/db/src/schema/index.ts` — export.
- `packages/db/drizzle/0104_research_trees.sql` — migration additive.
- `packages/db/src/game-config-data.ts` — seed (branch/tier/fork, 2 recherches neuves, bonus, 3 re-points, respec universe, labels).
- `packages/game-engine/src/formulas/combat.ts` + `bonus.ts` — `shield_pierce`.
- `apps/api/src/modules/research/research-choices.repo.ts` — **nouveau** (load/choose/respec/gating).
- `apps/api/src/modules/research/research.service.ts` + `research.router.ts` — chooseFork/respec/list/start gating.
- `apps/api/src/modules/fleet/fleet.types.ts` — `getCombatMultipliers` threade `shieldPierce`.
- `apps/api/scripts/migrate-research-forks.ts` — **nouveau** script bascule.
- `apps/web/src/pages/Research.tsx` (+ composants) — vue arbre.
- `apps/admin/src/pages/Research.tsx` — champs branch/tier/fork.
- Tests : co-localisés `__tests__/`.

**Graphe de dépendances (pour le multi-agent) :** T1 → {T2, T3, T4, T8 en parallèle} ; T4 → T5 → T7 ; {T1,T2,T4} → T6 ; tout → T9. T3 (combat) et T8 (admin) sont indépendants → worktrees parallèles possibles.

---

### Task 1 : Modèle data (colonnes + table + migration)

**Files:**
- Modify `packages/db/src/schema/game-config.ts` (researchDefinitions)
- Create `packages/db/src/schema/user-research-choices.ts`
- Modify `packages/db/src/schema/index.ts`
- Create `packages/db/drizzle/0104_research_trees.sql`

**Interfaces produced:**
- `researchDefinitions` gagne `branchId` (varchar 32), `tier` (smallint), `forkId` (varchar 64, nullable), `forkPath` (varchar 32, nullable).
- `userResearchChoices` table : `{ userId: uuid (FK users cascade), forkId: varchar(64), chosenPath: varchar(32) notNull, respecCount: smallint notNull default 0 }`, PK `(userId, forkId)`.

- [ ] **Step 1** — Ajouter à `researchDefinitions` : `branchId: varchar('branch_id', { length: 32 })`, `tier: smallint('tier')`, `forkId: varchar('fork_id', { length: 64 })`, `forkPath: varchar('fork_path', { length: 32 })` (tous nullable au schéma ; le seed les remplit). `pnpm --filter @exilium/db typecheck`.
- [ ] **Step 2** — Créer `user-research-choices.ts` (modèle calqué sur `user-research-levels.ts`) :
```ts
import { pgTable, uuid, varchar, smallint, primaryKey } from 'drizzle-orm/pg-core';
import { users } from './users.js';
export const userResearchChoices = pgTable('user_research_choices', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  forkId: varchar('fork_id', { length: 64 }).notNull(),
  chosenPath: varchar('chosen_path', { length: 32 }).notNull(),
  respecCount: smallint('respec_count').notNull().default(0),
}, (t) => [primaryKey({ columns: [t.userId, t.forkId] })]);
```
Exporter depuis `schema/index.ts` (`export * from './user-research-choices.js';`).
- [ ] **Step 3** — Écrire `0104_research_trees.sql` (additif, idempotent) :
```sql
ALTER TABLE "research_definitions" ADD COLUMN IF NOT EXISTS "branch_id" varchar(32);
ALTER TABLE "research_definitions" ADD COLUMN IF NOT EXISTS "tier" smallint;
ALTER TABLE "research_definitions" ADD COLUMN IF NOT EXISTS "fork_id" varchar(64);
ALTER TABLE "research_definitions" ADD COLUMN IF NOT EXISTS "fork_path" varchar(32);
CREATE TABLE IF NOT EXISTS "user_research_choices" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "fork_id" varchar(64) NOT NULL,
  "chosen_path" varchar(32) NOT NULL,
  "respec_count" smallint NOT NULL DEFAULT 0,
  CONSTRAINT "user_research_choices_pkey" PRIMARY KEY ("user_id","fork_id")
);
```
- [ ] **Step 4** — `bash scripts/setup-test-db.sh` ; vérifier `sudo -u postgres psql -d exilium_test -c "\d user_research_choices"`. **NE PAS toucher `exilium`.**
- [ ] **Step 5** — `pnpm --filter @exilium/db build && pnpm --filter @exilium/db typecheck`. Commit (`git add packages/db/src/schema/game-config.ts packages/db/src/schema/user-research-choices.ts packages/db/src/schema/index.ts packages/db/drizzle/0104_research_trees.sql`).

---

### Task 2 : Seed (arbre, contenu Armement, re-points, config)

**Files:** Modify `packages/db/src/game-config-data.ts`

**Interfaces consumed:** colonnes Task 1. **Produces:** catalogue complet seedé.

Mapping `fork_id`/`fork_path` (4 forks) : `economy_yield` (`production`/`efficiency`), `armament_spec` (`power`/`antishield`), `defense_doctrine` (`shields`/`armor`), `intel_warfare` (`detection`/`stealth`).

- [ ] **Step 1** — Sur les 21 `research` existantes, ajouter `branchId`/`tier`/`forkId`/`forkPath` selon le catalogue du spec (table « Catalogue »). Communes : `forkId: null, forkPath: null`. Ex. `shielding` → `branchId:'defense', tier:1, forkId:'defense_doctrine', forkPath:'shields'` ; `semiconductors` → `branchId:'economy', tier:2, forkId:'economy_yield', forkPath:'efficiency'` ; `espionageTech` → `branchId:'intel', tier:1, forkId:null`. Suivre la table verbatim (Économie/Propulsion/Armement/Défense/Renseignement).
- [ ] **Step 2** — Ajouter 2 `research` neuves (fork Armement, `branchId:'armament', tier:2, forkId:'armament_spec'`) :
  - `firepower` (`forkPath:'power'`, `levelColumn:'firepower'`, prereq research `weapons` lvl 3, annexe null, coûts ~ ceux de `volcanicWeaponry`).
  - `shieldBreaker` (`forkPath:'antishield'`, `levelColumn:'shieldBreaker'`, prereq research `weapons` lvl 3).
- [ ] **Step 3** — Ajouter leurs `bonusDefinitions` :
  - `{ id:'firepower__weapons', sourceType:'research', sourceId:'firepower', stat:'weapons', percentPerLevel:10, category:null, statLabel:'Puissance de feu', bonusType:'asymptotic', softCapMax:1.5, softCapK:0.15 }`
  - `{ id:'shieldBreaker__shield_pierce', sourceType:'research', sourceId:'shieldBreaker', stat:'shield_pierce', percentPerLevel:4, category:null, statLabel:'Perce-bouclier', bonusType:'asymptotic', softCapMax:0.6, softCapK:0.15 }` (cap 60% d'absorption ignorée ; valeur ajustable).
- [ ] **Step 4** — **Re-pointer 3 prérequis** (sever fork dead-ends) : `hyperspaceDrive` research prereq `shielding 5` → `impulse 5` ; `recycler` (ship) `shielding 2` → `combustion 2` ; `frigate` (ship) `armor 2` → `weapons 2`.
- [ ] **Step 5** — Ajouter au seed `universe` : `research_respec_base` (ex. `5` exilium) et `research_respec_factor` (ex. `2`). Ajouter les `ui-labels` des 4 forks + 8 voies (clés `research.fork.*`).
- [ ] **Step 6** — `pnpm --filter @exilium/db build && pnpm --filter @exilium/db typecheck`. Commit (chemins précis).

---

### Task 3 : Stat combat `shield_pierce` (game-engine)

**Files:**
- Modify `packages/game-engine/src/formulas/combat.ts`
- Modify `apps/api/src/modules/fleet/fleet.types.ts` (`getCombatMultipliers` + `CombatMultipliers`)
- Test `packages/game-engine/src/formulas/combat.shield-pierce.test.ts`

**Interfaces produced:** combat applique une fraction `attackerShieldPierce ∈ [0,1)` réduisant l'absorption bouclier. `CombatMultipliers` gagne `shieldPierce: number`.

- [ ] **Step 1 (test rouge)** — `combat.shield-pierce.test.ts` : 1 attaquant dégâts D vs 1 défenseur bouclier S (S<D), sans pierce → `shieldAbsorbed == S` ; avec `attackerShieldPierce=0.5` → `shieldAbsorbed == S*0.5` et hull damage augmenté d'autant. Utiliser les fixtures `combat.fixtures.ts`.
- [ ] **Step 2** — Run → FAIL.
- [ ] **Step 3** — Dans `combat.ts` : ajouter `attackerShieldPierce` à l'input de combat (côté attaquant, comme `defenderArmorPierce` est porté par `bossCtx` mais ici pour le combat normal — le threader via l'input combat / le contexte attaquant). Dans `applyDamage`, à l'étape bouclier (≈ lignes 415-420) :
```ts
const effShield = target.shield * (1 - attackerShieldPierce);
if (effShield > 0) { surplus = damage - effShield; defenderStats.shieldAbsorbed += effShield; entry.shieldDamage += effShield; shotShieldAbsorbed = effShield; }
target.shield = 0;
```
- [ ] **Step 4** — Dans `fleet.types.ts:getCombatMultipliers`, résoudre `shieldPierce: resolveBonus('shield_pierce', null, levels, bonusDefs) - 1` (resolveBonus renvoie un multiplicateur ; pour un effet additif borné, modéliser le stat comme fraction → utiliser `percentPerLevel`/soft-cap pour donner directement une fraction 0..0.6 ; documenter le mapping). Étendre le type `CombatMultipliers` (`packages/game-engine`) avec `shieldPierce: number`. Threader `attackerMultipliers.shieldPierce` jusqu'à `applyDamage` via l'input de combat (`combat.helpers.ts` → input). Defender pierce non utilisé (S1 : seul l'attaquant perce).
- [ ] **Step 5** — Run combat tests → PASS + `pnpm --filter @exilium/game-engine typecheck && pnpm --filter @exilium/api typecheck`. Commit (chemins précis).

> ⚠️ Le mapping resolveBonus→fraction est le point délicat : `shield_pierce` doit sortir une **fraction 0..softCapMax** (pas un multiplicateur ×). Implémenter via un helper dédié `resolveShieldPierce(levels, bonusDefs)` qui lit le soft-cap (`softCapMax`/`softCapK`) et renvoie `softCapMax × (1 - exp(-softCapK × level))`. Le tester explicitement.

---

### Task 4 : Repo choix + service (chooseFork / respec / gating)

**Files:**
- Create `apps/api/src/modules/research/research-choices.repo.ts`
- Modify `apps/api/src/modules/research/research.service.ts`
- Test `apps/api/src/modules/research/__tests__/research-choices.test.ts`

**Interfaces consumed:** `userResearchChoices` (T1), `userResearchLevels` + `setResearchLevel` (existant), `exiliumService.spend`. **Produces:**
- `loadChoices(db, userId): Promise<Record<forkId, { path: string; respecCount: number }>>`
- `chooseFork(db, userId, forkId, path): Promise<void>` (insert, échoue si déjà choisi)
- `isResearchLocked(def, choices): boolean` (true si `def.forkId` set et `choices[def.forkId]?.path !== def.forkPath`)
- `service.respecFork(userId, forkId, newPath)` : débite exilium (`base × factor^respecCount`), met à 0 les `user_research_levels` de l'ancienne voie (toutes les recherches du même `forkId`/ancienne `forkPath`), upsert `chosenPath=newPath` + `respecCount++`. Transactionnel.

- [ ] **Step 1 (test rouge)** — `research-choices.test.ts` (filet) : (a) `chooseFork` crée la ligne, 2e appel rejette ; (b) `isResearchLocked` vrai pour la mauvaise voie / fork non choisi, faux pour la bonne ; (c) `respecFork` débite l'exilium attendu, remet à 0 les niveaux de l'ancienne voie, bascule le path, `respecCount` 0→1, et le coût du 2e respec = `base×factor`. Seed minimal de 2 `research_definitions` forkées dans le filet (insert direct) + `userExilium` créditée.
- [ ] **Step 2** — Run → FAIL.
- [ ] **Step 3** — Implémenter `research-choices.repo.ts` (Drizzle) + brancher `respecFork`/`chooseFork` dans le service (le service a déjà `db`, `gameConfigService` ; injecter `exiliumService` ou l'appeler). Le coût respec lit `universe.research_respec_base/factor`.
- [ ] **Step 4** — Modifier `startResearch` : charger les choix, rejeter (`TRPCError FORBIDDEN`) si `isResearchLocked(def, choices)`. Modifier `listResearch` : joindre branch/tier/fork + choix + `locked` par recherche.
- [ ] **Step 5** — Run → PASS + `pnpm --filter @exilium/api typecheck` + suite recherche verte. Commit (chemins précis).

---

### Task 5 : API tRPC (list enrichi, chooseFork, respec, gating)

**Files:** Modify `apps/api/src/modules/research/research.router.ts` ; Test `apps/api/src/modules/research/__tests__/research.router.test.ts` (ou étendre l'existant).

**Interfaces consumed:** service Task 4.

- [ ] **Step 1 (test rouge)** — Test router : `chooseFork` (input `{forkId, path}`) appelle le service ; `respec` (input `{forkId, newPath}`) ; `list` renvoie les champs branch/tier/fork/locked/choices.
- [ ] **Step 2** — Run → FAIL.
- [ ] **Step 3** — Ajouter `chooseFork` et `respec` (`protectedProcedure` + zod input) ; enrichir le retour de `list`. `start` s'appuie sur le gating service (Task 4).
- [ ] **Step 4** — Run → PASS + `pnpm --filter @exilium/api typecheck`. Commit (chemins précis).

---

### Task 6 : Script bascule one-time

**Files:** Create `apps/api/scripts/migrate-research-forks.ts` ; Test `apps/api/src/modules/research/__tests__/migrate-research-forks.test.ts` ; Modify `scripts/apply-migrations.sh` **NON** (script TS lancé à part au deploy — documenter dans le plan de déploiement, pas auto).

**Interfaces consumed:** `userResearchLevels`, `userResearchChoices`, formules coût `game-engine`, config recherche.

- [ ] **Step 1 (test rouge)** — Test (filet) : user avec `shielding=4, glacialShielding=2` (voie shields) ET `armor=6` (voie armor) → après bascule : `chosenPath='armor'` (plus de ressources cumulées : calculer via `researchCost`), niveaux shields → 0, **remboursement** crédité sur la planète-mère = somme des coûts cumulés shields, `respecCount=0`. Cas mono-voie (que shields) → choisi shields, pas de remboursement. Re-run (idempotence) → no-op.
- [ ] **Step 2** — Run → FAIL.
- [ ] **Step 3** — Implémenter le script : pour chaque user, pour chaque `forkId` à conflit, calculer les ressources cumulées par voie (via `researchCost(def, level)` sommé 1..level), choisir la dominante (départage = voie listée première deterministe), insérer `userResearchChoices` (skip si existe), mettre à 0 les niveaux de la voie perdante, créditer le remboursement (minerai/silicium/hydrogène) sur la planète-mère (overflow toléré). Idempotent.
- [ ] **Step 4** — Run → PASS + `pnpm --filter @exilium/api typecheck`. Commit (chemins précis).

---

### Task 7 : UI vue arbre (web)

**Files:** Modify `apps/web/src/pages/Research.tsx` ; Create composants `apps/web/src/components/research/BranchColumn.tsx`, `ForkChoice.tsx`, `RespecDialog.tsx` ; réutiliser l'art des cartes existant.

**Interfaces consumed:** `trpc.research.list` enrichi, `trpc.research.chooseFork`, `trpc.research.respec`, `trpc.research.start`.

- [ ] **Step 1** — Regrouper les recherches par `branchId` puis `tier` ; rendre 5 sections (ordre Économie, Propulsion, Armement, Défense, Renseignement). Réutiliser la carte recherche existante.
- [ ] **Step 2** — Au tier fork : `ForkChoice` rend les 2 voies. Aucun choix → boutons « Choisir cette voie » (→ `chooseFork`, invalider `list`). Choix fait → voie active normale, voie adverse grisée + bouton « Respec » (→ `RespecDialog`).
- [ ] **Step 3** — `RespecDialog` : montre coût exilium (depuis `list`/config) + recherches remises à 0 ; confirme → `respec`, invalider `list` + solde exilium.
- [ ] **Step 4** — États par nœud : verrouillé (fork non choisi / mauvaise voie / prérequis) grisé + raison ; dispo ; en cours (file) ; max. `start` désactivé si verrouillé.
- [ ] **Step 5** — `pnpm --filter @exilium/web typecheck && pnpm --filter @exilium/web lint && pnpm --filter @exilium/web build`. Commit (chemins précis).

---

### Task 8 : Admin (champs arbre)

**Files:** Modify `apps/admin/src/pages/Research.tsx` (+ form) ; vérifier le routeur admin game-config accepte branch/tier/fork (sinon étendre `apps/api/src/modules/admin/game-config*`).

- [ ] **Step 1** — Ajouter au formulaire d'édition recherche : `branchId` (select 5 valeurs), `tier` (number), `forkId` (text/select nullable), `forkPath` (text nullable). Persistance via la mutation game-config existante.
- [ ] **Step 2** — Si le routeur/types game-config ne portent pas ces champs, les ajouter (`game-config.types.ts`, `build-config.ts`, mutation). `pnpm --filter @exilium/admin typecheck && pnpm typecheck`.
- [ ] **Step 3** — Commit (chemins précis).

---

### Task 9 : Gate + non-régression

**Files:** —

- [ ] **Step 1** — `cd /opt/exilium && pnpm typecheck` → 11/11.
- [ ] **Step 2** — `pnpm -r lint` → 0 erreur.
- [ ] **Step 3** — `pnpm -r test` → vert (api + game-engine + web).
- [ ] **Step 4** — `pnpm -r build` → vert.
- [ ] **Step 5** — Grep de cohérence : aucune ref à `firepower`/`shieldBreaker`/`shield_pierce` orpheline ; les 3 re-points appliqués. Coller le récap. **Déploiement** (prod+staging, backup avant, + lancer `migrate-research-forks.ts`) = étape séparée validée avec Julien.

## Self-review

- Couverture spec : catalogue (T2) · forks/respec (T4) · bascule (T6) · re-points (T2.4) · `shield_pierce` (T3) · data model (T1) · API (T5) · UI (T7) · admin (T8). ✓
- Pas de table droppée / fichier supprimé → pas de piège « git add d'un rm ».
- Types cohérents : `forkId`/`forkPath`/`chosenPath`/`respecCount`, `shieldPierce` sur `CombatMultipliers`, `isResearchLocked`/`chooseFork`/`respecFork` réutilisés tels quels entre T4/T5/T7.
- Point de vigilance : mapping resolveBonus→fraction pour `shield_pierce` (T3, helper dédié testé) ; calibrage chiffré laissé prudent.
- Hors scope (S2/S4) : exécution par planète, onglet planète, capstones, équilibrage fin.
