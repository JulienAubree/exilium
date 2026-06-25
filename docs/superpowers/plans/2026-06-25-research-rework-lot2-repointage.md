# Refonte recherche — Lot 2 : Re-pointage des features (lecture)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Re-pointer **toutes les lectures** des niveaux de recherche des ~10
sous-systèmes (« features ») de la table large `user_research` vers le modèle en
lignes `user_research_levels` (via helpers), **puis retirer le dual-write et
dropper `user_research`**. Comportement strictement identique, invisible aux
joueurs.

**Séquencement (2 PR) — drop d'une table prod = irréversible :**
- **PR-A (cette session) — re-pointage des lectures** : Tasks 1→5. La table
  large reste **dual-written** (filet intact). Déployer prod+staging, valider.
- **PR-B (après validation prod) — teardown** : Task 6. Retirer le dual-write +
  `getOrCreateResearch` + write admin, drop schéma/export/repo + migration
  `DROP TABLE user_research`. Ne PAS yanker le filet avant que la bascule soit
  confirmée en prod.

**Architecture:** Un seul point de lecture canonique du modèle en lignes, partagé.
- `getUserResearchLevels(db, userId)` (packages/db) **rebranchée** pour lire
  `user_research_levels` au lieu de `user_research` — même signature, même retour
  (`Record<researchId, level>`, défaut 0 pour les absents). Re-pointe d'un coup
  ses 2 consommateurs (`fleet.service`, `shipyard.service`).
- Nouveau `getAllUserResearchLevels(db)` (packages/db) → `Map<userId,
  Record<researchId, level>>` pour les lectures **bulk** (cron tick + ranking).
- Chaque lecture brute `select().from(userResearch)` des features migre vers ces
  helpers. `researchId === levelColumn === nom de colonne camelCase` → les accès
  `obj[key]` restent valides ; ajouter `?? 0` pour les recherches absentes.

**Tech Stack:** Drizzle ORM (Postgres), tRPC (Fastify), pnpm/turbo monorepo.

## Global Constraints

