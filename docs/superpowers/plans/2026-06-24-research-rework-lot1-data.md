# Refonte recherche — Lot 1 : Fondation data (wide → lignes)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Migrer le stockage des niveaux de recherche de la table « large »
`user_research` (1 colonne/recherche) vers un modèle **en lignes**
`user_research_levels (user_id, research_id, level)`, **à comportement
strictement identique** (empire-wide, même UI, mêmes effets). Invisible aux
joueurs. Débloque l'ajout futur de recherches sans migration de schéma.

**Architecture:** Table additive + backfill ; le service lit/écrit via deux
helpers (`loadResearchLevels` / `bumpResearchLevel`) au lieu d'accéder aux
colonnes via `def.levelColumn`. On **GARDE** `user_research` et le champ
`research_definitions.levelColumn` pour l'instant (filet + mapping du backfill) ;
ils seront retirés dans un lot ultérieur une fois la bascule validée en prod.

**Tech Stack:** Drizzle ORM (Postgres), tRPC (Fastify), pnpm/turbo monorepo.

## Global Constraints

- Working dir = `/opt/exilium` ; la session démarre dans `/home/ubuntu` → préfixer chaque Bash par `cd /opt/exilium &&`.
- **Repo PARTAGÉ avec Julien** → `git add` **chemins précis** uniquement ; vérifier `git rev-parse --abbrev-ref HEAD` avant chaque commit. ⚠️ **NE JAMAIS lister un fichier supprimé (`git rm`) dans un `git add <chemins>` suivant** (ça avorte tout l'add → commit incomplet → build cassé ; bug vu 2× aujourd'hui). Vérifier `git status --short` APRÈS chaque commit.
- Branche de travail : `feat/research-lot1-data` (basée sur `main`).
- Vérif après CHAQUE tâche : `pnpm typecheck` (doit rester 11/11) + `pnpm --filter @exilium/api test` (les tests recherche) + `pnpm --filter @exilium/web lint` (0 erreur). Le **gate final CI** = `pnpm typecheck && pnpm -r lint && pnpm -r test && pnpm -r build` vert.
- Migrations Drizzle : générées dans `packages/db` (cf. les migrations existantes + `scripts/` d'apply). Le backfill se fait en SQL dans la migration (ou un script de migration data dédié), idempotent.
- **Comportement inchangé** : aucune route tRPC, aucun type exposé, aucune UI ne change. Seul le stockage interne bascule. Les tests existants de la recherche doivent passer sans modification de leurs assertions.
- ESM `.js` dans les imports (convention du repo).

## Référence (état actuel)

- `packages/db/src/schema/user-research.ts` : `user_research` = `user_id` (PK) + 21 colonnes smallint (ex. `espionage_tech`, `weapons`…), default 0.
- `research_definitions.levelColumn` (varchar) mappe chaque `researchId` → sa colonne.
- `apps/api/src/modules/research/research.service.ts` :
  - **Lit** le niveau via `research[def.levelColumn as keyof typeof research]` aux lignes ~155, 173, 266, 292, 398, 464.
  - **Écrit** via `.update(userResearch).set({ [columnKey]: newLevel }).where(eq(userResearch.userId, …))` (~462-467, à la complétion d'une recherche).
  - La ligne `user_research` est chargée via `.select().from(userResearch).where(eq(userResearch.userId, userId))` (plusieurs endroits).

---

### Task 1 : Table `user_research_levels` + migration + backfill

**Files:** Create `packages/db/src/schema/user-research-levels.ts` ; Modify `packages/db/src/schema/index.ts` (export) ; Create migration Drizzle + backfill SQL.

**Interfaces produced:** `userResearchLevels` table : `{ userId: uuid (FK users, cascade), researchId: varchar(64), level: smallint notNull default 0 }`, PK composite `(userId, researchId)`.

- [ ] **Step 1** — Écrire la def de table `userResearchLevels` (pgTable `user_research_levels`, PK composite `(user_id, research_id)`, FK `user_id`→users cascade). Exporter depuis `schema/index.ts`. `cd /opt/exilium && pnpm --filter @exilium/db typecheck` → PASS.
- [ ] **Step 2** — Générer la migration (drizzle-kit, comme les migrations existantes de `packages/db`). Vérifier le SQL généré (CREATE TABLE).
- [ ] **Step 3** — Ajouter au même fichier de migration (ou un script de migration data idempotent) le **backfill** : pour chaque recherche (les 21 `research_id` connus, qui = les noms de colonnes camelCase ou la valeur `level_column` de `research_definitions`), `INSERT INTO user_research_levels (user_id, research_id, level) SELECT user_id, '<researchId>', <colonne> FROM user_research ON CONFLICT DO NOTHING`. Idempotent (ON CONFLICT). Source du mapping researchId↔colonne : `research_definitions.level_column` (= researchId ici) ou la liste en dur des 21.
- [ ] **Step 4** — Appliquer la migration en local (`exilium` dev DB) et vérifier le backfill : `SELECT count(*) FROM user_research_levels;` doit valoir `nb_users × 21` (ou ≥ ce qui existait). Coller le résultat.
- [ ] **Step 5** — Commit (`git add packages/db/src/schema/user-research-levels.ts packages/db/src/schema/index.ts packages/db/<migration>` — chemins précis).

---

### Task 2 : Helpers `loadResearchLevels` / `bumpResearchLevel`

**Files:** Create `apps/api/src/modules/research/research-levels.repo.ts` (ou helpers dans le service) ; Test `research-levels.repo.test.ts`.

**Interfaces produced:**
- `loadResearchLevels(db, userId): Promise<Record<string, number>>` — map `researchId → level` (défaut 0 pour les absents) depuis `user_research_levels`.
- `bumpResearchLevel(db, userId, researchId): Promise<number>` — upsert `level = level + 1` (ON CONFLICT (user_id, research_id) DO UPDATE), retourne le nouveau niveau.

- [ ] **Step 1** — Test (échoue) : `loadResearchLevels` retourne `{}` (ou tous 0) pour un user neuf ; après `bumpResearchLevel(db, u, 'weapons')` deux fois, `loadResearchLevels` donne `weapons: 2`.
- [ ] **Step 2** — Run → FAIL.
- [ ] **Step 3** — Implémenter les 2 helpers (Drizzle : select rows → reduce en Record ; upsert via `.onConflictDoUpdate` sur la PK composite avec `level: sql\`${userResearchLevels.level} + 1\``).
- [ ] **Step 4** — Run → PASS + `pnpm --filter @exilium/api typecheck`.
- [ ] **Step 5** — Commit (chemins précis).

---

### Task 3 : Brancher `research.service.ts` sur le modèle en lignes

**Files:** Modify `apps/api/src/modules/research/research.service.ts`.

**Interfaces consumed:** `loadResearchLevels`, `bumpResearchLevel` (Task 2).

- [ ] **Step 1** — Remplacer chaque lecture `research[def.levelColumn as keyof typeof research]` par une lecture dans la map `levels` chargée via `loadResearchLevels(db, userId)` (charger une fois par méthode, en tête). Les ~6 sites : lignes ~155, 173, 266, 292, 398, 464. `def.levelColumn` n'est plus utilisé pour la LECTURE (mais le champ reste en base).
- [ ] **Step 2** — Remplacer l'écriture `.update(userResearch).set({[columnKey]: newLevel})` (à la complétion) par `bumpResearchLevel(db, entry.userId, entry.itemId)`. Retirer la dépendance à la ligne `userResearch` chargée si elle ne sert plus qu'à ça.
- [ ] **Step 3** — `pnpm --filter @exilium/api typecheck` → PASS. Lancer les tests recherche existants : `pnpm --filter @exilium/api test research` → **PASS sans modifier les assertions** (preuve d'iso-comportement).
- [ ] **Step 4** — Vérif manuelle de cohérence : une recherche complétée incrémente bien `user_research_levels` (et le `listResearch` renvoie le bon niveau). Coller un extrait de test ou un log.
- [ ] **Step 5** — Commit (chemins précis).

---

### Task 4 : Gate vert + non-régression

**Files:** —

- [ ] **Step 1** — `cd /opt/exilium && pnpm typecheck` → 11/11.
- [ ] **Step 2** — `pnpm -r lint` → 0 erreur.
- [ ] **Step 3** — `pnpm -r test` → vert (en particulier api + game-engine).
- [ ] **Step 4** — `pnpm -r build` → vert (l'équivalent du build CI).
- [ ] **Step 5** — Coller le récap des 4 commandes. **Ne pas merger tant que les 4 ne sont pas vertes** (la hantise CI de Julien).

## Self-review

- Table additive + backfill idempotent : Task 1 ✓ · helpers testés : Task 2 ✓ · service bascule en iso-comportement (tests existants intouchés) : Task 3 ✓ · gate CI complet vert : Task 4 ✓.
- `user_research` (large) et `levelColumn` **conservés** (retrait dans un lot ultérieur après validation prod) — pas de suppression ici → pas de risque de build cassé par fichier supprimé.
- Hors scope (lots suivants) : branches/forks/capstones, exécution par-planète, UI arbre, migration `user_research_choices`/`planet_research_active`.
