# Cartographie fonctionnelle d'Exilium

> **Statut** : état des lieux exhaustif du jeu tel qu'il tourne, établi le 2026-08-09 à partir du **code** (`packages/game-engine`, `apps/api`, `apps/web`, `apps/admin`) et de la **base de production**, jamais à partir de la documentation existante.
> **Usage** : matière première du rework. Ce document décrit ce qui existe ; il ne propose rien.
> **Avertissement** : `docs/reference/game-mechanics.md` et `docs/reference/game-engine.md` sont périmés sur la majorité des domaines. Voir le chapitre 6. En cas de contradiction, **c'est ce document qui a été vérifié contre le code et la base**.

## Sommaire

1. [Le jeu en une page](#1-le-jeu-en-une-page)
2. [Les onze domaines](#2-les-onze-domaines) — [Économie](#21-économie-production-et-énergie) · [Bâtiments](#22-bâtiments-et-file-de-construction) · [Recherche](#23-recherche) · [Vaisseaux et défenses](#24-vaisseaux-défenses-et-chantier) · [Combat](#25-moteur-de-combat) · [Flotte](#26-flotte-missions-et-déplacements) · [PvE](#27-pve-pirates-ceintures-exploration) · [Colonisation](#28-colonisation-planètes-et-galaxie) · [Social](#29-social-alliances-messagerie-marché-classements) · [Méta](#210-progression-méta-xp-exilium-politiques-vaisseau-amiral) · [Tutoriel et notifications](#211-tutoriel-communication-et-notifications)
3. [Tableau de bord du contenu](#3-tableau-de-bord-du-contenu)
4. [Ce que les données disent de l'usage réel](#4-ce-que-les-données-disent-de-lusage-réel)
5. [Les frictions, classées](#5-les-frictions-classées)
6. [Dérives de documentation](#6-dérives-de-documentation)

---

## 1. Le jeu en une page

Exilium est un 4X spatial en français, jouable au navigateur (PWA), directement inspiré d'OGame. Le joueur reçoit une planète mère, monte trois mines, alimente une centrale, débloque des bâtiments, une recherche, des vaisseaux, puis part miner, explorer, coloniser, et éventuellement attaquer ses voisins.

**Les trois ressources** sont le **minerai**, le **silicium** et l'**hydrogène**. L'**énergie** n'est pas une ressource stockable : c'est un facteur multiplicatif instantané sur la production. L'**exilium** est une monnaie méta (assiduité), séparée de l'économie.

**La boucle principale**, telle qu'elle est réellement câblée :

```
                 ┌──────────── BÂTIMENTS (17) ────────────┐
                 │  1 seul chantier par planète, pas de file│
   PRODUCTION ──►│  mines · centrale · entrepôts           │──► débloque
   3 ressources  │  robotics · shipyard · arsenal · labo    │    tout le contenu
   + facteur     └────────────────┬───────────────────────┘
     énergie                      │
        ▲                         ├──► RECHERCHE (23, 5 arbres, 1 slot empire)
        │                         ├──► VAISSEAUX (13)  ─┐
        │                         └──► DÉFENSES (5)     │
        │                                               ▼
        │                                        FLOTTE (14 missions)
        │                                mine · transport · recycle · pirate
        └──── minage / pillage / recyclage ◄──── explore · attack · colonize · trade
```

**Autour de cette boucle, quatre couches** :

- **Le monde** — 9 galaxies × 499 systèmes × 16 positions (dont 2 ceintures d'astéroïdes par système) = **62 874 emplacements colonisables** pour 91 planètes existantes. 6 types de planète, 33 biomes, une température dictée par la position qui pilote l'hydrogène et l'énergie solaire.
- **La méta** — XP d'empire (débloque la capacité de colonies, le niveau des missions PvE, les slots de politique), 3 axes de politique d'empire, une monnaie d'assiduité (exilium) alimentée par des quêtes journalières, et un vaisseau amiral qui porte l'identité du joueur.
- **Le social** — alliances (tag, blason, chat, journal, classement — **aucun effet mécanique**), marché de ressources et de rapports d'exploration avec livraison physique par flotte, messagerie, amis, classement.
- **L'onboarding** — un tutoriel de 4 chapitres et 23 quêtes qui, dans les faits, **est la véritable économie du début de partie** : il verse 22 275 minerai, 13 000 silicium, 5 475 hydrogène en récompenses de quête, plus 2 200 ressources, 20 exilium et 7 vaisseaux en récompenses de chapitre.

**Deux repères de rythme, à garder en tête pour juger toute mécanique** :

| Jalon | Jeu optimal | Jeu économique |
|---|---|---|
| Premier laboratoire | — | **56 h** |
| Premier chantier spatial | **218 h** | — |
| **Premier vaisseau** | **529 h (3 semaines)** | **3 504 h (5 mois)** |

Ce simulateur (`packages/game-sim`) ne modélise **pas** les récompenses du tutoriel. Dans la réalité mesurée en base, un joueur qui suit le tutoriel obtient son premier prospecteur en **~41 h** — un facteur 13. C'est le tutoriel, pas la production, qui finance les premiers jours.

**État actuel** : 25 comptes (des amis de Julien), 91 planètes, 24 joueurs avec au moins une planète. **Le jeu est dormant** : dernière flotte lancée le 24 juin, dernier combat PvP le 26 mai, dernière recherche le 8 juillet, dernier message le 8 mai. Seules subsistent quelques constructions isolées (dernière le 8 août) et le cron de production, qui tourne toutes les 15 minutes sur des entrepôts pleins à 91 %.

---

## 2. Les onze domaines

Format de chaque mécanique :
**Joueur** — le parcours concret · **Chiffres** — formules et valeurs réelles · **Où** — moteur / API / base / front · **Réglable** — ce qui se change sans déployer · **Coince** — le constat de friction.

---

### 2.1 Économie, production et énergie

L'économie est un OGame fidèle : trois mines exponentielles, une centrale qui couvre la moitié de la consommation, des entrepôts, des curseurs. **Les formules sont propres et testées ; c'est le câblage qui est cassé** — quatre calculs de production distincts coexistent, et celui qui verse réellement les ressources donne **19,4 % de moins** que celui qui est affiché.

#### Les trois mines

**Joueur** — Monter la mine, attendre, remonter la mine. C'est la boucle des premières semaines.
**Chiffres** — `minerai/h = floor(30 × niveau × 1,1^niveau × facteur)` · silicium base 20 · hydrogène base 10 × `(1,36 − 0,004 × Tmax)`.
Valeurs (facteur 1) : minerai niv 10 = 778/h, niv 20 = 4 036/h, niv 25 = 8 126/h, niv 26 = 9 296/h. Silicium niv 20 = 2 690/h, niv 25 = 5 417/h. Hydrogène niv 20 à 30 °C = 1 668/h.
Coefficient de température : 1,960 à −150 °C · 1,360 à 0 °C · 0,600 à 190 °C · 0,360 à 250 °C — **écart de 5,4× entre les deux extrêmes atteignables**. Il s'annule à 340 °C et deviendrait négatif au-delà, sans clamp — inatteignable aujourd'hui (le maximum réel est 250 °C sur une colonie en position 1), mais aucun garde-fou n'existe.
Coûts : mineraiMine 60 M / 15 S (cf 1,5) · siliciumMine 48 M / 24 S (**cf 1,6**) · hydrogeneSynth 225 M / 75 S (cf 1,5).
**Retour sur investissement au niveau 20** : minerai **302 h**, silicium **1 486 h**, hydrogène **3 023 h**. Au niveau 25 : 1 220 h / 8 267 h / 12 199 h.
**Où** — `packages/game-engine/src/formulas/production.ts:5-36` · config lue depuis la table `production_config` via `production-config.ts:11-39` · front `apps/web/src/pages/Buildings.tsx:44-100`.
**Réglable** — Table `production_config` (page Production du back-office) : `base_production`, `exponent_base`, `temp_coeff_a` (1,36), `temp_coeff_b` (0,004). Coûts dans `building_definitions`.
**Coince** — Le cf 1,6 du silicium n'est compensé par aucun bonus : rentabiliser un niveau de silicium coûte **6,8× plus cher** que le même niveau de minerai. Les joueurs l'ont senti (niveau moyen 13,5 contre 15,1). Le synthétiseur d'hydrogène est économiquement mort dès le niveau ~15 et il est abandonné 6,4 niveaux derrière le minerai. Enfin `exponentBase` est **partagé** entre production et consommation d'énergie : impossible de régler l'un sans l'autre.

#### Le facteur d'énergie

**Joueur** — Une jauge en haut de l'écran. Quand la consommation dépasse la production, toutes les ressources chutent d'un coup.
**Chiffres** — Production = `floor((20 × niveau × 1,1^niveau + satellites) × (1 + bonus))`. Consommations : mine de minerai `10 × n × 1,1^n`, silicium idem, hydrogène `20 × n × 1,1^n`, **bouclier planétaire `ceil(30 × 1,5^(n−1))`**. Facteur = `min(1, produit / consommé)`, appliqué **uniformément** aux trois productions.
Conséquence structurelle : les trois producteurs au niveau L consomment `40 × L × 1,1^L`, la centrale au même niveau produit `20 × L × 1,1^L` — **exactement la moitié**. Il faut maintenir la centrale +3 niveaux (à L5), +5 (à L15-20), +6 (à L25-30) au-dessus des mines, en permanence.
Le bouclier est un gouffre : niveau 10 = 1 154 énergie, niveau 12 = 2 595 (soit 27 % de la consommation de la planète « Hoxis IV »).
**Où** — `production.ts:42-80` et `:99-103` · bouclier `formulas/shield.ts:14-17` · assemblage `formulas/resources.ts:113-125` · front `components/energy/EnergyBar.tsx`.
**Réglable** — `production_config.<mine>.energy_consumption`, `solarPlant.base_production`. La **consommation du bouclier est codée en dur** (`shield.ts:16`) : aucun réglage possible sans déployer.
**Coince** — La centrale est mathématiquement condamnée : elle coûte `1,5^n` pour produire `1,1^n`. Au niveau 20 elle coûte 182 silicium par point d'énergie, au niveau 26 c'est 971 ; un satellite solaire sur planète chaude coûte 18 à 50. Le bâtiment est strictement dominé dès le niveau 18-20 et rien ne le signale. **41 planètes sur 91 sont en pénurie d'énergie** sur le chemin qui verse réellement les ressources (28 sur le chemin affiché). Le tutoriel crée lui-même l'état zéro : quête 1 = mine de minerai, quête 2 = mine de silicium, la centrale n'arrive qu'en quête 3 — **deux comptes sont figés à facteur 0,000 depuis mars et mai**.

#### Satellites solaires

**Joueur** — Des « vaisseaux » construits au chantier qui restent en orbite et ajoutent de l'énergie.
**Chiffres** — `50` fixe sur la planète mère, sinon `max(10, floor(Tmax/4) + 20)` → 10 à −200 °C, 30 à 40 °C, 45 à 100 °C, 82 à 250 °C. Coût 0 M / 1 500 S / 375 H, prérequis chantier 1, coque 6, bouclier 1, stationnaire.
Rendement : **18 silicium par point d'énergie à 250 °C**, contre 971 pour une centrale niveau 26 — un écart de 1 à 54.
**Où** — `production.ts:110-117` · `universe_config.satellite_home_planet_energy` (50) / `satellite_base_divisor` (4) / `satellite_base_offset` (20).
**Réglable** — Les trois clés ci-dessus (page Univers du back-office) et le coût dans `ship_definitions`.
**Coince** — La règle « planète mère = 50 fixe » est une exception arbitraire : sur les 24 planètes mères (températures de −22 à 167 °C), c'est un malus pour les unes et un bonus pour les autres. C'est de loin la meilleure source d'énergie en milieu de partie et **seules 28 planètes sur 91 en possèdent** (320 unités). Coque 6 : ils meurent au premier bombardement et alimentent le champ de débris de l'attaquant.

#### Curseurs de production

**Joueur** — Un volet replié sur la Vue d'ensemble permet de réduire chaque mine et le bouclier de 0 à 100 %.
**Chiffres** — Production et consommation partagent le terme `niveau × 1,1^niveau`, donc le **ratio ressource par point d'énergie est constant quel que soit le niveau** : **3,00 pour le minerai, 2,00 pour le silicium, 0,60 pour l'hydrogène** (vérifié aux niveaux 10, 20 et 30).
**Où** — `resources.ts:101-129` · `resource.service.ts:364-383` · colonnes `planets.minerai_mine_percent` etc.
**Réglable** — Rien : c'est une donnée joueur.
**Coince** — La mécanique est **dégénérée** : une seule bonne réponse en toutes circonstances (couper l'hydrogène, puis le silicium). Les données confirment : **81 planètes sur 91 (89 %) sont à 100/100/100**, et 7 des 10 restantes n'ont touché que l'hydrogène. Le seul curseur porteur d'un vrai arbitrage (bouclier : énergie contre capacité) est noyé avec les trois autres, derrière un accordéon replié.

#### Entrepôts et plafond de stockage

**Joueur** — Trois jauges avec « plein dans X j ». Quand c'est plein, la production s'arrête.
**Chiffres** — `capacité = 5000 × floor(2,5 × e^(20 × niveau / 33))` → niveau 0 = **10 000**, 1 = 20 000, 3 = 75 000, 5 = 255 000, 8 = 1 590 000, 10 = 5 355 000, 12 = 18 005 000. La capacité croît de ×1,83 par niveau pendant que le coût croît de ×2,0.
**Le plafond de 10 000 au niveau 0 est un verrou dur.** Les premiers niveaux dont le coût dépasse 10 000 minerai sont, dans l'ordre : **storageMinerai / storageSilicium / storageHydrogene niveau 5 = 12 480 M**, puis robotics / shipyard / arsenal niveau 6 = 11 520, planetaryShield niveau 6 = 13 668, researchLab niveau 7 = 12 160. Le verrou mord donc **sur les entrepôts eux-mêmes**, très tôt.
Débordement : si le stock est **déjà** au-dessus du plafond (transport, pillage), il est intégralement préservé et la production s'arrête ; sinon la production est écrêtée.
**Où** — `production.ts:86-91`, `resources.ts:168-199` · `universe_config.storage_base/coeff_a/b/c`.
**Réglable** — 4 clés `universe_config` (5000 / 2,5 / 20 / 33). **Piège** : la ligne `storage` de `production_config` est éditable en back-office et **n'est jamais lue** ; l'aperçu admin (`apps/admin/src/pages/Buildings.tsx:87`) recalcule avec cette ligne morte et des coefficients en dur. Et `resource.router.ts:71` / `attack.handler.ts:361` lisent `config.universe['storage_config']`, une clé **qui n'existe pas** parmi les 143.
**Coince** — Trois sources de vérité concurrentes pour une seule formule, dont deux mortes. Le verrou à 10 000 est invisible : rien n'avertit le joueur que sa prochaine amélioration coûtera plus que sa capacité.

#### Types de planète et biomes

**Chiffres — types** : 6 lignes dans `planet_types`, multiplicateurs (M/S/H) appliqués en dernier, multiplicativement : volcanique 1,0/1,2/0,7 · aride 1,2/1,1/0,8 · tempérée 1,0/1,0/1,0 · glaciale 0,8/1,0/1,3 · gazeuse 0,9/0,9/1,1 · planète mère 1,0/1,0/1,0. **6 des 18 valeurs sont exactement 1,0.** Cumulés à l'effet de température, ils créent un **écart de 10,5× sur l'hydrogène** entre une glaciale froide (1,3 × 2,04) et une volcanique chaude (0,7 × 0,36).
**Chiffres — biomes** : **33 définitions**, 5 raretés (poids 0,40 / 0,30 / 0,18 / 0,09 / 0,03), 1 à 5 par planète (moyenne 2,70), **55 effets** répartis common 8 / uncommon 9 / rare 11 / epic 9 / legendary 18, sur 7 stats (production ×3, energy_production, storage ×3), amplitude **+0,05 à +0,25**. Tous sont économiques : aucun biome de combat, d'exploration ou de logistique.
**Où** — `formulas/biomes.ts` (poids **codés en dur** lignes 15-27) · `resource.service.ts:68-77` · tables `biome_definitions` / `planet_biomes` / `discovered_biomes`.
**Réglable** — `planet_types` intégralement en admin. `biome_definitions` : **aucune page d'administration n'existe** — modification SQL uniquement, et les poids de rareté sont en dur.
**Coince** — Le bonus de type est un **multiplicateur** côté moteur alors que tous les autres bonus (biomes, recherche, vocation, politique) sont des **deltas additifs** : `resource.service.ts:437-446` doit convertir l'un en l'autre juste pour l'affichage. Deux systèmes de bonus jamais unifiés. Et surtout, voir ci-dessous : les bonus de biome ne sont pas appliqués sur le chemin qui verse les ressources.

#### ⚠️ Les quatre chemins de calcul de la production

**Joueur** — Il voit un compteur qui monte, un taux « +X/h » et une projection « plein dans X j ». Il croit que ces nombres décrivent son empire. Ce qu'il reçoit réellement est **19,4 % en dessous**.

**Chiffres** — Les ressources sont matérialisées paresseusement (`floor(taux × heures écoulées)`), et **quatre implémentations coexistent avec des entrées différentes** :

| Chemin | Où | Ce qu'il applique | Total mesuré sur 91 planètes |
|---|---|---|---|
| **A — Affichage** | `getProductionRates`, `resource.service.ts:385-450` | biomes + recherche production + energy_production + energy_consumption + gouvernance + vocation + politiques + type de planète + bouclier + shield_percent | **528 423 /h** |
| **B — Matérialisation à la demande** | `materializeResources`, `:244-362` | idem A **sauf** energy_production et energy_consumption | **469 349 /h** |
| **C — CRON (celui qui verse)** | `apps/api/src/cron/resource-tick.ts:57-254`, toutes les 15 min | recherche production + energy_consumption + vocation + gouvernance + type de planète. **PAS de biomes, PAS de politiques, PAS de bouclier, PAS de shield_percent**, aucun filtre sur `status` | **425 740 /h** |
| **D — Aperçu client** | `apps/web/src/pages/Buildings.tsx:44-100` | formules brutes × facteur d'énergie. Aucun bonus, aucun curseur | (nombre sur lequel le joueur décide ses upgrades) |

Décomposition de l'écart A→C : biomes absents **−13,4 %**, energyTech absent **−7,2 %**, politiques absentes **−4,5 %**, bouclier non compté **+2,7 %**. 69 planètes sur 91 divergent entre A et C.
**Cinquième problème — la troncature** : le cron passe toutes les 15 minutes, donc `floor(taux × 0,25)` perd la partie fractionnaire **à chaque tick, sans report**. Un flux de 7/h perd 42,9 % en permanence ; **tout flux sous 4/h est gelé à zéro**. 22 flux en prod perdent plus de 2 %.
**Réglable** — Rien : c'est du câblage. L'intervalle du cron est en dur (`worker.ts:100`), contrairement au governor-tick qui lit sa clé de config.
**Coince** — Conséquences directes : (a) les **biomes** (33 définitions, 200 instances actives) et les **politiques d'empire** sont des systèmes complets **sans effet économique réel** ; (b) le compteur du front interpole avec le taux A puis **recule visiblement** toutes les 15 minutes ; (c) la projection « plein dans X j » est optimiste de 19 % ; (d) l'aperçu de la page Bâtiments sous-estime le gain d'un upgrade de 20 à 35 % sur une planète à biomes. Le test `composition-parity.test.ts:62-70` avait flairé le problème et l'a laissé en statut `a_trancher`.

#### Leviers hors mines

**Chiffres** — **Recherche** (branche `economy`, 5 technos) : `energyTech` +2 %/niv d'énergie produite · `semiconductors` −2 %/niv de consommation · `deepSpaceRefining` −15 %/niv de scories · `rockFracturing` **asymptotique** (`soft_cap_max` 2,25, `k` 0,15 — le `percent_per_level = 15` **n'est pas lu**) : +32 % au niveau 1, **+174 % au niveau 10, +214 % au niveau 20**, asymptote +225 % · `temperateProduction` +2 %/niv sur les trois productions, **seule techno du jeu qui augmente le rendement des mines**, et elle exige un Bio-Laboratoire donc une planète tempérée.
**Vocation** : minière +20 % production / +15 % temps de construction ; industrielle −10 % / −20 %. Cooldown 168 h, reconversion 50 000 M + 25 000 S, débloquée au niveau d'empire 5.
**Politiques** : voir §2.10.
**Gouvernance** : malus de récolte −15 / −35 / −60 % selon le dépassement de capacité.
**Coince** — L'arbre économique ne contient **aucune techno de rendement minier accessible à tous**. Il n'y a donc pas de courbe de progression économique par la science : la seule décision est l'ordre des upgrades, et elle est solvable. Une simulation gloutonne sur les vraies formules reproduit l'état exact des meilleurs joueurs (mine 26 / silicium 21 / hydro 18 / centrale 26 / entrepôts 10-11) — **il n'y a pas de bifurcation**. Vocation minière : 4 planètes sur 91 ; industrielle : **zéro**. Le malus de gouvernance n'a **jamais** déclenché.

#### Stockage blindé

**Chiffres** — `protégé = min(stock, floor(capacité × (1 + bonusStockageBiome) × 0,05 × resolveBonus('armored_storage')))`. La recherche `armoredStorage` donne +5 %/niveau linéaire (max 20 → ×2,0, soit 10 % de la capacité). Sur un entrepôt niveau 10 : 267 750 protégés, 535 500 à armoredStorage 20.
**Coince** — La protection est indexée sur la **capacité**, pas sur le stock : monter ses entrepôts « pour rien » protège mécaniquement plus. Et les deux appelants lisent la clé inexistante `storage_config`, donc retombent silencieusement sur des constantes en dur.

---

### 2.2 Bâtiments et file de construction

17 bâtiments, un seul chantier par planète, **pas de file**. Les bâtiments sont le vrai squelette du jeu : shipyard 1→7 débloque les **13 vaisseaux**, arsenal 1→8 les 5 défenses, researchLab 1→7 toute la recherche (et il est réservé à la planète mère).

#### Catalogue

**Chiffres** — 17 lignes, **7 catégories bâtiment** (`entity_categories` compte 19 lignes dont 7 de type `building` — toutes utilisées ; les 3 lignes de type `build` sont des catégories de *temps de construction d'unités*, pas des catégories de bâtiment).
Extraction 3 (mineraiMine 60/15/0 cf 1,5 · siliciumMine 48/24/0 cf 1,6 · hydrogeneSynth 225/75/0 cf 1,5, base_time 45 s) · Énergie 1 (solarPlant 75/30/0 cf 1,5) · Industrie 2 (robotics et shipyard 400/200/100 et 400/120/200, cf 2, bt 60 s) · Stockage 3 (1000/0/0 · 1000/500/0 · 1000/1000/0, cf 2) · Recherche 6 (researchLab 200/400/200 cf 2 + 5 labos annexes 8000/16000/8000 cf 2, bt 3600 s) · Militaire 1 (arsenal 400/200/100 cf 2) · Défense 1 (planetaryShield 2000/2000/0 cf 1,5, bt 7200 s).
**3 valeurs distinctes de `cost_factor`** : **1,5 → 4 bâtiments** (mineraiMine, hydrogeneSynth, solarPlant, planetaryShield), **1,6 → 1** (siliciumMine), **2,0 → 12**. 4 valeurs de `base_time` (45 / 60 / 3600 / 7200 s). **8 bâtiments sur 17 ne coûtent aucun hydrogène.**
6 bâtiments sont restreints par `allowed_planet_types` (researchLab → `homeworld`, chaque labo annexe → son biome). **8 lignes portent un `role` non nul** (4 producteurs, 3 stockages, planetaryShield) ; le gouverneur n'en exploite que 7 (il ignore planetaryShield).
**Réglable** — Tout en admin sauf `allowed_planet_types` (absent des formulaires → SQL requis) et `variant_planet_types`.
**Coince** — Les 5 labos annexes sont **strictement identiques** en coût, temps et courbe : c'est un seul bâtiment décliné 5 fois. L'aperçu des niveaux dans l'admin (`Buildings.tsx:70-98`) **n'applique pas le multiplicateur de phase** : il affiche mineraiMine niveau 1 à 60 minerai alors que le jeu facture 21 — l'équilibrage se règle sur des chiffres faux de −65 % à −5 % sur les 7 premiers niveaux.

#### Coût, phase et temps

**Chiffres** — `coût = floor(base × cf^(niveau−1) × phase(niveau))` avec phase = {1:0,35 · 2:0,45 · 3:0,55 · 4:0,65 · 5:0,78 · 6:0,90 · 7:0,95}, puis 1,0.
mineraiMine : L1 = 21/5 · L5 = 236/59 · L10 = 2 306/576 · L15 = 17 515/4 378 · L20 = 133 010/33 252 · L25 = 1 010 046/252 511 (cumul L1→L25 = 3 787 042 ressources). siliciumMine L20 = 362 677/181 338. researchLab cumul L10 = 805 384, L15 = 26,2 M. storageMinerai L15 = 16 384 000 d'un coup.
**Effet de la rampe de phase** : les sauts réels de mineraiMine (21 → 40 → 74 → 131) sont **×1,90 · ×1,85 · ×1,77**, décroissants vers ×1,50. La marche est donc plus raide au tout début qu'après le niveau 8 — l'inverse de l'intention affichée d'un « lissage early-game ».
`temps = max(1, floor(base_time × cf^(niveau−1) × bonusMultiplicateur × phase(niveau)))`. **Le temps ne dépend pas du coût, il dépend de `base_time`.** mineraiMine L20 = 1,2 j, L25 = 8,8 j ; researchLab/shipyard/arsenal L7 = 1,0 h, L15 = 11,4 j ; planetaryShield L10 = 3,2 j.
Distribution réelle sur 7 293 constructions : **médiane 153 s**, p90 5 911 s, p99 61 509 s, max 247 588 s (68,8 h). 69,2 % durent moins de 10 min.
**Réglable** — `universe_config.phase_multiplier` (JSON, nombre de paliers libre), `base_cost_*`, `cost_factor`, `base_time` par bâtiment. **Il n'existe aucun diviseur global de temps de construction** pour les bâtiments (contrairement à `shipyard_time_divisor` et `research_time_divisor`).
**Coince** — Le mur cf 2 est mesurable, pas théorique : les bâtiments cf 1,5/1,6 atteignent les niveaux 24-26 en prod, **les 12 bâtiments cf 2 plafonnent tous entre 8 et 12**, et les labos annexes entre 3 et 4. Aucune exception. Les trois bâtiments qui verrouillent tout le contenu (shipyard, arsenal, researchLab) ont un mur **100 % financier et 0 % temporel** : 1,8 h de construction cumulée jusqu'au niveau 7, contre 77 511 ressources.

#### Usine de robots et bonus de temps

**Chiffres** — Pour toute source de type `building`, `resolveBonus` applique **`1/(1 + niveau)`** et **ignore totalement `percent_per_level`** (la ligne `robotics__building_time` porte −15, valeur morte). Table : niv 1 ×0,500 · 2 ×0,333 · 3 ×0,250 · 4 ×0,200 · 5 ×0,167 · 10 ×0,0909.
4 bonus de ce type : robotics → building_time, researchLab → research_time, shipyard → ship_build_time (2 lignes, catégories industrial et military), arsenal → defense_build_time.
Le bonus est **par planète** : chaque colonie doit reconstruire son usine. Coûts cumulés : niv 4 = 6 228, niv 5 = 15 213, niv 10 = 724 845 ressources.
**Où** — `formulas/bonus.ts:65-66` (le court-circuit `sourceType === 'building'`).
**Réglable** — Presque rien : la courbe `1/(1+n)` est en dur. Les champs `bonus_type` / `soft_cap_max` / `soft_cap_k` existent en base et sont honorés pour les recherches, **jamais pour les bâtiments**.
**Coince** — **Le front affiche une courbe qui n'existe pas** : `apps/web/src/pages/Infrastructures.tsx:53` annonce `0,85^niveau`, soit ×0,52 au niveau 4 (le mode en prod), là où le moteur applique **×0,20**. Le joueur sous-estime son bâtiment d'un facteur 2,6. Coût géométrique (×2) contre bénéfice harmonique (`1/(n+2)` du temps restant) : la distribution réelle sur 89 planètes est 0→9, 1→4, 2→4, 3→13, **4→28 (mode)**, 5→13, 6→11, 7→4, 8→2, 9→1. Personne au-delà de 9. Enfin le simulateur de rythme appelle `buildingTime(def, target, 1)` — **bonusMultiplier en dur à 1** : il ignore l'usine de robots et surestime tous les temps.

#### Prérequis

**Chiffres** — **7 arêtes seulement** : shipyard ← robotics 1 · arsenal ← robotics 2 · les 5 labos annexes ← researchLab 6. Aucun autre bâtiment n'a de prérequis.
Règle de résolution : on compare aux niveaux **de la planète**, sauf si le bâtiment a un `allowed_planet_types` non nul — alors on prend le **max sur toutes les planètes du joueur** (`building.service.ts:186-199`). C'est ce qui permet aux annexes de voir le laboratoire de la planète mère.
**Vers l'aval** : shipyard 1/2/3/4/5/7 verrouille les **13 vaisseaux** (solarSatellite inclus, prérequis shipyard 1) — **aucun vaisseau du catalogue n'échappe au chantier** ; arsenal 1/2/4/6/8 verrouille les 5 défenses ; researchLab 1/2/3/4/6/7 verrouille toute la recherche.
**Coince** — L'arbre est plat : 7 arêtes pour 17 bâtiments, aucune bifurcation, aucun arbitrage. La règle de bascule inter-planétaire est invisible et indevinable. Incohérence : arsenal exige robotics 2 (cumul 900) quand shipyard n'exige que robotics 1 (cumul 252), alors que les deux bâtiments ont exactement le même coût et le même base_time.

#### La « file » — en réalité un slot unique

**Chiffres** — Il n'y a pas de file pour les bâtiments : `startUpgrade` refuse dès qu'une ligne `build_queue` active existe sur la planète. Le statut `queued` existe et sert au chantier spatial ; **0 ligne de type `building` ne l'a jamais porté** sur 7 293 constructions.
**Mesure d'occupation** : sur les 81 planètes ayant ≥10 constructions (90 en moyenne), le chantier est occupé **6,5 % du temps calendaire**. Temps mort médian entre deux constructions : **2 644 s (44 min)**, pour une durée médiane de 153 s. 47 % des intervalles dépassent 1 h ; **28 % font moins d'une minute** — le joueur qui reclique aussitôt.
**Réglable** — Rien. Le slot unique est en dur (pas de `max_building_slots`). La colonne `facility_id`, qui permettrait déjà de modéliser plusieurs chantiers, reste à NULL.
**Coince** — La contrainte ne crée aucun arbitrage : elle crée de l'oubli et du re-clic. Asymétrie non expliquée avec le chantier spatial, qui a une vraie file multi-cales, sur la même table.

#### Annulation, complétion, modificateurs, gouverneur, maxLevel

- **Annulation** — `ratio = min(0,7 ; temps_restant / durée)`, remboursement `floor(coût × ratio)`. Annuler immédiatement coûte **30 %**. La ligne `build_queue` est **supprimée** (pas marquée) : aucune donnée n'existe sur les annulations. Le front code 0,7 en dur (`lib/refund.ts:9`) : changer la clé fera mentir l'estimation.
- **Complétion** — Job BullMQ retardé (`jobId: building-<uuid>`), filet de sécurité par `event-catchup.ts`. XP d'empire = `2 × niveau atteint`. **La notification push renvoie vers `/resources`, une route qui redirige vers l'accueil.** La quête journalière se déclenche sur `construction:started`, donc une mine niveau 1 (15 s) la valide.
- **Modificateurs de temps empilés** (`building.service.ts:246-252`) — `floor(buildingTime(def, niv, bonusRobotique × talentMult, phase) × govTimeMult × vocTimeMult × polTimeMult)`. Gouvernance ×(1 + 0,15/0,35/0,60), vocation minière ×1,15 / industrielle ×0,80, politique mobilisation ×1,10 / industrialisation ×0,82. Cas extrême cumulé **×2,02**, meilleur cas **×0,656**. Aucun n'est décomposé dans l'UI ; la prop `speedReductionPercent` prévue pour ça n'est **jamais renseignée**. Cascade dupliquée à l'identique entre `listBuildings` et `startUpgrade`.
- **Gouverneur** — Cron 5 min, débloqué au niveau d'empire 8. Priorités : bilan énergétique négatif → centrale ; entrepôt >95 % → entrepôt ; directive `extraction` → la mine du plus bas niveau. Une seule directive existe. Il ne connaît que les 7 bâtiments à `role` exploités. **4 planètes sur 91.** Le commentaire du cron affirme que `startUpgrade` valide l'énergie : **c'est faux, aucun contrôle d'énergie n'existe** — joueur comme gouverneur peuvent basculer une planète en déficit.
- **maxLevel** — La colonne existe, est chargée, est renvoyée par l'API, et `startUpgrade` refuse au-delà. En base : **0 bâtiment sur 17 a un `max_level`**. Le mécanisme dort. C'est le levier de rééquilibrage le plus rapide disponible sans déployer.
- **Écrans** — `/infrastructures` (441 lignes) est une **page fantôme** : la route existe, aucun lien de navigation n'y mène — et c'est précisément la page qui contient le bug d'affichage de l'usine de robots. Elle référence en prime trois catégories inexistantes en base (`building_exploration`, `building_commerce`, `building_gouvernance`).

---

### 2.3 Recherche

23 technologies en 5 branches × 3 tiers, **4 forks imposant un choix exclusif définitif**, un respec payé en exilium. Le chantier S1 (livré le 2026-06-26) a livré la structure, le gating, le respec, la bascule des joueurs existants et le stat `shield_pierce`. **S2 (exécution par planète) et S4 (les 5 capstones) ne sont pas livrés.**

#### L'arbre

**Chiffres** — armament 4 · defense 5 · economy 5 · intel 5 · propulsion 4. **32 lignes de prérequis.** Le tier est purement organisationnel : `computerTech` est en Tier 3 mais ne demande que `researchLab 1` (c'est la techno la plus accessible du jeu, affichée tout en bas de sa branche), tandis que `espionageTech` (Tier 1) demande `researchLab 3`.
**Où** — Base `research_definitions.branch_id/tier` · la liste des 5 branches est **codée en dur côté front** (`research-tree.types.ts:33-41`) : ajouter une 6e branche en base ne l'affichera pas.
**Coince** — Deux taxonomies coexistent : `category_id` → `entity_categories` (4 vieilles catégories, encore utilisées par l'admin et l'aide en jeu) et `branch_id` (5 branches, utilisées par le jeu). Elles ne coïncident pas. La branche Propulsion n'a aucun fork et est donc structurellement différente des quatre autres, sans explication.

#### Coût et temps

**Chiffres** — `coût = base × 2,0^(niveau−1) × phase(niveau)` — **`cost_factor = 2,0` sur les 23 recherches**, `max_level = 20` partout sauf `deepSpaceRefining` (15) et `planetaryExploration` (aucun cap).
`temps = floor(((coût_minerai + coût_silicium) / 1000) × 3600 × bonus_labo × phase(niveau))`. Deux quirks : **le multiplicateur de phase est appliqué deux fois** (une fois dans le coût, une fois en facteur direct — 0,35² = 0,1225 au niveau 1), et **l'hydrogène ne compte pas** dans le temps.
Cumuls niveaux 1→20 : shielding 838 846 984 · weapons 1 048 558 730 · armoredStorage 2 097 117 460 · rockFracturing 7 339 911 110 · hyperspaceDrive / firepower / shieldBreaker / temperateProduction 37 748 114 280 · stealthTech / sensorNetwork 41 942 349 200.
Durées avec un labo niveau 10 seul : weapons L10 = 1,9 j, L15 = 62 j, **L20 = 1 986 j**. hyperspaceDrive L20 = **59 578 j (163 ans)**.
**Réglable** — Coûts, `cost_factor`, `max_level` par recherche (admin) · `research_time_divisor` (1000) et `phase_multiplier` en base.
**Coince** — Le cap affiché (20) est décoratif sur toute sa moitié droite. Le plafond utile réel est vers 10-12 ; **le meilleur joueur en prod est à 13**.

#### Le multiplicateur de vitesse

**Chiffres** — Produit de 6 facteurs : `1/(1 + niveau_labo)` × `max(0,01 ; 1 − 0,05 × Σ niveaux d'annexes)` × `max(0,01 ; 1 − 0,01 × nb biomes actifs)` × talents × coque du flagship × gouvernance. Plancher final 1 seconde.
**Le bonus d'annexe est linéaire et non plafonné** : 20 niveaux cumulés (≈1,38 M de ressources, soit 13× moins qu'**un seul** niveau 10 de hyperspaceDrive) suffisent à écraser le temps de 99 % et à coller le plancher 0,01.
**Mesure en prod** : le multiplicateur total va de **0,5** pour un débutant à **0,000767** pour Flow (labo 8, 28 niveaux d'annexes, 31 biomes) — un facteur **652×**. Deux joueurs sont déjà au plancher : leur recherche est de fait instantanée (weapons L10 = 23 min contre 10,7 jours pour un labo 1).
**Réglable** — **Presque rien** : les taux −5 %/niveau d'annexe et −1 %/biome sont des paramètres par défaut TypeScript, jamais lus depuis `universe_config`. Le `percent_per_level = -15` de `researchLab__research_time` est **décoratif** (`resolveBonus` ignore ce champ pour les sources `building`).
**Coince** — Le seul multiplicateur linéaire non plafonné dans un système où tout le reste est asymptotique. Deuxième incohérence : le champ s'appelle `discoveredBiomesCount` et l'aide dit « biomes découverts », mais le code compte `planet_biomes.active` sur les planètes **possédées** (200 lignes) et non `discovered_biomes` (1 103 lignes) — **explorer n'accélère rien**.

#### File unique et forks

**Chiffres — file** : une seule recherche pour tout l'empire (`build_queue` filtré par `user_id`), **payée exclusivement sur le stock de la planète mère**, alors que les niveaux sont empire-wide. Le nombre de slots (1) est **codé en dur** : aucune clé, aucun bâtiment, aucune techno ne l'augmente. Annulation à `min(0,7 ; restant/durée)`. XP d'empire = 5 × niveau.
**Chiffres — forks** : 4 forks, 8 voies, **10 recherches sur 23** concernées.

| Fork | Tier | Voie A | Voie B |
|---|---|---|---|
| `defense_doctrine` | **T1 + T2** | shields : shielding, glacialShielding | armor : armor, aridArmor |
| `armament_spec` | T2 | power : firepower | antishield : shieldBreaker |
| `economy_yield` | T2 | production : temperateProduction | efficiency : semiconductors |
| `intel_warfare` | T2 | detection : sensorNetwork | stealth : stealthTech |

Tant qu'aucune voie n'est choisie, **les deux sont verrouillées**. Le choix est gratuit, insert-only, **sans dialogue de confirmation** — c'est la décision la plus irréversible du jeu et elle se prend en un clic.
**Coince — trois défauts vérifiés** :
1. **Le fork Défense casse du contenu externe.** `defense_prerequisites` exige toujours `shielding 1` pour **heavyLaser** et **electromagneticCannon**. Un joueur voie « Blindage » ne peut plus jamais construire 2 des 5 types de défense. **7 joueurs sur 12 sont dans ce cas**, tous avec shielding à 0 ; quatre en possèdent déjà (Flow : 155 lasers lourds + 36 canons) construits avant la bascule.
2. **Le fork Défense casse le tutoriel.** `quest_20` exige `research_level shielding 1` et le tutoriel est strictement séquentiel : un nouveau joueur qui choisit « Blindage » est **définitivement bloqué à la quête 20** et ne verra jamais les quêtes 21 à 23.
3. **Aucune validation d'entrée.** `chooseFork` accepte `z.string()` sans vérification, la table n'a ni FK ni CHECK : `chooseFork('defense_doctrine', 'nimportequoi')` réussit et **verrouille les deux voies**.

#### Respec, bascule, annexes, effets

- **Respec** — `round(5 × 2^respec_count)` exilium par fork : 5, 10, 20, 40, 80… Mise à zéro des niveaux de l'ancienne voie, **aucun remboursement de ressources**, débit de l'exilium **après** commit. Le prix est un placeholder jamais calibré : le 1er respec coûte 5 exilium (le solde moyen est de 52,5) alors qu'il détruit par exemple 1 624 584 ressources. **Zéro respec de recherche n'a jamais eu lieu.** Le respec **n'annule pas la recherche en cours** : `completeResearch` ne revérifie jamais le verrou, donc le niveau est crédité sur une voie verrouillée et compte bel et bien dans les multiplicateurs de combat. Exploit à 5 exilium.
- **Bascule one-time** (2026-06-26) — Script idempotent : voie au coût cumulé le plus élevé conservée, l'autre mise à zéro et **intégralement remboursée** sur la planète mère. Trace : 72 complétions historiques de `shielding` pour 34 niveaux restants, 67 d'`armor` pour 41 — **~64 niveaux effacés chez 12 joueurs**.
- **Labos annexes** — 5 bâtiments identiques (8000/16000/8000, cf 2, bt 3600, prérequis researchLab 6), chacun débloquant une recherche exclusive via `required_annex_type` (champ **non éditable en admin**). Le gating est un OU global (« as-tu ce labo quelque part ? »), pas une contrainte de lieu : l'annexe est un péage, pas un endroit. Double gating non signalé : `aridArmor` et `glacialShielding` sont **en plus** derrière le fork Défense.
- **Effets** — 20 lignes `bonus_definitions` de source `research` couvrant 18 des 23 technos : **13 asymptotiques** (`1 + softCapMax × (1 − e^(−k×niveau))`, typiquement max 1,5 / k 0,15 → ×1,209 au niv 1, ×1,791 au niv 5, ×2,165 au niv 10, ×2,425 au niv 20) et **7 linéaires**. **5 recherches ont leurs effets codés en dur** (espionageTech, sensorNetwork, stealthTech, planetaryExploration, deepSpaceRefining).
  **Empilement multiplicatif non plafonné** : `weapons`, `firepower` et `volcanicWeaponry` produisent tous la stat `weapons` sans catégorie → au niveau 10 chacun, le multiplicateur de dégâts vaut **2,165³ = ×10,15**, très loin du « plafond +150 % » affiché sur chaque fiche. Idem pour armor et shielding (×6,25 chacun).
  `gaseousPropulsion` a `category = NULL` alors que les trois autres propulsions ont une catégorie de drive : c'est donc un multiplicateur de vitesse **universel**, cumulé avec le drive de chaque vaisseau. Outlier probablement non intentionnel.
  **Le tableau de progression affiché au joueur est faux** pour les 13 bonus asymptotiques : `ResearchDetailContent.tsx:164` calcule `percentPerLevel × level`, du linéaire pur. La fiche `weapons` annonce +200 % au niveau 20 (réel : +142,5 %) — trois chiffres contradictoires sur la même fiche.
- **`shield_pierce`** (contenu neuf de S1) — Fraction, pas multiplicateur : `0,6 × (1 − e^(−0,15 × niveau))` → 8,4 % au niv 1, 46,6 % au niv 10, plafond 60 %. Appliquée **uniquement côté attaquant**. **Un seul joueur, niveau 1.** `firepower`, l'autre voie du même fork, n'a jamais été recherché par personne.
- **Capstones (S4)** — Aucune occurrence de `capstone` dans `apps/` ou `packages/`. Les colonnes `unlocks_ship_id` / `unlocks_building_id` n'existent pas. Monter une branche jusqu'au bout ne donne que des pourcentages.

---

### 2.4 Vaisseaux, défenses et chantier

13 vaisseaux, 5 défenses, deux bâtiments producteurs. Système de combat par batteries techniquement soigné, mal calibré. **Rien n'est réglable en production** : `scripts/deploy.sh:46` lance `db:seed`, qui fait un `onConflictDoUpdate` sur **toutes** les colonnes de `ship_definitions` / `defense_definitions` et **supprime puis réinsère** les prérequis.

#### Catalogue vaisseaux

| Vaisseau | M / S / H | Cat. combat | Bouclier / Coque / Blindage | Vitesse | Soute | Prérequis |
|---|---|---|---|---|---|---|
| Intercepteur | 2 250 / 750 / 0 | light | 6 / 12 / 1 | 12 500 | 50 | Chantier 1 + Combustion 1 |
| Frégate | 4 500 / 3 000 / 0 | medium | 16 / 30 / 2 | 10 000 | 100 | Chantier 3 |
| Croiseur | 15 000 / 5 250 / 1 500 | heavy | 32 / 55 / 4 | 15 000 | 800 | Chantier 5 + Impulsion 4 + Armes 3 |
| Cuirassé | 33 750 / 11 250 / 0 | heavy | 40 / 120 / 6 | 10 000 | 1 500 | Chantier 7 + Hyperespace 4 |
| Petit transporteur | 1 500 / 1 500 / 0 | support | — | 5 000 | 5 000 | Chantier 2 |
| Grand transporteur | 4 500 / 4 500 / 0 | support | — | 7 500 | 25 000 | Chantier 4 |
| Prospecteur | 2 250 / 750 / 375 | support | — | 3 000 | 750 | Chantier 2 |
| Récupérateur | 2 250 / 750 / 375 | support | — | 2 000 | 2 000 | Chantier 4 |
| Recycleur | 7 500 / 4 500 / 1 500 | support | — | 2 000 | 20 000 | Chantier 4 |
| Vaisseau de colonisation | 7 500 / 15 000 / 7 500 | support | 80 / 90 / — | 2 500 | 7 500 | Chantier 4 + Impulsion 3 |
| Sonde d'espionnage | 0 / 750 / 0 | support | 0 / 3 / — | **100 000 000** | 0 | Chantier 3 |
| Explorateur | 2 250 / 1 500 / 375 | support | — | 8 000 | 0 | Chantier 3 + planetaryExploration 1 |
| Satellite solaire | 0 / 1 500 / 375 | support | 1 / 6 / — | stationnaire | 0 | Chantier 1 |

**27 lignes `ship_prerequisites`.** Catégories de combat : **1 light, 1 medium, 2 heavy, 9 support**. Le **vaisseau amiral est `medium`** en combat (`attack.handler.ts:156` lit `flagship.combatCategoryId ?? 'support'`, et les 14 lignes de `flagships` sont toutes `medium`) : il est donc **ciblable en priorité 2**, pas protégé. La catégorie `capital` n'existe qu'à deux endroits — la table de catégories du moteur et le calcul de FP.
**Amplitude du catalogue** : **×100 en coût** entre la Sonde (750 M+S) et l'Artillerie à ions (75 000 M+S), **×100 en temps de base** (10 min vs 16 h 40).
**Coince** — `explorer` et `interceptor` partagent `sort_order = 8` (ordre indéterminé). La Sonde à 100 000 000 de vitesse est une valeur sentinelle qui annule la géographie de l'espionnage (10 s de trajet partout). `is_stationary` du satellite n'est vérifié que **côté client**.

#### Catalogue défenses

| Défense | M / S / H | Cat. | B / C / Bl | Batterie | Prérequis |
|---|---|---|---|---|---|
| Lanceur de missiles | 3 000 / 0 / 0 | light | 8 / 14 / 1 | 6 dmg ×2 → Léger + Enchaînement | Arsenal 1 |
| Artillerie laser légère | 2 250 / 750 / 0 | light | 8 / 12 / 1 | 7 ×3 → Léger + Enchaînement | Arsenal 2 + EnergyTech 1 |
| Artillerie laser lourde | 5 625 / 1 875 / 0 | medium | 18 / 35 / 3 | 15 ×2 → Moyen | Arsenal 4 + EnergyTech 3 + Blindage 1 |
| Canon électromagnétique | 16 500 / 12 000 / 1 500 | heavy | 35 / 70 / 5 | 55 ×1 → Lourd | Arsenal 6 + EnergyTech 6 + Armes 3 + Blindage 1 |
| Artillerie à ions | 37 500 / 37 500 / 22 500 | heavy | 60 / 140 / 7 | 90 ×1 → Lourd | Arsenal 8 + EnergyTech 8 + Armes 7 |

Aucune ne génère de débris à la destruction. **50 % des tourelles détruites sont réparées gratuitement** (tirage individuel). `max_per_planet` est NULL sur les 5 — la mécanique de plafond est codée serveur, front et documentée dans l'aide, et jamais utilisée.
**Coince** — La catégorie `defense_boucliers` existe encore dans `entity_categories` mais est vide : les 2 boucliers ont été supprimés par le seed alors que 9 exemplaires avaient été construits. Il ne reste qu'une famille : 5 tourelles à 5 niveaux de puissance, sans choix qualitatif. Les deux tourelles haut de gamme sont des pièges économiques (**11 Artilleries à ions produites en 5 mois, tous joueurs confondus**, contre 1 322 Lanceurs de missiles).

#### Coût, temps, cales, lots

**Chiffres** — Coût = valeur fixe × quantité, **aucun facteur exponentiel**. `temps = floor(((M + S) / 4500) × 3600 × bonusBâtiment)` puis × coque du flagship × gouvernance × politique. **L'hydrogène n'entre pas dans le temps** : l'Artillerie à ions paie 22 500 H sans une seconde de plus.
Temps de base : Sonde 10 min · Satellite 20 min · Intercepteur / Lanceur / Laser léger / Prospecteur / Récupérateur / Petit transporteur 40 min · Explorateur 50 min · Frégate et Laser lourd 1 h 40 · Grand transporteur 2 h · Recycleur 2 h 40 · Croiseur 4 h 30 · Colonisation 5 h · Canon EM 6 h 20 · Cuirassé 10 h · Artillerie à ions 16 h 40. Divisé par `(1 + niveau du chantier)` : Cuirassé = 5 h au niveau 1, 1 h 15 au niveau 7, 28 min au niveau 20.
**Cales** : `shipyard → 2 + floor(talentCtx['shipyard_parallel_build'])`, tout le reste (donc l'Arsenal) → **1**. Le bonus n'est produit que si le joueur possède un vaisseau amiral **et qu'il est sur cette planète** : +1 à chantier ≥ 10, +1 à ≥ 20. Coût cumulé : chantier 10 = 402 692 minerai, chantier 20 = **419 423 492 minerai**.
**Lots** : quantité 1 à 9 999, débit intégral immédiat, `min(quantité, cales libres)` lignes actives de 1 unité chacune + un reliquat `queued`. Le temps unitaire est **recalculé à chaque activation** (monter le chantier accélère rétroactivement la file). Annulation : lot `queued` remboursé à 70 %, lot actif au prorata.
**Coince** — **`startBuild` ne vérifie AUCUN prérequis** : `checkShipPrerequisites` n'est appelé que par les endpoints d'affichage. Un appel tRPC direct produit un Cuirassé sur une planète sans chantier. `getShipyardQueue` n'a **aucun ORDER BY** : l'ordre de file affiché est indéterminé et la fusion de lots (« le dernier d'un tableau non trié ») est non déterministe. L'ETA affichée est fausse dès que la file mélange des types. Le remboursement d'annulation est écrit **sans clamp au plafond de stockage** : « commander 9 999 unités puis tout annuler » est un coffre-fort temporaire à 30 % de frais. Enfin le calcul de temps est **dupliqué 4 fois** dans le même fichier. La 3e cale n'a existé qu'une fois dans l'histoire du jeu (1 planète), la 4e est mathématiquement injouable.

#### Profils d'armes et points de flotte

**Chiffres** — **9 unités sur 18 ont un `weapon_profiles` explicite, pour 12 batteries** (7 vaisseaux, 5 défenses). Chaque batterie = `{damage, shots, targetCategory, rafale?, hasChainKill?}`, toutes tirent en parallèle chaque round.
**Fallback** quand `weaponProfiles` est vide : une batterie synthétique `{damage: weapons, shots: shotCount, targetCategory: 'light'}`. Contenu réel du fallback : **5 vaisseaux seulement** reçoivent 1 dmg × 1 tir (smallCargo, largeCargo, prospector, recuperateur, recycler) ; le **vaisseau de colonisation tire 4 dmg × 1**, `espionageProbe` 0 dmg, `explorer` 0 dmg × **0 tir**, et `solarSatellite` est forcé à 0/0 par `is_stationary`.
**Rafale** (déterministe) : `shots + rafale.count` si la **première** cible de la salve est de la bonne catégorie. Deux occurrences : Croiseur (2 tirs de 6 → 8 contre du léger), Cuirassé (2 tirs de 10 → 6 contre du moyen).
**Enchaînement** : un tir qui détruit sa cible en déclenche un bonus sur une autre unité de la même catégorie, non chaînable. Trois porteurs : Intercepteur, Lanceur de missiles, Laser léger.
**FP** : `dps = Σ(damage × shots + rafale.count × damage × 0,5) × (1,3 si enchaînement)`, ×0,7 si toutes les batteries visent la même catégorie ; `durabilité = bouclier + coque + blindage × 4` (×2 si `capital`) ; `FP = round(dps × durabilité / 100)`.
Valeurs : Intercepteur **2** · Frégate 13 · Croiseur 67 · Cuirassé **166** ; Lanceur 3 · Laser léger 5 · Laser lourd 14 · Canon EM 48 · Artillerie à ions 144. Rapporté au coût (FP par 1 000 M+S) : Intercepteur **0,67**, Cuirassé **3,69**.
**Coince** — **Le FP classe les unités presque à l'inverse de leur valeur réelle** : le Cuirassé vaut 5,5× plus de FP par ressource que l'Intercepteur alors qu'à budget égal l'Intercepteur le bat 100 % du temps. Comme le FP dimensionne les flottes pirates, un joueur en Intercepteurs affronte des pirates trop faibles et l'inverse. Le commentaire de `armorPerPoint: 4` se cale sur « un combat de 4 rounds » alors que `combat_max_rounds` vaut 6 : les poids ont été tunés sur une config disparue.

---

### 2.5 Moteur de combat

`packages/game-engine/src/formulas/combat.ts`, 752 lignes, 50 tests, déterministe (mulberry32). Techniquement propre. **Trois choses cassent l'ensemble** : la régénération intégrale du bouclier crée un seuil binaire, quatre définitions divergentes de la config coexistent, et le moteur ne tourne quasiment jamais en PvP.

#### Boucle et ciblage

**Chiffres** — **6 rounds max** (`combat_max_rounds` = 6 ; le défaut du code est 4). À chaque round on clone les deux camps, les deux tirent simultanément (une unité détruite ce round a quand même tiré), puis `applyDamage`, puis **tous les survivants regénèrent 100 % de leur bouclier**.
**7 catégories de cible** : light(1), medium(2), heavy(3), shield(4), defense(5), capital(6, non ciblable), support(7, non ciblable). `selectTarget` prend une cible **aléatoire** dans la catégorie préférée, sinon parcourt les catégories ciblables par ordre croissant.
**Aucune unité en base n'est `capital`** — les 14 vaisseaux amiraux sont `medium`. `defense` n'existe **qu'à l'exécution** : `attack.handler.ts:168-173` re-étiquette **toutes les défenses** en catégorie `defense` au moment d'une vraie attaque de planète.
**Coince** — **L'override `defense` n'existe que dans ce handler**. Le simulateur en jeu, le codex des contres, le PvE pirate et le raid de colonisation laissent les défenses en light/medium/heavy. Mesure : 30 cuirassés contre 200 lanceurs + 20 artilleries à ions → **63,8 lanceurs détruits en vraie attaque, 1,6 lanceur + 1,8 artillerie dans le simulateur** (40× d'écart). Le joueur teste un jeu qui n'existe pas. Par ailleurs `pve/pirate.service.ts:117-122` **re-déclare sa propre liste de 4 catégories** : les 1 138 combats pirates (91 % de tous les combats du jeu) tournent sur une table de ciblage différente du PvP.

#### Dégâts, bouclier, seuil de concentration

**Chiffres** — Par tir : si `bouclier ≥ dégâts`, le bouclier absorbe tout et la coque est intacte. Sinon `surplus = dégâts − bouclier`, bouclier à 0, `dégâts_coque = max(surplus − armure, 1)`. Puis regen intégrale en fin de round.
**Nombre de coups à concentrer sur la même cible dans un seul round pour la tuer** : intercepteur (4 dmg) → 6 pour un intercepteur, 19 pour une frégate, 63 pour un croiseur, 130 pour un cuirassé, 155 pour une artillerie à ions. Croiseur canon (35) → 3 croiseurs, 6 cuirassés, 7 artilleries. Cuirassé canon (50) → 2 croiseurs, 4 cuirassés, 5 artilleries.
Dégâts de coque du **premier** tir, bouclier plein : le tir d'intercepteur (4) fait **0 sur toute unité de bouclier ≥ 4** — c'est-à-dire toutes sauf deux : `espionageProbe` (bouclier 0, coque 3) est **détruite du premier tir**, et `solarSatellite` (bouclier 1, coque 6) encaisse 3 de coque. Le canon du croiseur (35) fait 0 sur cuirassé, canon EM et artillerie à ions ; celui du cuirassé (50) fait 0 sur artillerie à ions.
**Coince — c'est LE problème de conception.** Regen intégrale + ciblage aléatoire par tir = **il n'y a pas d'usure**, seulement un seuil. Conséquences mesurées : (a) sur le tournoi iso-coût, **10 cases sur 16 donnent 0 % ou 100 %** ; (b) **3 niveaux de recherche d'écart suffisent à annihiler** — 100 croiseurs niv 3 contre 100 croiseurs niv 0 : 100 % de victoire pour **1,1 perte contre 100** (à égalité : 79,7 pertes de chaque côté) ; (c) l'overkill est massif (5 256 points gaspillés dans un 30 cuirassés vs 400 intercepteurs, plus que le bouclier absorbé) ; (d) les traits anti-essaim sont neutralisés par les essaims — la Rafale du croiseur fait 6 dmg contre 6 de bouclier d'intercepteur, donc le premier coup sur chaque cible est toujours absorbé : **10 croiseurs perdent 100 % du temps contre 100 intercepteurs**.

#### Tournoi iso-coût (3 M de M+S par camp, multiplicateurs neutres, 200 combats par case)

| attaquant \ défenseur | 1000 Interc. | 400 Frég. | 148 Crois. | 66 Cuir. |
|---|---|---|---|---|
| **Intercepteur** | 46/10/45 | 0/0/**100** | 0/0/**100** | **100**/0/0 |
| **Frégate** | **100**/0/0 | 28/43/29 | **100**/0/0 | 0/0/**100** |
| **Croiseur** | **100**/0/0 | 0/1/99 | 24/49/28 | **100**/0/0 |
| **Cuirassé** | 0/0/**100** | **100**/0/0 | 0/0/**100** | 12/**74**/14 |

Cycle réel : Intercepteur > Cuirassé > Frégate > Croiseur > Intercepteur, plus deux arêtes de double-contre. Mais 10 cases sur 16 sont binaires, et les miroirs finissent en nul 43 % / 49 % / **74 %** du temps.
**Une flotte mixte perd 100 % de sa valeur contre n'importe quel mono-type de même budget** — vérifié à 150 k, 450 k et 2 M, à recherches 0 comme à recherches 10. Le système de batteries et de catégories, conçu pour encourager les armes combinées, produit l'effet exactement inverse.

#### Bouclier planétaire, débris, réparation, pillage

- **Bouclier planétaire** — `capacité = round(50 × 1,3^(n−1))`, `énergie = ceil(30 × 1,5^(n−1))`. Niveau 1 : 50 pts / 30 énergie ; niveau 10 : 530 / 1 154 ; **niveau 12 : 896 / 2 595 (max en prod)** ; niveau 15 : 1 969 / 8 758 ; niveau 20 : 7 310 / 66 506. Injecté comme unité `__planetaryShield__` (catégorie `shield`, coque 1) et **ressuscité à 100 % au round suivant** : il absorbe jusqu'à `capacité × 6` par combat.
  **Coince** : `attack.handler.ts:260-261` calcule `hasDefenders` uniquement sur les vaisseaux et les défenses — **une planète qui n'a QUE un bouclier est traitée comme non défendue** : victoire instantanée, zéro round, pillage complet. **14 planètes sur 91 sont dans ce cas.** Et le simulateur, lui, compte le bouclier. Falaise d'invulnérabilité entre les niveaux 12 et 15 : 30 cuirassés contre 50 lanceurs → victoire attaquant jusqu'au niveau 12, **match nul avec zéro perte au niveau 20**.
- **Débris** — `floor(0,35 × Σ coûts M et S des VAISSEAUX détruits des deux camps)`. Les défenses ne produisent rien, l'hydrogène jamais, le vaisseau amiral non plus. En prod : 41 champs, 496 767 M + 345 778 S, dernier mouvement le 4 juin.
- **Réparation des défenses** — Tirage indépendant à `rng() < 0,5` par unité détruite. Appliquée en net (`lost − repaired`).
- **Pillage** — Uniquement si l'attaquant gagne. `protégé = capacité × 0,05 × bonus_armoredStorage`, puis `dispo = floor(max(0, stock − protégé) × 0,33)`, réparti en trois tiers de cargo puis redistribué minerai → silicium → hydrogène. En prod : 90 pillages, moyenne 11 437 minerai, max 79 311.
- **Économie du combat** — Un vaisseau détruit restitue 35 % de sa valeur M+S au vainqueur du champ de débris ; **une tourelle détruite restitue 50 % de sa valeur totale, hydrogène compris, directement au défenseur**. La tourelle est donc 1,43× plus résiliente économiquement, avant même de compter qu'elle ne se déplace pas. À budget égal, 150 Lanceurs de missiles détruisent 100 % d'une flotte de même valeur en ne perdant que 13 à 40 unités, dont la moitié se répare.

#### Outillage et instrumentation

- **Simulateur serveur** (`combat.simulate`) : 200 runs par défaut (max 500), seeds dispersés par hash de Knuth. **Trois divergences avec le vrai jeu** : pas d'override `defense`, courbe de recherche **linéaire** `1 + 0,1 × niveau` pour le défenseur (au lieu d'asymptotique — ×1,30 au lieu de ×1,54 au niveau 3), et le codex affiche la catégorie brute de chaque défense.
- **Guide de combat client** (`/guide/combat`) : `buildShipCombatConfigs` **ne recopie pas `weaponProfiles`** — toutes les unités retombent sur le fallback. Écart mesuré : 30 cuirassés contre 200 frégates → **132,2 frégates tuées en 5 rounds dans le vrai moteur, 79,3 en 3 rounds dans le guide** (−40 %).
- **Rapports** — `detailedLog: true` est **codé en dur** et stocké **deux fois** (un rapport par camp). Mesure : 93 unités par camp = 0,37 Mo ; 937 unités = 3,80 Mo ; **3 750 unités = 15,28 Mo × 2 = 30,6 Mo pour un seul combat** — contre 4,1 Mo pour toute la table `mission_reports` aujourd'hui. Le même combat consomme **2 s de CPU synchrone** dans `processArrival` (`selectTarget` filtre tout le camp adverse à chaque tir).
- **Déterminisme** — Le moteur sait rejouer un combat, mais **les vrais combats ne passent aucun seed** (`Math.random`) : aucun rejeu possible en cas de litige. Et les 12 scénarios snapshotés protègent un jeu disparu : `combat.fixtures.ts` fige maxRounds 4, debrisRatio 0,3, defenseRepairRate 0,7, des stats et des coûts supérieurs de 33 %, deux défenses inventées et une liste de catégories sans `capital`.

---

### 2.6 Flotte, missions et déplacements

La couche la plus mature : un pipeline unique (`sendFleet` → job `arrive` → handler de mission → `scheduleReturn` → job `return`) desservant 14 missions via 14 handlers isolés. C'est aussi le domaine le plus utilisé — et le plus déséquilibré : **31,6 % de minage, 19,6 % de transport, 1,5 % d'attaque**.

#### Formules de déplacement

- **Vitesse** = `min` sur tous les types de `floor(baseSpeed × multiplicateur)`. Multiplicateur = `resolveBonus('ship_speed', driveType)`, **asymptotique** : combustion cap 1,5, impulse 3,0, hyperspaceDrive 4,5, et `gaseousPropulsion` cap 1,5 **avec category = NULL donc appliqué à tous les moteurs**. Un croiseur impulse 20 + gaseous 20 monte à 140 085 (×9,34).
- **Distance** (4 cas, avec **enroulement circulaire**) : galaxies différentes `20 000 × min(|dg|, 9−|dg|)` · systèmes `2 700 + 95 × min(|ds|, 499−|ds|)` · positions `1 000 + 5 × |dp|` · même position 5. Concrètement : position voisine 1 005 · bout du système 1 075 · **système voisin 2 795** · +10 systèmes 3 650 · +1 galaxie 20 000 · maximum 80 000. **Traverser tout un système coûte moins cher que d'aller chez le voisin.**
- **Durée** = `round(10 + (35 000 / vitesse) × sqrt(distance × 10))`. smallCargo vers le système voisin = 19,7 min ; recycleur = 48,9 min ; recycleur à +4 galaxies = 4 h 21. Le retour est **recalculé au départ** avec les recherches du moment.
- **Carburant** = `max(1, round(conso × n × (distance/35 000) × facteur))` **par type**, puis `max(1, ceil(somme))`. Cas réels : minage {largeCargo 10, prospecteur 15} intra-système = **37 H2** pour un cycle qui rapporte 21 000 ressources. **Le retour est gratuit.**
- **Slots** = `floor(resolveBonus('fleet_count'))` + bonus de politique. Une seule source : `computerTech`, +100 %/niveau → **slots = 1 + niveau**. Coût cumulé du niveau 10 (11 slots) : 402 692 Si + 604 038 H2.
**Coince** — **Les deux compteurs de slots divergent** : `getFleetSlots` ajoute le bonus de politique et exclut les raids de colonisation ; `sendFleet` n'ajoute pas le bonus et compte tous les événements actifs. Un joueur en posture Mobilisation voit 6/6 libres et se fait refuser le 6e envoi. `buildFleetConfig` n'injecte pas `maxSystems`/`maxGalaxies` : changer la taille de l'univers laisse l'enroulement calibré sur l'ancien. Et le routeur accepte des coordonnées hors univers → distance négative → `sqrt(négatif)` = NaN → **Invalid Date**, avec ressources et vaisseaux déjà débités.

#### Le pipeline d'envoi

**Chiffres** — 18 étapes séquentielles : propriété, slots, auto-ciblage (bloqué pour `spy` et `attack` seulement), disponibilité des vaisseaux, validation du flagship, calculs, soute, `validateFleet` de la mission, puis `spendResources`, `UPDATE planet_ships`, `INSERT fleet_events`, validation PvE, liaison marché, job BullMQ, flagship en mission, quête, notification, job de détection.
**Coince — critique** : **aucune transaction.** Les étapes 9 à 18 s'exécutent hors transaction ; le seul rollback concerne la réservation d'offre de marché. Un échec après l'étape 9 laisse le joueur amputé de ses ressources et de ses vaisseaux, potentiellement avec une **flotte fantôme immortelle** consommant un slot. La validation PvE se fait **après** l'insert. TOCTOU sur les vaisseaux (SELECT puis UPDATE non atomiques) et sur les slots. Les validations de composition sont incohérentes : `exclusive` n'est appliqué côté serveur que par spy/recycle/colonize, et **`AttackHandler.validateFleet` ne vérifie aucun rôle** — un appel API direct attaque avec un seul smallCargo.

#### Retour et rappel

- **Retour** — Vaisseaux re-crédités atomiquement, cargaison ajoutée, flagship à quai. Missions **sans retour** : station, colonize (succès), colonize_reinforce, abandon_return, colonization_raid, flotte détruite.
  **Coince** : le dépôt de cargaison **ne vérifie aucun plafond de stockage** (`fleet.service.ts:600`, idem dans transport/station/colonize_reinforce). **La flotte est un entrepôt infini gratuit.** Si la planète d'origine a été supprimée, tout est perdu silencieusement.
- **Rappel** — Possible en phase `outbound`, `prospecting`, `mining` ; interdit pour `trade` et `colonization_raid`. Deux régimes : mine et pirate en `outbound` → **annulation instantanée** (delay 0, retour depuis n'importe où) ; sinon le retour dure « le temps écoulé depuis `departureTime` ».
  **Coince — exploit vérifié** : `MineHandler` **écrase `departureTime` à l'entrée de chaque phase**. Rappeler une flotte 30 secondes après le début de la prospection la ramène chez elle **en 30 secondes**, quelle que soit la distance parcourue. Téléportation gratuite. Aucun remboursement de carburant. Et il est impossible de rediriger une flotte vers une autre de ses planètes — le besoin logistique de base d'un 4X.

#### Détection

**Chiffres** — À l'envoi d'une mission dangereuse contre un autre joueur : `score = sensorNetwork(défenseur) − stealthTech(attaquant)`, comparé à `scoreThresholds` **[0, 1, 3, 5, 7]**, et le job de détection est planifié à `(100 − timingPercent) %` du trajet avec `timingPercents` **[20, 40, 60, 80, 100]**. Palier 0 = alerte nue à 80 % du trajet ; palier 4 = identité complète dès le départ.
**Réglable** — `attack_detection_score_thresholds` et `attack_detection_timing` sont **lues** par le code mais **absentes des 143 clés** : le système tourne sur ses valeurs de repli.
**Coince** — Avec le palier 0 comme minimum, **toute attaque est détectée** : il n'existe aucun état « non détecté », le stealthTech ne fait que retarder. En prod, sensorNetwork moyen 0,5 et stealthTech moyen 0,3 : **tout le monde était au palier 0**, la grille de 5 paliers n'a jamais été exercée.
**Bug vérifié** : les **raids pirates de colonisation n'apparaissent jamais** dans la liste des flottes entrantes. La requête exige `mission IN (dangerousMissions)` **ET** `(autre joueur détecté OU mission = colonization_raid)` — mais `dangerousMissions` est construit depuis `config.missions`, issu de `mission_definitions`, **où `colonization_raid` n'a pas de ligne**. La clause OR écrite spécialement pour eux est morte. Le worker prend pourtant soin de fixer `detectedAt` et `detectionScore = 9999`.

#### Les 14 missions

| Mission | Envois | Joueurs | Règle marquante | Friction principale |
|---|---|---|---|---|
| **mine** | 2 631 (31,6 %) | 14 | 4 phases ; extraction `3 000 / prospecteur` ; durée `max(5, soute/extraction × 10)` min ; scories `0,5 × 0,85^niv` | L'aide conseille d'ajouter des cargos ; au-delà de `soute = 2 × extraction` c'est **contre-productif** |
| **transport** | 1 628 (19,6 %) | 14 | Aucune validation, cible n'importe qui | Cargaison moyenne **1 113** : navette de survie, pas logistique. Aucun plafond de stockage |
| **recycle** | 1 187 (14,3 %) | 10 | Collecte **séquentielle** (minerai d'abord) | Recycleurs = vaisseaux les plus lents (2 000) ; principal immobilisateur de slot |
| **pirate** | 1 166 (14,0 %) | 11 | Butin plafonné **deux fois** | Rappel instantané en `outbound` = annulation gratuite après lecture du FP |
| **explore** | 661 (7,9 %) | 8 | Scan `1 800 / (1 + 0,1 × niveau)` s | **Toutes les constantes sont en dur** — seule mécanique du domaine non réglable |
| **station** | 368 | 10 | Transfert définitif entre ses propres planètes | Pas de flotte alliée stationnée : brique manquante des alliances |
| **spy** | 327 | 8 | Visibilité par seuils `[1,3,5,7,9]`, détection `sondes × 2 − Δtech × 4` | **`dangerous = false`** → la cible reçoit une notification temps réel nommant l'espion **à l'envoi**. Tout le sous-système de furtivité est annulé |
| **attack** | 128 (1,5 %) | 8 | Voir §2.5 | `required_ship_roles` n'est lu que par le front |
| **colonize** | 78 | 12 | Voir §2.8 | Marquée `dangerous = true` (détournement du drapeau) → bouton rouge pour une action pacifique |
| **colonization_raid** | 58 | système | FP `10 × ipc^1,4 → cap 35 × ipc^1,8`, ×2 par vague | Invisible dans les entrantes ; pas de ligne `mission_definitions` donc libellé brut affiché |
| **trade** | 53 (0,6 %) | 9 | Réservation atomique, non rappelable | `market_reservation_minutes = 60` alors qu'un trajet peut durer 4 h 21 |
| **colonize_reinforce** | 22 | 5 | Garnison + bonus de convoi | 58 raids pour 22 renforts : la contre-mesure n'a pas fonctionné |
| **abandon_return** | 3 | 1 | Seule mission créée dans une **vraie transaction** | Masquée par détournement de `requires_pve_mission` |
| **scan** | 0 | — | Handler existant mais mort | Doublon de `flagship.scan`, atteignable par API directe |

**Cohérence des ensembles** : 16 valeurs dans l'enum Postgres `fleet_mission`, 13 dans l'enum TypeScript, **12 lignes** dans `mission_definitions`, **14 handlers**, 14 missions présentes en base. **`fleet_phase` compte 5 valeurs** : outbound, prospecting, mining, exploring, return — `base` n'existe que comme clé `ui_labels` (`phase.base`), un libellé orphelin.
**Surface de configuration** — L'écran admin Missions n'expose que 5 champs cosmétiques (label, hint, buttonLabel, color, sortOrder) alors que l'API en accepte 10 : les cinq qui pilotent le gameplay (`dangerous`, `exclusive`, `required_ship_roles`, `recommended_ship_roles`, `requires_pve_mission`) exigent du SQL. Le champ `required_ship_roles` contient tantôt des **IDs de vaisseau** (attack, transport), tantôt de vrais **rôles** (recycle, mine, explore).
**Presets de flotte** — Table, service, 4 procédures tRPC, composant de 241 lignes, plafond de 20 par joueur : **1 seul preset existe en base**, pour 1 joueur sur 25. Le preset ne mémorise que la composition, pas la mission ni la destination — et 54 % des envois ne contiennent qu'un seul type de vaisseau.
**Trois leviers morts** : `fleet_speed`, `fleet_fuel`, `fleet_cargo` sont lus dans le code et produits par personne (référencés dans `LEVIERS_MORTS_CONNUS` du test `bonus-levers.test.ts`).

---

### 2.7 PvE : pirates, ceintures, exploration

Trois boucles très inégales : le **minage** est le seul PvE réellement joué, les **pirates** sont un décor (99,1 % de victoires), l'**exploration** est entièrement facultative — mais elle sert, sans que le jeu le dise.

#### Centre de missions

**Chiffres** — Le « niveau de centre » n'est pas un bâtiment : `3 + floor((niveauEmpire − 1) / 5)`. Cooldown = `max(1, 7 − niveauCentre)` heures → **4 h au démarrage**, 1 h à partir du niveau 6 (empire 16). Deux timers indépendants, décalés de cooldown/2. Caps : **3 gisements**, **2 pirates** (la clé `pve_max_pirate_missions` n'existe pas, défaut en dur). Matérialisation **paresseuse** : rien n'est tiré si le joueur n'ouvre pas la page.
**Coince** — La page annonce « 6 h au niv. 1 » alors que le niveau plancher est 3 (donc 4 h). Le front duplique la formule et les caps en dur. L'aide promet un « cooldown 24h » sur l'annulation d'un gisement : **il n'existe pas**. `expireOldMissions()` et sa clé `pve_mission_expiry_days` sont du **code mort** (aucun appelant). Et le couplage niveau d'empire ↔ niveau de missions **n'a jamais tourné** : `empire_xp_log` ne contient aucune ligne de source `pve`.

#### Gisements et ceintures

**Chiffres** — Candidats : systèmes `home ± 5` × positions [8, 16] = **22 coordonnées possibles**. Taille du dépôt : `floor((15 000 + 5 000 × (niveau−1)) × variance[0,6 ; 1,6])` → **15 000 à 40 000 au niveau 3**. Composition 0,60/0,30/reste, **hydrogène plafonné à 1 500** et l'excédent redistribué.
Ceintures : créées paresseusement, chacune avec **3 à 5 dépôts d'ambiance** (position 8 → 20 000-40 000 ; position 16 → 40 000-80 000). En base : **242 ceintures, 3 082 dépôts**. Position 8 : 29 981 unités de moyenne dont 922 d'hydrogène ; position 16 : 59 720 dont **33 139 d'hydrogène** (36× plus).
**Coince** — **985 dépôts sur 3 082 (32 %) ne sont accessibles par personne** : le seul chemin vers un dépôt est `mission.parameters.depositId`, et les dépôts d'ambiance n'ont aucune mission. Toute la richesse en hydrogène de la position 16 est décorative. Les dépôts ne sont jamais supprimés (jusqu'à 113 par ceinture). La planète « maison » de référence est déterminée par un `SELECT ... LIMIT 1` **sans ORDER BY** : les gisements peuvent se déplacer autour d'une autre colonie sans raison visible. Toutes les constantes de ceinture sont en dur dans le service.

#### Minage

**Chiffres** — 4 phases : aller → `prospecting` → `mining` → retour.
Prospection : `5 + floor(quantité/10 000) × 2` minutes, divisé par `1 + prospection_speed` (coque industrielle +45 %) → ~11 min pour un dépôt de 30 000, 7,6 min avec la coque.
Extraction : durée `max(5, soute / extractionFlotte × 10)` min ; quantité `min(extractionFlotte, soute × (1 − scories))`, répartie au prorata du restant.
`extractionFlotte` = 3 000 par prospecteur (seul vaisseau minier) × `resolveBonus('mining_extraction')`. Le vaisseau amiral à coque industrielle a `miningExtraction = sa soute`.
**Scories** : `min(0,99 ; 0,50 × 0,85^niveau_deepSpaceRefining)` → 50 % au niveau 0, 30,7 % au niveau 3, 9,8 % au niveau 10, **4,37 % au niveau 15 (max)**. Valeur **unique et globale**, indépendante de la position.
Rendements réels : 1 prospecteur seul → 5 min, **375 unités**. Coque industrielle seule → 6,9 min, **6 833 unités**. Flotte de fin de partie observée (extraction 110 818, soute 261 250) → 23,6 min, **55 731 unités nettes en un voyage**.
**Réglable** — `slag_rate` (0,5) en base. Le coefficient **0,85 par niveau est en dur** : `deepSpaceRefining` est la seule recherche du domaine sans ligne `bonus_definitions`, donc non rééquilibrable en back-office. Les bonus de coque (0,45) sont en dur dans le seed.
**Coince** — 50 % de scories au départ est un impôt énorme, invisible à l'envoi. Le prospecteur (vitesse 3 000) est le vaisseau non stationnaire le plus lent avec les recycleurs : l'ajouter à une flotte de grands transporteurs divise sa vitesse par 2,5. Les bonus de coque s'appliquent dès que le joueur **possède** une coque industrielle, même si le vaisseau amiral reste à la maison. Enfin **les rapports de minage sont purgés au bout de 3 jours** (`cleanupOldReports` n'exempte que `attack` et `pirate`) : 2 631 vols de minage, **26 rapports survivants** — aucun historique possible.

#### Régénération des dépôts — mécanique morte

Quand un dépôt atteint 0, `regenerates_at = NOW() + 4 à 8 h`, et un cron toutes les 30 min le recharge (20 000-40 000 en position 8, **40 000-80 000 en position 16**, souvent plus gros que le dépôt d'origine).
**Coince** — Vider un dépôt appelle `completeMission` : la mission passe en `completed` et n'est plus jamais offerte. **Le dépôt rechargé n'est rattaché à aucune mission disponible : personne ne pourra jamais le miner.** En base : **0 dépôt en régénération, 0 dépôt vide, 3 082 pleins**. Le cron tourne toutes les 30 minutes pour remplir des coffres que le jeu ne rouvre pas.

#### Pirates

**Chiffres** — 10 templates (3 easy, 4 medium, 3 hard). Tier `easy` toujours disponible, `medium` au niveau de centre 4, `hard` au 6 ; tirage **uniforme** parmi les tiers débloqués.
`targetFP = min((fpMin + rnd × (fpMax − fpMin)) × niveauCentre, fpJoueur × 0,8)` avec easy 2-5, medium 5-12, hard 15-30 → **maximum théorique 180 FP** au niveau 6.
Butin : `récompenseTemplate × (pirateFP / baseFP) × 0,1 × (1 + pve_loot)`, figé à la génération.
Combat : moteur PvP standard, **aucune défense, aucune technologie** côté pirate.
**Réalité mesurée sur 1 138 combats** : **1 128 victoires (99,1 %)**, 7 égalités, 3 défaites. **FP joueur moyen 5 133 contre 117 côté pirate (44:1)**, **1,25 round**. 16,7 % des combats coûtent au moins un vaisseau. Butin moyen **10 128 unités** — cinq fois moins qu'un voyage de minage de fin de partie.
**Coince** — Le cap `pirate_fp_player_cap_ratio = 0,8` **ne mord jamais** : c'est le plancher (échelle absolue ≤ 180) qui est le problème. **`scaleFleetToFP` détruit l'identité des templates** : « Armada pirate : 3 croiseurs, 4 frégates, 2 cuirassés » est stocké en base comme `{"frigate": 14}` ; le petit transporteur a un **FP de 0**, donc `smuggler_convoy_easy` devient `{"interceptor": 5}` — le convoi de contrebandiers n'a plus de convoi. **644 missions pirates sur 1 232 (52 %) ont été générées sur des coordonnées occupées par une planète réelle.** Le joueur a dû ajouter lui-même un filtre « FP min » persisté en localStorage. Enfin le minage ne donne **ni XP, ni exilium, ni quête** : la boucle la plus jouée n'alimente aucune progression.

#### Exploration et biomes

**Chiffres** — Explorateur : 2 250 / 1 500 / 375, vitesse 8 000, **soute 0, armes 0, 0 tir**, prérequis chantier 3 + `planetaryExploration` 1.
Scan : `floor(1 800 / (1 + 0,1 × niveau))` s → 30 min au niveau 0, 15 min au niveau 10.
Probabilité par biome inconnu : `min(0,95 ; 0,20 × (1 + (n−1) × 0,35) × (1 + 0,12 × L) / pénalité)`, pénalités common 1 / uncommon 1,8 / rare 3 / epic 5 / **legendary 8**.
→ 1 explorateur niveau 1 : common 22,4 %, rare 7,5 %, **legendary 2,8 %**. 10 explorateurs niveau 10 : common 95 %, rare 60,9 %, legendary 22,8 %.
**Biomes** : 33 définitions (8 common, 6 uncommon, 7 rare, 6 epic, 6 legendary), **55 effets**. Structure très régulière : 8 biomes universels + exactement 1 de chaque rareté par type de planète → **13 candidats compatibles par type**, aucun pour `homeworld`. Tirage **déterministe par coordonnées**. Amplitudes réelles : **+8 à +10 % pour un common, +8 à +15 % pour un rare, +5 à +22 % pour un epic** (`precursor_relics` est epic et ne porte que +0,05/+0,05/+0,05/+0,10), jusqu'à +25 % pour un legendary.
Second effet souvent oublié : chaque biome **actif** donne **−1 % de temps de recherche**.
**Réglable** — **Rien.** Les sept constantes d'exploration sont en dur dans le moteur ; `biome_definitions` n'a **aucune page d'administration**.
**Coince** — **Coloniser auto-découvre TOUS les biomes de la position** (`colonize.handler.ts:188`) : explorer ne sert donc qu'à *choisir* où coloniser. Résultat mesuré : 200 lignes `planet_biomes` actives sur 207 (96,6 %) alors que **8 joueurs seulement ont exploré**. Mais le repérage marche : **14 colonies sur 67 (21 %) portent un biome légendaire, contre 6,1 % attendus au hasard** (simulation 200 000 tirages) — un enrichissement ×3,4, et personne ne le dit au joueur. **Les 24 planètes mères n'ont aucun biome.** La quête journalière nommée « Explorateur » récompense en réalité le **minage**. Les rapports d'exploration sont purgés à 3 jours : 661 vols, **3 rapports survivants**. `pickBiomes` est réexécuté à trois endroits différents.

#### Rapports d'exploration (marché)

Création gratuite (`creationCost` écrit en dur à `'0'`), le rapport fige un instantané des biomes découverts. Mise en vente à prix libre, coordonnées anonymisées par bucket de 10 systèmes. L'achat exige d'**envoyer une flotte de commerce** chez le vendeur pour acquérir… de l'information. L'acheteur reçoit `selfExplored = false` : **il ne peut pas revendre**, donc pas de marché secondaire.
**En base** : 34 rapports créés, 10 vendus, 24 offres. **Prix médian des rapports vendus : 5 ressources. Prix médian des rapports expirés : 4 250.** Aucun rapport affiché au-dessus de 500 n'a jamais trouvé preneur. La clé `report_creation_biome_costs` (barème 50/100/250/600/1000 par rareté) est **seedée et jamais lue** : il n'existe aucune ancre de valeur.

---

### 2.8 Colonisation, planètes et galaxie

La mécanique la plus travaillée du jeu — refonte du 2026-04-14, processus tické multi-étapes, avant-poste, ravitaillement, raids — et **la moins jouée** : 15 processus enregistrés, le dernier le 23 mai, **zéro échec**.

#### La galaxie et le spawn

**Chiffres** — 9 × 499 × 16 = 71 856 emplacements, moins 8 982 ceintures = **62 874 colonisables**. Occupation réelle : 91 planètes, **0,14 %**. Répartition : galaxie 1 = 72 planètes sur 16 systèmes ; G4 = 12 ; G7 = 3 ; G2 = 2 ; G5 = 1 ; G6 = 1. Position 16 jamais occupée.
**Spawn** : ancre = la planète mère la plus récemment créée ; **`const galaxy = anchor.galaxy` — la galaxie de l'ancre n'est jamais quittée**, ni en phase aléatoire ni en scan séquentiel. Rayon `spawn_radius × (1 + tentative)` avec `spawn_radius` **absent de la base → 10 en dur**. Position tirée entre `home_planet_position_min` (4) et `max` (12).
**Coince** — Les 8 autres galaxies sont décoratives et le code ne peut structurellement pas les peupler. La fourchette 4-12 **n'exclut pas les ceintures** : 3 planètes mères sont posées en position 8, c'est-à-dire sur une ceinture d'astéroïdes. Il n'existe **aucune vue d'ensemble** : chercher une cible de colonisation, c'est parcourir 499 systèmes un par un.

#### Température, types de planète, diamètre

**Chiffres** — `maxTemp = 40 + (8 − position) × 30 + offset`. **L'offset aléatoire ±20 n'est appliqué qu'à la planète mère** (`planet.service.ts:244`) ; les colonies, la galaxie et l'exploration passent tous `offset = 0`. Comme les planètes mères sont bornées aux positions 4 à 12 :
- **maximum réel d'une planète mère : 180 °C** ;
- **maximum réel d'une colonie : 250 °C** (position 1) ;
- minimum : −170 °C (position 15).
**270 °C n'est atteignable par aucun chemin de code.**
La température pilote deux formules : l'hydrogène (`1,36 − 0,004 × Tmax`) et l'énergie des satellites (`max(10, floor(Tmax/4) + 20)`). Combinée aux multiplicateurs de type, elle produit un **écart de 10,5× sur l'hydrogène** entre une glaciale froide (3 567/h au niveau 20) et une volcanique chaude (339/h).
**Le type est tiré au sort par tranche de température**, pas par position fixe. Distribution mesurée sur 4 491 systèmes : positions 1-4 → volcanique 60 %, aride 25 %, tempérée 10 % · 5-7 → aride 45 %, volcanique 25 % · position 9 → tempérée 50 % · 10-12 → glaciale 54 % · 13-15 → glaciale 60 %, gazeuse 35 %.
**Coince** — La colonne `planet_types.positions` est éditable en admin et affichée comme la règle : **aucun code de gameplay ne la lit**. Les tranches de température (`TEMP_BRACKETS`) sont en dur. Le **diamètre** est généré (non seedé), stocké, affiché et **ne sert à aucune formule** : la mécanique OGame des emplacements n'a jamais été portée. Et l'effet le plus structurant de tout le domaine — le facteur 10,5× sur l'hydrogène — **n'apparaît nulle part dans l'interface** au moment de choisir une cible.

#### Le processus de colonisation

1. **Envoi** — Vaisseau à 7 500 / 15 000 / 7 500 (30 000 unités), soute 7 500, vitesse 2 500. Prérequis chantier 4 + Impulsion 3.
2. **Arrivée** — Échecs possibles : ceinture (`belt_positions` = [8,16]) ou position occupée → retour. Sinon la planète est créée en statut **`colonizing`** : improductive, aucune construction possible. Elle reçoit **500 minerai + 500 silicium gratuits** par les défauts SQL (non intentionnel), plus le cargo.
3. **Avant-poste** — Seuils `500 M / 250 S`, mis à l'échelle par `1 + 0,5 × niveauAdmin` (niveauAdmin = capacité de gouvernance − 1) → 1 000/500 à l'empire 5, 2 750/1 375 à l'empire 19. **Deux chemins qui ne testent pas la même chose** : à l'arrivée du vaisseau on regarde le **cargo seul**, à l'arrivée d'un transport on regarde le **stock total**. Délai : **24 h**, sinon échec et suppression de la planète.
4. **Progression** — Worker toutes les 5 min. `taux = 0,11 × difficulté × (stock suffisant ? 1 : 0,5) + bonus`. Difficulté = typeFactor (tempérée 1,00 · aride/glaciale 0,95 · volcanique/gazeuse 0,90) × distanceFactor (`max(0,90 ; 1 − |Δsystème| × 0,01)`, **la galaxie est ignorée**).
   Durées : **9,1 h** (tempérée proche) à **11,2 h** (pire cas), 4,8 h avec les bonus au plafond, 22,4 h en rupture de stock. Durées réelles observées : 6,7 / 7,4 / 7,9 / 7,9 / 8,0 / 9,5 / 16,5 / 18,2 / 30,5 h.
5. **Bonus** — Garnison ≥ **50 FP** → +0,05/h ; convoi → +0,05/h pendant 2 h. **Plafond = 0,10, soit exactement la somme des deux : `colonization_rate_bonus_cap` ne peut jamais mordre.**
6. **Consommation** — `200 M / 100 S` par heure × `(1 + 0,5 × niveauAdmin)`, après 1 h de sursis. Facture totale d'une colonisation de 9,1 h : 1 620 M + 810 S au niveau 0, **8 910 M + 4 455 S à l'empire 19**.
7. **Raids** — Toutes les ~1 h à 1 h 30. `startFP = 10 × ipc^1,4 × (1 + min(0,001 × FP stationné ; 0,5))`, `capFP = 35 × ipc^1,8`, ×2 par vague. Sans garnison : −8 % de progression + **50 % de pillage** ; avec garnison : combat complet, −8 % + 33 % si les pirates gagnent, −4 % en cas de nul. Gabarit de flotte `{interceptor: 3, frigate: 1}` **codé en dur** (la table `pirate_templates` est ignorée).

**Coince** — **La colonisation ne peut pas échouer une fois l'avant-poste posé** : la seule condition est `progress <= 0`, testée **après** le tick qui vient d'ajouter de la progression. 15 processus, 51 raids, **0 échec**. **Personne n'a jamais défendu** : les 21 rapports de raid sont tous `hasGarrison = false`. Le facteur de difficulté ne différencie rien (23 % d'écart entre le meilleur et le pire cas), la distance sature à 10 systèmes et ignore la galaxie. L'écran « Prendre possession » est décoratif (le worker finalise seul dans les 5 minutes). Le **FP de la garnison est calculé avec deux formules différentes** selon qu'on affiche (V2) ou qu'on applique (héritée) : un intercepteur vaut 2 FP dans l'UI et 4 dans le tick — l'indicateur « bonus garnison actif » ment. Enfin l'échec supprime la planète par **CASCADE**, ce qui **détruit silencieusement toute garnison envoyée en renfort** (seul le vaisseau de colonisation est rendu) et menace la contrainte NOT NULL sur `flagships.planet_id` — précaution que le service d'abandon prend explicitement et que le chemin d'échec oublie.

#### Capacité de gouvernance — le vrai plafond

**Chiffres** — `capacité = 1 + floor(max(0, niveauEmpire − 1) / 2)` → L1 = 1, L5 = 3, L11 = 6, L19 = 10. `overextend = max(0, colonies − capacité)`, malus **[0,15 ; 0,35 ; 0,60]** de récolte **et** de construction, planète mère exemptée.
**`maxPlanetsPerPlayer` (= 9) existe en base, est éditable en admin, et n'est lu par aucun code** — la vérification a été retirée lors de la refonte du 14 avril.
**Coince** — **Le malus n'a jamais déclenché** : overextend = 0 pour les 24 joueurs. Flow et JMFion (niveau 19) sont à 10 colonies pour 10 de capacité, zechapeon 9/9, Vladimirovitch 6/6 — tous exactement à la limite. Le niveau d'empire porte **trois rôles à la fois** (capacité, coût de colonisation, puissance des raids) : impossible d'ajuster un axe sans bouger les deux autres. Et le seul palier désirable rend la colonisation suivante plus chère.

#### Vocations, gouverneurs, abandon, renommage

- **Vocations** — Minière +20 % production / +15 % temps de construction ; industrielle −10 % / −20 %. Débloquées au niveau 5, cooldown 168 h, reconversion 50 000 M + 25 000 S. **4 planètes minières sur 91, zéro industrielle** : l'arbitrage n'en est pas un (la production est permanente, la construction ponctuelle).
- **Gouverneurs** — Une seule directive (`extraction`), débloquée au niveau 8, **4 planètes sur 91**.
- **Abandon** — Bloqueurs vérifiés (planète mère, colonisation en cours, hostile entrant, flotte sortante, offres de marché, destination invalide), transaction avec SELECT FOR UPDATE, flagship déplacé **avant** le DELETE. Cargaison chargée minerai → silicium → hydrogène ; le **surplus M+S part en champ de débris, l'hydrogène est purement perdu**. **Aucun remboursement des bâtiments et défenses.** Aucune clé de configuration. 3 abandons en prod.
- **Renommage** — **Une seule fois, définitivement** (`planets.renamed`), sans coût ni cooldown, juste un verrou. 55 planètes sur 91 renommées ; les 36 autres s'appellent toutes « Colonie » dans le même sélecteur.
- **Le tutoriel ne mentionne jamais la colonisation** : les 23 quêtes couvrent mines, énergie, robotique, labo, chantier, flagship, minage, pirates et défenses. Le moment le plus structurant d'un 4X n'est enseigné nulle part.

---

### 2.9 Social : alliances, messagerie, marché, classements

La couche sociale existe, elle est propre, et **elle n'a aucune prise sur le gameplay**. Une alliance ne donne aucun bonus, aucune défense mutuelle, aucun dépôt commun. Le marché est la seule mécanique sociale avec de vraies conséquences économiques.

#### Alliances

**Chiffres** — 3 rôles (founder / officer / member), nom 3-30 UNIQUE, tag 2-8 UNIQUE, blason **12 formes × 17 icônes** + 2 couleurs libres (défaut dérivé d'un hash FNV-1a du tag), devise ≤100. **Aucune limite de membres, aucun coût, aucun prérequis.** Un joueur ne peut appartenir qu'à une seule alliance (contrainte UNIQUE globale).
Journal : **9 types d'événements** (4 militaires, 5 membres), 2 visibilités, **rétention 30 jours**, filtrage sur `created_at >= member.joined_at`.
Chat : **pas de table dédiée** — c'est un fan-out dans `messages` (une ligne par membre). 60 messages distincts → **170 lignes** (×2,83).
**Réglable** — **Rien du tout : zéro clé `alliance_*` sur les 143.** Aucune page d'admin. Les longueurs, catalogues et rôles sont du TypeScript et des enums Postgres.
**Coince** — **Le nom et le tag ne peuvent jamais être changés** (aucun endpoint). La description n'est visible que sur la fiche publique, qui redirige automatiquement si le viewer est membre : **elle est donc invisible pour les membres**. Impossible de transmettre la fondation (`setRole` n'accepte que officer/member). **Bug dur** : les index UNIQUE des invitations et candidatures portent sur la paire (alliance, joueur), pas sur le statut — un joueur décliné ou ayant quitté **ne peut plus jamais être réinvité ni recandidater** : l'INSERT viole la contrainte et remonte une erreur Postgres brute. 5 paires sont déjà verrouillées. `alliance_logs` est **vide (0 ligne)** : la purge à 30 jours combinée à la dormance a tout effacé.

#### Messagerie et amis

- **Messagerie** — Enum `message_type` à **7 valeurs, dont 2 seulement encore produites** (`player`, `alliance`) ; 5 mortes (system, colonization, espionage, combat, mission — 838 lignes historiques). Limite 20 envois / 60 s. Notification SSE + **push web** (seule catégorie push sociale).
  **Coince** : **`deleteThread` supprime la conversation pour les DEUX joueurs** (le DELETE porte sur `thread_id = X AND (sender = moi OR recipient = moi)`), sans avertissement. L'endpoint accepte n'importe quel threadId : passer un allianceId supprimerait tous les messages d'alliance jamais envoyés par ce joueur, pour tout le monde. `countUnread` ne compte que `type='player'` : les messages d'alliance non lus n'apparaissent pas dans la cloche. Aucune pagination, aucun blocage, aucune modération.
- **Amis** — 2 statuts, limite 10 demandes / heure. **Seul usage gameplay** : le carnet de contacts alimente le menu de ciblage de flotte.
  **Coince** : accepter une demande d'ami **révèle les coordonnées de toutes vos planètes**, en permanence et sans exploration — un outil de reconnaissance déguisé en fonction sociale. Et le raccourci de ciblage sert aussi bien à envoyer un transport qu'une attaque. 11 relations en base.

#### Marché

**Chiffres** — Plafond **10 offres simultanées** par joueur (rapports compris). **Commission vendeur = `ceil(quantité × 5 %)`**, débitée à la **mise en vente** et **détruite** (puits économique, jamais remboursée). Expiration **48 h**. Achat : réservation atomique par la mission `trade`, vérification des coordonnées, de la soute et de la capacité de retour ; **une flotte de commerce ne peut pas être rappelée**. À l'arrivée le vendeur est payé, la marchandise repart, et un drop d'exilium à 2 % est tiré.
**En base** : 103 offres (79 ressources, 24 rapports), **54 vendues / 26 expirées / 23 annulées** — **48 % d'échec**. **1 361 060 unités échangées.** Prix unitaires qui se concluent : minerai 0,468 · silicium 1,044 · hydrogène 1,542 (donc 1 H2 ≈ 3,3 minerai). **138 730 ressources brûlées en commission, dont 70 676 (51 %) sur des offres qui n'ont jamais rien vendu.**
Logistique : **53 flottes `trade` sur 8 317 mouvements (0,64 %)**, 24 min d'aller en moyenne.
**Réglable** — `market_commission_percent` (5), `market_max_offers` (10), `market_offer_duration_hours` (48), `exilium_drop_rate_market` (0,02). **Clé morte** : `market_reservation_minutes` (60) n'est lue nulle part. Le talent `market_fee` est lu par le code et **n'existe dans aucune ligne de `bonus_definitions`**.
**Coince** — La commission est une **taxe sur la tentative**, pas sur la transaction. **Les réservations n'expirent jamais** : une offre `reserved` dont la flotte disparaît est bloquée à vie, et le vendeur ne peut pas l'annuler. `listOffers` prend un `planetId` obligatoire **qu'il n'utilise jamais**. L'onglet « Historique » demande le statut `cancelled` que `myOffers` exclut explicitement : les 23 offres annulées n'apparaissent nulle part. L'écran d'achat n'affiche ni vendeur, ni expiration, ni durée de vol. L'aide affirme « vos offres restent actives jusqu'à ce qu'un acheteur les prenne » — **faux, 48 h**. Le pseudo affiché comme « Vendeur » sur un rapport est celui du **créateur**, pas du vendeur.

#### Classements

**Chiffres** — `points = floor(ressources investies / 1000)`, en 4 blocs (bâtiments, recherches, flotte, défenses) **additionnés puis un seul total stocké**. Recalcul global toutes les **30 minutes**.
Exemples : mine de minerai niveau 20 → 498 points ; laboratoire niveau 15 → 26 213 points à lui seul.
Distribution réelle : zechapeon **2 759 515** (compte admin), Flow 123 207, Zecharia 108 275, JMFion 84 277, NKh 27 757, puis chute — **8 comptes à 0 point**. Le n°1 vaut **22× le n°2**.
Alliance = **somme brute** des points des membres : LFI (**1 membre**) 2 759 515 > ARCOM (3 membres) 207 933 > RNS (4 membres) 146 217.
**Coince** — **Le multiplicateur de phase n'est pas appliqué** : une mine niveau 1 coûte 26 ressources et rapporte 75 points (×2,88) ; l'écart tombe sous 2 % au niveau 10, donc il ne fausse que le début de partie — exactement là où tout le monde se trouve. **Les vaisseaux en vol valent 0 point** (le classement lit `planet_ships`, que `sendFleet` décrémente au départ) : on peut masquer sa puissance en gardant ses flottes en l'air. Les quatre sous-scores sont calculés puis jetés : aucun classement économie / militaire / défense n'est possible sans redéployer. Deux formules de rang d'alliance concurrentes (positionnelle vs SQL) divergent en cas d'égalité.

**Gating** — Marché, alliance et classement sont verrouillés derrière `afterTutorial`. **9 comptes sur 22 n'ont jamais terminé le tutoriel** : ils n'ont donc jamais vu la couche sociale.

---

### 2.10 Progression méta : XP, exilium, politiques, vaisseau amiral

Sur le papier une boucle d'engagement cohérente. En pratique les trois piliers sont grippés : **l'exilium n'a plus aucun puits** depuis le 1er juin, **97,2 % de l'XP en base vient d'un backfill de migration**, et le vaisseau amiral a perdu trois systèmes de progression successifs.

#### XP d'empire

**Chiffres** — `XP cumulée pour atteindre L = 100 × (L−1) × L / 2 = 50·L·(L−1)` → L2 = 100, L5 = 1 000, L10 = 4 500, L19 = 17 100, L21 = 21 000, L100 = 495 000.
Barème : bâtiment **2 XP × niveau atteint** · recherche **5 × niveau** · victoire PvE **15** · victoire PvP en attaque **40** · colonisation **150**. Les unités de chantier sont exclues.
Ordres de grandeur : monter un bâtiment de 1 à 20 rapporte 420 XP ; passer de L19 à L21 (3 900 XP) demande ~9 bâtiments montés à 20, ou 26 colonisations, ou 98 victoires PvP.
**Déblocages** : capacité de colonies tous les 2 niveaux · niveau de missions PvE tous les 5 · slot de politique tous les 10 (**plafonné à 3, donc dernier palier au niveau 21**) · vocations au niveau 5 · gouverneurs au niveau 8.
**Réglable** — 7 clés `universe_config` : c'est la partie la mieux configurée du domaine.
**Coince** — **Trois des cinq sources n'ont jamais produit une seule ligne** : `empire_xp_log` contient `admin` 12 lignes / 94 100 XP (backfill de la migration 0095), `building` 89 / 2 620, `research` 5 / 140. Zéro `pve`, zéro `pvp`, zéro `colonization` — le système a été livré le 9 juin, l'activité PvE s'est arrêtée le 2. L'XP organique totale, tous joueurs confondus, en 2 mois : **2 760**. Le joueur le plus actif fait **24 XP/jour**. 13 comptes sur 25 n'ont même pas de ligne. Le niveau max est 100 mais l'échelle politique sature au 21 : **79 niveaux sur 100 n'apportent plus que +1 colonie tous les 2 niveaux**. Et la page `/progression`, seule page qui explique la progression, **n'est dans aucun menu**.

#### Quêtes journalières et exilium

**Chiffres** — Pool de **8 quêtes en dur** (miner 5 000 ressources, builder, navigator, bounty_hunter, warrior, merchant, explorer, recycler). **3 tirées par jour** en excluant les 3 de la veille (donc tirage de 3 parmi 5). **Règle centrale : une seule complétion par jour** — à la première quête validée, les deux autres passent en `expired`. Récompense **1 exilium**. Plafond absolu : **1 exilium / jour / joueur**. Bloqué tant que le tutoriel n'est pas terminé.
**Sources d'exilium** : quête journalière 1/jour · drops aléatoires (pve 4 %, pvp 3 %, market 2 %, recycling 2 %, montant 1) · tutoriel 2 + 3 + 15 = 20 une fois · admin.
**Puits** : réparation instantanée du vaisseau amiral (**2 exilium**) et respec de recherche (`5 × 2^n`). Deux puits historiques supprimés (anomalies, talents).
**Coince** — Le joueur voit trois objectifs et n'en a qu'un : les deux autres sont du décor. **430 complétions en 5 mois**, réparties miner 133 / navigator 102 / builder 97 / explorer 58 / recycler 21 / bounty_hunter 17 / merchant 2 / **warrior 0**. Deux quêtes sur huit sont statistiquement mortes, et cinq sont inatteignables avant 218 à 529 h de jeu — un débutant tire régulièrement 3 quêtes dont 2 impossibles.
**L'économie de l'exilium n'existe plus** : `SELECT count(*) FROM exilium_log WHERE amount < 0 AND created_at >= '2026-06-01'` → **0 dépense, 0 exilium**. **1 259 exilium dormants** sur les comptes. Le respec de recherche n'a **jamais** été utilisé. Le seul puits réellement exercé (19 réparations, −38 exilium au total, dernière le 20 mai) coûte 2 exilium pour économiser 2 heures. **Le journal n'est affiché nulle part** (`exilium.getLog` est exposé et jamais appelé) et **il ne réconcilie pas** : 17 comptes ont un solde supérieur de exactement +40 à la somme de leur journal, un de +66, un de +124 — `setExiliumBalance` écrit le solde sans ligne de log.

#### Politiques d'empire

**Valeurs exactes du code** (`policy.ts:54-112`, **pas de la doc**) :

| Axe | Posture | Effets réels |
|---|---|---|
| Doctrine | `croissance` | production **+12 %** · temps **vaisseaux et défenses** ×1,12 |
| Doctrine | `economie_guerre` | production **−12 %** · temps vaisseaux et défenses ×0,82 |
| Fiscalité | `rendement` | production **+10 %** · gains exilium ×0,9 |
| Fiscalité | `frugalite` | production −8 % · gains exilium ×1,15 |
| Logistique | `mobilisation` | **+1 slot de flotte** · temps bâtiments ×1,10 |
| Logistique | `industrialisation` | production −5 % · temps bâtiments ×0,82 |

Capacité = `min(3, 1 + floor((niveau−1)/10))`. Cooldown 12 h par axe.
**Réglable** — `empire_policy_levels_per_slot` et `policy_switch_cooldown_hours`. **Tout le reste — les 3 axes, les 6 postures, leurs magnitudes — est en dur dans le moteur TypeScript.** Rééquilibrer une posture exige un déploiement.
**Coince** — **L'axe Fiscalité est arithmétiquement inopérant** : tous les gains d'exilium valent 1, et `Math.max(1, Math.round(1 × 0,9)) = Math.max(1, Math.round(1 × 1,15)) = 1`. Donc `rendement` = +10 % de production pour **zéro coût réel** (posture strictement dominante) et `frugalite` = −8 % pour **zéro gain** (strictement perdante). **Le bonus de production des politiques n'est pas appliqué par le cron** qui verse réellement les ressources (voir §2.1). Le cooldown se contourne trivialement : repasser au neutre efface l'horodatage. **2 joueurs sur 25** ont touché cette page ; les deux ont pris `croissance`. Le 3e slot exige le niveau 21, soit ~2,4 ans au rythme organique observé.

#### Vaisseau amiral

**Chiffres** — Stats de départ : weapons 12, shield 16, hull 30, armor 2, shotCount 2, speed 10 000, fuel 75, cargo 5 000. Dès qu'un vaisseau est débloqué, les stats sont **recalculées comme le max des vaisseaux débloqués** (min pour le carburant), sur 10 des 13 fiches (espionageProbe, solarSatellite, recuperateur exclus). Plafonds : weapons 70, shield 80, hull 120, speed 15 000, cargo 25 000.
**Passifs de coque** (clé jsonb `hulls` de `universe_config`) : **combat** = +8 armes, +6 blindage, +2 tirs, −20 % temps militaire, −45 % temps de réparation · **industrielle** = +45 % vitesse de minage et de prospection, −20 % temps industriel, capacités mine/recycle · **scientifique** = −20 % temps de recherche, capacité scan.
Incapacitation : `7 200 s / (1 + réduction)` → 2 h, ou 1 h 23 avec la coque de combat. Réparation instantanée : 2 exilium.
Refit : 5 min d'indisponibilité, **le coût et le cooldown sont commentés dans le service** (`flagship.service.ts:383-400`, « TODO: re-enable after testing ») — **rien n'est débité**.
Scan : sonde virtuelle +5 d'espionnage, sans détection, cooldown 30 min.
**Coince** — **Débloquer son premier vaisseau nerfe le vaisseau amiral** : construire un prospecteur (1/8/15/0) fait tomber l'amiral de 12/16/30/2 à 1/8/15/0. Deux comptes sont dans cet état. **Les trois bonus de combat de la coque de combat ne s'appliquent dans aucun combat** : ils sont conditionnés à `status === 'active'` alors qu'en combat le vaisseau est `in_mission`, et un vaisseau amiral stationné ne défend jamais (`attack.handler.ts:143` n'injecte que celui de l'attaquant). Ils sont pourtant annoncés dans l'UI et dans l'admin. **L'UI du refit annonce un coût de plusieurs centaines de milliers de ressources qui n'est jamais prélevé**, un cooldown qui n'existe pas, et affiche « Prochain changement possible dans 0 jour » (300 s formatés en jours). Le coût affiché est indexé sur l'**exilium total gagné** — plus on a joué, plus changer coûte cher. 5 amiraux sur 14 ont déjà changé de coque, gratuitement. Le portrait est retiré au hasard à chaque changement, écrasant le choix du joueur. Répartition des coques : **9 industrielles, 5 combat, ZÉRO scientifique** — la capacité de scan est écrite, testée et morte (2 activations, dernière le 16 avril).

---

### 2.11 Tutoriel, communication et notifications

#### Tutoriel

**Chiffres** — 4 chapitres, 23 quêtes, 7 types de condition. Récompenses de quête cumulées : **22 275 minerai / 13 000 silicium / 5 475 hydrogène**. Récompenses de chapitre : ch.1 500/300/100 · ch.2 500/500/300 + **2 exilium** · ch.3 **3 exilium** + 1 prospector + 1 smallCargo · ch.4 **15 exilium** + 5 intercepteurs. Total : 2 200 ressources, 20 exilium, 7 unités.
Machine à états : la condition remplie met `pending_completion = true` (pastille ambre) ; **la validation est manuelle** (« Suivant → »), choix délibéré pour forcer la lecture. Deux chemins : poussé (les workers appellent `checkAndComplete`) et tiré (re-mesure à chaque `getCurrent`).
**Coince** :
- **Trois quêtes sur 23 sont gratuites** : q13 et q16 sont identiques (`mission_complete 'mine'`), q22 et q23 sont **strictement identiques**, et q17 (chantier 3) est une régression sur q14 (chantier 4). Temps mesurés : q13 = 0,1 h, q17 = 0,4 h, q23 = 0,2 h.
- **Les récompenses de chapitre ne sont jamais affichées.** L'API calcule et renvoie `chapterReward`, `questReward` et `tutorialComplete` : **aucun n'est lu par le front**. Le joueur qui finit le chapitre 4 reçoit 15 exilium et 5 intercepteurs en silence — et la mutation n'invalide ni `exilium.getBalance` ni `shipyard.ships`.
- **Le vrai mur du tutoriel est ergonomique, pas économique** : la **quête 11 (nommer son vaisseau amiral) prend 15,6 h en moyenne, jusqu'à 155,8 h** — pour deux clics. C'est le seul cas où `getActionLink()` renvoie `null`, et `useTutorialHighlight` ne couvre pas le type `flagship_named`. Les vrais murs économiques sont bien plus modestes : q19 12,4 h, q21 11,4 h, q18 8,2 h, q14 7,0 h.
- Le lien profond de la mission de minage est câblé sur **`quest_17`** alors que la quête concernée est la 16 : l'ajout du chapitre 4 a décalé la numérotation, le front code des numéros de quête en dur.
- `getCurrentProgress` pour `building_level` fait un `.limit(1)` **sans `orderBy`** : avec plusieurs colonies, c'est une planète arbitraire qui est lue.
- L'admin peut **supprimer une quête** sans garde-fou : tout joueur qui pointait dessus est **soft-locké définitivement**, et sa sidebar retombe au chapitre 1.

#### Visibilité progressive des écrans

**18 règles** : `always` (8 chemins), `atChapter(2)` (research, production), `atChapter(3)` (galaxy, fleet, missions), `afterTutorial` (market, alliance, ranking), `afterTutorialWithColonies(2)` (empire, politiques). Fonction pure testée dans `packages/game-engine/src/sidebar-visibility.ts`.
**Coince** — **La navigation mobile ignore complètement les règles** : `BottomTabBar.tsx` n'importe rien du tutoriel, un joueur sur téléphone voit Colonies, Politiques, Marché, Alliance et Classement dès la première minute. `/alliance` et `/ranking` ont été déplacées dans le menu profil **sans condition**. 3 règles portent sur des chemins présents dans aucune navigation. Le routeur déclare ~45 chemins ; 18 seulement ont une règle. Et si la quête courante disparaît, `chapterOrder` retombe à **1** : la nav rétrécit brutalement pour un joueur avancé.

#### Communication

| Canal | Volumétrie | Constat |
|---|---|---|
| **Annonces** (bandeau global) | **0 ligne**, jamais utilisée en 5 mois | 161 l. de service, 361 l. d'admin, **le seul test du domaine** — pour zéro usage. 9 changelogs publiés sans qu'aucun bandeau ne les annonce |
| **Changelog** | 9 articles, **4 commentaires** (3 sur un seul article) | **Aucun indicateur de nouveauté** nulle part. L'article « VOTRE AVIS : Redesign du système de combat » (8 075 car.) n'a recueilli **aucun** commentaire. `adminGenerate` fait tourner `git log` en `execSync` depuis le serveur d'API |
| **Feedback** | 81 fiches, **14 votes** (4 votants), 61 commentaires (**2 auteurs**) | **69 fiches sur 81 (85 %) à zéro vote**, maximum 2 : le tri « Populaires » ne trie rien. Le type `feedback` et le statut `in_progress` n'ont **jamais** été utilisés. **`page_path` n'est renseigné que sur 6 fiches sur 81** — et les 6 viennent des bots. Délai moyen : 87 h (bugs), 280 h (idées) |

#### Notifications — 3 canaux, 24 types, 72 interrupteurs

- **SSE** — Ticket à usage unique, plafond **3 connexions par joueur**, heartbeat 30 s. **22 types publiés, 26 `case` traités côté client.** Trois désynchronisations : `colonization-complete` / `-failed` / `-raid` sont publiés et **traités par aucun case** ; `tutorial-quest-complete` est traité côté front (avec toast) et **jamais publié** ; `market-reservation-expired` est au registre sans être ni émis ni traité. Le contrat de type est `type: string`.
- **Push** — 6 catégories, **5 sites d'appel seulement**. **Seuls 10 des 24 types peuvent réellement partir en push** : les 14 interrupteurs Push correspondants dans l'écran de préférences **ne font rien**. La permission est demandée **au chargement**, sans mise en contexte, par **deux chemins concurrents**. 15 abonnements, tous créés entre le 27 mars et le 28 avril.
- **Cloche** (`game_events`) — 14 types, purge à **30 jours**. **`bellDisabled` est contourné pour les événements les plus fréquents** : les workers font un `db.insert` direct sans passer par `gameEventService.insert`, donc building-done, research-done, shipyard-done, fleet-arrived, fleet-returned et pve-mission-done s'inscrivent **même si le joueur a coché « ne pas afficher »**. Deux registres de libellés parallèles (`ui_labels` 14 clés éditables vs `EVENT_TYPE_LABELS` 24 entrées en dur). En base : **32 lignes, toutes `building-done`, sur 2 comptes**.
- **Préférences** — 10 catégories × 24 types × 3 canaux = **72 interrupteurs**. `pve-mission-done`, `empire-level-up`, `tutorial-quest-pending`, `alliance-log:new` et les trois `colonization-*` sont émis et affichés mais **absents d'`EVENT_TYPE_TO_CATEGORY`** : le bouton « Tout désactiver » ne les couvre pas.
  **Signal d'usage brutal** : **3 comptes sur 25** ont ouvert l'écran, et **2 des 3 ont poussé 22 à 24 types dans les trois canaux à la fois**. Personne n'a fait de réglage fin. La réponse des joueurs au volume de notifications a été l'interrupteur général.
- **Résumé d'absence** — Seuil **30 min**, `previous_login_at` mis à jour uniquement si l'écart dépasse le seuil (pour qu'un refresh de token n'efface pas la référence). 8 pastilles agrégées.
  **Coince** : il dépend entièrement de `game_events`, purgé à 30 jours et vidable par les préférences de cloche — un joueur qui a coupé la cloche verra « Rien de neuf » alors qu'il s'est passé des choses. La pastille « Combats » compte des `mission_reports` (donc du PvE), et une pastille « Missions PvE » compte le même fait sous un autre nom. **Fermer la bannière écrit `previous_login_at = now()` : le résumé est détruit, pas masqué.**

**Couverture de test du domaine** : **2 fichiers** — `announcement.service.test.ts` (314 l., sur la fonctionnalité à 0 ligne en base) et `sidebar-visibility.test.ts` (60 l.). Zéro test sur le tutoriel, les préférences, le feedback, le changelog, le SSE, le push et le résumé d'absence.

---

## 3. Tableau de bord du contenu

**Définitions de contenu** (comptages vérifiés en base ce jour)

| Table | Lignes | Détail |
|---|---|---|
| `building_definitions` | **17** | 7 catégories · cost_factor : 1,5 ×4, 1,6 ×1, 2,0 ×12 · base_time : 45 / 60 / 3600 / 7200 s · **0 avec max_level** · 6 restreints par type de planète · 8 sans coût en hydrogène |
| `research_definitions` | **23** | 5 branches × 3 tiers · cost_factor **2,0 partout** · max_level 20 (sauf deepSpaceRefining 15, planetaryExploration illimité) · 4 forks / 10 technos · 5 gatées par annexe |
| `ship_definitions` | **13** | 4 combat / 2 transport / 7 utilitaires · combat : 1 light, 1 medium, 2 heavy, 9 support · 1 stationnaire · amplitude de coût ×100 |
| `defense_definitions` | **5** | Toutes des tourelles · 2 light, 1 medium, 2 heavy · `max_per_planet` NULL sur les 5 |
| `biome_definitions` | **33** | 8 common / 6 uncommon / 7 rare / 6 epic / 6 legendary · **55 effets** (8/9/11/9/18) · 7 stats · +0,05 à +0,25 |
| `planet_types` | **6** | 5 colonisables + homeworld · 18 multiplicateurs dont **6 valent exactement 1,0** |
| `mission_definitions` | **12** | Pour **14 handlers** et 16 valeurs d'enum Postgres · `colonization_raid` et `scan` sans ligne |
| `pirate_templates` | **10** | 3 easy / 4 medium / 3 hard |
| `tutorial_quest_definitions` | **23** | 4 chapitres (5/5/6/7) · 7 types de condition · 3 quêtes redondantes |
| `entity_categories` | **19** | 7 `building` (toutes utilisées) · 4 `research` (taxonomie legacy) · 3 `ship` · 2 `defense` · 3 `build` (temps d'unités) |
| `bonus_definitions` | **25** | 20 de source `research` (13 asymptotiques / 7 linéaires) · 5 de source `building` (courbe `1/(1+n)`, `percent_per_level` ignoré) |
| `universe_config` | **143** | dont ~45 colonisation/planètes, 33 `colonization_*` (**14 `colonization_raid_*`**), 25 PvE, 22 méta, 11 économie, 7 flotte, 6 combat vivantes + 5 mortes, 6 social |
| Prérequis | **79** | bâtiments **7** · vaisseaux **27** · défenses **13** · recherches **32** |
| Profils d'armes | **12 batteries** | sur 9 unités (7 vaisseaux, 5 défenses) · 2 Rafale · 3 Enchaînement · 9 unités sans profil (fallback) |
| Illustrations flagship | **28** | 8 combat / 12 industrielle / 8 scientifique |

**Contenu déclaré mais jamais exercé**

| Élément | État |
|---|---|
| `max_level` sur les bâtiments | Mécanisme complet, testé, **0 bâtiment plafonné** |
| Catégorie de combat `capital` | Déclarée, **portée par aucune unité** (les 14 flagships sont `medium`) |
| Catégorie `defense_boucliers` | Existe dans `entity_categories`, **vide** |
| `max_per_planet` (défenses) | Codé serveur + front + aide en jeu, **NULL sur les 5** |
| Capstones de recherche (S4) | **Aucune occurrence de `capstone` dans le code** |
| `damageMultiplier` (combat V8.1) | Implémenté et testé, **aucune donnée ne l'utilise** |
| `expireOldMissions()` + `pve_mission_expiry_days` | **Aucun appelant** |
| `report_creation_biome_costs` / `report_creation_base_cost` | Seedées, **jamais lues** (création gratuite en dur) |
| `market_reservation_minutes`, `pve_dismiss_cooldown_hours` | Présentes en base, **jamais lues** |
| `maxPlanetsPerPlayer` | Éditable en admin, **lue par aucun code** |
| `debrisRatio` (0,3), `lootRatio`, `combat_defense_repair_probability` (0,7), `combat_bounce_threshold`, `combat_rapid_destruction_threshold` | **5 clés mortes exposées dans l'onglet « Combat » de l'admin** |
| `attack_detection_*` (2), `spy_*_multiplier` (2), `pve_max_pirate_missions`, `pve_deposit_size_increment`, `pve_composition_*` (3), `spawn_radius`, `colonization_cost_scaling_factor`, `storage_config` | **Lues par le code, absentes des 143 clés** → valeurs de repli en dur |
| Leviers `fleet_speed` / `fleet_fuel` / `fleet_cargo` / `pve_loot` / `market_fee` / `military_build_time` / `industrial_build_time` | **Lus dans le chemin chaud, produits par personne** |
| Directives de gouverneur | Type suggérant un catalogue, **une seule valeur** (`extraction`) |
| Page `/infrastructures` (441 l.) | **Aucun lien de navigation n'y mène** |
| `scan.handler.ts` (91 l.) | **0 événement de flotte `scan`** ; doublon de `flagship.scan` |

---

## 4. Ce que les données disent de l'usage réel

**Périmètre** : 25 comptes (amis de Julien), 24 avec au moins une planète, 91 planètes, 4 connexions dans les 60 derniers jours. Connexions réussies par mois : avril 139 · mai 177 · **juin 31 · juillet 2 · août 2**.

### 4.1 L'arrêt du jeu, domaine par domaine

| Domaine | Dernier acte | Volume total |
|---|---|---|
| Construction de bâtiments | **8 août 2026** (1 en cours) | 7 293 constructions · mars 1 890, avril 4 251, mai 1 021, **juin 93, juillet 12, août 26** |
| Recherche | 8 juillet | 928 complétions · **2 seulement depuis la livraison de S1 le 26 juin** |
| Flotte | **24 juin** (minage) | 8 317 envois · avril 4 903, mai 1 935, **juin 36** |
| Production d'unités | 21 juin (satellites solaires) | 5 090 vaisseaux + 2 681 défenses · **juin : 7 vaisseaux, 1 joueur** |
| PvE pirate | 4 juin | 1 166 envois |
| Combat PvP | **26 mai** | 107 combats |
| Colonisation | 23 mai | 78 envois, 15 processus |
| Exploration | 24 mai | 661 envois |
| Marché | 20 mai | 103 offres |
| Messagerie | 8 mai | 1 506 messages |

### 4.2 Ce qui a été joué

**Missions de flotte** (8 317 envois) : mine **2 631 (31,6 %, 14 joueurs)** · transport **1 628 (19,6 %, 14)** · recycle 1 187 (14,3 %, 10) · pirate 1 166 (14,0 %, 11) · explore 661 (7,9 %, 8) · station 368 (10) · spy 327 (8) · **attack 128 (1,5 %, 8)** · colonize 78 (12) · colonization_raid 58 · trade 53 (9) · colonize_reinforce 22 (5) · colonize_supply 7 · abandon_return 3 · **scan 0**.

**Le jeu est un jeu de minage et de logistique** : 66 % de l'activité de flotte est du minage et du transport, 1,5 % de l'attaque. Explication mécanique : le prospecteur ne demande que **chantier niveau 2 et aucune recherche** — c'est le premier vaisseau accessible et la première mission jouable.

**Portée des trajets** : inter-système 45,3 % · intra-système 42,7 % · **inter-galaxie 7,9 %** · même position 3,6 %. **88 % des flottes restent dans leur galaxie.**
**Complexité des flottes** : **1 seul type de vaisseau dans 54 % des envois**, 2 types dans 31 %, 3+ dans 15 %. La composition de flotte, cœur supposé du système de combat, est triviale dans 85 % des cas.

**Production d'unités** : Intercepteur 1 360 (10 joueurs) · Frégate 634 (9) · Grand transporteur 531 (8) · **Prospecteur 504 (14 joueurs — l'unité la plus universelle)** · Satellite solaire 402 (9) · Croiseur 385 (10) · Cuirassé 266 (6) · Explorateur 251 (12) · Petit transporteur 228 (11) · Recycleur 188 (8) · Sonde 172 (8) · Récupérateur 79 (7) · Colonisation 65 (12).
Défenses : Lanceur de missiles **1 322 (12 joueurs)** · Laser léger 802 (10) · Laser lourd 426 (8) · Canon EM 111 (5) · **Artillerie à ions 11 (3 joueurs)**.

> ⚠️ **Piège de lecture** : `planet_ships` contient 153 552 vaisseaux, dont **135 582 pour le seul compte admin zechapeon** (43 528 intercepteurs sur une planète) — 30× plus que tout ce qui est passé par le chantier. Seuls les chiffres `build_queue` ci-dessus reflètent l'usage réel.

**Niveaux de bâtiment atteints** (planètes / max / moyenne) : solarPlant 90 / **26** / 15,5 · mineraiMine 88 / **26** / 15,1 · siliciumMine 87 / 24 / 13,5 · hydrogeneSynth 90 / 20 / 8,7 · storageMinerai 88 / 10 / 5,1 · storageSilicium 88 / 9 / 4,6 · **robotics 89 / 9 / 3,9** · **shipyard 82 / 10 / 4,1** · storageHydrogene 87 / 10 / 3,3 · **arsenal 68 / 8 / 2,9** · planetaryShield 56 / 12 / 3,4 · **researchLab 47 / 9 / 2,8** · labTemperate 22 / 3 · labGlacial 14 / 4 · labGaseous 16 / 3 · labArid 16 / 3 · labVolcanic 12 / 3.

**Recherches** : 505 lignes dans `user_research_levels` chez 24 joueurs, **dont 334 à zéro**. Top : energyTech (15 joueurs, max 10) · combustion (14, max 11) · computerTech (13, max 12) · weapons (11, max 13). **Aucun joueur n'a jamais dépassé le niveau 13** sur un cap affiché de 20.

**Combats** : 1 138 pirates (91 % de tous les combats) · **107 PvP** · 21 raids de colonisation · 2 espionnages.
Issues PvP : 90 victoires attaquant (84 %), 8 défenseur, 9 nuls. **Distribution des rounds : 0 round → 45 combats (42 %)**, 1 round → 41, 2 → 5, 3 → 4, 4 → 12 (tous antérieurs au passage à 6 rounds). **Depuis la refonte du 25 avril, le combat le plus long a duré 2 rounds**, et 33 attaques sur 37 (89 %) se sont soldées par 0 round — planète sans aucune défense.

### 4.3 Ce qui n'a jamais été joué

| Mécanique | Preuve en base |
|---|---|
| **Respec de recherche** | `respec_count = 0` sur les 30 lignes de `user_research_choices` |
| **Fork `armament_spec`** | 1 joueur, 1 niveau de shieldBreaker, le jour du déploiement. `firepower` : **jamais recherché par personne** |
| **Malus de gouvernance** | overextend = 0 pour les 24 joueurs, **jamais déclenché** |
| **Vocation industrielle** | **0 planète** (4 en minière sur 91) |
| **Politiques d'empire** | **2 joueurs sur 25** |
| **Coque scientifique** | **0 des 14 vaisseaux amiraux** ; 2 activations de scan, dernière le 16 avril |
| **XP d'empire PvE / PvP / colonisation** | **0 ligne** sur les 3 sources ; 97,2 % de l'XP vient d'un backfill admin |
| **Dépenses d'exilium** | **0 depuis le 1er juin** ; 1 259 exilium dormants |
| **Quête journalière `warrior`** | **0 complétion** sur 430 |
| **Annonces** | **0 ligne** en 5 mois |
| **Journal d'alliance** | **0 ligne** (purge 30 jours) |
| **Presets de flotte** | **1 preset, 1 joueur sur 25** |
| **Régénération des dépôts** | 0 dépôt vide, 0 en régénération, 3 082 pleins dont **985 inaccessibles** |
| **Détection au-delà du palier 0** | sensorNetwork moyen 0,5, stealthTech 0,3 : toutes les attaques au palier 0 |
| **Curseurs de production** | **89 % des planètes à 100/100/100** ; 7 des 10 restantes n'ont touché que l'hydrogène |
| **Échec de colonisation** | 15 processus, 51 raids, **0 échec** |
| **Défense d'une colonie en formation** | 21 rapports de raid, **tous `hasGarrison = false`** |
| **Type de feedback `feedback` et statut `in_progress`** | 0 ligne chacun sur 81 fiches |

### 4.4 Entonnoirs

**Tutoriel** (22 progressions enregistrées) : **5 comptes (23 %) n'ont validé aucune quête** · 17 au moins une · 15 ont fini le ch.1 · 14 le ch.2 · 13 le ch.3 · **3 seulement (14 %) ont fini les 23 quêtes**. Durée d'un tutoriel complet : **3,3 jours** en moyenne.
**Dix comptes sont enfermés hors du chapitre 4** : `current_quest_id = 'quest_16'`, `is_complete = true`, 16 quêtes validées, mis à jour entre le 18 et le 29 mars — quand la quête 16 était la dernière. Les chapitres et les quêtes 17-23 sont arrivés ensuite. Comme `getCurrent` sort immédiatement sur `isComplete`, **aucune reprise n'est possible** : ces 10 joueurs ne verront jamais les 7 quêtes, les 9 650 minerai, les 15 exilium ni les 5 intercepteurs du chapitre 4.

**Écosystème social** : 8 joueurs sur 25 en alliance (3 alliances, dont une solo depuis 5 mois) · 10 joueurs ont envoyé un message privé · 8 auteurs de feedback (dont 2 pesant 64 % du volume) · 4 votants · 2 commentateurs · 3 comptes ont ouvert les préférences de notification.

### 4.5 Deux signaux économiques

- **Le marché révèle une valorisation inverse de celle du moteur** : les prix qui se concluent donnent 1 hydrogène ≈ 3,3 minerai et 1 silicium ≈ 2,2 minerai. Or le rendement énergétique du moteur est 3,00 pour le minerai, 2,00 pour le silicium et **0,60 pour l'hydrogène**. Les joueurs valorisent le plus haut ce que la formule rend le moins rentable à produire.
- **Le jeu est un empire figé plein à ras bord** : **83 planètes sur 91 (91 %) ont au moins une ressource au plafond de stockage** (taux de remplissage moyen du minerai : 85,5 %). Stocks totaux : 57,7 M minerai, 40,1 M silicium, 20,0 M hydrogène. Le cron consomme 91 calculs toutes les 15 minutes pour n'ajouter presque rien.

---

## 5. Les frictions, classées

### Niveau 1 — Fondations faussées (tout chiffre d'équilibrage posé dessus est faux)

1. **Quatre calculs de production divergents.** Le jeu **affiche 528 423 ressources/h et en verse 425 740** (−19,4 %). Le cron, seul chemin qui crédite réellement, ignore les biomes (−13,4 %), les politiques (−4,5 %) et energyTech (−7,2 %). Les biomes (33 définitions, 200 instances) et les politiques d'empire sont **des systèmes entiers sans effet économique**. S'ajoute la troncature `floor(taux × 0,25)` par tick : **tout flux sous 4/h est gelé à zéro**.
2. **Le seed écrase la configuration du back-office à chaque déploiement.** `db:seed` fait un `onConflictDoUpdate` sur toutes les colonnes de `ship_definitions` / `defense_definitions` et **supprime puis réinsère** les prérequis. Coûts, stats, batteries, prérequis : **rien n'est réellement réglable en production**. L'outil d'équilibrage ment.
3. **Quatre définitions divergentes de la config de combat** : le moteur (+ base), les fixtures de test (config d'il y a deux refontes), `pirate.service.ts` (sa propre liste de 4 catégories, pour 91 % des combats du jeu), et le guide client (qui jette les `weaponProfiles`). **Le simulateur officiel ne simule pas le jeu** : 40× d'écart contre des tourelles, −40 % de pertes dans le guide.
4. **L'override de catégorie `defense` n'existe que dans un handler sur cinq.** C'est la règle la plus structurante du combat planétaire et elle est cachée dans une boucle de 5 lignes.
5. **Le contenu réglable et le contenu en dur sont mélangés sans logique** : la consommation d'énergie du bouclier, les magnitudes des politiques, les poids de rareté des biomes, la courbe `1/(1+n)`, les 7 constantes d'exploration, les catégories de combat, l'intervalle du cron et les taux d'annexe de recherche exigent tous un déploiement — pendant que 5 clés mortes sont exposées dans l'onglet « Combat » de l'admin.

### Niveau 2 — Boucles de jeu dégénérées

6. **Le combat est binaire.** Regen intégrale du bouclier + ciblage aléatoire par tir = pas d'usure, seulement un seuil de concentration. 10 cases sur 16 du tournoi iso-coût à 0 % ou 100 %, 3 niveaux de recherche d'écart suffisent à annihiler (1,1 perte contre 100), et **une flotte mixte perd 100 % du temps contre n'importe quel mono-type de même budget** — l'inverse exact de l'intention du système de batteries.
7. **La défense statique gagne d'avance.** 50 % des tourelles se réparent gratuitement, elles ne laissent aucun débris, et la bascule `defense` désactive silencieusement toutes les rafales de l'attaquant. Résultat : **0 flotte lancée depuis le 24 juin**.
8. **Il n'y a pas de combat pirate.** 99,1 % de victoires, 1,25 round, 44:1 de rapport de force, et un butin **5× inférieur** à un voyage de minage. Le FP visé est une échelle absolue (≤ 180) qui ne suit jamais la croissance du joueur.
9. **La colonisation ne peut pas échouer** une fois l'avant-poste posé (`progress <= 0` testé après le tick qui vient d'ajouter de la progression). 15 processus, 51 raids, 0 échec.
10. **Le curseur de production n'a qu'une réponse** : ratio constant par niveau (3,00 / 2,00 / 0,60). 89 % des planètes n'y ont jamais touché.
11. **L'économie est un rail unique** : aucune techno de rendement minier accessible à tous, une simulation gloutonne reproduit exactement l'état des meilleurs joueurs. Aucune bifurcation.
12. **L'exilium n'a plus aucun puits** (0 dépense en 2 mois, 1 259 dormants) — et l'axe Fiscalité, qui module l'exilium, est **arithmétiquement inopérant** parce que tous les gains valent 1.
13. **Les alliances n'ont aucun effet mécanique** : ni bonus, ni défense mutuelle, ni dépôt, ni guerre. Un tag, un blason, un chat.

### Niveau 3 — Murs de rythme

14. **529 h avant le premier vaisseau en jeu optimal** (3 504 h en économique), 218 h avant le chantier spatial. Pendant trois semaines, aucune mécanique de flotte n'existe. Le tutoriel court-circuite ce mur (~41 h) et **le simulateur ne le modélise pas** : deux courbes économiques incompatibles cohabitent.
15. **Le mur `cost_factor = 2`** : les 12 bâtiments concernés plafonnent tous entre 8 et 12 en prod, sans exception, y compris les trois qui verrouillent tout le contenu (shipyard, arsenal, researchLab).
16. **Le mur de la recherche** : cf 2,0 + max_level 20 → le niveau 20 de hyperspaceDrive demande 18,9 milliards de ressources et 163 ans. Personne n'a jamais dépassé le niveau 13.
17. **Le slot unique de construction** : chantier occupé **6,5 % du temps**, médiane de 153 s, 28 % des enchaînements en moins d'une minute, 47 % des intervalles au-dessus d'une heure. Ce n'est pas un arbitrage, c'est de l'oubli et du re-clic.
18. **Le mur ergonomique du tutoriel** : la quête 11 (nommer son vaisseau amiral) prend **15,6 h en moyenne, jusqu'à 155,8 h**, faute de lien d'action et de surbrillance.
19. **Le trou d'équilibrage de la recherche** : le bonus d'annexe (−5 %/niveau, linéaire, non plafonné) sature son plancher à 20 niveaux cumulés pour 1,38 M de ressources. **Écart de 652× entre deux joueurs du même univers.**

### Niveau 4 — Contenu bloqué ou cassé

20. **Le fork Défense supprime 2 des 5 défenses du jeu** (heavyLaser, electromagneticCannon exigent toujours `shielding 1`) pour **7 joueurs sur 12** — dont 4 en possèdent déjà, construites avant la bascule.
21. **Le fork Défense bloque définitivement le tutoriel** à la quête 20 pour tout joueur voie « Blindage ». Et **10 comptes sont déjà enfermés** hors du chapitre 4 par un décalage de numérotation historique.
22. **985 dépôts sur 3 082 (32 %) ne sont accessibles par personne**, et la régénération remplit des coffres que le jeu ne rouvre jamais.
23. **14 planètes ont un bouclier planétaire totalement inopérant** (`hasDefenders` ignore le bouclier seul → 0 round, pillage complet).
24. **Les raids de colonisation n'apparaissent jamais** dans la liste des flottes entrantes (filtre construit sur `mission_definitions`, où ils n'ont pas de ligne).
25. **Deux planètes mères sont figées à facteur d'énergie 0,000** depuis mars et mai — état créé par l'ordre des quêtes du tutoriel.
26. **`startBuild` ne vérifie aucun prérequis** ; **`AttackHandler` ne vérifie aucun rôle de vaisseau**. Le déblocage est cosmétique côté serveur.
27. **`chooseFork` accepte n'importe quelle chaîne** sans FK ni CHECK : on peut se verrouiller les deux voies et devoir payer un respec.

### Niveau 5 — Ce que l'interface raconte de faux

28. **L'usine de robots** : le front affiche `0,85^niveau` (×0,52 au niveau médian) là où le moteur applique `1/(1+niveau)` (**×0,20**) — facteur 2,6.
29. **Le changement de coque** annonce un coût de plusieurs centaines de milliers de ressources **jamais prélevé** et un cooldown inexistant, avec « Prochain changement possible dans 0 jour ».
30. **Les bonus de combat du vaisseau amiral** (+8 armes, +6 blindage, +2 tirs) sont annoncés dans l'UI et l'admin et **ne s'appliquent dans aucun combat**.
31. **Le tableau de progression des recherches** affiche du linéaire pour 13 bonus asymptotiques : trois chiffres contradictoires sur la même fiche.
32. **Le guide de combat se contredit d'un onglet à l'autre** : 4 rounds / 30 % / 70 % dans l'onglet pédagogique, 6 / 35 % / 50 % dans l'onglet technique de la même page.
33. **L'aperçu admin des niveaux de bâtiment ignore le multiplicateur de phase** : Julien équilibre sur des chiffres faux de −65 % à −5 % sur les 7 premiers niveaux.
34. **L'aide du minage conseille d'ajouter des cargos** : au-delà de `soute = 2 × extraction`, c'est **contre-productif** (ça allonge l'extraction sans rien rapporter).
35. **L'espionnage prévient sa cible** : `mission_definitions.spy` a `dangerous = false`, donc la victime reçoit une notification temps réel nommant l'espion **au moment de l'envoi**. Tout le sous-système de furtivité est annulé.
36. **Les récompenses de fin de chapitre du tutoriel ne sont jamais affichées** (15 exilium et 5 intercepteurs versés en silence).
37. **72 interrupteurs de notification dont la majorité ne pilote rien** : 14 des 24 toggles Push sont inertes, 7 des 14 types de cloche contournent `bellDisabled`.
38. **La page `/infrastructures` (441 lignes) n'est liée depuis aucun menu** — et c'est celle qui contient le bug de l'usine de robots. **La page `/progression`, seule page qui explique la progression, non plus.**
39. **La notification push « Construction terminée » renvoie vers `/resources`**, une route qui redirige vers l'accueil.
40. **La divulgation progressive n'existe pas sur mobile** : la barre d'onglets ignore complètement les règles de visibilité.

### Niveau 6 — Fragilités techniques

41. **`sendFleet` n'est pas transactionnel** : ressources et vaisseaux débités avant l'insert, validation PvE **après** l'insert, TOCTOU sur les vaisseaux et sur les slots. Des coordonnées hors univers produisent une distance négative, une durée NaN et une perte sèche.
42. **Le rappel pendant prospection/minage téléporte la flotte** (`departureTime` écrasé par les phases).
43. **`deleteThread` supprime la conversation pour les deux joueurs**, et accepte n'importe quel `threadId`.
44. **Les invitations et candidatures d'alliance sont verrouillées à vie** par un index UNIQUE sur la paire sans le statut.
45. **`detailedLog: true` en dur** : un combat de 3 750 unités produit 30,6 Mo de JSON (contre 4,1 Mo pour toute la table) et 2 s de CPU synchrone dans le worker.
46. **Le remboursement d'annulation n'a pas de clamp de stockage** (bâtiments et unités) : coffre-fort temporaire à 30 % de frais.
47. **Le ledger d'exilium ne réconcilie pas** : +40 d'écart sur 17 comptes.
48. **Les rapports de minage et d'exploration sont purgés à 3 jours** : 2 631 vols → 26 rapports, 661 vols → 3 rapports. Aucun historique. Les rapports pirates, eux, sont gardés à vie.
49. **Les annulations de construction sont supprimées** au lieu d'être marquées : angle mort d'instrumentation total.
50. **Aucun seed en production** : impossible de rejouer un combat litigieux, alors que le moteur sait le faire. Et les 12 scénarios snapshotés protègent une config d'il y a deux refontes.

---

## 6. Dérives de documentation

> **Règle de lecture** : quand `docs/reference/` contredit ce document, c'est `docs/reference/` qui a tort. Les fichiers ci-dessous n'ont pas suivi les refontes successives.

### 6.1 `docs/reference/game-mechanics.md`

**Son propre bandeau d'avertissement est faux** : il annonce que seule la section 1 (combat) est obsolète et que « le reste (production, recherche, fleet, pillage) reste à jour ».

| Ligne / section | La doc dit | Le code/la base disent |
|---|---|---|
| §1, l.30 / l.103 | 4 rounds de combat | **6** (`combat_max_rounds`) |
| §1, l.61-73 | Système de « rapid fire » avec relance de dé à 5/6 | **N'a jamais existé dans ce moteur** |
| §8, l.389 / l.545 | Débris = coût × **0,30** | **0,35** (`combat_debris_ratio`) |
| §9, l.412 | **70 %** de chance de réparation des défenses | **50 %** (`combat_defense_repair_rate`) |
| §4, l.208 | Temps des unités : diviseur **2500** | **4500** (`shipyard_time_divisor`) → tous les temps sont 1,8× trop courts |
| §5, l.240-258 | Bonus de recherche **linéaires**, « +10 %/niv, niveau 10 = ×2,00 » | **Asymptotiques** pour 13 bonus sur 20 : niveau 10 = **×2,165**, plafond ×2,5 |
| §5, l.274-278 | `ship_build_time` porté par le « Centre de commandement » | **Ce bâtiment n'existe plus** ; c'est shipyard qui porte les deux catégories |
| §5, l.308 | Bonus recherche : « chaque biome **découvert** » | Le code compte `planet_biomes.active` sur les planètes **possédées** |
| §5 (tableau) | rockFracturing : `mining_duration`, **−10 %/niveau, linéaire** | Stat **`mining_extraction`**, asymptotique, cap **2,25**. Aucun effet sur la durée |
| §6 (distance) | `20 000 × |Δgalaxie|` | **Enroulement circulaire** : `20 000 × min(|dg|, 9−|dg|)` → facteur 8 d'écart entre G1 et G9 |
| §6 (vitesses) | 3 recherches de propulsion, linéaires | **4** (gaseousPropulsion, `category = NULL`, **absente de la doc**, appliquée à tous les moteurs) |
| §6 (carburant) | `Total = max(1, ceil(somme))` | `max(1, round(...))` **par type** puis un second max sur le total → 7 types = 7 H2 minimum |
| §10, l.436 | Le minage se déroule en **deux phases** | **Quatre** : aller, prospecting, mining, retour |
| §10, l.468 | `slag_rate` dépend de la position (8 ou 16) ; −15 %/niveau, plancher 0 % | **Une seule valeur globale** ; réduction **multiplicative** `× 0,85^niveau` ; **4,37 % restants au niveau 15** |
| §11, l.479-486 | Pool de missions 3/4/5/6 selon le niveau, accumulation 6 à 12 | **Entièrement inventé.** Caps fixes : 3 gisements, 2 pirates |
| §11, l.496 | Tier Facile : niveau de centre 3+ | **Toujours disponible**, sans seuil |
| §11, l.496-499 | Butin pirate 50K-100K minerai en difficile | Valeurs **brutes des templates** ; le butin réel est ×0,1 × ratio FP → **10 128 unités en moyenne**. Surestimation d'un facteur 20 à 60 |
| §12 (colonisation) | Max 9 planètes · vaisseau consommé · planète créée immédiatement · 0 ressource de départ · vaisseaux restants renvoyés · température ±20 | **Aucune limite dure** (clé morte) · statut `colonizing` 9 à 11 h · **500 M + 500 S** par défaut SQL · **rien ne repart** · offset **0** pour une colonie |
| §12 (tableau types) | volcanique 1-3, aride 4-6, tempérée 7 et 9… | Reproduit `planet_types.positions`, **lue par aucun code**. La vraie règle est un tirage pondéré par tranche de température |
| §14, l.591 | Points de classement calculés « **avec** le multiplicateur de phase » | `ranking.ts` ne l'applique **jamais** → +188 % au niveau 1 |
| **Absent** | — | Satellites solaires · consommation d'énergie du bouclier · curseurs de production · biomes · vocations · politiques · gouvernance · le cron de 15 min · marché · alliances · messagerie · tutoriel · notifications · exploration · rapports d'exploration · régénération des dépôts · toute la refonte S1 de la recherche (5 branches, 4 forks, respec) |

### 6.2 `docs/reference/game-engine.md`

Son bandeau (2026-04-27) n'avoue qu'une partie des erreurs.

- **La formule de temps de construction des bâtiments est purement fausse** (l.137) : elle donne `(coût_métal + coût_cristal) / (2500 × (1 + robotics)) × 3600` — **c'est la formule des vaisseaux**. La vraie est pilotée par `base_time` (45 s à 7 200 s). Exemple : labVolcanic niveau 1 → doc 12 096 s, réel **1 260 s** (**9,6× d'écart**).
- **Prérequis erroné** (l.122) : « Chantier spatial ← Robotics 2 ». La base dit **robotics 1** ; c'est arsenal qui exige 2 — et arsenal n'apparaît nulle part.
- **7 bâtiments sur 17 sont absents** du tableau (arsenal, planetaryShield, les 5 labos annexes) ; la restriction `homeworld` du laboratoire n'est pas mentionnée.
- **Nomenclature OGame non portée** : « Mine de métal », « cristal », « deutérium », colonnes M/C/D.
- **`emplacements_max = floor((diamètre/1000)²)`** : formule inventée, aucun code ne l'implémente — et `game-mechanics.md` l.570 dit explicitement l'inverse. **Deux documents du même dossier se contredisent sur l'existence d'une mécanique.**
- Univers « 9 × 499 × **15** positions » → c'est **16** (dont 2 ceintures).
- Vaisseau de colonisation « 10000/20000/10000, 50/100 » → la base dit **7 500 / 15 000 / 7 500**, bouclier 80, coque 90.
- La documentation du moteur ne couvre **ni l'XP d'empire, ni l'exilium, ni les quêtes journalières, ni les politiques, ni le vaisseau amiral**, et renvoie à `talent.service.ts` pour un système de talents **supprimé le 2026-05-03**.

### 6.3 `docs/reference/combat.md` — la meilleure référence du dépôt, avec 5 réserves

Exact sur les 6 rounds, les 35 % de débris, les 50 % de réparation, les profils d'armes et les stats des 9 unités de combat. Mais :
1. §1, la table des catégories **oublie `capital`** et place `support` à l'ordre 6 (le code le met à 7).
2. §2, « toutes les unités de combat ont leur profil explicite » — **faux pour le vaisseau amiral**, injecté sans batteries et retombant sur le fallback `light`.
3. §6, « Recherche niveau 5 (linéaire +10 %/niv) → ×1,5 » — c'est **asymptotique** : ×1,791.
4. §10, la formule de pillage divise les **ressources** par 3 ; le code divise le **cargo** par 3 puis redistribue le reliquat.
5. §11, `combat_research_bonus_per_level` déclaré « inutilisé » alors qu'il pilote le multiplicateur du défenseur dans le simulateur.
6. **Il ne mentionne nulle part la bascule des défenses en catégorie `defense`** — la règle la plus structurante du combat planétaire, qui invalide la moitié de son tableau de traits.
7. Ligne 95, « les cargos ne ripostent pratiquement jamais » : chaque support tire bien une salve par round (voir le détail du fallback en §2.4).

### 6.4 Specs et plans qui décrivent un jeu non livré

| Document | Ce qu'il affirme | Réalité |
|---|---|---|
| `specs/2026-06-26-research-trees-s1-design.md` | « Audit complet → **exactement 3 dépendants externes** » | **5** : les 3 re-pointés + heavyLaser + electromagneticCannon, plus `quest_20`. Et `recycler → combustion 2` proposé, `combustion 6` en base |
| `specs/2026-04-01-onboarding-redesign-design.md` | Récompenses de chapitre 350/200/75, 5/10/15 exilium ; ch.3 « 2 Récupérateurs » ; chapitres 11-17 et 18-23 ; écran « Chapitre terminé ! » | **500/300/100**, **2/3/15** exilium (nerf du 7 avril, visible dans `exilium_log`) ; **1 prospector + 1 smallCargo** ; chapitres **11-16 et 17-23** (ce décalage est la cause du lien mort sur `quest_17`) ; **l'écran n'existe pas** |
| `plans/2026-06-21-edits-politiques-empire.md` | « Toutes les valeurs dans `universe_config`, équilibrables sans redéploiement » | `POLICY_AXES` est une **constante TypeScript**. Et 3 postures sur 6 ont des valeurs différentes de la doc |
| `plans/2026-06-09-empire-level.md` | « Un joueur actif gagne **~150-400 XP/jour** en early » | Le joueur le plus actif du serveur : **24 XP/jour**. Facteur 6 à 17. Le champ `governanceFloor` documenté n'existe plus |
| `plans/2026-03-14-phase6c-realtime-notifications.md` | `NotificationEvent.type` = union fermée de 4 valeurs | `type: string`, **22 types circulent** — c'est cette ouverture qui a permis les trois désynchronisations SSE |
| `proposals/2026-06-09-refonte-architecture-information.md` | « La divulgation progressive : la nav grandit avec le tutoriel — très bon, à conserver tel quel » | **Ignorée sur mobile**, et `/alliance` + `/ranking` déplacées sans condition |
| `specs/2026-06-24-research-rework-design.md` | 5 capstones débloquant vaisseaux et bâtiments | **Aucune occurrence de `capstone` dans le code** ; les colonnes n'existent pas |

### 6.5 Le mécanisme de la dérive, illustré

`universe_config` contient **deux clés pour la même notion** : `debrisRatio` = 0,3 (la valeur de la doc, **jamais lue**) et `combat_debris_ratio` = 0,35 (**celle que le code utilise**). L'ancienne clé n'a jamais été supprimée, la doc l'a documentée, et l'onglet « Combat » de l'admin l'expose encore.
Le même piège existe en **pire** sur la réparation des défenses : `combat_defense_repair_probability` = 0,7 (**morte**, exposée dans l'onglet Combat) contre `combat_defense_repair_rate` = 0,5 (**vivante**, rangée dans « Divers »). Deux noms quasi indistinguables, deux valeurs contradictoires, et le levier visible dans l'admin est celui qui ne fait rien.
Et `combat-config.ts:22-27` porte des valeurs par défaut périmées (maxRounds 4, debrisRatio 0,3, defenseRepairRate 0,7) : elles ne s'appliquent que si la clé manque en base, mais **elles racontent l'ancien équilibrage à quiconque lit le code sans lire la base**.

---

*Document établi le 2026-08-09 par lecture du code et de la base de production. Toutes les valeurs proviennent de `packages/game-engine/src/formulas/`, des modules `apps/api/src/modules/`, ou de requêtes SQL sur `exilium` — jamais d'un fichier markdown.*