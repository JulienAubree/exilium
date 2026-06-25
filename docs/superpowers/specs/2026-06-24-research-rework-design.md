# Refonte du système de recherche — Design

> Statut : **design validé sur le cadre** (2026-06-24, avec Julien). Le détail
> des 5 arbres (contenu exact) reste à affiner ensemble. Spec → plan → build.

## Goal

Transformer la recherche d'une **liste plate de « +X%/niveau »** (file unique,
centralisée sur la planète-mère) en un **système d'arbres-disciplines avec
choix stratégiques, déblocages qualitatifs, et exécution décentralisée &
parallèle par planète** — tout en gardant des **niveaux/effets empire-wide**.

## Décisions verrouillées (avec Julien)

1. **5 branches-disciplines**, chacune un **arbre à paliers** (tiers).
2. **Choix exclusifs** au sein des branches (spécialisation : tu ne peux pas
   tout avoir dans une branche). Empire-wide (un seul choix par fork, pour
   tout l'empire). **Respec possible contre un coût en EXILIUM, gros &
   progressif** (chaque respec coûte plus cher).
3. **Capstones raisonnables** : chaque branche se clôt par un déblocage
   **qualitatif** réutilisant les systèmes existants (nouveau vaisseau, nouveau
   bâtiment) — **pas** de mécanique neuve (terraformation, voyage instantané…)
   pour l'instant.
4. **Niveaux & choix = empire-wide** (résultats partagés par tout l'empire).
5. **Exécution décentralisée & parallèle** : **chaque planète** (avec un labo)
   peut développer **une** recherche à la fois ; plusieurs planètes avancent
   **en parallèle**. La vitesse dépend du **labo + annexe** de la planète qui
   recherche. Fin du verrou « planète-mère ». → l'expansion (plus de colonies)
   récompense la recherche, sans système de slots artificiel.
6. **Règle anti-double-dip** : une même recherche ne peut pas être en cours sur
   **2 planètes à la fois**.
7. **Migration data** : table « large » `user_research` (1 colonne/recherche) →
   modèle **en lignes** (empire-wide : `userId + researchId + level` ; + état
   d'exécution par planète).

## Modèle d'exécution (le cœur)

- **L'arbre est empire-wide** : un seul jeu de niveaux (`researchId → level`)
  et un seul jeu de choix exclusifs (`forkId → choix`) pour tout l'empire.
- **Les planètes sont les moteurs** : chaque planète avec un `researchLab` a
  **une file de recherche locale** (1 actif à la fois). Lancer une recherche
  sur une planète fait progresser le **niveau empire-wide** à la complétion.
- **Vitesse** = fonction du `researchLab` de **cette** planète + son annexe de
  biome (réutilise `researchTime` + `researchAnnexBonus` existants, mais
  scopés à la planète exécutante au lieu de homeworld+somme-des-annexes).
- **Annexe-gating** : une recherche annexe (ex. `volcanicWeaponry`) ne peut
  être lancée que sur une planète ayant l'annexe correspondante (volcanique).
  → tu construis tes annexes là où tu veux pouvoir développer ces branches.
- **Parallélisme organique** : N planètes-labo = N recherches en parallèle.
  Pas de slots. (Plus tard éventuellement : plusieurs files par planète.)
- **Anti-double-dip** : un `researchId` déjà actif sur une planète est
  verrouillé pour les autres planètes tant qu'il n'est pas terminé.

## Structure d'une branche (patron)

```
TIER 1   Recherche de base (montable, effet quantitatif)
            │
TIER 2   ⚔ FORK EXCLUSIF — choisir UNE spécialisation (empire-wide)
         ├─ Voie A
         └─ Voie B          (respec = coût exilium gros & progressif)
            │
TIER 3   Recherche avancée / annexe (montable, gated annexe de biome)
            │
CAPSTONE 🚀 Déblocage qualitatif (nouveau vaisseau OU bâtiment)
```

- **(A) Profondeur** = le fork exclusif au Tier 2 (ton build) + les paliers.
- **(B) « Waouh »** = le capstone (déblocage qualitatif) en fin de branche.

## Les 5 branches (PROPOSITION de mapping — à affiner avec Julien)

> On répartit les 21 recherches existantes + on ajoute les forks & capstones.
> Le contenu exact (quelle recherche dans quel tier, libellés des forks,
> capstones précis) est la partie « design produit » à caler avec Julien.

### 1. Économie & Production
- Existant : `energyTech`, `semiconductors` (−conso), `rockFracturing`,
  `deepSpaceRefining`, `temperateProduction` (annexe tempérée).
- Fork T2 (ex.) : **Rendement** (+production) vs **Efficience** (−consommation).
- Capstone (ex.) : nouveau **bâtiment** de production/stockage avancé, ou
  prospecteur amélioré.

### 2. Propulsion
- Existant : `combustion`, `impulse`, `hyperspaceDrive`, `gaseousPropulsion`
  (annexe gazeuse).
- Fork T2 (ex.) : **Vitesse** vs **Portée/autonomie**.
- Capstone (ex.) : nouvelle **classe de vaisseau** rapide.

### 3. Armement (offensif)
- Existant : `weapons`, `volcanicWeaponry` (annexe volcanique).
- Fork T2 (ex.) : **Canons lourds** (dégâts, lent) vs **Armes à impulsion**
  (cadence, dégâts moindres).
- Capstone (ex.) : nouvelle classe **« Destroyer »** (vaisseau de combat).

### 4. Défense & Protection
- Existant : `shielding`, `armor`, `glacialShielding`/`aridArmor` (annexes),
  `armoredStorage` (anti-pillage), `planetaryShield` (bâtiment lié).
- Fork T2 (ex.) : **Boucliers** vs **Blindage**.
- Capstone (ex.) : **forteresse planétaire** / nouvelle structure défensive.

### 5. Renseignement & Exploration
- Existant : `espionageTech`, `planetaryExploration` (débloque l'Explorateur),
  `sensorNetwork` (détection), `stealthTech` (furtivité), `computerTech`
  (+flottes).
- Fork T2 (ex.) : **Détection** (réseau de capteurs) vs **Furtivité**.
- Capstone (ex.) : vaisseau **espion/explorateur** avancé.

> ⚠️ Arbitrages à trancher : `computerTech` (flottes) et `sensorNetwork`/
> `stealthTech` pourraient aller en branche 3/4/5 — à décider. Et combien de
> tiers exactement par branche (3 proposé).

## Choix exclusifs & respec

- Un **fork** = un set de N voies mutuellement exclusives, scopé empire-wide.
- Choisir une voie débloque ses recherches/effets ; les autres restent
  verrouillées.
- **Respec** : re-choisir une voie coûte de l'**exilium**, montant **gros et
  progressif** (ex. coût = base × facteur^(nb_respecs_de_ce_fork)). À calibrer.
- Effet d'un respec : on bascule la voie active ; les niveaux investis dans
  l'ancienne voie sont **remis à 0** (option **a**, VERROUILLÉE par Julien) — le
  choix a un vrai poids : tu paies l'exilium ET tu repars de zéro sur l'autre
  voie. Engagement réel.

## Capstones (déblocages qualitatifs — raisonnables)

- Réutilisent les systèmes existants : un capstone = soit un **nouveau
  `ShipDef`** (le vaisseau devient constructible au Chantier), soit un nouveau
  **`BuildingDef`** (constructible aux Bâtiments). Pas de mécanique neuve.
- Gate : le capstone est le dernier nœud de la branche (requiert les tiers +
  le fork). Empire-wide (une fois débloqué, constructible partout selon les
  règles habituelles du Chantier/Bâtiments).

## Migration data (modèle en lignes)

- **Avant** : `user_research` = 1 ligne/joueur, 1 colonne/recherche (`espionage_tech`, `weapons`, …). Ajouter une recherche = migration de schéma.
- **Après** :
  - `user_research_levels` (empire-wide) : `(user_id, research_id, level)` — PK composite. Niveaux partagés.
  - `user_research_choices` (forks) : `(user_id, fork_id, chosen_path, respec_count)`.
  - `planet_research_active` (exécution) : `(planet_id, research_id, started_at, ends_at)` — la file locale d'une planète (1 actif).
- **Migration one-shot** : convertir les colonnes existantes de `user_research`
  en lignes `user_research_levels`. Garder l'ancienne table le temps de la
  bascule puis drop.
- `research_definitions` : ajouter `branchId`, `tier`, `forkId`/`forkPath`,
  `unlocksShipId`/`unlocksBuildingId` (capstones), prereqs déjà gérés.

## Impact UI

- **La recherche redevient un onglet PLANÈTE** : `Vue d'ensemble · Bâtiments ·
  Chantier · Recherche` (puisque l'exécution est locale). Elle sort de la nav
  empire (sidebar section EMPIRE perd « Recherche »).
- L'onglet montre : l'**arbre empire-wide** (niveaux/choix partagés) + la **file
  locale de CETTE planète** (ce qu'elle développe). On peut y voir où chaque
  recherche est en cours (sur quelle planète).
- Vue **arbre** par branche (tiers, forks visibles, capstone en bout) — remplace
  la grille plate actuelle. L'art des cartes existant est réutilisé.
- Indicateur « X est en cours sur la planète Y » (anti-double-dip lisible).

## Design détaillé des branches (verrouillé au fil de l'eau avec Julien)

### Branche 1 — ÉCONOMIE ✅
- **T1** : Technologie Énergie (existant) — base, +prod énergie.
- **T2 FORK exclusif** : **Production** (Symbiose adaptative, +prod ressources) vs **Efficience** (Semi-conducteurs, −conso énergie).
- **T3 commun** : Minage — Fracturation → Raffinage (chaîne prospecteurs, existant).
- 🚀 **CAPSTONE — Centrale à hydrogène** (nouveau bâtiment) : consomme de l'hydrogène → produit de l'énergie. Réutilise Bâtiments + Énergie ; vrai arbitrage éco (brûler son H₂ pour de l'énergie).

### Branche 2 — PROPULSION ✅
- **Linéaire** (pas de fork — branche « progression » ; propulsion = vitesse seule pour l'instant).
- **T1** Combustion → **T2** Impulsion → **T3** Hyperespace + Ionique (annexe gazeuse).
- 🚀 **CAPSTONE — Porte de saut quantique** (nouveau bâtiment). ⚠️ **Vraie mécanique neuve** (voyage instantané flotte↔flotte entre portes) — feature à part entière, scope assumé. **Garde-fous** : coût par saut **élevé** (énergie/hydrogène) · **cooldown** par porte · **portes ALLIÉES** (saut entre portes de toi OU de ton alliance → coordination d'alliance). À construire : bâtiment + appairage des portes + nouveau **mode d'envoi de flotte « saut »** + UI + équilibrage.

### Branche 3 — ARMEMENT ✅
- **T1** : Technologie Armes (existant) — base, +dégâts.
- **T2 FORK exclusif** : **Puissance brute** (gros dégâts/tir) vs **Cadence** (plus de tirs/round). [contenu à créer]
- **T3** : Métallurgie plasma (volcanicWeaponry, annexe volcanique).
- 🚀 **CAPSTONE — Bombardier orbital** (nouveau vaisseau) : bonus de dégâts **vs défenses planétaires** (rôle de siège). Petit ajout combat : modificateur « dégâts vs type défense ».

### Branche 4 — DÉFENSE & SÉCURITÉ ✅
- **T1** : base durabilité.
- **T2 FORK exclusif** : **Boucliers** (shielding + glacialShielding annexe) vs **Blindage** (armor + aridArmor annexe).
- **T3** : Blindage des hangars (armoredStorage, anti-pillage).
- 🚀 **CAPSTONE — Bouclier orbital** (nouveau bâtiment) : étend le bouclier pour protéger **aussi la flotte stationnée** (le `planetaryShield` actuel ne la protège pas — comble ce manque connu).
- NB : la **Surveillance** (sensorNetwork + stealthTech) QUITTE cette branche → va dans Renseignement.

### Branche 5 — RENSEIGNEMENT & EXPLORATION ✅
- **T1** : Exploration planétaire (existant) — base (débloque l'Explorateur + biomes).
- **T2 FORK exclusif (guerre de l'info)** : **Détection** (sensorNetwork — voir les attaques tôt) vs **Furtivité** (stealthTech — cacher ses flottes).
- **T3** : Espionnage (espionageTech) + `computerTech` (+flottes — nœud utilitaire « intrus », gardé ici faute de branche Logistique).
- 🚀 **CAPSTONE — Sonde furtive orbitale** (nouvelle unité déployable) : se place en orbite d'une planète ennemie → accès à son **Overview complet** (comme si elle était à toi). **Contre-jeu** : la Détection ennemie la repère/détruit, la Furtivité la masque → **boucle le fork de la branche**. Réutilise l'UI Overview existante.

### Récap des 5 branches
| Branche | Fork (choix exclusif) | Capstone |
|---|---|---|
| Économie | Production / Efficience | Centrale à hydrogène (bât.) |
| Propulsion | *(linéaire)* | Porte de saut quantique (bât. + méca) |
| Armement | Puissance / Cadence | Bombardier orbital (vaisseau) |
| Défense | Boucliers / Blindage | Bouclier orbital (bât.) |
| Renseignement | Détection / Furtivité | Sonde furtive orbitale (unité + méca) |

## Hors scope (pour l'instant)

- Le **parallélisme par slots** explicite (plusieurs files par planète) — la
  décentralisation pose les rails, on l'activera plus tard si besoin.
- Mécaniques **neuves** comme capstones (terraformation, voyage instantané).
- Rééquilibrage fin des coûts/temps de toutes les recherches (passe séparée).
- `maxLevel` des recherches (20/15) : à reconsidérer (cohérence avec bâtiments
  illimités) — décision séparée, pas bloquante pour le rework de structure.

## Reste à faire (le design de structure est VERROUILLÉ)

Design bouclé : 5 branches + forks + capstones + respec (a) + exécution
décentralisée/parallèle empire-wide. Reste :

- **Équilibrage chiffré** : coûts/temps par nœud ; coût exilium du respec
  (gros & progressif) ; garde-fous Porte de saut (coût/cooldown) et Sonde
  furtive ; maxLevel des recherches (à reconsidérer vs bâtiments illimités).
- **Contenu nouveau à créer** : les recherches des forks « maigres » (ex.
  Armement Puissance/Cadence) ; les **5 capstones** (ShipDef/BuildingDef + leurs
  mécaniques : centrale H₂ consomme-pour-produire, porte de saut inter-alliés,
  bombardier bonus-vs-défenses, bouclier couvrant la flotte, sonde donnant
  l'Overview ennemi).
- **PLAN d'implémentation** (superpowers:writing-plans) découpé en lots :
  (1) migration data wide→lignes + service/router empire-wide-par-planète +
  anti-double-dip ; (2) UI arbre + onglet planète ; (3) les 5 capstones (chacun
  ≈ une feature, certains gros : porte de saut, sonde). Chaque lot testable.
