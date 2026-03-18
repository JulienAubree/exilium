# Refonte du système de minage — Phases multiples + Technologie de fracturation

**Date** : 2026-03-18

## Problème

Le minage actuel est trop simpliste : la flotte arrive, extrait instantanément, puis attend une durée fixe avant de repartir. Il n'y a pas de phase de recherche d'astéroïdes (prospection) ni de technologie permettant d'optimiser l'extraction. Le prospecteur vient d'être nerfé à 750 de fret, ce qui renforce le besoin de rendre le minage plus stratégique.

## Solution

### 1. Mission de minage en 4 phases

La mission passe de 2 phases (transport + extraction) à 4 phases séquentielles :

```
[Envoi] ──transport──> [Arrivée] ──prospection──> [Prospecté] ──minage──> [Extrait] ──transport──> [Retour]
```

| Phase | Champ `phase` DB | Description | Durée |
|-------|-----------------|-------------|-------|
| Transport aller | `outbound` | Voyage vers la ceinture | Formule de distance existante |
| Prospection | `prospecting` | Recherche des bons astéroïdes | `5 + floor(depositQuantity / 10000) × 2` minutes |
| Minage | `mining` | Extraction des ressources | `max(5, 16 - centerLevel) × max(0.2, 1 - 0.1 × fracturingLevel)` minutes |
| Transport retour | `return` | Retour avec le chargement | Même durée que l'aller |

#### Durée de prospection

Basée sur la richesse du gisement (`totalQuantity` du dépôt dans `asteroid_deposits`, fixée à la création — ne change pas même si le dépôt est partiellement miné) :

```
prospectionDuration(depositQuantity) = 5 + floor(depositQuantity / 10000) × 2  (en minutes)
```

| Quantité gisement | Durée prospection |
|-------------------|-------------------|
| 20 000 | 9 min |
| 40 000 | 13 min |
| 60 000 | 17 min |
| 80 000 | 21 min |

#### Durée de minage

Formule de base existante modifiée par la technologie de fracturation :

```
miningDuration(centerLevel, fracturingLevel) = max(5, 16 - centerLevel) × max(0.2, 1 - 0.1 × fracturingLevel)
```

| Center Level | Base (fract. 0) | Fract. 3 | Fract. 5 | Fract. 8 |
|-------------|----------------|----------|----------|----------|
| 1 | 15 min | 10.5 min | 7.5 min | 3 min |
| 3 | 13 min | 9.1 min | 6.5 min | 2.6 min |
| 5 | 11 min | 7.7 min | 5.5 min | 2.2 min |
| 7 | 9 min | 6.3 min | 4.5 min | 1.8 min |
| 11+ | 5 min | 3.5 min | 2.5 min | 1 min |

### 2. Technologie « Fracturation des roches »

Nouvelle recherche ajoutée au système existant :

| Champ | Valeur |
|-------|--------|
| ID | `rockFracturing` |
| Nom | Technologie de fracturation des roches |
| Description | Améliore les techniques d'extraction minière, réduisant le temps de minage. |
| Coût de base | 2000 minerai, 4000 silicium, 1000 hydrogène |
| Facteur de coût | 2.0 |
| Prérequis | `missionCenter` niv. 1, recherche `combustion` niv. 3 |
| Effet | Réduit la durée de minage de 10% par niveau (plancher 20% = level 8 max utile) |

Suit le pattern exact de `ResearchDefinition` dans `research.ts` (id, name, description, baseCost, costFactor, prerequisites). Le temps de recherche est calculé dynamiquement par la formule existante `researchTime()`.

**Colonne DB** : ajouter `rockFracturing smallint DEFAULT 0` dans `user_research` (même pattern que les autres recherches).

### 3. Formule d'extraction (inchangée)

```
extracted = min(baseExtraction × effectiveProspectors, fleetCargoCapacity, depositRemaining)
baseExtraction(centerLevel) = 2000 + 800 × (centerLevel - 1)
effectiveProspectors = min(prospectorCount, 10)
```

Le calcul d'extraction se fait à la fin de la phase de minage (pas à l'arrivée comme avant).

### 4. Chaînage des jobs BullMQ

Les jobs `fleet-prospect-done` et `fleet-mine-done` sont des **noms de jobs dans la queue `fleet-arrival` existante** (pas de nouvelles queues). Le worker `fleet-arrival` dispatch sur le nom du job.

