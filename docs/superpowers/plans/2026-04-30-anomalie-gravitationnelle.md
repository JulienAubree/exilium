# Anomalie Gravitationnelle V1 — Plan d'implémentation

**Goal:** Livrer la V1 spécifiée dans `docs/superpowers/specs/2026-04-30-anomalie-gravitationnelle-design.md` (rogue-lite asynchrone, mission flagship + 5 Exilium, combats successifs avec scaling, hull tracking entre nœuds, page sidebar dédiée).

**Architecture:** Nouveau module `anomaly` (service + router + combat helper), formules pures dans `game-engine`, table `anomalies` avec partial unique index, page UI conditionnelle dans la sidebar groupe Espace.

**Tech stack:** Drizzle ORM (PostgreSQL), tRPC, vitest, React + Tailwind. Réutilise `simulateCombat`, `computeFleetFP` du game-engine et le pattern de `pve.service.ts`.

---

## Ordre des tâches

| # | Tâche | Fichiers | Effort |
|---|---|---|---|
| 1 | Schéma + migration DB | `packages/db/src/schema/anomalies.ts` + `index.ts`, `packages/db/drizzle/0063_anomalies.sql` | S |
| 2 | Seed universe config (6 keys) | `packages/db/src/seed-game-config.ts` | S |
| 3 | Formules pures + tests | `packages/game-engine/src/formulas/anomaly.ts` + `.test.ts`, `index.ts` | S |
| 4 | Combat helper (génération ennemi + résolution) | `apps/api/src/modules/anomaly/anomaly.combat.ts` | M |
| 5 | Service `engage` + tests | `apps/api/src/modules/anomaly/anomaly.service.ts` + `__tests__/anomaly.service.test.ts` | M |
| 6 | Service `current` + `advance` + tests | service + tests | M-L |
| 7 | Service `retreat` + `history` + tests | service + tests | M |
| 8 | Router tRPC + intégration app-router | `anomaly.router.ts`, `apps/api/src/trpc/app-router.ts` | S |
| 9 | Sidebar visibility (path `/anomalies`) | `packages/game-engine/src/sidebar-visibility.ts` | XS |
| 10 | Icône AnomalyIcon + sidebar entry + route | `apps/web/src/lib/icons.tsx`, `Sidebar.tsx`, `router.tsx` | S |
| 11 | Page Anomaly (intro + run view + history) | `apps/web/src/pages/Anomaly.tsx` + composants | M-L |
| 12 | Composant AnomalyEngageModal | `components/anomaly/AnomalyEngageModal.tsx` | M |
| 13 | Lint + typecheck + tests + commit + deploy | — | — |

## Détails clés par tâche

### 1. Schéma DB

Voir spec section 3 — colonnes : `id, user_id, origin_planet_id, status, current_depth, fleet jsonb, loot_minerai/silicium/hydrogene, loot_ships jsonb, exilium_paid, next_node_at, created_at, completed_at`. Partial unique index `WHERE status = 'active'`.

### 2. Seed config

```ts
{ key: 'anomaly_entry_cost_exilium', value: 5 },
{ key: 'anomaly_difficulty_growth', value: 1.3 },
{ key: 'anomaly_loot_base', value: 5000 },
{ key: 'anomaly_loot_growth', value: 1.4 },
{ key: 'anomaly_enemy_recovery_ratio', value: 0.15 },
{ key: 'anomaly_node_travel_seconds', value: 600 },
```

### 3. Formules pures

```ts
export function anomalyEnemyFP(playerFP, depth, growth = 1.3): number;
export function anomalyLoot(depth, base = 5000, growth = 1.4): { minerai, silicium, hydrogene };
export function anomalyEnemyRecoveryCount(defeatedShips, ratio = 0.15): Record<string, number>;
```

Tests basés sur valeurs de la spec :
- depth=1 : enemyFP = playerFP×0.5, loot = base×1
- depth=4 : loot ≈ base × 2.74, enemyFP ≈ playerFP × 1.0985
- recovery = floor(count × ratio)

### 4. Combat helper

