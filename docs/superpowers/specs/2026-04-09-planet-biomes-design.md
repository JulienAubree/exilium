# Systeme de biomes planetaires

## Contexte

Les planetes sont actuellement differenciees par 5 types (Volcanique, Aride, Temperee, Glaciale, Gazeuse) determines par la position orbitale, avec des multiplicateurs de production de ressources. Ce systeme est fonctionnel mais generique : deux planetes du meme type au meme emplacement sont interchangeables.

L'objectif est de rendre chaque planete unique en ajoutant des **biomes mineurs** qui donnent des bonus varies, faisant de la colonisation une decision strategique reelle.

## Principes de conception

- Le type de planete existant devient le **biome majeur** (pas de changement structurel)
- Chaque planete colonisee recoit un nombre aleatoire de **biomes mineurs** (1 a 5)
- Le homeworld ne recoit aucun biome mineur, il reste neutre
- Les biomes sont **purement passifs** (bonus automatiques, pas d'interaction)
- **Catalogue fixe** de biomes (pas de generation procedurale)
- **Chaque effet doit avoir un point de consommation verifie dans le game engine** : aucun bonus cosmétique
- Les biomes sont visibles avant colonisation (au scan dans la vue galaxie)

## Modele de donnees

### Table `biomes` (config/seed)

| Champ | Type | Description |
|-------|------|-------------|
| `id` | string | Identifiant unique (ex: `silicon_geysers`) |
| `name` | string | Nom affiche (ex: "Geysers de silicium") |
| `description` | string | Texte flavor |
| `rarity` | enum | `common`, `uncommon`, `rare`, `epic`, `legendary` |
| `compatiblePlanetTypes` | string[] | Types de planetes compatibles (vide = tous) |
| `effects` | Effect[] | Liste d'effets |

### Table `planetBiomes` (jointure)

| Champ | Type | Description |
|-------|------|-------------|
| `planetId` | UUID (FK) | La planete |
| `biomeId` | string (FK) | Le biome |

### Structure d'un effet

| Champ | Type | Description |
|-------|------|-------------|
| `stat` | string | La stat affectee (ex: `minerai_production`, `shield_power`) |
| `category` | string? | Filtre optionnel (type de ressource, type de batiment) |
| `modifier` | number | Valeur du bonus en % (ex: `+15`, `-10`) |

Les effets s'integrent dans la chaine de multiplicateurs existante : `production = base * type_planete * talents * biomes`.

## Generation des biomes

### Declenchement

Les biomes sont generes **au premier scan** d'une position dans la vue galaxie. Si la position n'a jamais ete visitee, les biomes sont tires et persistes. Tout joueur qui scanne ensuite la meme position voit les memes biomes.

A la colonisation, les biomes sont deja generes (puisque le joueur a necessairement scanne la position avant). Si pour une raison technique les biomes n'existent pas encore, ils sont generes a ce moment.

### Nombre de biomes mineurs

Tirage aleatoire pondere :

| Nombre | Probabilite |
|--------|-------------|
| 1 | 15% |
| 2 | 30% |
| 3 | 30% |
| 4 | 20% |
| 5 | 5% |

### Tirage de chaque biome

Pour chaque slot, tirage dans le catalogue filtre par compatibilite avec le type de planete :

| Rarete | Probabilite par slot |
|--------|---------------------|
| Commun | 40% |
| Peu commun | 30% |
| Rare | 18% |
| Epique | 9% |
| Legendaire | 3% |

### Regles

- Pas de doublons sur une meme planete
- Le homeworld ne recoit aucun biome
- Les biomes sont immutables une fois generes

## Catalogue de biomes (V1)

Le catalogue final sera reduit aux seuls biomes dont les stats sont effectivement consommees dans le game engine. Les biomes ci-dessous sont des candidats ; ceux dont la stat n'a pas de point de consommation seront differes en V2.

### Biomes universels (tous types)

| Biome | ID | Rarete | Effet |
|-------|----|--------|-------|
| Plaines fertiles | `fertile_plains` | Commun | +8% production silicium |
| Gisements de surface | `surface_deposits` | Commun | +8% production minerai |
| Cavernes profondes | `deep_caverns` | Commun | +10% capacite stockage minerai |
| Nappes souterraines | `underground_reserves` | Peu commun | +10% capacite stockage hydrogene |
| Reseau de failles | `fault_network` | Peu commun | -8% cout construction mines |
| Croute dense | `dense_crust` | Peu commun | +10% resistance defenses |
| Orbite stable | `stable_orbit` | Rare | +8% production energie solaire |
| Noyau actif | `active_core` | Rare | +12% production toutes ressources |
| Reliques precurseurs | `precursor_relics` | Epique | -15% cout recherche |
| Nexus gravitationnel | `gravitational_nexus` | Legendaire | -10% cout construction tous batiments |

### Biomes volcaniques (positions 1-3)

| Biome | ID | Rarete | Effet |
|-------|----|--------|-------|
| Coulees de lave | `lava_flows` | Commun | +10% production silicium |
| Cheminees volcaniques | `volcanic_vents` | Peu commun | +12% production energie |
| Forges naturelles | `natural_forges` | Rare | -12% cout construction vaisseaux |
| Lac de magma primordial | `primordial_magma` | Epique | +20% production minerai |
| Coeur de plasma | `plasma_core` | Legendaire | +25% production energie |

### Biomes arides (positions 4-6)

| Biome | ID | Rarete | Effet |
|-------|----|--------|-------|
| Dunes metalliques | `metallic_dunes` | Commun | +10% production minerai |
| Canyons profonds | `deep_canyons` | Peu commun | +15% capacite stockage silicium |
| Oasis souterraine | `underground_oasis` | Rare | +15% production hydrogene |
| Desert de cristaux | `crystal_desert` | Epique | +18% production silicium |
| Tempete de sable permanent | `permanent_sandstorm` | Legendaire | +20% resistance defenses |

### Biomes temperes (positions 7, 9)

| Biome | ID | Rarete | Effet |
|-------|----|--------|-------|
| Forets denses | `dense_forests` | Commun | +8% production energie |
| Plateaux mineraux | `mineral_plateaus` | Peu commun | +12% production minerai |
| Ecosysteme symbiotique | `symbiotic_ecosystem` | Rare | +10% production toutes ressources |
| Terres rares exposees | `exposed_rare_earths` | Epique | +20% production silicium |
| Biosphere harmonique | `harmonic_biosphere` | Legendaire | +8% bonus tous les effets |

### Biomes glaciaux (positions 10-12)

| Biome | ID | Rarete | Effet |
|-------|----|--------|-------|
| Glaciers d'hydrogene | `hydrogen_glaciers` | Commun | +10% production hydrogene |
| Permafrost riche | `rich_permafrost` | Peu commun | +12% capacite stockage toutes ressources |
| Geysers cryogeniques | `cryogenic_geysers` | Rare | +15% production hydrogene |
| Cristaux d'antimatiere | `antimatter_crystals` | Epique | +22% production hydrogene |
| Cryovolcan eternel | `eternal_cryovolcano` | Legendaire | +15% vitesse vaisseaux |

### Biomes gazeux (positions 13-15)

| Biome | ID | Rarete | Effet |
|-------|----|--------|-------|
| Couches de gaz nobles | `noble_gas_layers` | Commun | +10% production hydrogene |
| Vortex atmospherique | `atmospheric_vortex` | Peu commun | +10% puissance bouclier |
| Nuages de deuterium | `deuterium_clouds` | Rare | +15% production hydrogene |
| Tempete ionique | `ionic_storm` | Epique | +20% production energie |
| Anomalie spatiale | `spatial_anomaly` | Legendaire | -12% temps de construction vaisseaux |

## Affichage

### Vue galaxie (scan)

En cliquant sur une position non colonisee dans un systeme solaire, le joueur voit :
- Le type de planete (biome majeur) comme aujourd'hui
- La liste des biomes mineurs avec nom, rarete et effets
- Les biomes sont generes a ce moment s'ils ne l'ont pas encore ete

### Vue detail planete (colonisee)

Une section "Biomes" dans la page de la planete affiche la liste des biomes actifs avec leurs effets.

### Couleurs de rarete

| Rarete | Couleur |
|--------|---------|
| Commun | Gris |
| Peu commun | Vert |
| Rare | Bleu |
| Epique | Violet |
| Legendaire | Or |

## Perimetre V1

### Inclus

- Table `biomes` dans la config (seed)
- Table `planetBiomes` (jointure planete-biome)
- Algorithme de tirage (nombre + rarete + compatibilite)
- Generation au scan dans la vue galaxie
- Generation a la colonisation (fallback)
- Integration des bonus dans le game engine (uniquement pour les stats deja consommables)
- Affichage dans la vue galaxie (scan) et vue detail planete
- Catalogue limite aux stats reellement branchees dans le moteur

### Hors perimetre (V2)

- Biomes interactifs (batiments d'exploitation)
- Filtre/recherche par biome dans la galaxie
- Variantes procedurales des bonus
- Biomes avec malus en contrepartie d'un gros bonus
- Nouvelles stats dans le game engine pour supporter plus d'effets
