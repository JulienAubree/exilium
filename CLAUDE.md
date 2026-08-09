# CLAUDE.md — Exilium

Jeu de stratégie spatiale **4X** (français), monorepo pnpm/turbo. Dev solo, on travaille sur `main`. On cherche à *lisser/approfondir l'existant* (rester 4X, pas roguelite) — voir `docs/proposals/2026-06-09-modernisation-4x-empire.md`.

**Stack** : `apps/web` (React/PWA, servi par Caddy depuis `dist/` **en direct**), `apps/api` (tRPC/Fastify, PM2), `apps/admin` (back-office), `packages/db` (Drizzle/Postgres), `packages/game-engine` (formules pures), `packages/shared`.

---

## Workflow d'une nouvelle feature

1. **Brancher** depuis `main` : `git checkout -b feat/<nom>`.
2. **Implémenter** sur la branche. Vérifier au fil de l'eau : `pnpm typecheck` après **chaque lot** d'edits ; `pnpm lint` + `pnpm test` en fin (parité CI). Ne jamais enchaîner 20 edits sans vérif intermédiaire.
3. **Commit** : conventional commits FR (`feat(market): …`, `fix(web): …`, `chore(db): …`). Finir par `Co-Authored-By: Claude …`.
4. **Présenter pour validation** — **NE PAS déployer** tant que le user n'a pas dit go. Signaler explicitement : décisions produit (équilibrage, **compensation des joueurs** quand on retire/transforme un système), et **migrations destructives**.
   **Exception (accordée 2026-06-11)** : les **petits changements front purs** (pas de migration, pas de seed, pas de décision d'équilibrage, pas de changement de paradigme UI — cf. leçon du rollback Passerelle) peuvent être **poussés + déployés sans go explicite**, en le signalant après coup. Dans le doute → demander.
5. **Sur go → merge + déploiement** (ci-dessous).

---

## Déploiement — prod + staging TOUJOURS ensemble

> **Règle (importante)** : un déploiement prod s'accompagne **toujours** du staging dans la foulée, sinon ils dérivent (déjà arrivé). `deploy.sh` le fait d'office ; un déploiement **ciblé manuel** (plus fin, moins de blast radius) ne le fait **pas** → enchaîner `deploy-staging.sh` à la main.

**Merge + push**
```bash
git checkout main && git merge --ff-only feat/<nom> && git push origin main
```

**Prod (déploiement ciblé manuel)**
1. **Backup** avant toute migration destructive : `bash scripts/backup-postgres.sh` → `/opt/backups/postgres/`.
2. **Build propre** : `tsc` ne nettoie PAS `dist/` → si des fichiers source ont été supprimés, faire `rm -rf apps/api/dist packages/db/dist` puis `pnpm build` (Vite nettoie web/admin seul). Après retrait de colonnes : vérifier que `packages/db/dist/schema/<table>.js` ne cite plus les colonnes droppées (sinon `select()` → "column does not exist").
3. **Reload AVANT migration** (le nouveau code doit tolérer l'ancien schéma : il ignore les colonnes en trop) : `pm2 reload ecosystem.config.cjs --update-env`. Vérifier : `curl -s localhost:3000/trpc/health`.
4. **Migration** : `bash scripts/apply-migrations.sh` (applique les `packages/db/drizzle/NNNN_*.sql` absents de `_migrations`). **Vérifier en base** ce qui a été droppé/ajouté.
5. **Reseed** `pnpm --filter @exilium/db db:seed` **uniquement** si le seed a changé ET que la migration ne couvre pas déjà le changement. ⚠️ Le seed fait des **upserts** → il ne supprime PAS les entrées retirées du seed : toute **suppression de config** (bâtiment, recherche, catégorie…) doit passer par une **migration**.
6. Caddy sert `apps/web/dist` en direct → pas de reload nécessaire.

**Staging (juste après)**
```bash
bash scripts/deploy-staging.sh        # checkout origin/main + build + migrations exilium_staging + seed + reload PM2 staging
```
Vérifier : `curl -s localhost:3001/trpc/health` et `HEAD` staging == prod.

---

## Migrations & DB
- Migrations : `packages/db/drizzle/NNNN_*.sql` (numérotation séquentielle), tracking table `_migrations`.
- `apply-migrations.sh` utilise `DATABASE_URL` (user `exilium`) → bon ownership. **NE PAS** appliquer une migration via `sudo -u postgres psql` (tables OWNED par `postgres` → permission denied pour l'app ; sinon `ALTER TABLE … OWNER TO exilium`).
- DB prod : `sudo -u postgres psql -d exilium`. Staging : `exilium_staging`.
- FK `building_prerequisites` → `building_definitions` en `ON DELETE CASCADE` (supprimer un bâtiment nettoie ses prérequis). `planet_buildings`/`build_queue` n'ont pas de FK config → suppression explicite en migration.
- **⚠️ `DROP COLUMN` : ne JAMAIS passer par `deploy.sh`/`deploy-staging.sh` d'une traite.** Les deux appliquent les migrations **avant** le `pm2 reload` (`deploy-staging.sh:53` puis `:68`). Sur un `DROP COLUMN`, ça ouvre une fenêtre où l'ancien binaire interroge une colonne disparue — et Drizzle **énumère explicitement les colonnes** du schéma TS, il n'y a pas de `select *`. Résultat : exception sur toute requête de la table, y compris `db.select().from(users)` dans `auth.service.ts`, c'est-à-dire **le login**. Séquence correcte, à faire à la main : backup → retirer le champ du schéma Drizzle → `rm -rf apps/api/dist packages/db/dist && pnpm build` → vérifier que `packages/db/dist/schema/<table>.js` ne cite plus la colonne → `pm2 reload` → health → **et seulement ensuite** `apply-migrations.sh`. Rollback à sens unique : revenir au code précédent sans réajouter la colonne rejoue la même panne.
- **Les migrations s'écrivent à la main en SQL** dans `packages/db/drizzle/` et s'appliquent via `scripts/apply-migrations.sh`. **`drizzle-kit generate` n'est pas le workflow de ce projet** : il numérote depuis `drizzle/meta/`, en ignorant les noms de fichiers sur disque, et produirait un fichier qui se trierait *avant* les migrations existantes dans le glob — donc appliqué hors ordre.
- **⚠️ `scripts/` ne contient QUE des scripts d'exploitation réentrants.** Tout backfill ponctuel passe par `packages/db/drizzle/` (+ un marqueur dans `_migrations`), jamais par un `.sql` dans `scripts/`. Raison : un backfill qui traîne devient un piège armé. `backfill-flagship-stats.sql` s'annonçait « idempotent » et, rejoué le 2026-08-08, aurait modifié **13 vaisseaux amiraux sur 14 et fait perdre des déblocages permanents à 11 joueurs** — il reconstruisait `unlocked_ships` (registre permanent) depuis les vaisseaux *actuellement possédés*. Supprimé le 2026-08-08 ; son travail est conservé dans la migration `0025`.

## Économie — un seul chemin de calcul (acte 0, 2026-08-09)
- **Toute production passe par `assembleBonusContext`** (`packages/game-engine/src/formulas/bonus-context.ts`). Cœur PUR, sans base : on lui donne des `BonusFacts`, il rend un contexte additif (`1 + Σ deltas`) et le détail par source.
- Deux chargeurs de faits dans `apps/api/src/modules/resource/bonus-context.ts` : `createPerPlanetBonusLoader` (~5 requêtes, l'API) et `createBatchBonusLoader` (4 requêtes pour tout l'univers, le tick). **Ne jamais appeler le chargeur par-planète dans une boucle sur les planètes** — le tick a un contrat de perf en O(requêtes constantes) à 50k planètes.
- Le simulateur (`packages/game-sim`) consomme le même cœur : il ne recompose plus ses primitives.
- **Pourquoi** : l'économie affichait ~528 k/h et versait ~426 k/h. Quatre chemins divergeaient, et le tick du worker — créditeur dominant, il réécrit `resources_updated_at` de toutes les planètes toutes les 15 min — ignorait biomes, politiques, `energy_production` et bouclier planétaire. Mesuré après correction : **+25,8 % versé** (425 740 → 535 536/h sur 91 planètes).
- Deux filets, complémentaires et non substituables : `bonus-context.test.ts` verrouille que les deux chargeurs produisent des faits **identiques** ; `production-parity.test.ts` verrouille que `getProductionRates` == `materializeResources` == `resourceTick` **au centime**. Le second ne garantit QUE la cohérence : retirer un ingrédient de l'assembleur partagé le retire des trois chemins à la fois et la parité tient toujours — c'est le premier, avec ses valeurs attendues, qui couvre ce flanc.
- Les deux tests exigent `exilium_test` seedée : `bash scripts/setup-test-db.sh` puis `DATABASE_URL=…/exilium_test pnpm --filter @exilium/db db:seed`.

## Seed — cible explicite, mode init
- **`db:seed` n'a plus de valeur par défaut.** Sans `DATABASE_URL` il s'arrête ; vers la base `exilium` (prod) il exige `--allow-prod`. Il affiche toujours sa cible avant d'écrire. Avant, il retombait silencieusement sur la prod.
- **Mode init par défaut** : crée ce qui manque, ne touche jamais à l'existant (`onConflictDoNothing`). Les 4 tables de prérequis, reconstruites en entier faute de clé métier stable, ne sont rebâties que si elles sont **vides**. `deploy.sh` lançant le seed à chaque déploiement, c'est ce qui permet aux réglages du back-office de survivre.
- **`--force-overwrite`** rétablit l'écrasement par les valeurs du dépôt. Conséquence du mode init : un nouveau prérequis ajouté au dépôt n'arrive pas tout seul sur une base peuplée — il faut le flag, ou une migration ciblée.

## Infra
- Prod : PM2 `exilium-api` (cluster ×4) + `exilium-worker`, API `:3000`, config `ecosystem.config.cjs`.
- Staging : `/opt/exilium-staging`, PM2 `exilium-api-staging` + `exilium-worker-staging`, API `:3001`, config `staging.config.cjs`. Copier données prod→staging (anonymisé) : `sudo scripts/refresh-staging-from-prod.sh`.
- PWA en `autoUpdate` → les joueurs récupèrent le nouveau front au prochain lancement.
- Table **`feedbacks`** = retours joueurs in-game (LA source, pas GitHub/Discord).

## Docs (`docs/README.md`)
`proposals/` = brainstorms ouverts (dont la vision modernisation 4X) · `plans/` = specs avant code · `reference/` = vérité courante · `patchnotes/` = livré · `archive/` = obsolète.
