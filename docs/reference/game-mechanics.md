> **⚠️ Section combat partiellement obsolète** — la [refonte combat du 2026-04-25](../patchnotes/2026-04-25-refonte-combat.md) a remplacé le système (rapidfire, bounce rule, priorité de cible) par un système multi-batteries avec catégories (Léger/Moyen/Lourd) et traits (Rafale, Enchaînement). Le reste du document (production, recherche, fleet, pillage, etc.) reste à jour.

# Mecaniques de jeu

Ce document detaille toutes les mecaniques de jeu, en particulier celles dont le fonctionnement n'est pas evident a premiere vue.

---

## Table des matieres

1. [Systeme de combat](#1-systeme-de-combat)
2. [Espionnage](#2-espionnage)
3. [Production de ressources](#3-production-de-ressources)
4. [Cout et temps de construction](#4-cout-et-temps-de-construction)
5. [Systeme de bonus](#5-systeme-de-bonus)
6. [Flottes et deplacements](#6-flottes-et-deplacements)
7. [Pillage](#7-pillage)
8. [Debris et recyclage](#8-debris-et-recyclage)
9. [Reparation des defenses](#9-reparation-des-defenses)
10. [Mining (ceintures d'asteroides)](#10-mining-ceintures-dasteroides)
11. [Pirates (PvE)](#11-pirates-pve)
12. [Colonisation](#12-colonisation)
13. [Planetes et univers](#13-planetes-et-univers)
14. [Classement](#14-classement)

---

## 1. Systeme de combat

Un combat se deroule en **4 rounds maximum**. Il s'arrete plus tot si un camp est entierement detruit.

### Deroulement d'un round

1. Chaque attaquant tire sur un defenseur aleatoire
2. Chaque defenseur tire sur un attaquant aleatoire
3. Les boucliers de toutes les unites survivantes se regenerent a 100%

### Calcul des degats

Les stats de base de chaque unite (armes, bouclier, blindage) sont multipliees par les bonus de recherche du joueur :

```
armes_effectives  = armes_base  * multiplicateur_armes
bouclier_effectif = bouclier_base * multiplicateur_bouclier
blindage_effectif = blindage_base * multiplicateur_blindage
```

Quand une unite tire sur une cible :

1. **Regle du bounce** : si les degats < 1% du bouclier max de la cible, le tir n'inflige **aucun degat**. Cela empeche les unites tres faibles de grignoter les grosses unites.
2. Le bouclier absorbe les degats en premier
3. Les degats excedentaires passent sur le blindage (hull)
4. **Destruction rapide** : si le blindage tombe a 30% ou moins du max, l'unite est detruite immediatement (pas besoin d'atteindre 0)

### Regeneration des boucliers

A la fin de chaque round, **tous les boucliers remontent a 100%**. Seuls les degats infliges au blindage sont permanents. Cela signifie qu'un gros bouclier protege efficacement round apres round, mais qu'une fois perce, les degats sur le hull sont irreversibles.

### Rapid fire

Le rapid fire permet a une unite de **tirer plusieurs fois dans le meme round**.

**Donnee** : `rapidFire[attaquant][cible] = N`

Exemple : le croiseur a un rapid fire de 6 contre le chasseur leger.

**Mecanique** : apres chaque tir, l'attaquant a une probabilite de tirer a nouveau :

```
probabilite de re-tirer = (N - 1) / N
```

Avec N = 6 : probabilite = 5/6 = 83%. Le de est relance a chaque tir supplementaire. En moyenne, l'unite tire **N fois au total** dans le round.

**Details** :
- A chaque tir supplementaire, une **nouvelle cible vivante** est choisie aleatoirement
- Si la nouvelle cible est d'un type contre lequel l'attaquant n'a **pas** de rapid fire, la chaine s'arrete
- Les defenseurs beneficient aussi du rapid fire (pas seulement les attaquants)

**Table de rapid fire actuelle** :

| Attaquant | Cible | N | Tirs moyens | Probabilite |
|-----------|-------|---|-------------|-------------|
| Petit cargo | Sonde espionnage | 5 | 5 | 80% |
| Grand cargo | Sonde espionnage | 5 | 5 | 80% |
| Chasseur leger | Sonde espionnage | 5 | 5 | 80% |
| Chasseur lourd | Sonde espionnage | 5 | 5 | 80% |
| Chasseur lourd | Petit cargo | 3 | 3 | 67% |
| Croiseur | Sonde espionnage | 5 | 5 | 80% |
| Croiseur | Chasseur leger | 6 | 6 | 83% |
| Croiseur | Petit cargo | 3 | 3 | 67% |
| Croiseur | Lanceur de missiles | 10 | 10 | 90% |
| Vaisseau de bataille | Sonde espionnage | 5 | 5 | 80% |
| Vaisseau de bataille | Chasseur leger | 4 | 4 | 75% |
| Vaisseau de bataille | Petit cargo | 4 | 4 | 75% |
| Vaisseau de bataille | Grand cargo | 4 | 4 | 75% |
| Vaisseau de colonisation | Sonde espionnage | 5 | 5 | 80% |

### Issue du combat

- **Victoire attaquant** : tous les defenseurs detruits, au moins 1 attaquant survit
- **Victoire defenseur** : tous les attaquants detruits, au moins 1 defenseur survit
- **Match nul** : les deux camps ont encore des unites apres 4 rounds, ou les deux sont detruits

---

## 2. Espionnage

### Quantite d'information revelees

Le nombre de sondes envoyees et l'ecart technologique determinent ce que le rapport revele :

```
probInfo = nombre_de_sondes - (techEspionnage_defenseur - techEspionnage_attaquant)
```

| probInfo | Information revelee |
|----------|---------------------|
| >= 1 | Ressources |
| >= 3 | Flotte |
| >= 5 | Defenses |
| >= 7 | Batiments |
| >= 9 | Recherches |

Plus l'ecart de technologie est grand en faveur du defenseur, plus il faut de sondes pour obtenir les memes infos.

### Detection des sondes

Le defenseur a une chance de detecter (et detruire) les sondes :

```
chance_detection (%) = nombre_de_sondes * 2 - (techEspionnage_attaquant - techEspionnage_defenseur) * 4
```

La valeur est bornee entre 0% et 100%.

- Si les sondes sont detectees : elles sont toutes detruites, pas de retour
- Si elles ne sont pas detectees : elles reviennent normalement

**Consequence** : envoyer beaucoup de sondes donne plus d'infos mais augmente le risque de detection. Avoir une tech espionnage superieure reduit ce risque.

---

## 3. Production de ressources

### Formules de production (par heure)

| Ressource | Formule |
|-----------|---------|
| Minerai | `30 * niveau * 1.1^niveau * facteurProduction` |
| Silicium | `20 * niveau * 1.1^niveau * facteurProduction` |
| Hydrogene | `10 * niveau * 1.1^niveau * (1.36 - 0.004 * tempMax) * facteurProduction` |

**Hydrogene et temperature** : la formule inclut un terme `(1.36 - 0.004 * tempMax)`. Plus la planete est froide (tempMax bas), plus la production d'hydrogene est elevee. Une planete en position 13-15 (gazeuse, froide) produit significativement plus d'hydrogene qu'une planete en position 1-3 (volcanique, chaude).

### Energie et facteur de production

Chaque mine consomme de l'energie :

| Batiment | Consommation d'energie |
|----------|------------------------|
| Mine de minerai | `10 * niveau * 1.1^niveau` |
| Mine de silicium | `10 * niveau * 1.1^niveau` |
| Synthetiseur d'hydrogene | `20 * niveau * 1.1^niveau` |

La centrale solaire produit : `20 * niveau * 1.1^niveau`

**Facteur de production** :

```
Si energie_produite >= energie_consommee : facteur = 1.0 (production a 100%)
Si energie_produite <  energie_consommee : facteur = energie_produite / energie_consommee
```

Quand l'energie est insuffisante, **toutes les mines sont degradees proportionnellement**. C'est un goulot d'etranglement critique : negliger la centrale solaire reduit la production de toutes les ressources.

### Stockage

```
capacite = 5000 * floor(2.5 * e^(20 * niveau / 33))
```

La production s'arrete quand le stockage est plein. Chaque ressource a son propre entrepot.

---

## 4. Cout et temps de construction

### Batiments

```
cout      = cout_base * facteur_cout^(niveau - 1) * multiplicateur_phase(niveau)
temps (s) = temps_base * facteur_cout^(niveau - 1) * bonus_robotique * multiplicateur_phase(niveau)
```

Minimum : 1 seconde.

### Recherches

```
cout      = cout_base * facteur_cout^(niveau - 1) * multiplicateur_phase(niveau)
temps (s) = ((cout_minerai + cout_silicium) / 1000) * 3600 * bonus_labo * multiplicateur_phase(niveau)
```

### Vaisseaux et defenses

```
temps (s) = ((cout_minerai + cout_silicium) / 2500) * 3600 * bonus_chantier
```

Les couts des vaisseaux et defenses sont **fixes** (pas de facteur exponentiel comme les batiments).

### Multiplicateur de phase (acceleration early-game)

Les niveaux 1 a 7 beneficient d'une reduction de cout et de temps :

| Niveau | Multiplicateur | Reduction |
|--------|---------------|-----------|
| 1 | 0.35 | -65% |
| 2 | 0.45 | -55% |
| 3 | 0.55 | -45% |
| 4 | 0.65 | -35% |
| 5 | 0.78 | -22% |
| 6 | 0.90 | -10% |
| 7 | 0.95 | -5% |
| 8+ | 1.00 | aucune |

Cela permet un demarrage rapide tout en conservant la progression exponentielle a haut niveau.

---

## 5. Systeme de bonus

Les bonus proviennent des batiments et recherches. Ils sont **multiplicatifs** entre eux. Le calcul **diffère selon la source** — c'est important :

### Calcul

```
batiment :   modificateur = 1 / (1 + niveau)         ← diminishing returns
recherche :  modificateur = max(0.01, 1 + (pct/100) * niveau)   ← linéaire
```

Le multiplicateur final est le **produit** de tous les modificateurs applicables, avec un plancher à 0.01 (1%).

**Pourquoi cette différence** : les bâtiments donnent un gain énorme aux premiers niveaux puis ralentissent (encourager les early upgrades), les recherches scalent linéairement (encourager l'investissement long terme).

### Exemples chiffrés

**Usine de robots (bâtiment, réduit le temps de construction)** :
- Niv 1 : `1/(1+1) = 0.50` → temps × 0.50 (−50 %)
- Niv 3 : `1/(1+3) = 0.25` → temps × 0.25 (−75 %)
- Niv 5 : `1/(1+5) ≈ 0.167` → temps × 0.167 (−83 %)
- Niv 10 : `1/11 ≈ 0.091` → temps × 0.091 (−91 %)

**Recherche Armes (linéaire +10 %/niv)** :
- Niv 1 : `1 + 0.10*1 = 1.10` (+10 %)
- Niv 5 : `1 + 0.10*5 = 1.50` (+50 %)
- Niv 10 : `1 + 0.10*10 = 2.00` (+100 %)

### Filtrage par categorie

Certains bonus ont une categorie (ex: `combustion`, `build_military`). Ils ne s'appliquent qu'aux entites de cette categorie. Les bonus sans categorie (`null`) s'appliquent a tout.

Exemple : le chantier naval donne sa réduction sur les vaisseaux industriels (`build_industrial`), tandis que le centre de commandement la donne sur les vaisseaux militaires (`build_military`).

### Liste des bonus

> Source de vérité : table `bonus_definitions` (admin) + `packages/game-engine/src/formulas/bonus.ts`. Le champ `percentPerLevel` n'a d'effet que pour les bonus de type `research` ; pour les `building`, l'effet est toujours `1/(1+level)` quel que soit le `percentPerLevel` configuré.

**Temps de construction (bâtiments, diminishing) :**

| Source | Stat | Categorie |
|--------|------|-----------|
| Usine de robots | building_time | toutes |
| Laboratoire | research_time | toutes |
| Chantier naval | ship_build_time | industriels |
| Centre de commandement | ship_build_time | militaires |
| Arsenal | defense_build_time | toutes |

**Combat (recherches, linéaires) :**

| Source | Stat | Effet/niveau |
|--------|------|-------------|
| Recherche armes | weapons | +10 % |
| Recherche bouclier | shielding | +10 % |
| Recherche blindage | armor | +10 % |

**Vitesse des vaisseaux (recherches, linéaires) :**

| Source | Stat | Effet/niveau | Categorie |
|--------|------|-------------|-----------|
| Reacteur a combustion | ship_speed | +10 % | combustion |
| Reacteur a impulsion | ship_speed | +20 % | impulse |
| Propulsion hyperespace | ship_speed | +30 % | hyperspaceDrive |

**Autres (recherches) :**

| Source | Stat | Effet/niveau |
|--------|------|-------------|
| Technologie informatique | fleet_count | +1 flotte simultanee |
| Fracturation rocheuse | mining_duration | −10 % par niveau (plancher 1 %) |

### Bonus annexes (laboratoires de recherche par biome)

Mécanique séparée du `resolveBonus` ci-dessus. Cf. `packages/game-engine/src/formulas/bonus.ts` :

- `researchAnnexBonus(totalAnnexLevels, 5)` — chaque niveau d'annexe (toutes biomes confondus) donne **−5 % linéaire** sur le temps de toute recherche
- `researchBiomeBonus(totalDiscoveredBiomes, 1)` — chaque biome découvert (toutes planètes confondues) donne **−1 %** linéaire sur le temps de toute recherche

Plancher 1 % combiné.

---

## 6. Flottes et deplacements

### Vitesse de flotte

La flotte se deplace a la vitesse de son **vaisseau le plus lent** :

```
vitesse_flotte = min(vitesse_vaisseau pour chaque type present)
vitesse_vaisseau = vitesse_base * multiplicateur_propulsion
```

Ajouter un recycleur (vitesse 2000) a une flotte de croiseurs (vitesse 15000) ramene toute la flotte a 2000.

### Distance

La distance depend de la difference de coordonnees :

| Cas | Formule |
|-----|---------|
| Galaxies differentes | `20 000 * |diff_galaxie|` |
| Systemes differents (meme galaxie) | `2 700 + 95 * |diff_systeme|` |
| Positions differentes (meme systeme) | `1 000 + 5 * |diff_position|` |
| Meme position | `5` |

### Temps de trajet

```
temps (s) = 10 + (35 000 / vitesse) * sqrt((distance * 10) / vitesse_univers)
```

La vitesse de l'univers (defaut : 1) est un multiplicateur global.

### Consommation de carburant

```
Par type de vaisseau : conso_base * nombre * (distance / 35 000) * ((duree + 10) / (duree - 10))
Total = max(1, ceil(somme de toutes les consommations))
```

Le facteur `(duree + 10) / (duree - 10)` signifie que les trajets tres courts consomment proportionnellement plus de carburant (acceleration/deceleration).

Minimum : 1 unite de carburant, meme pour un trajet minime.

### Capacite de chargement

```
capacite_totale = somme(capacite_cargo * nombre) pour chaque type de vaisseau
```

---

## 7. Pillage

Quand l'attaquant gagne un combat, il pille les ressources de la planete.

### Distribution du butin

1. La capacite de cargo disponible des vaisseaux survivants est calculee
2. Le cargo est divise en **3 parts egales** (une par ressource)
3. Chaque ressource est pillee a hauteur de `min(ressource_disponible, 1/3 du cargo)`
4. Le cargo restant est rempli dans l'ordre : minerai, puis silicium, puis hydrogene

Ce systeme fait qu'avec suffisamment de cargo, on prend environ 1/3 de chaque ressource. Avec un cargo limite, les ressources les plus abondantes sont favorisees dans l'ordre.

**Note** : la production passive du defenseur est materialisee avant le pillage (les ressources generees pendant le vol sont pillables).

---

## 8. Debris et recyclage

### Generation de debris

Apres un combat, les vaisseaux detruits (des deux camps) generent un champ de debris :

```
debris_minerai  = floor(somme(cout_minerai_vaisseaux_detruits) * 0.30)
debris_silicium = floor(somme(cout_silicium_vaisseaux_detruits) * 0.30)
```

**Regles** :
- Seuls les **vaisseaux** generent des debris (pas les defenses)
- Seuls le **minerai** et le **silicium** sont recuperables (pas l'hydrogene)
- Le ratio par defaut est de **30%**
- Les debris s'accumulent aux memes coordonnees (plusieurs combats = un seul champ)

### Recyclage

La mission de recyclage ne peut etre effectuee que par des **recycleurs**.

1. Le cargo total de la flotte de recycleurs est calcule
2. Le minerai est collecte en premier (jusqu'a la limite du cargo)
3. Le silicium est collecte avec le cargo restant
4. Le champ de debris est mis a jour (supprime s'il est vide)

---

## 9. Reparation des defenses

Apres un combat, chaque defense detruite a **70% de chance** d'etre reparee automatiquement.

```
pour chaque defense detruite :
  si random() < 0.70 : la defense est restauree
```

Les pertes nettes du defenseur = defenses detruites - defenses reparees.

Les vaisseaux detruits ne sont **jamais** repares.

---

## 10. Mining (ceintures d'asteroides)

Les positions 8 et 16 de chaque systeme sont des **ceintures d'asteroides**. Elles contiennent des depots de ressources exploitables via des missions de mining.

### Conditions

- La flotte doit contenir au moins **1 prospecteur**
- La cible doit etre une position de ceinture d'asteroides (8 ou 16)

### Deroulement

La mission se deroule en deux phases :

**Phase 1 — Prospection** :

```
duree (min) = 5 + floor(quantite_totale_depot / 10 000) * 2
```

**Phase 2 — Extraction (mining)** :

```
duree (min) = max(5, capacite_cargo_flotte / extraction_flotte * 10) * bonus_fracturation
```

> Source : `packages/game-engine/src/formulas/pve.ts:miningDuration`

Plus la flotte a de cargo à remplir et peu d'extraction, plus le minage est long. La recherche **Fracturation rocheuse** réduit la durée via `bonus_fracturation` (planchier 1 %).

### Quantite extraite

L'extraction est répartie proportionnellement entre minerai / silicium / hydrogène selon les quantités restantes du dépôt :

```
extraction_max = min(extraction_flotte, cargo_effective)
cargo_effective = cargo_flotte * (1 - slag_rate)   // perte par scories
ratio_M = minerai_restant / (M+S+H restants)
quantite_M = floor(extraction_max * ratio_M)       // idem S, le H reçoit le reste
```

> Source : `packages/game-engine/src/formulas/pve.ts:computeMiningExtraction`

- `extraction_flotte` = somme de `miningExtraction` de chaque vaisseau présent (les prospecteurs ont la valeur la plus élevée)
- `slag_rate` = fraction perdue en scories, dépend de la position du dépôt (8 ou 16) et de la recherche `Deep Space Refining` (chaque niveau réduit le slag de 15 %, plancher 0 %)
- Si `extraction_max >= total_restant`, tout le dépôt est vidé

### Composition d'un dépôt

Quantité totale : `floor((15 000 + 5 000 * (niveau_centre - 1)) * variance)`

Composition par défaut : 60 % minerai, 30 % silicium, 10 % hydrogène (ajustée par offsets aléatoires, hydrogène ≥ 2 %).

### Pool de missions visibles

Le nombre de missions disponibles depend du niveau du centre de mission :

| Niveau centre | Missions visibles | Accumulation max |
|---------------|-------------------|------------------|
| 1-2 | 3 | 6 |
| 3-4 | 4 | 8 |
| 5-6 | 5 | 10 |
| 7+ | 6 | 12 |

---

## 11. Pirates (PvE)

Les missions pirates permettent de combattre des flottes PNJ pour obtenir des recompenses.

### Tiers de difficulte

| Tier | Niveau centre requis | Recompenses typiques |
|------|---------------------|----------------------|
| Facile | 3+ | 3K-6K minerai, 1.5K-4K silicium, 0.5K-1.5K hydrogene |
| Moyen | 4+ | 10K-20K minerai, 5K-12K silicium, 2K-5K hydrogene |
| Difficile | 6+ | 50K-100K minerai, 30K-60K silicium, 15K-30K hydrogene |

### Recompenses

- Le butin est **plafonne par la capacite de cargo** des vaisseaux survivants
- Si le butin total depasse le cargo : `butin_effectif = floor(butin * cargo / butin_total)`
- Certains templates de pirates offrent des **vaisseaux bonus** avec une probabilite (ex : 30% de chance de recuperer 2 chasseurs legers)

Le combat utilise exactement le meme moteur que le PvP. Les pirates ont des niveaux de technologie fixes definis par template.

---

## 12. Colonisation

### Conditions

- Seuls les **vaisseaux de colonisation** peuvent coloniser
- Maximum **9 planetes** par joueur
- Les positions **8 et 16** (ceintures d'asteroides) ne sont pas colonisables
- La position cible doit etre **libre**

### Fonctionnement

1. Le vaisseau de colonisation est **consomme** a l'arrivee
2. Une nouvelle planete est creee avec :
   - Un type determine par la position (volcanique, aride, temperee, glaciale, gazeuse)
   - Un diametre aleatoire dans la fourchette du type
   - Une temperature calculee selon la position avec une variation aleatoire de +/-20
   - 0 ressources de depart
3. Les vaisseaux restants de la flotte **retournent a l'origine**

---

## 13. Planetes et univers

### Configuration de l'univers

| Parametre | Valeur |
|-----------|--------|
| Galaxies | 9 |
| Systemes par galaxie | 499 |
| Positions par systeme | 16 (dont 8 et 16 = asteroides) |
| Planetes max par joueur | 9 |
| Vitesse univers | 1x |
| Ratio de debris | 30% |
| Ressources de depart | 500 minerai, 300 silicium, 100 hydrogene |

### Temperature

```
tempMax = 40 + (8 - position) * 30 + offset    (offset aleatoire entre -20 et +20)
tempMin = tempMax - 40
```

Les positions basses (1-3) sont chaudes, les positions hautes (13-15) sont froides.

### Types de planete

| Type | Positions | Bonus minerai | Bonus silicium | Bonus hydrogene |
|------|-----------|---------------|----------------|-----------------|
| Volcanique | 1-3 | 1.0× | 1.2× | 0.7× |
| Aride | 4-6 | 1.2× | 1.1× | 0.8× |
| Temperee | 7, 9 | 1.0× | 1.0× | 1.0× |
| Glaciale | 10-12 | 0.8× | 1.0× | 1.3× |
| Gazeuse | 13-15 | 0.9× | 0.9× | 1.1× |

Les bonus de ressources s'appliquent à la production de la planète.

### Diametre

Le diamètre est stocké sur la planète mais **aucune mécanique de "champs max" / cases constructibles n'est implémentée à ce jour** (héritage OGame non porté). Toutes les planètes peuvent construire tous les bâtiments sans limite de cases. Si une telle limite était introduite, ce serait via une nouvelle colonne et un check côté `building.service`.

### Boucliers planetaires

Les domes de bouclier (petit et grand) sont limites a **1 exemplaire de chaque par planete**.

---

## 14. Classement

Les points de classement sont calcules a partir du cout cumule de tout ce qu'un joueur a construit :

```
points_batiments  = floor(somme(couts_tous_niveaux_batiments) / 1000)
points_recherches = floor(somme(couts_tous_niveaux_recherches) / 1000)
points_flotte     = floor(somme(nombre_vaisseaux * cout_vaisseau) / 1000)
points_defenses   = floor(somme(nombre_defenses * cout_defense) / 1000)

points_totaux = points_batiments + points_recherches + points_flotte + points_defenses
```

Les couts pris en compte incluent le minerai, le silicium et l'hydrogene. Pour les batiments et recherches, c'est la somme des couts de chaque niveau de 1 au niveau actuel (avec le multiplicateur de phase).

**Consequence** : perdre des vaisseaux fait baisser les points de flotte. Les defenses reparees ne comptent pas comme perte de points.
