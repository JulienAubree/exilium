# Refonte d'équilibrage — Roadmap 5 piliers

**Date** : 2026-05-13
**Statut** : Vision gamedesigner validée, Sprint 1 prêt à démarrer
**Auteurs** : Brainstorm session 2026-05-13 (synthèse des 3 proposals existantes)
**Documents liés** :
- [Buildings rebalance (proposal d'origine)](./2026-04-26-buildings-rebalance.md)
- [Research rebalance (proposal d'origine)](./2026-04-26-research-rebalance.md)
- [Robotics rebalance (proposal d'origine)](./2026-04-28-robotics-rebalance.md)
- [Alliance improvements (chantier parallèle, ne pas mélanger)](./2026-04-21-alliance-improvements.md)

---

## TL;DR

> **Le jeu a accumulé des systèmes, mais perdu des décisions.** 21 bâtiments, 21 recherches, 5 annexes copier-collées, 4 chaînes industrielles redondantes, +10%/niv linéaire infini sur tout — pourtant le joueur ne fait quasiment aucun choix qui change sa façon de jouer.

Cette refonte ne **rééquilibre pas des chiffres** : elle **convertit les +% passifs en décisions de gameplay**, et fait que 2 joueurs au même âge ont des empires différents.

**5 piliers** attaquent 5 axes d'identité (temps, géographie, build, activité, colonie). **5-6 semaines** au total, livrable sprint par sprint, chaque sprint indépendant.

---

## Table des matières

1. [Contexte de la session](#contexte-de-la-session)
2. [Diagnostic](#diagnostic)
3. [Les 5 piliers](#les-5-piliers)
   - [Pilier 1 — Plafonds & soft-caps](#pilier-1--plafonds--soft-caps)
   - [Pilier 2 — Annexes biomes différenciées](#pilier-2--annexes-biomes-différenciées)
   - [Pilier 3 — Spécialisation tier 5](#pilier-3--spécialisation-tier-5)
   - [Pilier 4 — Robotics refonte](#pilier-4--robotics-refonte)
   - [Pilier 5 — Doctrines + fusion industrielle](#pilier-5--doctrines--fusion-industrielle)
4. [Cohérence d'ensemble](#cohérence-densemble)
5. [Phasing recommandé](#phasing-recommandé)
6. [Ce qui n'est PAS inclus](#ce-qui-nest-pas-inclus)
7. [Notes techniques pour reprise](#notes-techniques-pour-reprise)
8. [Décisions en attente](#décisions-en-attente)
9. [Next step](#next-step)

---

## Contexte de la session

### Ce qui a été déployé cette session (12 commits)

**Vague 1 — Features QoL joueurs** (table `feedbacks` NEW ideas adressées) :
- `cb4bcb02` feat(fleet): presets de composition (save/load/delete + UI sur Fleet.tsx)
- `10f72d3f` feat(user): résumé d'absence au login (modal au mount du Layout)
- `ef8b66ca` feat(web): warning rouge sur ResourceBar quand énergie en déficit
- `8840d392` feat(web): widget "Bonus actifs" sur Overview
- `5ead6d90` feat(missions): filtre FP minimum sur repaires pirates
- `15a0d77f` feat(web): CraftEtaBadge sur BuildingUpgradeCard (estimation temps avant craft)
- `fddc91ac` feat(spy): rapport de contre-espionnage
- `7150424d` fix(spy): rendu dédié CounterEspionageReportDetail (post code-review)

**Vague 2 — Infrastructure deploy** (fixes auto-déploiement staging) :
- `7d6bc7c3` ops(staging): ecosystem.staging.cjs + chaînage deploy.sh → deploy-staging.sh
- `ecb52421` fix(staging): rename `staging.config.cjs` (pm2 6.x exige `.config.cjs`)
- `a1da654f` fix(deploy): apply-migrations.sh priorise toujours le .env local
- `ad43d1da` fix(deploy): scrub env prod avant de chaîner deploy-staging.sh
- `3acd5d58` fix(deploy): nettoyer .tsbuildinfo dans deploy-staging avant build

**Vague 3 — Code review fixes post-déploiement** :
- `b3e2cd47` chore(web): format energyBalance en locale fr-FR
- `3c0c59df` chore(fleet): ConfirmDialog au lieu de window.confirm pour delete preset
- `1e412871` chore(api): aligner sur les helpers byUser / byId et vérifier code 23505

### État de l'environnement

| Service | URL | Status |
|---|---|---|
| Prod | https://exilium-game.com | ✅ Cluster x4 + worker |
| Staging | https://staging.exilium-game.com | ✅ Fork x1 + worker |
| DB prod | `exilium` (Postgres local) | Migrations à jour |
| DB staging | `exilium_staging` (Postgres local) | Migrations à jour |
| Deploy | `./scripts/deploy.sh` (prod) → chaîne staging | Fonctionne |
| Refresh staging | `sudo ./scripts/refresh-staging-from-prod.sh` | Anonymise depuis prod |

### Idées joueurs encore non traitées (table `feedbacks`)

À ce stade, 2 idées NEW restent :
- **Bunker** (nouveau bâtiment protégeant X% des ressources contre raids) — chantier game-engine + DB + UI
- **Refonte UX page Flotte** (idée : les mouvements > la liste de vaisseaux)

---

## Diagnostic

### État des lieux factuel

**Buildings** (21 dans 10 catégories) :
- `costFactor` entre 1.5 et 2.0, `maxLevel = null` partout
- Phase multiplier plateau dès niv 8 (1.0 = scaling pur exponentiel)
- Bonus *building* en diminishing returns (`1/(1+lvl)`), bonus *recherche* linéaires
- 4 bâtiments redondants : `robotics`, `shipyard`, `arsenal`, `commandCenter` — tous appliquent `-15%/niv build_time` sur sous-domaines
- 5 labs annexes biomes — copier-coller à 8000/16000/8000 base, factor 2.0, donnent tous `-5%/niv research_time` + 1 recherche unique
- Stockage exponentiel runaway : `5000 × floor(2.5 × e^(20×lvl/33))` → niv 20 = millions d'unités, écrase la prod linéaire ×1.1^lvl
- `galacticMarket` : 5000/5000/1000 pour débloquer UI, **aucun effet par niveau**
- `missionCenter` cap au niv 6 (silent UI)
- `planetaryShield` : 7200s build pour effet linéaire `(50+10×lvl)` — fait double employ avec `shielding` research
- `hydrogeneSynth` puni 2.5× sur planètes chaudes — force monoculture glacier/gaseous
- `imperialPowerCenter` : cap colonies non exposé en UI

**Research** (21 dans 4 catégories : 7 fondatrices, 6 utilitaires, 4 détection/espionnage, 5 annexes biomes) :
- `costFactor=2.0` **uniforme** sur les 21
- `maxLevel = null` **sur 21/21** (aucun cap)
- Scaling +% combat/propulsion : **+10%/niv linéaire infini** → niv 20 weapons = +200%
- Lab principal : `1/(1+lvl)` (diminishing OK)
- Annexes biomes : `-5%/niv` (linéaire, max 5 en stack)
- 4 annexes biomes (`volcanicWeaponry`, `aridArmor`, `glacialShielding`, `gaseousPropulsion`) = **doublons exacts** de leurs parents (+10% weapons/armor/shield/speed)
- 3 techs "fantômes" : `computerTech` (+1 flotte invisible UI), `sensorNetwork`, `stealthTech` (pas de chiffre)
- `deepSpaceRefining` : exception multiplicative (`0.85^N`) hardcodée dans `pve.ts`, pas dans `bonus_definitions`
- `energyTech` pivot incohérent : prérequise par shielding mais PAS par weapons
- Overlap talents flagship : `research_time`, `combat_weapons` dupliquent les recherches
- **Pas de respec / pas de choix mutuellement exclusifs** : aucune décision irréversible = pas d'identité de build

**Robotics specifically** :
- Mono-effet `-15%/niv build_time`
- Formule `1/(1+lvl)` : 50% au niv 1, 83% au niv 5 → décision triviale "monte tôt, oublie"
- Pas d'interaction systémique avec d'autres mécaniques
- Promesse thématique forte ("Usine de robots") mais contenu = multiplication

### Les tensions fondamentales

1. **Runaway scaling** : Linear +% × no cap = vétérans/débutants divergent à jamais → PvP non-équilibrable.
2. **Monoculture de build** : Tous les joueurs optimaux suivent le même path. 0 identité.
3. **Clonage de colonie** : Les 5 planètes d'un joueur sont fonctionnellement identiques (seule différenciation = biome, et même les biomes annexes sont des doublons).
4. **Bâtiments redondants** : 4 chaînes industrielles font la même chose → cognitive tax sans décision.
5. **Informations cachées** : Caps non exposés, techs "fantômes" sans chiffres, malus gouvernance opaque, productionFactor non visible (déjà partiellement adressé).
6. **Bâtiments subis** : `robotics` et autres mono-effets sont des slots à monter et oublier, jamais à piloter.

---

## Les 5 piliers

### Pilier 1 — Plafonds & soft-caps

**Tension résolue** : Runaway scaling (#1). `costFactor=2.0` + `maxLevel=null` + bonus linéaire `+10%/niv` = un vétéran à niv 25 weapons a +250%, un débutant niv 5 a +50% → PvP impossible à équilibrer dans le temps.

**Proposition**
- `maxLevel` partout :
  - Recherches : `20` (sauf annexes biomes restent à `null`)
  - Bâtiments standards : `25`
  - Stockage : pas de hard cap, mais effet plafonné (voir ci-dessous)
- `costFactor` différencié par catégorie :
  | Catégorie | costFactor proposé |
  |---|---|
  | Mines (minerai, silicium, hydrogene) | 1.5 |
  | Manufactures (industries) | 1.8 |
  | Labs (research) | 2.0 |
  | Defenses | 1.7 |
  | Storage | 1.4 |
- **Soft-cap asymptotique** sur tous les `+%` linéaires (weapons, armor, shield, propulsion, etc.) :
  ```
  bonus(lvl) = max × (1 - exp(-k × lvl))
  ```
  - `max = 1.5` (asymptote +150%)
  - `k = 0.15` (courbe douce : +120% au niv 15, +140% au niv 25)
- **Storage** : effet plafonné à `10 × prod_horaire`. Au-delà, le niveau ne donne plus de capacité (UI affiche "Plafond effectif atteint, monte tes mines pour débloquer").

**Migration** (grand-fathering)
- Les joueurs gardent leurs **niveaux** actuels (pas de rétrogradation)
- Les effets sont rétroactivement remappés sur la nouvelle courbe → vétérans gardent leur avantage relatif mais la courbe s'aplanit pour tout le monde
- Changelog explicite : "Recherche soft-cap maintenant à +150% asymptotique. Tes niveaux restent, leurs effets ont été ajustés."

**Effort** : 3 jours.
- 1 jour : changements DB (`game_config` table, `costFactor`, `maxLevel`)
- 1 jour : formule soft-cap dans `packages/game-engine/src/formulas/bonus.ts`
- 1 jour : UI (afficher caps, asymptotes, plafonds storage)

**Risque** : 🟢 Faible. Pas de nouvelle mécanique, juste du data + une formule. Réversible si problème.

**Fichiers à toucher** :
- `packages/db/src/seed-game-config.ts` (costFactor, maxLevel par def)
- `packages/game-engine/src/formulas/bonus.ts` (resolveBonus avec soft-cap)
- `packages/game-engine/src/formulas/building-cost.ts` (caps)
- `packages/game-engine/src/formulas/research-cost.ts` (caps)
- `apps/web/src/components/entity-details/BuildingDetailContent.tsx` (afficher cap)
- `apps/web/src/pages/Research.tsx` (afficher asymptote)
- Migration Drizzle pour les updates de seed values

**Pré-requis** : Aucun. Peut démarrer immédiatement.

---

### Pilier 2 — Annexes biomes différenciées

**Tension résolue** : Clonage de colonie (#3). Les 4 recherches annexes (`volcanicWeaponry`, `aridArmor`, `glacialShielding`, `gaseousPropulsion`) = doublons exacts. Les 5 labs annexes = copier-coller. Donc coloniser un biome rare ≠ avantage différencié, juste +10% de plus.

**Proposition** — chaque annexe devient un **effet qualitatif** unique (pas du +%) :

#### Recherches annexes biomes (4)

| Annexe | Effet actuel (dummy) | Effet proposé (mécanique nouvelle) |
|---|---|---|
| `volcanicWeaponry` | +10% weapons | **Pénétration d'armure** : ignore 30% du blindage cible. Conserver +5%/niv damage en plus. |
| `aridArmor` | +10% coque | **Régénération hull** : 5% HP regénéré au début de chaque round de combat. |
| `glacialShielding` | +10% bouclier | **Bouclier persistant** : si le bouclier tombe, +1 round de grâce avant que la coque prenne des dégâts. |
| `gaseousPropulsion` | +10% vitesse | **Économies thermiques** : -15% conso hydrogène en voyage. |
| `temperateProduction` | +2% prod | Conserver (déjà différencié). |

Chaque mécanique est **paramétrable** dans `bonus_definitions` (pas de hardcode dans le combat engine).

#### Labs annexes (5) — bonus empire-wide passifs

En plus de débloquer leur tech annexe respective, chaque lab annexe construit donne un **bonus empire-wide** :

| Lab annexe | Bonus passif unique (par niveau de l'annexe) |
|---|---|
| `labVolcanic` | +5% prod minerai sur **toutes** les volcaniques de l'empire |
| `labArid` | +5% capacité stockage sur **toutes** les arides |
| `labGlacial` | +5% prod hydrogène sur **toutes** les glaciales |
| `labGaseous` | +2% vitesse flotte empire-wide |
| `labTemperate` | -2% conso énergétique empire-wide |

→ **L'expansion par biome devient stratégique**. Coloniser 3 volcaniques + 2 arides ≠ 5 glaciales.

**Migration** : Aucune. Les joueurs qui ont déjà investi dans `volcanicWeaponry` voient l'effet **changer** (de +10% damage à AP) au prochain login. Changelog explicite + grace period de 1 reset gratuit par tech annexe.

**Effort** : 5 jours.
- 1 jour : data DB (nouveaux effets dans `bonus_definitions`)
- 3 jours : implémentation des 4 mécaniques en game-engine (AP, regen, bouclier persistant, conso hydrogène)
- 1 jour : tests d'équilibrage sur staging

**Risque** : 🟠 Moyen. Nouvelles mécaniques de combat → faut équilibrer. Tester en sandbox staging avant deploy.

**Fichiers à toucher** :
- `packages/db/src/seed-game-config.ts` (effets `bonus_definitions`)
- `packages/game-engine/src/formulas/combat.ts` (simulateCombat — intégrer AP, regen, bouclier persistant)
- `packages/game-engine/src/formulas/fleet.ts` (conso hydrogène)
- `packages/game-engine/src/formulas/biomes.ts` (bonus empire-wide via labs annexes)
- `apps/api/src/modules/building/building.service.ts` (calcul du bonus empire-wide à chaque lab annexe)
- `apps/web/src/pages/Research.tsx` (afficher les nouveaux effets)
- `apps/web/src/components/entity-details/BuildingDetailContent.tsx` (afficher le bonus empire-wide des labs annexes)

**Pré-requis** : Pilier 1 (soft-caps en place avant d'ajouter des mécaniques qui s'empilent).

---

### Pilier 3 — Spécialisation tier 5

**Tension résolue** : Monoculture de build (#2). Aujourd'hui tout le monde suit la même tech path optimale. Aucune décision irréversible = pas d'identité de build entre joueurs.

**Proposition** — Tier 5 specialization tree sur les 3 techs structurelles :

#### Architecture

```
weapons 1→5 (linéaire, comme actuel + soft-cap)
            ├─ Plasma     (lvl 6-20) : +25% dégâts vs boucliers, -10% vs coque
            └─ Cinétique  (lvl 6-20) : +25% dégâts vs coque, -10% vs boucliers

armor 1→5 (linéaire + soft-cap)
        ├─ Composite (lvl 6-20) : -15% dégâts hull, flat
        └─ Réactif   (lvl 6-20) : 8% chance/coup de renvoyer 50% des dégâts à l'attaquant

propulsion 1→5
              ├─ Hyperspace (lvl 6-20) : +30% vitesse long-courrier (>10 systèmes)
              └─ Manœuvre   (lvl 6-20) : +15% chance esquive en combat
```

#### Mécanique de spec

- À l'atteinte du niveau 5 d'une de ces 3 techs : pop-up "Choisis ta spécialisation pour les niveaux 6-20"
- Choix mutuellement exclusif. Une fois sélectionné, les niveaux 6+ vont dans la branche choisie
- Reset disponible :
  - **1 reset gratuit** dans la vie du joueur (grace period)
  - **50 Exilium par reset** ensuite — donne du sens à la devise premium

#### Migration

- Tous les joueurs au-delà du tier 5 sur les 3 techs concernées reçoivent un modal "free spec" au prochain login
- Ils peuvent prendre n'importe quelle branche **sans payer** (1 fois par tech)
- Si ils ne choisissent pas dans les 14 jours → assignation par défaut (Plasma + Composite + Hyperspace par ex.) avec possibilité de re-spec gratuit toujours dispo

**Effort** : 1 semaine.
- 1 jour : DB schema (`research_specializations` ou champ `spec` dans `user_research`)
- 2 jours : intégration des effets en combat engine
- 2 jours : UI tier 5 selector + reset modal
- 2 jours : migration script + tests

**Risque** : 🟠 Moyen. Forte sensibilité PvP : il FAUT tester les matchups Plasma vs Composite (boucliers melt faster vs hull endurant), Cinétique vs Réactif (renvoie de dégâts), etc. Staging extensif obligatoire.

**Fichiers à toucher** :
- Migration Drizzle pour `user_research_specializations` (table ou colonnes)
- `packages/db/src/schema/user-research.ts`
- `packages/game-engine/src/formulas/combat.ts` (intégrer les effets de spec)
- `apps/api/src/modules/research/research.service.ts` (chooseSpecialization, resetSpecialization)
- `apps/api/src/modules/research/research.router.ts` (nouvelles procedures)
- `apps/web/src/pages/Research.tsx` (UI choice modal au niv 5)
- `apps/web/src/components/research/SpecializationSelector.tsx` (nouveau composant)

**Pré-requis** : Pilier 1 (soft-caps), idéalement Pilier 2 (annexes différenciées) pour cohérence des effets.

---

### Pilier 4 — Robotics refonte

**Tension résolue** : Bâtiments subis (#6). `robotics` aujourd'hui = `-15%/niv build_time` linéaire. C'est un slot qu'on monte tôt et qu'on oublie, jamais piloté.

**Proposition** — l'usine produit des **robots assignables**. L'effet passif `-15%/niv` est **supprimé** au profit d'un système actif :

#### Mécanique

- Capacité = `N × 2` robots empire-wide (niv 10 = 20 robots)
- **4 types de slots** d'affectation :
  | Slot | Effet par robot | Cap par cible |
  |---|---|---|
  | Construction | +5% vitesse build sur 1 bâtiment précis en cours | 5 robots/bâtiment |
  | Extraction | +1%/h prod sur 1 mine spécifique | 3 robots/mine |
  | Maintenance défense | +0.5% HP regen défense planète | 5 robots/planète |
  | Mission PvE | -2% temps mission PvE active | 4 robots/mission |
- Réassignation libre avec cooldown de **5 min** (évite micro-optimisation toutes les secondes)
- Robots non-assignés ne font rien (incite à utiliser)

#### UI nouvelle : panneau "Atelier"

- Nouvelle page `/atelier` ou dans le détail du bâtiment robotics
- Vue d'ensemble des robots :
  - Total / Assignés / Disponibles
  - Liste des affectations actuelles avec effet visible
- Boutons d'affectation rapide (presets : "Optimiser construction", "Optimiser prod", etc.)
- Effets visibles **directement sur les écrans concernés** (BuildingUpgradeCard, ResourceCard, etc.)

#### Migration

- Les niveaux actuels de `robotics` sont préservés
- L'effet `-15%/niv build_time` est rétroactivement supprimé
- Compensation : au moment du déploiement, chaque joueur reçoit un crédit de robots = ses niveaux × 2 (équivalent niveau actuel)
- Changelog majeur explicite

**Effort** : 2 semaines.
- 3 jours : DB schema (`robot_assignments` table)
- 3 jours : service d'application des bonus dans tous les pipelines (build, mining, defense regen, PvE)
- 5 jours : UI panneau Atelier + intégration aux 4 surfaces
- 3 jours : tests + migration

**Risque** : 🔴 Élevé. Tax cognitif important. Risque "j'ai pas envie de gérer ça" chez les joueurs casual. Mitigations :
1. Presets prêts à l'emploi ("Optimiser pour construction")
2. Effets visibles en temps réel sur les écrans existants (le joueur SENT l'impact)
3. Message d'aide dans le tutoriel (à étendre)

**Fichiers à toucher** :
- Migration Drizzle pour `robot_assignments`
- `packages/db/src/schema/robot-assignments.ts` (nouveau)
- `packages/game-engine/src/formulas/production.ts` (intégrer le bonus robots)
- `packages/game-engine/src/formulas/building-cost.ts` (intégrer le bonus robots)
- `packages/game-engine/src/formulas/combat.ts` (intégrer regen defense)
- `apps/api/src/modules/robotics/` (nouveau module)
- `apps/web/src/pages/Atelier.tsx` (nouveau)
- `apps/web/src/components/robotics/RobotAssignment.tsx` (nouveau)
- Modifs sur les pages existantes pour afficher les bonus actifs : Buildings, Resources, Defense, Missions

**Pré-requis** : Pilier 1 (caps), idéalement Pilier 5 fait avant (la fusion industrielle simplifie l'arbre).

---

### Pilier 5 — Doctrines + fusion industrielle

**Tension résolue** : Clonage de colonie (#3) + Bâtiments redondants (#4).

**Proposition en 2 mouvements complémentaires** :

#### 5.A — Doctrine de colonie (à la colonisation)

4 doctrines mutuellement exclusives :

| Doctrine | -25% coût | +25% coût | Bâtiment unique débloqué |
|---|---|---|---|
| **Industrielle** | Bâtiments indus + storage | Recherches | `Raffinerie` (production de composants — voir Bonus ideas) |
| **Militaire** | Shipyards + défenses | Production civile | `Caserne` (vaisseaux militaires +10% stats sur cette planète) |
| **Scientifique** | Labs + recherche | Bâtiments militaires | `Quantum Lab` (2 recherches en parallèle empire-wide tant qu'il existe) |
| **Commerciale** | Storage + market | Defense | `Bourse libre` (-50% commission marché sur les offres venant de cette planète) |

- **Doctrine homeworld** : à choisir au premier vrai login (modal one-time grace) — par défaut `Industrielle` si timeout
- **Reset doctrine** : 100 Exilium → pivot lourd mais possible

#### 5.B — Fusion industrielle

État actuel :
- `robotics` : -15%/niv build_time global
- `shipyard` : prérequis robotics 1
- `arsenal` : prérequis robotics 2
- `commandCenter` : prérequis robotics 4 + shipyard 2

Proposition :
- `robotics` reste **socle global** (système de Pilier 4 — robots assignables)
- `shipyard` + `arsenal` → fusion en **`industrialComplex`** : -15%/niv temps indus + défenses
- `commandCenter` → **`militaryDocks`** : -15%/niv temps militaires + débloque vaisseaux lourds

**Migration**
- Niveaux consolidés : `level(industrialComplex) = max(level shipyard, level arsenal)`
- `level(militaryDocks) = level commandCenter`
- Bookmarks et tutoriels mis à jour (impact UI)
- Changelog majeur avec FAQ

**Effort** : 2 semaines.
- 3 jours : migration data (consolidation des bâtiments existants)
- 3 jours : DB schema (`user_doctrines`, suppression de `shipyard` + `arsenal`, ajout `industrialComplex` + `militaryDocks`)
- 4 jours : implémentation des 4 doctrines + leurs bâtiments uniques
- 4 jours : UI doctrine selector + UI bâtiments fusionnés + cleanup tutoriels

**Risque** : 🔴 Élevé.
- Casse des bookmarks existants
- Renomme des process pm2 ? Non, juste des entités DB.
- Migration de schema importante : 1500 colonies à reconsolider
- Tutoriel doit être mis à jour (quest_6 "Mains mécaniques" cite robotics)

**Fichiers à toucher** :
- Migration Drizzle complexe (consolidation buildings + nouveaux schémas)
- `packages/db/src/schema/user-doctrines.ts` (nouveau)
- `packages/db/src/schema/planet-buildings.ts` (suppression de shipyard/arsenal, ajout industrialComplex)
- `packages/db/src/seed-game-config.ts` (3 nouveaux bâtiments uniques par doctrine)
- `apps/api/src/modules/colonization/colonization.service.ts` (choice doctrine au moment de colonisation)
- `apps/web/src/pages/Galaxy.tsx` (modal doctrine au moment de coloniser)
- Refactor majeur des pages : Buildings, Defense, CommandCenter (qui n'existe plus), Shipyard (qui n'existe plus)
- Tutoriel : `quest_6` à mettre à jour, et probablement d'autres

**Pré-requis** : Aucun strict, mais à faire après Pilier 4 pour éviter de toucher robotics 2 fois.

---

## Cohérence d'ensemble

Les 5 piliers attaquent **5 axes d'identité différents** :

```
Pilier 1 (caps)         → axe TEMPS         (la courbe scale est saine)
Pilier 2 (biomes)       → axe GÉOGRAPHIE    (où je colonise change ma stratégie)
Pilier 3 (specs)        → axe BUILD         (mon style de combat est unique)
Pilier 4 (robotics)     → axe ACTIVITÉ      (je prends des décisions chaque jour)
Pilier 5 (doctrines)    → axe COLONIE       (chaque planète a un rôle)
```

Chaque pilier ouvre 1 dimension. Aujourd'hui : 1 dimension (XP/niveaux) × 1 choix dominant = monoculture.
Avec les 5 piliers : 5 dimensions × N choix par dimension = espace de gameplay multiplicatif.

**Exemple concret de combinatoire post-refonte** :
- Joueur A : doctrine Scientifique + spec Plasma weapons + 3 colonies glaciales (boost hydrogen + bouclier persistant) + robots assignés à recherches
- Joueur B : doctrine Militaire + spec Cinétique + 2 colonies volcaniques (AP weapons) + robots assignés défense
- Joueur C : doctrine Commerciale + spec Hyperspace propulsion + 4 colonies arides (storage + hull regen) + robots assignés à PvE

3 styles complètement différents émergent naturellement.

---

## Phasing recommandé

| Sprint | Pilier | Durée | Risque | Rationale |
|---|---|---|---|---|
| **S1** | Pilier 1 (caps + soft-caps) | 3 jours | 🟢 Faible | **Débloquant** des 4 autres. Pur math + UI. Réversible. |
| **S2** | Pilier 2 (biomes différenciés) | 5 jours | 🟠 Moyen | Pure data DB, mais 4 nouvelles mécaniques combat à équilibrer en staging. |
| **S3** | Pilier 3 (specialization tier 5) | 1 sem | 🟠 Moyen | Migration "free spec" à gérer pour les vétérans. PvP intensif test. |
| **S4** | Pilier 4 (robotics refonte) | 2 sem | 🔴 Élevé | Gros chantier UI + nouvelle table. Risque tax cognitif. |
| **S5** | Pilier 5 (doctrines + fusion) | 2 sem | 🔴 Élevé | Migration schema lourde. Casse bookmarks. À packager avec changelog majeur. |

**Total** : 5-6 semaines. Chaque sprint livrable indépendamment — possible de s'arrêter après S2 ou S3.

### Pourquoi cet ordre

1. **S1 doit être premier** : sans soft-caps, ajouter des mécaniques cumulatives explose le balancing.
2. **S2 après S1** : permet de mesurer si les biomes différenciés changent réellement la stratégie d'expansion.
3. **S3 après S2** : le contenu "spec tier 5" coexiste mieux avec annexes différenciées (sinon les vétérans choisissent en aveugle).
4. **S4 et S5 sont les plus risqués** : à arbitrer après les 3 premiers.

### Métriques à mesurer entre chaque sprint

- **S1** : Distribution des niveaux de recherche par joueur (l'asymptote casse-t-elle les vétérans ?)
- **S2** : Diversité des biomes colonisés (avant/après le pilier)
- **S3** : Distribution des specs (50/50 ou monoculture ?)
- **S4** : Taux de joueurs qui utilisent l'Atelier (>X% au bout d'1 semaine ?)
- **S5** : Distribution des doctrines au moment de la colonisation

---

## Ce qui n'est PAS inclus

### Idées rejetées (pour ce cycle)

- **Bâtiments XP-driven** (construits via activité combat/extraction) → ajoute une 5e économie, fait perdre le sens d'investissement classique. À considérer plus tard comme couche optionnelle.
- **Architecture émergente — slot limité par planète** (25 slots max) → trop radical, change la promesse "build everything" du jeu actuel.
- **Catalysts / Items rares** (drops pirate/exilium qui multiplient une recherche pour N niveaux) → ajoute un loot management. À étudier avec une refonte loot globale.
- **Joint Alliance Research** → **BON CHANTIER**, mais appartient à la roadmap alliance (voir [alliance-improvements](./2026-04-21-alliance-improvements.md)). Ne pas mélanger.
- **Wonders d'alliance** → endgame social, à packager avec le pilier alliance.
- **Research insights passifs** (XP-driven small bonuses) → ajoute encore une économie. Pas le bon moment.

### Bonus ideas à explorer après le 5-pillar refonte

Si le 5-pillar tient, et qu'on a la respiration pour avancer :
- **Tech Leak via espionnage avancé** (sondes lvl 8+ peuvent voler 1 niveau de recherche) → cohérent avec un futur "espionnage évolué"
- **Lost Technologies via biomes Précurseurs** (biome `precursor_relics` débloque tech unique) → cohérent avec une refonte exploration
- **Composants** (4e ressource produite par la `Raffinerie`, consommée par tier 2+ buildings) → cohérent avec le bâtiment unique de la Doctrine Industrielle, mais ajoute du tax cognitif
- **Adjacency bonuses** (bâtiments voisins se boostent mutuellement, style Anno) → polish UX, gros impact si bien fait
- **Auto-recyclage** (% de débris convertis en ressources, scale avec robotics) → flavor feature niveau Pilier 4 supplémentaire
- **Maintenance auto** (défenses détruites reconstruites gratuitement sous certaines conditions) → cohérent avec Pilier 4 (robots maintenance)
- **Production parallèle** (file build x2 à partir d'un certain niveau) → grosse révolution éco, à arbitrer après S5

---

## Notes techniques pour reprise

### Conventions du repo

- **Commits** : conventional commits en français, scope type `(flagship)`, `(web)`, `(api)`, `(db)`, `(missions)`, etc.
- **Langue** : tout le contenu joueur en français. Code, commentaires en anglais (sauf domain terms).
- **DB helpers** : utiliser `byUser(table.userId, userId)` et `byId(table.id, id)` au lieu de `eq()` direct (218 occurrences dans le repo, cf `apps/api/src/lib/db-helpers.ts`).
- **Erreurs PG** : pour détecter des conflits unique, check `err.code === '23505'` (SQLSTATE), pas le message string.
- **Drizzle** : `sql\`${date}\`` ne marche pas pour les Date objects — utiliser `gt()/lt()` à la place.
- **Migrations** : numéros séquentiels dans `packages/db/drizzle/00XX_*.sql`. Tracking via table `_migrations`. **Toujours appliquer via `apply-migrations.sh` (pas via psql user postgres direct).**

### Déploiement

- **Prod** : `./scripts/deploy.sh` depuis `/opt/exilium` → git pull + install + build + migrations + seed + pm2 reload + caddy reload + **chaîne deploy-staging.sh automatiquement**
- **Staging seul** : `./scripts/deploy-staging.sh [ref]` (default `origin/main`)
- **Refresh staging depuis prod** : `sudo ./scripts/refresh-staging-from-prod.sh` (anonymise)
- **PM2 staging config** : `staging.config.cjs` (suffix `.config.cjs` REQUIS par pm2)
- **Migrations** : `apply-migrations.sh` lit `DATABASE_URL` depuis le `.env` local (priorité absolue, ne pas se laisser leak par env ambient)

### Tests / vérifications

- **Typecheck** : `pnpm typecheck` après chaque batch d'edits (NE PAS BATCHER 30 fichiers sans vérif)
- **Sandbox staging** : utiliser le password staging (`/opt/exilium-staging/.staging-password`) pour login as any user via `<username_slug>@staging.local`
- **DB staging** : `sudo -u postgres psql -d exilium_staging`
- **API staging local** : `http://localhost:3001/trpc/*` (pas `/api/trpc/*` — préfixe `/trpc`)
- **Format curl** : tRPC accepte `{json:{...}}` ou raw `{...}` selon configuration

### Fichiers de référence pour cette refonte

#### Game-engine (logique)
- `packages/game-engine/src/formulas/bonus.ts` — resolveBonus, soft-caps à intégrer ici
- `packages/game-engine/src/formulas/combat.ts` — simulateCombat, intégrer AP/regen/bouclier persistant/specs
- `packages/game-engine/src/formulas/production.ts` — intégrer robots
- `packages/game-engine/src/formulas/building-cost.ts` — intégrer robots
- `packages/game-engine/src/formulas/research-cost.ts` — caps
- `packages/game-engine/src/formulas/biomes.ts` — bonus empire-wide par lab annexe
- `packages/game-engine/src/formulas/fleet.ts` — conso hydrogène (gaseous propulsion)

#### Database
- `packages/db/src/seed-game-config.ts` — TOUTES les définitions (BUILDINGS, RESEARCH, BONUS_DEFINITIONS, etc.)
- `packages/db/drizzle/` — migrations
- `packages/db/src/schema/` — schémas Drizzle, ajouter `robot-assignments.ts`, `user-doctrines.ts`, `user-research-specializations.ts`

#### API
- `apps/api/src/modules/building/building.service.ts` — application des bonus, modifier pour robots + doctrines
- `apps/api/src/modules/research/research.service.ts` — modifier pour specs
- `apps/api/src/modules/colonization/colonization.service.ts` — doctrine choice
- Nouveaux : `apps/api/src/modules/robotics/`, `apps/api/src/modules/doctrine/`

#### Web
- `apps/web/src/pages/Buildings.tsx`, `Research.tsx`, `Defense.tsx`, `CommandCenter.tsx`, `Shipyard.tsx`, `Galaxy.tsx`
- `apps/web/src/components/entity-details/BuildingDetailContent.tsx` — afficher caps + ROI
- `apps/web/src/components/common/BuildingUpgradeCard.tsx` — déjà a `rates` via Pilier 0
- Nouveaux : `apps/web/src/pages/Atelier.tsx`, `apps/web/src/components/research/SpecializationSelector.tsx`, modals doctrine

### Données de référence (chiffres clés actuels)

- **Phase multipliers** (universe_config) : `[0.35, 0.5, 0.65, 0.75, 0.85, 0.9, 0.95, 1.0]` pour niveaux 1-8, puis 1.0
- **Production base** : minerai 30, silicium 20, hydrogène 10
- **Exponent base** : 1.1 partout
- **Storage formula** : `5000 × floor(2.5 × e^(20×lvl/33))`
- **Anomaly FP** : `80 × 1.7^(tier-1) × min(3.0, 1.06^(depth-1))` — V6 absolute, indépendant du FP joueur
- **Flagship XP** : quadratique `xp = 100 × (L-1) × L / 2`, maxLevel 60

### Patchnotes récents à connaître (toucher pas sans relire)

Voir `docs/patchnotes/` :
- `2026-04-25-refonte-combat.md` — refonte combat majeur
- `2026-04-14-colonization-rework.md`
- `2026-04-14-laboratoires-annexes-recherche-empire.md` — chantier qui a introduit les annexes
- `2026-04-13-biomes-exploration-marketplace.md`

---

## Décisions en attente

À arbitrer avec le user avant de démarrer S1 :

1. **Valeur exacte de `k` dans la soft-cap** : `1 - exp(-k×lvl)` avec `k=0.15` donne :
   - niv 5  : +49% (vs +50% linéaire actuel) — quasi-identique
   - niv 10 : +78% (vs +100%) — sensible
   - niv 15 : +90% (vs +150%) — fort
   - niv 20 : +95% (vs +200%) — fort
   - asymptote : +100% × max → `max=1.5` → +150% absolu
   - Confirmer la valeur `max=1.5` (asymptote) et `k=0.15`. Trop souple = pas d'effet, trop dur = vétérans frustrés.

2. **Reset gratuit Pilier 3** : 1 fois ou illimité pendant 14 jours ?

3. **Coût Exilium** :
   - Reset spec : 50 Exilium (proposé)
   - Reset doctrine : 100 Exilium (proposé)
   - Vérifier que ces montants ne cassent pas l'économie Exilium existante

4. **Migration grand-fathering** : combien de temps de grace period (14 jours proposé) avant d'appliquer les caps rétroactivement ?

5. **S4 robotics** : implémenter en feature flag (opt-in pendant 2 mois) ou direct pour tous ?

6. **S5 fusion** : faire un wipe staging spécifique pour tester la migration de schema avant d'envoyer en prod ?

---

## Next step

**Si la vision est validée** : démarrer **Sprint 1** (Pilier 1 — Plafonds & soft-caps).

Plan d'implémentation Sprint 1 en détail :

### Jour 1 — DB + game-engine

1. **Migration Drizzle** `00XX_balance_caps.sql` :
   ```sql
   -- Add maxLevel column to building/research definitions if not in seed
   -- (already in seed-game-config.ts, just adjust values)
   -- Add costFactor differentiation
   ```
2. **Modifier `seed-game-config.ts`** :
   - Recherches : `maxLevel: 20` partout (sauf annexes biomes restent `null`)
   - Bâtiments standards : `maxLevel: 25`
   - `costFactor` différencié par catégorie (table dans Pilier 1)
3. **Modifier `packages/game-engine/src/formulas/bonus.ts`** :
   - Ajouter `softCapBonus(level, max=1.5, k=0.15)`
   - Appliquer aux bonus marqués `linearPercentage` (à étiqueter dans bonus_definitions)

### Jour 2 — Storage cap + tests

4. **Modifier `production.ts`** :
   - Storage effective = `min(storage_definition_value, 10 × hourly_production)`
   - Exposer `effective_storage_cap` dans `rates` (pour UI)
5. **Tests** :
   - Vérifier sur staging avec des comptes vétérans (Zecharia est admin niv max)
   - Mesurer impact sur quelques builds typiques (recherche niv 15, mine niv 30)

### Jour 3 — UI + déploiement

6. **UI updates** :
   - `BuildingDetailContent.tsx` : afficher "Plafond niv 25" et "Plafond stockage atteint" si pertinent
   - `Research.tsx` : afficher "Asymptote +150%" sur les techs concernées
   - `OverviewBonuses.tsx` (existant) : afficher caps cumulés
7. **Commit + push + deploy.sh**
8. **Smoke test** : Zecharia post-deploy, vérifier que les niveaux existants ne crashent rien

### Critères d'acceptance Sprint 1

- [ ] Tous les maxLevel sont en DB et appliqués côté API
- [ ] La soft-cap est appliquée sur tous les bonus linéaires (weapons, armor, shield, propulsion, autres si applicable)
- [ ] Storage est capé à `10 × prod_horaire` quand applicable
- [ ] UI affiche les caps de manière visible (pas en infobulle cachée)
- [ ] Typecheck passe sur prod + staging
- [ ] Pas de régression sur les comptes existants (test Zecharia)
- [ ] Changelog en français préparé pour les joueurs

---

## Annexe — Glossaire pour reprise sans contexte

- **FP** = Facteur de Puissance, score d'une flotte
- **Anomaly** = donjon PvE solo avec flagship-only depuis V4
- **Flagship** = vaisseau amiral, 3 coques (combat/industrial/scientific), modules slottés
- **Exilium** = devise premium (microtransactions)
- **Brownout** = état où production_factor < 1.0 (énergie consommée > produite, mines au ralenti)
- **Phase multiplier** = courbe d'ajustement de coûts par niveau de bâtiment (paliers 1-8)
- **Mission relay** = système de bonus PvE basé sur composition de flotte (cf doc design parallèle)
- **Anomaly content service** = gère le pool de bosses + events, admin-éditable depuis V9.2

---

**Fin du document.** Pour reprendre : démarrer par "Next step" ci-dessus, ou poser des questions sur les "Décisions en attente".