Réutilise `simulateCombat`. Construit `shipConfigs` modifié avec `baseHull = original × hullPercent`. Génère un ennemi à FP cible (réutilise `pirateService.buildScaledPirateFleet` si possible, sinon nouveau picker simple — ennemi tiré dans une pool d'IA pirate "mid-tier").

Output : `{ outcome, attackerSurvivors: { [shipId]: { count, hullPercent } }, enemyDestroyed: Record<string, number>, combatReportId }`.

### 5-7. Service

Pattern aligné sur `pve.service.ts` (factory function). Dépendances : `db, gameConfigService, exiliumService, flagshipService, reportService, redis`.

**`engage`** (transactionnel) :
1. Validate flagship sur planète, no active anomaly, 5 Exilium dispo
2. Spend Exilium (`exiliumService.spend`)
3. Lock flagship (`flagshipService.setInMission`)
4. Décrémente `planet_ships` du origin (move out)
5. INSERT row anomalies, current_depth=0, next_node_at=now+10min, fleet={...avec hullPercent: 1.0}

**`current(userId)`** : SELECT WHERE userId AND status='active'. Renvoie fleet + loot + depth + nextNodeAt.

**`advance(userId)`** :
1. Load active anomaly, vérif `next_node_at <= now`
2. Compute playerFP courant (sur fleet vivante)
3. Compute target enemyFP avec formule
4. Call `anomaly.combat.runNode(...)` → simulateCombat
5. Si wipe : status='wiped', flagship→incapacitated, return wiped
6. Si survived : update fleet (count + hullPercent), depth++, ajoute loot/ships, next_node_at=now+10min

**`retreat(userId)`** :
1. Load active anomaly
2. status='completed', completed_at=now
3. Refund 5 Exilium (`exiliumService.earn`)
4. Crédite ressources sur homeworld (UPDATE planets)
5. Réinjecte ships survivants (UPDATE planet_ships, += counts)
6. Réinjecte loot_ships
7. Libère flagship (`flagshipService.returnFromMission`)

**`history(userId, limit)`** : SELECT WHERE status IN ('completed','wiped') ORDER BY completed_at DESC.

### 8. Router

Endpoints `current`, `engage`, `advance`, `retreat`, `history`. Validation Zod minimale. Exposer dans app-router via `anomalyRouter`.

### 9. Sidebar visibility

Ajout : `'/anomalies': atChapter(4)` dans `SIDEBAR_VISIBILITY_RULES`.

### 10. Icône + sidebar + route

- AnomalyIcon : SVG inline style portail/spirale (cohérent avec MissionsIcon, FleetIcon, etc.)
- Sidebar.tsx : item `{ label: 'Anomalies', path: '/anomalies', icon: AnomalyIcon }` dans le groupe Espace après Missions
- Router : route `path: 'anomalies', lazy: lazyLoad(() => import('./pages/Anomaly'))`

### 11. Page Anomaly

Conditionnelle sur `trpc.anomaly.current`. Si `null` → IntroView (bouton + texte explicatif + history). Si actif → RunView. Toujours afficher HistoryCard en bas.

### 12. AnomalyEngageModal

Pattern aligné sur `SendFleetOverlay`. Sélecteur de ships (flagship coché par défaut, désactivable non), bouton Engager qui appelle `mutate engage`. Toast au succès.

---

## Tests

**Game-engine** (Vitest pures) : 6-8 tests sur `anomaly*` formulas.

**Service** (Vitest avec mocks DB) :
- `engage` : succès + 4 cas d'erreur (no flagship / no exilium / active / busy)
- `advance` : survived + wiped + pas prêt
- `retreat` : succès, calcul refund/crédit ressources
- `history` : tri + limit

**Frontend** : pas de tests unitaires React (cohérent avec le projet). Smoke test manuel via dev server : engage → wait timer → advance → loop → retreat. Vérif ressources/ships rentrent bien.

---

## Self-review du plan

**Spec coverage** :
- ✅ Trigger 5 Exilium + flagship → tâche 5 (engage)
- ✅ Hull tracking entre nœuds → tâche 4 (combat helper)
- ✅ Scaling difficulté/loot → tâche 3 (formules)
- ✅ Wipe / retreat / advance → tâches 5-7
- ✅ Sidebar dédiée + page conditionnelle → tâches 9-11
- ✅ Edge cases (validation, anomalie active unique, etc.) → tâche 5
- ✅ Migration DB + seed → tâches 1-2

**Placeholder scan** : aucun TBD. Les valeurs concrètes sont dans la spec, référencées ici.

**Type consistency** : `fleet` est `Record<string, { count, hullPercent }>` partout. `loot_*` sont des numeric. `next_node_at` est nullable seulement à la complétion.

**Scope** : V1 est self-contained. V2-V7 sont en backlog spec, hors plan.

---

## Plan complete

Sauvegardé. Vu la commande utilisateur "implémente direct", je passe directement en exécution inline (pas de subagent driven), et je commit/déploie les blocs cohérents au fur et à mesure.
