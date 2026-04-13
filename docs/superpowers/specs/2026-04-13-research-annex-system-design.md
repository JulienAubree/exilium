# Systeme de laboratoires annexes

## Contexte

La recherche est actuellement globale (par joueur, pas par planete). Le batiment `researchLab` est constructible sur n'importe quelle planete sans distinction. Le temps de recherche depend uniquement du niveau du labo sur la planete courante + talents.

## Objectif

- Restreindre le labo principal (`researchLab`) a la planete mere uniquement.
- Introduire 5 laboratoires annexes, un par type de planete colonie (Volcanic, Arid, Temperate, Glacial, Gaseous).
- Chaque annexe apporte un bonus passif de vitesse de recherche (cross-planete) et debloque une recherche exclusive.
- Le nombre total de biomes decouverts par le joueur devient un bonus global de vitesse de recherche.

---

## Architecture

### Approche retenue : 5 batiments distincts

Chaque annexe est un `building_definition` a part entiere avec son propre cout, ses bonus via `bonus_definitions`, et sert de prerequis pour sa recherche exclusive. Cette approche exploite a 100% les patterns existants (buildings, bonus, prerequisites) sans nouvelle table ni nouvelle mecanique.

---

## Les 5 annexes

| ID | Nom | Type de planete | Bonus passif | Recherche exclusive |
|----|-----|-----------------|--------------|---------------------|
| `labVolcanic` | Forge Volcanique | Volcanic | -5% temps recherche / niv | `volcanicWeaponry` : +10% degats / niv |
| `labArid` | Laboratoire Aride | Arid | -5% temps recherche / niv | `aridArmor` : +10% coque / niv |
| `labTemperate` | Bio-Laboratoire | Temperate | -5% temps recherche / niv | `temperateProduction` : +2% production toutes ressources / niv |
| `labGlacial` | Cryo-Laboratoire | Glacial | -5% temps recherche / niv | `glacialShielding` : +10% boucliers / niv |
| `labGaseous` | Nebula-Lab | Gaseous | -5% temps recherche / niv | `gaseousPropulsion` : +10% vitesse vaisseaux / niv |

Prerequis commun : `researchLab` niveau 6 sur la planete mere.
Non constructible sur la planete mere.
1 seule annexe par colonie (automatique selon le type de la planete).

---

## Changements data model

### 1. `building_definitions` -- nouveau champ

```
allowedPlanetTypes  JSONB  (nullable)
```

- `null` : constructible sur tous les types de planetes (comportement par defaut, tous les batiments existants).
- `["homeworld"]` : uniquement sur la planete mere (applique au `researchLab` existant).
- `["volcanic"]` : uniquement sur planetes volcaniques (applique a `labVolcanic`).

### 2. `research_definitions` -- nouveau champ

```
requiredAnnexType  VARCHAR(64)  (nullable)
```

