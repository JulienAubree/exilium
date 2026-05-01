# Anomalie V3 — Plan d'implémentation

**Spec :** `docs/superpowers/specs/2026-05-01-anomaly-events-v3-design.md`

**Stack :** Drizzle/Postgres, tRPC, React+Tailwind, vitest. Mêmes patterns que la V1.

**Architecture :** événements stockés dans `anomaly_content.events` (jsonb existant, schéma à étendre). État de run dans 5 nouvelles colonnes sur `anomalies`. Engine pure dans `@exilium/game-engine` pour la sélection + l'application d'outcome. Service `anomaly-content` reste lecture seule côté run, écriture côté admin.

---

## Tâche 1 : Migration DB + schémas Drizzle

**Fichiers :**
- Créer : `packages/db/drizzle/0067_anomaly_events.sql`
- Modifier : `packages/db/src/schema/anomalies.ts`

Ajouter 5 colonnes : `next_node_type` (varchar(8) default 'combat'), `next_event_id` (varchar(40)), `seen_event_ids` (jsonb default '[]'), `combats_until_next_event` (smallint default 3), `event_log` (jsonb default '[]').

## Tâche 2 : Étendre `eventEntrySchema`

**Fichier :** `apps/api/src/modules/anomaly-content/anomaly-content.types.ts`

Ajouter `tier`, `enabled`, `choices` (avec `label`, `hidden`, `outcome`, `resolutionText`). Construire `outcomeSchema` complet (resources, exilium, hullDelta, shipsGain, shipsLoss). Garde-fou : `flagship` interdit dans shipsGain/shipsLoss.

Garder rétrocompat : les events existants (vide pour l'instant) avec ancien schéma sont validés par le `safeParse` qui retombera sur DEFAULT.

## Tâche 3 : Engine pur — `anomaly-events.ts`

**Fichier :** `packages/game-engine/src/formulas/anomaly-events.ts` + `.test.ts`

Fonctions pures :
- `tierForDepth(depth: number): 'early' | 'mid' | 'deep'`
- `pickEventGap(rng: () => number): 2 | 3 | 4` — uniforme
- `pickEventForTier(events, tier, seenIds, rng)` — retourne un event ou null
- `applyOutcomeToFleet(fleet, outcome)` — pure, retourne `{ fleet, lootDeltas, exiliumDelta }` clamped

Tests : distribution `pickEventGap`, application hull (clamp 0.01-1), ship gain (hull pondéré), ship loss (suppression à 0), tier mapping.

## Tâche 4 : Seed des 30 events dans `DEFAULT_ANOMALY_CONTENT`

**Fichier :** `apps/api/src/modules/anomaly-content/anomaly-content.types.ts`

10 events par tier, écrits en français, ton Exilium. Chaque event : id stable, title, description (2-4 phrases), 2-3 choices avec outcomes ponctuels variés. Pas d'images (l'admin uploadera).

## Tâche 5 : `resolveEvent` dans `anomaly.service.ts`

**Fichier :** `apps/api/src/modules/anomaly/anomaly.service.ts`

Nouvelle méthode `resolveEvent(userId, choiceIndex)`. Transaction + advisory lock + SELECT FOR UPDATE. Charge `anomalyContent.events`, applique outcome via engine, push event_log + seen_event_ids, prépare combat suivant (génère enemy preview), set nextNodeAt+2min. Erreurs explicites pour les cas dégradés.

Modifier `advance()` : après combat résolu, décrémenter `combatsUntilNextEvent`, décider `nextNodeType` (event vs combat), pré-charger l'event si tirage. Si event tiré, rerollover `combatsUntilNextEvent` pour APRÈS l'event.

Modifier `engage()` : initialiser `combatsUntilNextEvent = pickEventGap()`, `nextNodeType = 'combat'`.

## Tâche 6 : Router tRPC

**Fichier :** `apps/api/src/modules/anomaly/anomaly.router.ts`

Ajouter `resolveEvent` mutation avec input `{ choiceIndex: number }`. Le `current` query renvoie déjà tous les champs SELECT `*` → les 5 nouveaux passent automatiquement.

## Tâche 7 : Tests service

**Fichier :** `apps/api/src/modules/anomaly/__tests__/anomaly.events.test.ts` (nouveau)

3-4 tests minimum :
- resolveEvent applique outcome + prépare combat
- resolveEvent rejette `nextNodeType !== 'event'`
- resolveEvent fallback si event id supprimé du content
- advance() pré-charge un event quand le compteur tombe à 0

## Tâche 8 : UI joueur — adaptation `RunView`

**Fichier :** `apps/web/src/pages/Anomaly.tsx`

Lire `nextNodeType`. Si `combat` → rendu actuel inchangé. Si `event` → carte event (image + titre + description + boutons de choix). Choix visibles affichent leur outcome inline ; choix cachés affichent `???`. Choix cachés → modal de confirmation. Choix visibles → exécution directe.

Toast en sortie : "Vous avez résolu : [resolutionText]" + delta affichés.

## Tâche 9 : UI joueur — `EventLog` compact

**Fichier :** `apps/web/src/components/anomaly/AnomalyEventLog.tsx` (nouveau)

Liste compacte des events résolus pendant la run, sous le bloc Loot. Une ligne par event.

## Tâche 10 : UI admin — éditeur d'events

**Fichier :** `apps/admin/src/pages/Anomalies.tsx` (étendu)

Remplacer le placeholder V3 par l'éditeur réel :
- Liste groupée par tier (3 sections collapsibles)
- Add event → ajoute une entrée vide
- Chaque event : image slot, toggle enabled, radio tier, title, description, liste de choix (add/remove, max 3, min 2)
- Chaque choix : label, hidden toggle, outcome inputs (3 ressources, exilium, hull%, ship gain dropdown+count, ship loss dropdown+count), resolution textarea

Le composant est volumineux mais reste un fichier plat (cohérent avec `Homepage.tsx`).

## Tâche 11 : Lint + tests + commit + deploy

Run `pnpm turbo lint typecheck test`. 0 errors. Commit cohérent. Push. `/opt/exilium/scripts/deploy.sh` (la migration s'applique en prod via `apply-migrations.sh`).

---

## Notes d'exécution

- Les events resolution n'utilisent PAS `mission_reports` : juste un toast + event log inline. Pas de noeud rapport supplémentaire à créer.
- Pas de notification SSE/push pour les events (le joueur est sur la page).
- Pas de modification de `flagship.service.ts` : les events n'affectent pas le flagship state machine.
- Le seed code-side des 30 events est la source de vérité au premier déploiement. L'admin overwrite via `update`. Reset re-applique le seed.