- Working dir = `/opt/exilium` ; session démarre dans `/home/ubuntu` → préfixer chaque Bash par `cd /opt/exilium &&`.
- **Repo PARTAGÉ avec Julien** → `git add` **chemins précis** uniquement ; `git rev-parse --abbrev-ref HEAD` avant chaque commit. ⚠️ **NE JAMAIS lister un fichier supprimé (`git rm`) dans un `git add <chemins>`** (avorte tout l'add → commit incomplet → build cassé). `git status --short` APRÈS chaque commit.
- Branche de travail : `feat/research-lot2-repointage` (basée sur `main`, Lot 1 déjà mergé en #4).
- Vérif après CHAQUE tâche : `pnpm typecheck` + `pnpm --filter @exilium/api test` + `pnpm --filter @exilium/web lint`. **Gate final** = `pnpm typecheck && pnpm -r lint && pnpm -r test && pnpm -r build` vert (la hantise CI de Julien).
- ⚠️ **SÉCURITÉ DB** : `exilium` = PROD (Caddy sert le live). Ne JAMAIS y toucher. Filet de test = `exilium_test` (`bash scripts/setup-test-db.sh`). **PR-A = lecture seule, aucune migration** (la table `user_research_levels` existe déjà depuis Lot 1). **PR-B** ajoute la migration `DROP TABLE` (appliquée prod+staging au déploiement, jamais à la main).
- **Comportement inchangé** : aucune route tRPC, aucun type exposé, aucune UI ne change. Les tests existants passent sans modif d'assertions.
- ESM `.js` dans les imports.
- **On GARDE `research_definitions.level_column`** (= researchId, sert de clé dans les maps) — son retrait toucherait l'API admin + les types game-config → cleanup séparé.
- **Hors scope** : arbres/forks/capstones/UI/exécution par-planète (les « lots features »).

## Référence (état après Lot 1)

- `user_research_levels (user_id, research_id, level)` = source de vérité (backfillée + maintenue par dual-write de `research.service`).
- Helpers existants : `apps/api/.../research/research-levels.repo.ts` → `loadResearchLevels` / `bumpResearchLevel` / `setResearchLevel` (lisent/écrivent le NOUVEAU modèle).
- `packages/db/.../repositories/user-research.ts` → `getUserResearchLevels` (lit encore l'ANCIENNE table large).
- **Restent en lecture sur `user_research` (à re-pointer)** :
  - Bulk : `cron/resource-tick.ts:120`, `ranking/ranking.service.ts:26`.
  - Via `getUserResearchLevels` : `fleet/fleet.service.ts:124`, `shipyard/shipyard.service.ts:1166`.
  - Brut per-user : `admin/player-admin.service.ts:88`, `flagship/flagship.service.ts:515,525`, `fleet/fleet.types.ts:218`, `fleet/handlers/attack.handler.ts:356`, `fleet/handlers/explore.handler.ts:41`, `fleet/handlers/mine.handler.ts:89,187`, `fleet/handlers/spy.handler.ts:274,563`, `fleet/operations/send-fleet.ts:356`, `resource/resource.router.ts:64`, `resource/resource.service.ts:179`, `tutorial/tutorial.service.ts:82`.
- **NE PAS toucher (filet d'écriture, retiré au lot suivant)** : `research.service.ts` dual-write (~464-470) + getOrCreate (~515-521) ; `player-admin.service.ts:172` write (déjà synchronisé via `setResearchLevel`).

---

### Task 1 : Helpers de lecture du modèle en lignes (packages/db)

**Files:** Modify `packages/db/src/repositories/user-research.ts` ; Modify `packages/db/src/repositories/index.ts` (export bulk) ; Test `packages/db` (ou api) couvrant les deux helpers contre `exilium_test`.

**Interfaces produced:**
- `getUserResearchLevels(db, userId): Promise<Record<string, number>>` — **inchangée en signature**, lit désormais `user_research_levels`.
- `getAllUserResearchLevels(db): Promise<Map<string, Record<string, number>>>` — toutes les lignes `user_research_levels` groupées par `userId`.

- [ ] **Step 1** — Test (échoue) contre le filet : insérer un user + des lignes `user_research_levels` (ex. `weapons=3`, `espionageTech=2`) ; asserter `getUserResearchLevels` → `{ weapons:3, espionageTech:2 }` et `getAllUserResearchLevels` regroupe par user. Nettoyer + `closeTestDb()`.
- [ ] **Step 2** — Run → FAIL.
- [ ] **Step 3** — Réécrire `getUserResearchLevels` pour `SELECT research_id, level FROM user_research_levels WHERE user_id = ?` → reduce en Record. Ajouter `getAllUserResearchLevels` (SELECT all → group Map). Retirer l'import `userResearch` de ce fichier s'il n'y sert plus. Exporter `getAllUserResearchLevels` depuis `repositories/index.ts`.
- [ ] **Step 4** — Run → PASS + `pnpm --filter @exilium/db typecheck`. (Re-pointe automatiquement `fleet.service` + `shipyard.service`.)
- [ ] **Step 5** — Commit (chemins précis).

---

### Task 2 : Lectures bulk (cron tick + ranking)

**Files:** Modify `apps/api/src/cron/resource-tick.ts` ; Modify `apps/api/src/modules/ranking/ranking.service.ts`.

**Interfaces consumed:** `getAllUserResearchLevels` (Task 1).

- [ ] **Step 1** — `resource-tick.ts` : remplacer `select().from(userResearch)` + la boucle de construction `researchByUser` par `const researchByUser = await getAllUserResearchLevels(db)`. Retirer l'import `userResearch` s'il n'y sert plus.
- [ ] **Step 2** — `ranking.service.ts` : remplacer la lecture `select().from(userResearch)` (dans le `Promise.all`) par `getAllUserResearchLevels`, et adapter l'indexation en aval (map au lieu de lignes ; mêmes clés). Retirer l'import `userResearch` si inutilisé.
- [ ] **Step 3** — `pnpm --filter @exilium/api typecheck` → PASS. Test ciblé ranking si existant, sinon s'appuyer sur le typecheck + la suite globale (Task 5).
- [ ] **Step 4** — Commit (chemins précis).

---

### Task 3 : Lectures per-user — Resource & Tutorial & Admin

**Files:** Modify `resource/resource.router.ts`, `resource/resource.service.ts`, `tutorial/tutorial.service.ts`, `admin/player-admin.service.ts` (lecture `:88` uniquement, **pas** l'écriture).

**Interfaces consumed:** `getUserResearchLevels`.

- [ ] **Step 1** — Pour chaque site : remplacer `select().from(userResearch)…` par `const levels = await getUserResearchLevels(db, userId)` ; remplacer les accès `row[rDef.levelColumn]` / `research.<col>` par `levels[<key>] ?? 0`. (`resource.router:69` itère déjà via `levelColumn` → `levels[rDef.levelColumn] ?? 0`.)
- [ ] **Step 2** — `player-admin.service.ts` : re-pointer **seulement** la lecture d'affichage (`:88`). Laisser le write `:172` (filet) intact.
- [ ] **Step 3** — Retirer les imports `userResearch` devenus inutiles dans chaque fichier. `pnpm --filter @exilium/api typecheck` → PASS.
- [ ] **Step 4** — Commit (chemins précis).

---

### Task 4 : Lectures per-user — Fleet, Combat, Flagship

**Files:** Modify `fleet/fleet.types.ts` (`getCombatMultipliers`), `fleet/handlers/attack.handler.ts`, `fleet/handlers/explore.handler.ts`, `fleet/handlers/mine.handler.ts`, `fleet/handlers/spy.handler.ts`, `fleet/operations/send-fleet.ts`, `flagship/flagship.service.ts`.

**Interfaces consumed:** `getUserResearchLevels`.

- [ ] **Step 1** — `fleet.types.ts:getCombatMultipliers` : remplacer le select+strip-`userId` par `const levels = await getUserResearchLevels(db, userId)` (passé tel quel à `resolveBonus`). ⚠️ chemin combat — vérifier l'égalité de comportement.
- [ ] **Step 2** — `attack.handler.ts:356` : `defenderResearchLevels[key] = levels[rDef.levelColumn] ?? 0` (depuis `getUserResearchLevels(db, targetPlanet.userId)`).
- [ ] **Step 3** — `explore.handler`, `mine.handler` (×2), `spy.handler:274`, `spy.handler:563` (`levels.espionageTech ?? 0`), `send-fleet:356` (`levels.sensorNetwork ?? 0`), `flagship.service:515` (attaquant) + `:525` (défenseur) : même substitution par helper + `?? 0`.
- [ ] **Step 4** — Retirer les imports `userResearch` inutilisés. `pnpm --filter @exilium/api typecheck` → PASS.
- [ ] **Step 5** — Test combat/recherche minimal sur le filet si faisable rapidement (sinon couverture par la suite globale, Task 5). Commit (chemins précis).

---

### Task 5 : Gate vert PR-A + vérif « plus aucune lecture »

**Files:** —

- [ ] **Step 1** — `grep -rn "from(userResearch)" apps packages --include="*.ts" | grep -v dist | grep -v test` ne doit plus lister QUE `research.service.ts` (getOrCreate + dual-write, filet) ; `packages/db/.../user-research.ts` ne doit plus lire `userResearch`. Coller la preuve.
- [ ] **Step 2** — `cd /opt/exilium && pnpm typecheck` → 11/11.
- [ ] **Step 3** — `pnpm -r lint` → 0 erreur.
- [ ] **Step 4** — `pnpm -r test` → vert (api + game-engine + game-sim).
- [ ] **Step 5** — `pnpm -r build` → vert. Coller le récap. **PR-A prête à déployer.** Ne pas merger tant que les 4 ne sont pas vertes.

---

### Task 6 — PR-B (APRÈS validation prod de PR-A) : teardown `user_research`

> ⚠️ Ne commencer QUE quand PR-A est déployée ET la bascule confirmée en prod (les niveaux affichés/combat/prod identiques). Drop irréversible.

**Files:** Modify `research/research.service.ts` (retirer dual-write `~464-470` + `getOrCreateResearch` désormais mort) ; Modify `admin/player-admin.service.ts` (retirer le write `:172`, garder `setResearchLevel`) ; Delete `packages/db/src/schema/user-research.ts` + son export `schema/index.ts` ; retirer `getUserResearch`/import résiduel ; nouvelle migration Drizzle `DROP TABLE user_research`.

- [ ] **Step 1** — Retirer le bloc dual-write (`getOrCreateResearch` + `update(userResearch)`) de `completeResearch` ; supprimer `getOrCreateResearch` (plus aucun caller). `bumpResearchLevel` reste seul.
- [ ] **Step 2** — `player-admin.service.ts:172` : retirer l'`update(userResearch)` ; `setResearchLevel` (new table) reste l'unique écriture.
- [ ] **Step 3** — Supprimer la def de table `userResearch` + son export. ⚠️ `git rm` puis **ne PAS** lister ce fichier dans un `git add <chemins>` ultérieur (bug 2× vu) — committer la suppression à part.
- [ ] **Step 4** — Générer la migration `DROP TABLE user_research` (drizzle-kit). Sync filet de test (`setup-test-db.sh`).
- [ ] **Step 5** — Gate complet vert (typecheck/lint/test/build) + grep : plus AUCUNE occurrence de `userResearch` hors migration. Commit (suppression à part), PR-B.

## Self-review

- Lecture seule : aucune migration, aucune écriture modifiée → pas de risque DB ; dual-write garde `user_research` cohérente comme filet.
- Helper unique re-pointé + bulk helper → un seul endroit lit le nouveau modèle, le reste délègue.
- `researchId === levelColumn === colonne` → substitution `obj[key]` → `map[key] ?? 0` iso-comportement.
- Aucun fichier supprimé → pas de risque « git add d'un fichier rm ».
- Fin de lot : `user_research` n'est plus **lue** que par son propre filet d'écriture ; prêt pour le lot « retrait dual-write + drop table ».
