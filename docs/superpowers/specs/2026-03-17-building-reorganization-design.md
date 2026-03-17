# Réorganisation des bâtiments — Arsenal, Chantier spatial, Centre de commandement

**Date :** 2026-03-17
**Statut :** Validé

## Objectif

Ajouter de la profondeur au gameplay en séparant le Chantier spatial unique en 3 bâtiments spécialisés, chacun débloquant une catégorie d'unités. Migrer vers un stockage dynamique des niveaux de bâtiments (`planetBuildings`) pour permettre l'ajout futur de bâtiments sans migration de schema.

## Nouveaux bâtiments

### Chantier spatial (industriel) — `shipyard`

- **Rôle :** Débloque et accélère la construction des vaisseaux industriels
- **Coût :** 400M, 200S, 100H (facteur 2.0)
- **Prérequis :** Usine de robots niv. 1
- **Note :** Nouveau bâtiment. L'ancien `shipyard` est renommé `commandCenter`.

### Arsenal planétaire — `arsenal`

- **Rôle :** Débloque et accélère la construction des défenses planétaires
- **Coût :** 400M, 200S, 100H (facteur 2.0)
- **Prérequis :** Usine de robots niv. 2

### Centre de commandement — `commandCenter`

- **Rôle :** Débloque et accélère la construction des vaisseaux militaires
- **Coût :** 400M, 200S, 100H (facteur 2.0)
- **Prérequis :** Usine de robots niv. 4 + Chantier spatial niv. 2
- **Note :** C'est le renommage de l'ancien Chantier spatial. Les joueurs existants conservent leur niveau.

## Nouveaux vaisseaux

### Prospecteur — `prospector`

- **Rôle :** Vaisseau de minage early-game
- **Coût :** 1500M, 500S, 0H
- **Prérequis :** Chantier spatial niv. 1 + Réacteur à combustion niv. 1
- **Catégorie :** Vaisseaux industriels
- **Propulsion :** Combustion
- **Stats :**
  - Cargo : 500
  - Vitesse de base : 5000
  - Consommation fuel : 10
  - Armes : 2, Bouclier : 5, Structure : 2000
