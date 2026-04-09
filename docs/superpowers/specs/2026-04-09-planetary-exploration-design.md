# Systeme d'exploration planetaire

## Contexte

Le systeme de biomes est en place : chaque planete colonisee a un biome majeur (type de planete) et des biomes mineurs avec des bonus reels sur la production. Actuellement, les biomes des positions vides sont visibles immediatement dans la vue galaxie via generation deterministe.

L'objectif est de cacher les biomes par defaut et d'ajouter un gameplay d'exploration : le joueur doit envoyer des vaisseaux d'exploration pour decouvrir progressivement les biomes d'une position avant de decider s'il veut la coloniser.

## Principes de conception

- Les biomes des positions vides sont **caches par defaut**
- Il faut envoyer des vaisseaux d'exploration pour decouvrir les biomes un par un
- La decouverte est **probabiliste** : chaque biome a une chance d'etre revele par mission
- Les biomes rares sont plus difficiles a decouvrir que les communs
- Plus on envoie de vaisseaux et plus la recherche est elevee, plus les chances augmentent
- Les decouvertes sont **par joueur** (pas partagees entre joueurs)
- A la colonisation, tous les biomes sont automatiquement reveles
- Les planetes deja colonisees gardent leurs biomes visibles (pas de reset)

## Nouvelle recherche : Exploration planetaire

| Champ | Valeur |
|-------|--------|
| id | `planetary_exploration` |
| name | Exploration planetaire |
| description | Permet d'explorer les planetes pour decouvrir leurs biomes. Chaque niveau augmente les chances de decouverte. |
| Niveaux | illimite |
| Prerequis | A definir (recherche mid-game existante) |
| Effet niveau 1 | Debloque la construction du vaisseau Explorateur |
| Effet par niveau | Augmente `researchFactor` dans la formule de decouverte |

## Nouveau vaisseau : Explorateur

| Champ | Valeur |
|-------|--------|
| id | `explorer` |
| name | Explorateur |
| role | `exploration` |
| Prerequis | Exploration planetaire niv. 1 + Chantier spatial niv. 3 |
| Cout | ~3000 minerai, ~2000 silicium, ~500 hydrogene |
| Temps de construction | ~45 min (base) |
| Vitesse | 8000 (moyenne, entre petit cargo et sonde) |
| Cargo | 0 |
| Consommation fuel | faible |
| Combat | 0 armes, 0 bouclier, hull minimal |
| Stationnaire | non (revient apres la mission) |

Non-combattant, accessible mid-game. Le joueur en envoie plusieurs par mission pour augmenter ses chances.

## Mission "explore"

### Deroulement

1. Le joueur envoie N explorateurs vers une **position vide** non colonisee
2. **Phase aller** : duree de trajet classique (distance + vitesse)
3. **Phase scan** : a l'arrivee, les vaisseaux restent en orbite pendant une duree de scan
4. **Resolution** : chaque biome non encore decouvert est teste individuellement (formule ci-dessous)
5. **Phase retour** : les vaisseaux rentrent, un rapport d'exploration est genere

### Duree de scan

```
dureeScan = baseDuration / (1 + recherche * 0.1)
```

| Parametre | Valeur |
|-----------|--------|
| baseDuration | 1800 secondes (30 minutes) |
| recherche niv. 1 | 1636s (~27 min) |
| recherche niv. 5 | 1200s (20 min) |
| recherche niv. 10 | 900s (15 min) |

### Contraintes de la mission

- Seules les positions vides (non colonisees) peuvent etre explorees
- Seuls les vaisseaux avec role `exploration` sont autorises (+ flagship)
- Les vaisseaux ne sont pas consommes, ils reviennent
- La mission est de type `explore` avec son propre `ExploreHandler`

## Formule de decouverte

Pour chaque biome non decouvert sur la position :

```
probabilite = min(0.95, baseChance * shipFactor * researchFactor / rarityPenalty)
```

### Parametres