- `null` : recherche classique (pas d'annexe requise).
- `"volcanic"` : necessite une Forge Volcanique (niveau >= 1) quelque part dans l'empire du joueur.

Ce champ evite de creer des prerequis batiment cross-planete (qui n'existent pas dans le systeme actuel). Le service verifie simplement "le joueur possede-t-il une annexe de ce type sur l'une de ses colonies ?".

### 3. `user_research` -- 5 nouvelles colonnes

```
volcanicWeaponry     INTEGER DEFAULT 0
aridArmor            INTEGER DEFAULT 0
temperateProduction  INTEGER DEFAULT 0
glacialShielding     INTEGER DEFAULT 0
gaseousPropulsion    INTEGER DEFAULT 0
```

Suit le pattern existant (1 colonne par recherche dans `user_research`).

### 4. Seed data

- 5 nouvelles `building_definitions` : les annexes avec `allowedPlanetTypes` et couts a definir.
- 5 nouvelles `research_definitions` : les recherches exclusives avec `requiredAnnexType`.
- 10+ nouvelles `bonus_definitions` :
  - 5 bonus passifs des annexes : `sourceType='building'`, `stat='research_time'`.
  - 5 bonus des recherches exclusives : `sourceType='research'`, stat selon la recherche (weapons, armor, shielding, all_production, ship_speed).
- Mise a jour du `researchLab` existant : ajout `allowedPlanetTypes: ["homeworld"]`.

---

## Formule de temps de recherche

### Etat actuel

```
temps = ((minerai + silicium) / timeDivisor) * 3600 * bonusMultiplier * talentMultiplier
```

Ou `bonusMultiplier` vient de `resolveBonus('research_time', null, buildingLevels)` qui utilise uniquement les batiments de la planete courante.

### Etat propose

```
temps = baseTime * labBonus * annexBonus * biomeBonus * talentBonus
```

Les 4 sources sont multiplicatives :

| Source | Calcul | Exemple |
|--------|--------|---------|
| `labBonus` | `resolveBonus('research_time', null, buildingLevels)` -- existant, rendements decroissants `1/(1+level)` | Labo niv 5 : x0.167 |
| `annexBonus` | `max(0.01, 1 - sumAnnexLevels * 0.05)` -- somme des niveaux de toutes les annexes du joueur. Lineaire (pas de rendements decroissants), car c'est une recompense d'expansion et chaque colonie doit compter. | 2 annexes (niv 3 + niv 2) = 5 niveaux : x0.75 |
| `biomeBonus` | `max(0.01, 1 - totalDiscoveredBiomes * 0.01)` -- total de biomes decouverts par le joueur | 12 biomes : x0.88 |
| `talentBonus` | existant, inchange | x0.90 |

---

## Changements dans les services

### `building.service.ts`

#### `startUpgrade()`

Avant la verification des prerequis :
1. Charger le `planetClassId` de la planete cible.
2. Si `def.allowedPlanetTypes` n'est pas null, verifier que le type de la planete est dans la liste.
3. Sinon, renvoyer une erreur "Ce batiment ne peut pas etre construit sur ce type de planete".

#### `listBuildings()`

Filtrer ou griser les batiments incompatibles avec le type de la planete courante. Les batiments dont le `allowedPlanetTypes` ne contient pas le type de la planete ne sont pas affiches (ou affiches grises avec message explicatif).

### `research.service.ts`

#### `listResearch()` et `startResearch()`

1. Recuperer les niveaux de batiments de la planete courante (existant).
2. Recuperer la somme des niveaux d'annexe sur toutes les planetes du joueur :
   ```sql
   SELECT SUM(level) FROM planet_buildings
   WHERE building_id IN ('labVolcanic','labArid','labTemperate','labGlacial','labGaseous')
   AND planet_id IN (SELECT id FROM planets WHERE user_id = ?)
   ```
3. Compter les biomes decouverts :
   ```sql
   SELECT COUNT(*) FROM discovered_biomes WHERE user_id = ?
   ```
4. Calculer `annexBonus = max(0.01, 1 - annexLevelSum * 0.05)`.
5. Calculer `biomeBonus = max(0.01, 1 - biomeCount * 0.01)`.
6. Multiplier dans le temps final.

#### `checkResearchPrerequisites()`

Si `def.requiredAnnexType` n'est pas null :
- Verifier que le joueur possede au moins 1 annexe de ce type (niveau >= 1) sur l'une de ses colonies.
- Sinon, la recherche apparait comme verrouillee.

### `game-engine` -- formules

#### Nouvelle fonction : `researchAnnexBonus()`

```typescript
export function researchAnnexBonus(totalAnnexLevels: number, percentPerLevel: number = 5): number {
  return Math.max(0.01, 1 - totalAnnexLevels * (percentPerLevel / 100));
}
```

#### Nouvelle fonction : `researchBiomeBonus()`

```typescript
export function researchBiomeBonus(totalDiscoveredBiomes: number, percentPerBiome: number = 1): number {
  return Math.max(0.01, 1 - totalDiscoveredBiomes * (percentPerBiome / 100));
}
```

#### Mise a jour de `researchTime()`

Ajouter `annexBonus` et `biomeBonus` comme parametres multiplicatifs.

---

## Frontend

### Panneau recherche (labo principal)

- Les recherches exclusives apparaissent dans la liste avec un indicateur du type d'annexe requis.
- Recherches verrouillees : affichent "Necessite une [Forge Volcanique] sur une colonie volcanique".
- Le detail des bonus de vitesse affiche la decomposition : labo, annexes, biomes, talents.

### Vue colonie (batiments)

- Les annexes apparaissent dans la categorie "Recherche" des batiments.
- Sur une planete incompatible, l'annexe n'est pas affichee.
- Sur la planete mere, le `researchLab` reste visible mais les annexes ne sont pas affichees.

---

## Ce qui ne change PAS

- La recherche reste globale (par joueur, pas par planete).
- Une seule file de recherche a la fois.
- Le systeme de prerequis batiment/recherche existant.
- Le systeme de talents et bonus de hull.
- Les formules de cout de recherche (seul le temps change).
- Les biomes existants et leur systeme de decouverte.