- **Rapid fire :** Cible de rapid fire 5 depuis tous les vaisseaux de combat (même valeur que la sonde d'espionnage)
- **countColumn :** `'prospector'`

### Explorateur — `explorer`

- **Rôle :** Sonde d'exploration spatiale (missions lointaines, découverte de ressources)
- **Coût :** 0M, 1500S, 0H
- **Prérequis :** Chantier spatial niv. 1 + Réacteur à combustion niv. 1
- **Catégorie :** Vaisseaux industriels
- **Propulsion :** Combustion
- **Stats :**
  - Cargo : 100
  - Vitesse de base : 80000
  - Consommation fuel : 1
  - Armes : 0, Bouclier : 0, Structure : 1000
- **Rapid fire :** Cible de rapid fire 5 depuis tous les vaisseaux de combat (même valeur que la sonde d'espionnage)
- **countColumn :** `'explorer'`

## Réorganisation des prérequis

### Vaisseaux industriels → Chantier spatial (`shipyard`)

| Vaisseau | Niveau requis | Prérequis recherche (inchangés) |
|---|---|---|
| Prospecteur | 1 | combustion niv. 1 |
| Explorateur | 1 | combustion niv. 1 |
| Petit transporteur | 2 | combustion niv. 2 |
| Sonde d'espionnage | 3 | combustion niv. 3 + espionageTech niv. 2 |
| Grand transporteur | 4 | combustion niv. 6 |
| Vaisseau de colonisation | 4 | impulse niv. 3 |
| Recycleur | 4 | combustion niv. 6 + shielding niv. 2 |

### Vaisseaux militaires → Centre de commandement (`commandCenter`)

| Vaisseau | Niveau requis | Prérequis recherche (inchangés) |
|---|---|---|
| Chasseur léger | 1 | combustion niv. 1 |
| Chasseur lourd | 3 | armor niv. 2 + impulse niv. 2 |
| Croiseur | 5 | impulse niv. 4 + weapons niv. 3 |
| Vaisseau de bataille | 7 | hyperspaceDrive niv. 4 |

### Défenses → Arsenal planétaire (`arsenal`)

| Défense | Niveau requis | Prérequis recherche (inchangés) |
|---|---|---|
| Lanceur de missiles | 1 | — |
| Petit bouclier | 1 | shielding niv. 2 |
| Artillerie laser légère | 2 | energyTech niv. 1 |
| Artillerie laser lourde | 4 | energyTech niv. 3 + shielding niv. 1 |
| Grand bouclier | 4 | shielding niv. 6 |
| Canon de Gauss | 6 | energyTech niv. 6 + weapons niv. 3 + shielding niv. 1 |
| Artillerie à ions | 8 | energyTech niv. 8 + weapons niv. 7 |

**Note :** le changement de prérequis du Chantier spatial de robotics niv. 2 → niv. 1 est un changement de balance intentionnel pour rendre les vaisseaux industriels accessibles plus tôt.

## Nouveau modèle de données

### Table `planetBuildings` (nouvelle)

Remplace les colonnes de niveaux en dur sur la table `planets`.

```
planetBuildings:
  - planetId    (FK → planets, partie de la PK composite)
  - buildingId  (text, référence buildingDefinitions.id, partie de la PK composite)
  - level       (smallint, default 0)
  PK: (planetId, buildingId)
```

### Colonnes supprimées de `planets`

Toutes les colonnes `*Level` sont supprimées :
- `mineraiMineLevel`, `siliciumMineLevel`, `hydrogeneSynthLevel`
- `solarPlantLevel`, `roboticsLevel`, `shipyardLevel`
- `researchLabLevel`, `storageMineraiLevel`, `storageSiliciumLevel`, `storageHydrogeneLevel`

### Champ supprimé de `buildingDefinitions`

- `levelColumn` — n'a plus de raison d'être puisque les niveaux sont dans `planetBuildings`, identifiés par `buildingId`. Tout le code qui lisait `def.levelColumn` doit utiliser un lookup `planetBuildings` par `(planetId, def.id)`.

### Champs ajoutés à `buildingDefinitions`

- `buildTimeReductionFactor` (numeric, nullable) — Facteur de réduction du temps de construction pour la catégorie associée. Null = le bâtiment ne réduit pas de temps.
- `reducesTimeForCategory` (FK → entityCategories.id, nullable) — La catégorie dont ce bâtiment réduit le temps de construction.

### Colonnes ajoutées à `planetShips`

- `prospector` (integer, default 0) — Nombre de prospecteurs sur la planète
- `explorer` (integer, default 0) — Nombre d'explorateurs sur la planète

### Nouvelles catégories d'entités

Les catégories existantes (`ship_combat`, `ship_transport`, `ship_utilitaire`, `defense_tourelles`, `defense_boucliers`) sont **conservées** pour le groupement UI.

On ajoute 3 nouvelles catégories dédiées à la réduction de temps de construction (entityType: `'build'`) :
- `build_industrial` ("Vaisseaux industriels", entityType: `'build'`) — assignée au Chantier spatial via `reducesTimeForCategory`
- `build_military` ("Vaisseaux militaires", entityType: `'build'`) — assignée au Centre de commandement via `reducesTimeForCategory`
- `build_defense` ("Défenses", entityType: `'build'`) — assignée à l'Arsenal planétaire via `reducesTimeForCategory`

Chaque vaisseau/défense reçoit un **second tag** `buildCategory` sur `shipDefinitions`/`defenseDefinitions` (nouveau champ nullable FK → entityCategories) qui indique quelle catégorie de construction s'applique. Cela permet de garder le `categoryId` existant pour l'affichage UI et d'avoir un `buildCategory` séparé pour le calcul de temps.

**Alternative plus simple :** plutôt qu'un second champ, on peut déduire le `buildCategory` depuis les prérequis de bâtiment (si le vaisseau requiert `shipyard` → industriel, si `commandCenter` → militaire, si la défense requiert `arsenal` → défense). Cela évite un champ supplémentaire mais couple la logique aux prérequis.

**Choix retenu :** Déduction depuis les prérequis. Pas de nouveau champ `buildCategory`. Le code identifie le bâtiment de production d'un vaisseau/défense en regardant son prérequis de bâtiment principal, puis récupère le `buildTimeReductionFactor` de ce bâtiment.

## Temps de construction

### Formule

```
seconds = ((costMinerai + costSilicium) / (2500 × (1 + buildingLevel × reductionFactor))) × 3600
```

Avec un minimum de 1 seconde.

- **Vaisseaux industriels** : `buildingLevel` = niveau du Chantier spatial, `reductionFactor` = son `buildTimeReductionFactor`
- **Vaisseaux militaires** : `buildingLevel` = niveau du Centre de commandement, `reductionFactor` = son `buildTimeReductionFactor`
- **Défenses** : `buildingLevel` = niveau de l'Arsenal planétaire, `reductionFactor` = son `buildTimeReductionFactor`
- **Bâtiments** : niveau de l'Usine de robots (inchangé, reductionFactor = 1)

Les `buildTimeReductionFactor` sont configurables depuis le panneau admin (valeur par défaut : 1.0).

## Helper de niveaux de bâtiments

Créer une fonction utilitaire `getBuildingLevels(planetId)` qui retourne un `Record<string, number>` (buildingId → level) depuis la table `planetBuildings`. Exemple de retour : `{ mineraiMine: 5, shipyard: 2, commandCenter: 7 }`.

**Changement de convention de clé :** actuellement le code utilise `buildingId + 'Level'` comme clé (ex: `shipyardLevel`). Avec le nouveau helper, les clés sont les `buildingId` directement (ex: `shipyard`). Ce changement impacte :
- `prerequisites.ts` : `req.buildingId + 'Level'` → `req.buildingId`
- `ranking.ts` : `levels[def.levelColumn]` → `levels[def.id]`, le type `BuildingDef` doit remplacer `levelColumn` par `id`
- Tous les appelants dans les services qui construisent le dict `buildingLevels`

Services consommateurs :
- `resource.service.ts` (production, stockage)
- `building.service.ts` (prérequis, slots, **completeUpgrade** — doit écrire dans `planetBuildings` au lieu de `planets[levelColumn]`)
- `shipyard.service.ts` (prérequis, temps de construction)
- `ranking.service.ts` (calcul de points)
- `game-config.service.ts` (admin — supprimer `levelColumn` des types `BuildingConfig`, `createBuilding`, `updateBuilding`, `getFullConfig`)
- Formules du game-engine (reçoivent le `Record` en paramètre)

### Calcul des slots de construction

Le calcul actuel somme les colonnes `*Level`. Il doit être remplacé par un `SUM(level)` sur toutes les lignes de `planetBuildings` pour la planète.

## Migration des données existantes

### Prérequis de déploiement

**IMPORTANT :** Avant de lancer la migration :
1. **Arrêter le worker** (`pm2 stop ogame-worker`) pour qu'aucun job de build queue ne s'exécute pendant la migration
2. **Attendre** que les jobs en cours terminent (vérifier la build queue)
3. Lancer la migration
4. **Redémarrer** le worker avec le code mis à jour

### Étapes de migration

**Étape 1 — Renommer l'ancien shipyard en commandCenter :**
- UPDATE `buildingDefinitions` SET `id` = 'commandCenter', `name` = 'Centre de commandement' WHERE `id` = 'shipyard'
- UPDATE `buildingPrerequisites` SET `requiredBuildingId` = 'commandCenter' WHERE `requiredBuildingId` = 'shipyard'
- UPDATE `shipPrerequisites` SET `requiredBuildingId` = 'commandCenter' WHERE `requiredBuildingId` = 'shipyard'
- UPDATE `defensePrerequisites` SET `requiredBuildingId` = 'commandCenter' WHERE `requiredBuildingId` = 'shipyard'
- UPDATE `researchPrerequisites` SET `requiredBuildingId` = 'commandCenter' WHERE `requiredBuildingId` = 'shipyard'
- UPDATE `buildQueue` SET `itemId` = 'commandCenter' WHERE `itemId` = 'shipyard' AND `type` = 'building'

**Étape 2 — Créer la table `planetBuildings` :**
- CREATE TABLE avec PK composite `(planetId, buildingId)`

**Étape 3 — Migrer les données depuis les colonnes `planets` :**
- Pour chaque planète, INSERT INTO `planetBuildings` une ligne par bâtiment :
  - `mineraiMine` ← `mineraiMineLevel`
  - `siliciumMine` ← `siliciumMineLevel`
  - `hydrogeneSynth` ← `hydrogeneSynthLevel`
  - `solarPlant` ← `solarPlantLevel`
  - `robotics` ← `roboticsLevel`
  - `commandCenter` ← `shipyardLevel` (ancien shipyard, maintenant renommé)
  - `researchLab` ← `researchLabLevel`
  - `storageMinerai` ← `storageMineraiLevel`
  - `storageSilicium` ← `storageSiliciumLevel`
  - `storageHydrogene` ← `storageHydrogeneLevel`

**Étape 3b — Supprimer `levelColumn` de `buildingDefinitions` :**
- ALTER TABLE `buildingDefinitions` DROP COLUMN `levelColumn`
- Note : cette colonne est `NOT NULL`, il faut la supprimer avant d'insérer les nouveaux bâtiments (qui n'auraient pas de valeur pertinente pour ce champ)

**Étape 4 — Créer les nouveaux bâtiments :**
- INSERT le nouveau `shipyard` (industriel, countColumn: `'shipyard'`) et `arsenal` (countColumn: `'arsenal'`) dans `buildingDefinitions`
- INSERT dans `planetBuildings` avec level 0 pour toutes les planètes existantes

**Étape 5 — Mettre à jour les prérequis des vaisseaux/défenses :**
- Réaffecter les prérequis des vaisseaux industriels vers `shipyard` (nouveau)
- Garder les prérequis des vaisseaux militaires sur `commandCenter`
- Réaffecter les prérequis des défenses vers `arsenal`

**Étape 6 — Nettoyer :**
- Supprimer les colonnes `*Level` de la table `planets`
- Ajouter les champs `buildTimeReductionFactor` et `reducesTimeForCategory` à `buildingDefinitions`
- Ajouter les colonnes `prospector` (integer default 0) et `explorer` (integer default 0) à `planetShips`

**Note :** `researchDefinitions.levelColumn` n'est PAS supprimé — les recherches restent stockées dans `userResearch` avec leur propre convention.

**Toute la migration doit être exécutée dans une seule transaction SQL** pour garantir la cohérence en cas d'échec partiel.

### Rétrocompatibilité joueurs existants

Les prérequis ne sont vérifiés qu'au moment de lancer une nouvelle construction. Les joueurs existants avec un Centre de commandement de haut niveau ne sont pas bloqués rétroactivement — ils devront simplement construire le nouveau Chantier spatial niv. 2 avant de pouvoir améliorer davantage leur Centre de commandement.

## Impact sur le code

### Backend (API)

- **Tous les services** : remplacer `planet.xxxLevel` par le helper `getBuildingLevels(planetId)` → `Record<string, number>`
- **`shipyard.service.ts`** : identifier le bâtiment de production depuis les prérequis, appliquer son `buildTimeReductionFactor`
- **`building.service.ts`** : lire/écrire dans `planetBuildings`, calcul des slots via `SUM(level)`
- **`resource.service.ts`** : adapter pour recevoir un `Record<string, number>` au lieu de lire `planet.*Level`
- **Prérequis** : adapter `checkShipPrerequisites`, `checkDefensePrerequisites` — changer la convention de clé de `buildingId + 'Level'` vers `buildingId` directement

### Game Engine

- **`formulas/production.ts`** : accepter des niveaux en paramètres (`mineLevel`, `plantLevel`, etc.) au lieu d'un objet planet
- **`formulas/shipyard-cost.ts`** : nouvelle formule de temps avec `buildTimeReductionFactor`
- **Constantes** : ajouter Prospecteur et Explorateur dans `ships.ts`, ajouter Arsenal et Centre de commandement dans `buildings.ts`
- **Rapid fire** : ajouter les entrées pour Prospecteur et Explorateur — rapid fire 5 depuis tous les vaisseaux de combat (même valeur que la sonde d'espionnage)
- **`ranking.ts`** : remplacer `levels[def.levelColumn]` par `levels[def.id]`, adapter le type `BuildingDef`

### Frontend Web

- Toutes les pages qui lisent des niveaux de bâtiments passent par la nouvelle structure retournée par l'API
- Barre de ressources, pages Buildings, Shipyard, Defense

### Frontend Admin

- Page Buildings : ajouter les champs `buildTimeReductionFactor` et `reducesTimeForCategory`
- Seed : mettre à jour avec les nouveaux bâtiments, vaisseaux, catégories et prérequis réorganisés

## Considérations futures

- **Table dynamique pour les vaisseaux/défenses** : Le même pattern `planetShips`/`planetDefenses` avec colonnes en dur pourrait être migré vers des tables dynamiques `(planetId, shipId, count)` dans une future itération, pour éviter des migrations à chaque nouveau vaisseau.
- **Missions de minage et d'exploration** : Les mécaniques de gameplay du Prospecteur (minage) et de l'Explorateur (exploration lointaine) seront spécifiées dans un design séparé.