```
sendFleet()
  └─ fleetArrivalQueue.add('arrive', { fleetEventId }, { delay: travelTime })

processArrival() [mine mission]
  ├─ phase: outbound → prospecting
  ├─ departureTime = now, arrivalTime = now + prospectionDuration
  └─ fleetArrivalQueue.add('prospect-done', { fleetEventId }, { delay: prospectionDuration })

processProspectDone()
  ├─ phase: prospecting → mining
  ├─ departureTime = now, arrivalTime = now + miningDuration
  └─ fleetArrivalQueue.add('mine-done', { fleetEventId }, { delay: miningDuration })

processMineDone()
  ├─ calcul extraction (formule existante)
  ├─ extractFromDeposit()
  ├─ phase: mining → return
  ├─ departureTime = now, arrivalTime = now + travelTime
  ├─ pve mission → completed
  └─ fleetReturnQueue.add('return', { fleetEventId }, { delay: travelTime })

processReturn() [inchangé]
  ├─ livrer ressources sur planète
  └─ fleet event → completed
```

**Important** : `departureTime` est mis à jour à chaque transition de phase pour que le rappel puisse calculer le temps écoulé dans la phase courante (`now - departureTime`).

### 5. Rappel de flotte

Le rappel est possible pendant les phases `outbound`, `prospecting` et `mining` :
- La flotte rentre à vide (pas de ressources extraites)
- La mission PvE est remise en `available`
- Temps de retour = `now - departureTime` (temps écoulé dans la phase courante)
- `departureTime` étant mis à jour à chaque transition de phase (voir section 4), ce calcul fonctionne identiquement quelle que soit la phase
- **Annulation du job en cours** : annuler le job BullMQ pending pour cet événement (`arrive`, `prospect-done` ou `mine-done` selon la phase) avant de planifier le retour

**Backend** : modifier `recallFleet()` dans `fleet.service.ts` (ligne 271) pour accepter `phase IN ('outbound', 'prospecting', 'mining')` au lieu de `phase = 'outbound'` uniquement.

**Frontend** : le bouton « Rappeler » dans `Movements.tsx` (ligne 101) doit être visible pour les phases `outbound`, `prospecting` et `mining` (actuellement seulement `outbound`).

### 6. Schema DB

#### Extension de l'enum `phase` (`fleet-events.ts`)

```ts
export const fleetPhaseEnum = pgEnum('fleet_phase', ['outbound', 'prospecting', 'mining', 'return']);
```

Migration SQL :
```sql
ALTER TYPE fleet_phase ADD VALUE 'prospecting';
ALTER TYPE fleet_phase ADD VALUE 'mining';
```

#### Nouvelle colonne `user_research` (`user-research.ts`)

```ts
rockFracturing: smallint('rock_fracturing').notNull().default(0),
```

Migration SQL :
```sql
ALTER TABLE user_research ADD COLUMN rock_fracturing smallint NOT NULL DEFAULT 0;
```

### 7. Frontend

#### Libellés de phase dans les mouvements de flotte

| Phase | Libellé affiché |
|-------|----------------|
| `outbound` | En route vers [coords] |
| `prospecting` | Prospection en cours sur [coords] |
| `mining` | Extraction en cours sur [coords] |
| `return` | En route vers [planète d'origine] |

Le countdown existant fonctionne déjà car `arrivalTime` est mis à jour à chaque transition de phase. Seul le libellé change selon la valeur de `phase`.

#### Recherche fracturation

Affichée dans la page Recherche, comme les autres technologies. Même pattern UI.

## Fichiers impactés

| Fichier | Modification |
|---------|-------------|
| `packages/game-engine/src/constants/research.ts` | Ajouter `rockFracturing` |
| `packages/game-engine/src/formulas/pve.ts` | Ajouter `prospectionDuration()`, modifier `miningDuration()` (anciennement `extractionDuration`) |
| `packages/db/src/schema/fleet-events.ts` | Étendre l'enum `phase` avec `prospecting` et `mining` |
| `packages/shared/src/types/missions.ts` | Étendre `FleetPhase` avec `Prospecting` et `Mining` |
| `apps/api/src/modules/fleet/fleet.service.ts` | Refactorer `processArrival` pour mine, ajouter `processProspectDone` et `processMineDone` |
| `packages/db/src/schema/user-research.ts` | Ajouter colonne `rockFracturing` |
| `apps/api/src/workers/fleet-arrival.worker.ts` | Dispatch sur job name (`arrive`, `prospect-done`, `mine-done`) |
| `apps/web/src/pages/Movements.tsx` | Libellés de phase + bouton rappel pour `prospecting`/`mining` |
| `apps/web/src/pages/Research.tsx` (ou équivalent) | Afficher la nouvelle recherche |

## Ce qui ne change PAS

- Formule d'extraction (baseExtraction × prospectors, cappé par cargo et dépôt)
- Génération des missions PvE et gisements
- Page Missions (initiation d'une mission de minage)
- Système de déplétion/régénération des gisements
- Flotte mixte autorisée pour le minage (prospecteurs + cargos)
