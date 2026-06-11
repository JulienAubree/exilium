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

## Infra
- Prod : PM2 `exilium-api` (cluster ×4) + `exilium-worker`, API `:3000`, config `ecosystem.config.cjs`.
- Staging : `/opt/exilium-staging`, PM2 `exilium-api-staging` + `exilium-worker-staging`, API `:3001`, config `staging.config.cjs`. Copier données prod→staging (anonymisé) : `sudo scripts/refresh-staging-from-prod.sh`.
- PWA en `autoUpdate` → les joueurs récupèrent le nouveau front au prochain lancement.
- Table **`feedbacks`** = retours joueurs in-game (LA source, pas GitHub/Discord).

## Docs (`docs/README.md`)
`proposals/` = brainstorms ouverts (dont la vision modernisation 4X) · `plans/` = specs avant code · `reference/` = vérité courante · `patchnotes/` = livré · `archive/` = obsolète.