| Parametre | Formule | Description |
|-----------|---------|-------------|
| baseChance | 0.20 | 20% de chance de base |
| shipFactor | `1 + (nbVaisseaux - 1) * 0.35` | Bonus par vaisseau supplementaire |
| researchFactor | `1 + recherche * 0.12` | Bonus par niveau de recherche |
| rarityPenalty | voir table | Diviseur selon la rarete du biome |
| Cap | 0.95 | Maximum 95% |

### Penalite de rarete

| Rarete | Penalite |
|--------|----------|
| common | 1 |
| uncommon | 1.8 |
| rare | 3 |
| epic | 5 |
| legendary | 8 |

### Exemples

| Scenario | Commun | Peu commun | Rare | Epique | Legendaire |
|----------|--------|------------|------|--------|------------|
| 1 vaisseau, rech. 1 | 22% | 12% | 7% | 4% | 3% |
| 3 vaisseaux, rech. 3 | 52% | 29% | 17% | 10% | 7% |
| 5 vaisseaux, rech. 5 | 82% | 46% | 27% | 16% | 10% |
| 5 vaisseaux, rech. 10 | 95% | 68% | 41% | 24% | 15% |
| 10 vaisseaux, rech. 10 | 95% | 95% | 75% | 45% | 28% |

Un biome legendaire necessite de la perseverance : 3% par mission au depart, et meme avec un investissement massif (10 vaisseaux, rech. 10), seulement 28% par tentative.

## Persistance des decouvertes

### Table `discovered_biomes`

| Champ | Type | Description |
|-------|------|-------------|
| userId | UUID (FK) | Le joueur qui a decouvert |
| galaxy | smallint | Coordonnees de la position |
| system | smallint | Coordonnees de la position |
| position | smallint | Coordonnees de la position |
| biomeId | string (FK) | Le biome decouvert |

Cle primaire composite : `(userId, galaxy, system, position, biomeId)`

Les decouvertes sont par joueur. Chaque joueur doit explorer pour lui-meme.

## Rapport de mission

Le rapport d'exploration affiche :

- Coordonnees explorees
- Nombre de vaisseaux envoyes
- Nombre de biomes decouverts cette mission
- Liste des biomes decouverts (nom, rarete, effets)
- Nombre de biomes restants non decouverts (sans reveler lesquels)

## Impact sur la vue galaxie

### Positions vides

| Etat | Affichage |
|------|-----------|
| Non exploree | Type de planete + "? biomes" (pas de detail) |
| Partiellement exploree | Biomes decouverts affiches + "X biomes restants" |
| Entierement exploree | Tous les biomes affiches |

### Planetes colonisees

| Propriete | Affichage |
|-----------|-----------|
| Ses propres planetes | Tous les biomes visibles (reveles a la colonisation) |
| Planetes d'autres joueurs | Aucun biome visible |

### Actions

Sur les positions vides, un bouton "Explorer" apparait si le joueur possede des explorateurs et la recherche Exploration planetaire niv. 1. Ce bouton coexiste avec "Coloniser".

## Colonisation

Quand un joueur colonise une position :
- Les biomes sont generes et persistes dans `planetBiomes` (inchange)
- Tous les biomes de cette position sont automatiquement inseres dans `discovered_biomes` pour ce joueur
- Pas besoin d'avoir explore avant pour coloniser

## Transition

- Les planetes deja colonisees gardent leurs biomes visibles
- Les positions vides perdent leur affichage de biomes (plus de generation deterministe visible)
- Les joueurs doivent explorer pour decouvrir les biomes des positions vides

## Perimetre V1

### Inclus

- Recherche `planetary_exploration`
- Vaisseau `explorer` avec role `exploration`
- Type de mission `explore` avec `ExploreHandler`
- Table `discovered_biomes`
- Formule de decouverte probabiliste
- Duree de scan en orbite modulee par recherche
- Rapport d'exploration
- Vue galaxie : biomes caches par defaut, reveles progressivement
- Bouton "Explorer" sur les positions vides
- Colonisation revele automatiquement tous les biomes
- Transition : planetes colonisees gardent leurs biomes

### Hors perimetre (V2)

- Partage des decouvertes avec l'alliance
- Evenements aleatoires pendant l'exploration
- Scan passif via un batiment
- Exploration de planetes d'autres joueurs
