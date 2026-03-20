# Scories & Raffinage en espace lointain

## Objectif

Ajouter un système de scories au minage pour nerfer un gameplay trop rémunérateur. Les scories occupent de la place dans la cargaison ET le gisement perd le montant brut (avant réduction). Une nouvelle technologie "Raffinage en espace lointain" permet de réduire progressivement le taux de scories.

## Mécanique des scories

### Principe

Lors d'une mission de minage, un pourcentage de la cargaison est constitué de scories (déchets inutiles). Cela a un double impact :

1. **Cargo** : la capacité cargo utile est réduite par le taux de scories
2. **Gisement** : le gisement perd le montant brut (incluant les scories), s'épuisant plus vite

### Formules

```
slagRate = baseSlagRate × (1 - 0.15)^refiningLevel
effectiveCargo = cargoCapacity × (1 - slagRate)
extracted = min(baseExtraction × nbProspectors, effectiveCargo, depositRemaining)
depositLoss = extracted / (1 - slagRate)
playerReceives = extracted
```

- `baseSlagRate` : taux de base, variable selon position et ressource (stocké en DB)
- `refiningLevel` : niveau de la tech "Raffinage en espace lointain"
- `depositLoss` : ce que le gisement perd (toujours >= playerReceives)

### Taux de base (configurables en DB)

| Ressource  | Position 8 (proche) | Position 16 (lointain) |
|------------|---------------------|------------------------|
| Minerai    | 35%                 | 20%                    |
| Silicium   | 30%                 | 15%                    |
| Hydrogene  | 20%                 | 10%                    |

Logique :
- Les gisements lointains (pos 16) sont plus purs, compensant le trajet plus long
- L'hydrogene (gaz) produit moins de déchets solides que les minerais

## Tech "Raffinage en espace lointain"

### Définition

```
id: 'deepSpaceRefining'
name: 'Raffinage en espace lointain'
description: 'Développe des techniques de raffinage embarquées qui réduisent les scories lors de l extraction minière'
baseCost: { minerai: 2000, silicium: 4000, hydrogene: 1000 }
costFactor: 2
maxLevel: 15
prerequisites:
  - rockFracturing niveau 2
  - missionCenter niveau 2
```

### Bonus

```
sourceType: 'research'
sourceId: 'deepSpaceRefining'
stat: 'slag_rate'
percentPerLevel: -15
category: null
```

### Progression (exemple avec 30% de base)

| Niveau | Scories restantes | Cargo utile (sur 10k) |
|--------|-------------------|-----------------------|
| 0      | 30.0%             | 7 000                 |
| 3      | 18.4%             | 8 160                 |
| 6      | 11.3%             | 8 870                 |
| 10     | 5.9%              | 9 410                 |
| 15     | 2.5%              | 9 750                 |

Réduction multiplicative : chaque niveau réduit les scories restantes de 15%. A niveau 15, les scories sont négligeables (~2.5%).

## Stockage en DB

Toutes les valeurs sont configurables via la table `game_config` existante. Aucune valeur hardcodée dans le game-engine.

### Nouvelles entrées game_config

```
slag_rate.pos8.minerai = 0.35
slag_rate.pos8.silicium = 0.30
slag_rate.pos8.hydrogene = 0.20
slag_rate.pos16.minerai = 0.20
slag_rate.pos16.silicium = 0.15
slag_rate.pos16.hydrogene = 0.10
```

La tech `deepSpaceRefining` et son bonus suivent le même format que les recherches et bonus existants.

## Points d'impact dans le code

### Game-engine (`packages/game-engine`)

- `formulas/pve.ts` : nouvelle fonction `effectiveCargoCapacity(cargo, slagRates, refiningLevel, position)` et modification de `totalExtracted` pour retourner `{ playerReceives, depositLoss }`
- `constants/research.ts` : ajout de la définition `deepSpaceRefining`

### API (`apps/api`)

- `modules/fleet/handlers/mine.handler.ts` : brancher les nouvelles formules lors de la phase mining, utiliser `effectiveCargo` pour le joueur et `depositLoss` pour la déduction du gisement
- `modules/pve/asteroid-belt.service.ts` : la déduction du gisement utilise `depositLoss` au lieu de `extracted`

### DB (`packages/db`)

- `seed-game-config.ts` : ajouter les entrées `slag_rate.*`, la recherche `deepSpaceRefining`, et le bonus associé
- Pas de migration de schéma nécessaire (utilisation de `game_config` et `bonus` existants)

### Shared (`packages/shared`)

- Ajouter `'deepSpaceRefining'` au type `ResearchId`

### Frontend (`apps/web`)

- Afficher le cargo utile vs cargo total dans l'UI de lancement de mission mine
- Afficher les scories dans le rapport de retour de mission
