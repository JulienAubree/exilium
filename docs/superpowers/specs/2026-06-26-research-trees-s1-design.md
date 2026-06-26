# Refonte recherche — S1 : Arbres + forks exclusifs + respec (design)

> Statut : **design validé avec Julien (2026-06-26)**, section par section. Sous-projet **S1**
> du « features lot » de la [refonte recherche](2026-06-24-research-rework-design.md).
> Spec → plan (superpowers:writing-plans) → build.

## Contexte & découpage

La refonte recherche (cadre verrouillé le 2026-06-24) se découpe en sous-systèmes
indépendants, chacun son cycle spec→plan→build :

- **S1 (ce spec)** — Structure d'arbre (5 branches/tiers) + **forks exclusifs** + **respec**, niveaux empire-wide. UI arbre. **Exécution INCHANGÉE** (file planète-mère, onglet empire).
- **S2** — Exécution décentralisée par planète (labos parallèles, anti-double-dip) + passage de la recherche en **onglet planète**.
- **S4** — Les 5 capstones (déblocages qualitatifs ; 2 = mécaniques neuves : porte de saut, sonde furtive).

Pré-requis acquis (Lot 2, déployé) : niveaux en lignes `user_research_levels` (source unique ; `user_research` droppée).

## Goal de S1

Transformer la liste plate de recherches en **5 branches-disciplines à paliers**, avec
**choix exclusifs** (spécialisation empire-wide) et **respec** payant en exilium —
en réutilisant au maximum les 21 recherches existantes. Visible joueur via une **vue
arbre** sur l'onglet recherche empire actuel. Aucun changement d'exécution.

## Décisions verrouillées (avec Julien, 2026-06-26)

1. **Catalogue** (cf. table ci-dessous) : 5 branches, 4 forks (Économie, Armement, Défense, Renseignement), Propulsion linéaire.
2. **Bascule joueurs existants** = **auto-pick dominant + remboursement** (one-time).
3. **Fork Armement** = **Puissance (+dégâts) vs Anti-bouclier (`shield_pierce`)**, à effets réutilisant le moteur (`shield_pierce` symétrique à `armor_pierce` existant).
4. **Respec** = coût exilium gros & progressif, **voie abandonnée remise à 0 sans remboursement** (engagement réel).
5. **Respec cost global** (universe config), pas par-fork (YAGNI).
6. **S1 garde l'onglet empire** ; passage onglet planète = S2.

## Catalogue (5 branches)

| Branche | T1 | T2 | T3 (commun) |
|---|---|---|---|
| **Économie** | `energyTech` | ⚔ **Production** (`temperateProduction`) vs **Efficience** (`semiconductors`) | `rockFracturing` → `deepSpaceRefining` |
| **Propulsion** *(linéaire)* | `combustion` | `impulse` | `hyperspaceDrive` + `gaseousPropulsion` |
| **Armement** | `weapons` | ⚔ **Puissance** (+dégâts, neuf) vs **Anti-bouclier** (`shield_pierce`, neuf) | `volcanicWeaponry` |
| **Défense** | ⚔ **Boucliers** (`shielding`) vs **Blindage** (`armor`) | path-gated : Boucliers→`glacialShielding` · Blindage→`aridArmor` | `armoredStorage` |
| **Renseignement** | `espionageTech` (base) | ⚔ **Détection** (`sensorNetwork`) vs **Furtivité** (`stealthTech`) | `planetaryExploration` + `computerTech` |

- ⚔ = fork (choix exclusif). **Défense** : le fork est en **T1** (pas de « base durabilité » séparée — aucune recherche existante n'y allait) ; la doctrine est choisie d'emblée, l'annexe avancée suit en T2.
- **Renseignement** : `espionageTech` est le prérequis de `planetaryExploration` (lvl 2) ET du fork `sensorNetwork`/`stealthTech` (lvl 3) → il est placé en **T1** (foundation) ; `planetaryExploration`+`computerTech` deviennent les communs T3. Les tiers sont organisationnels/d'affichage mais **doivent rester cohérents avec le graphe de prérequis**.
- Recherches **communes** (non grisées par le fork) : minage, `volcanicWeaponry`, `armoredStorage`, `planetaryExploration`+`computerTech`.
- **Conflit bascule** (investissement des deux côtés possible) : Économie, Défense, Renseignement. Armement = neuf → pas de conflit.

### Re-pointage des prérequis (fork Défense)

Forker `shielding`/`armor` (T1 Défense) crée des culs-de-sac : des défs externes les exigent en prérequis. **Audit complet** (recherches + vaisseaux + défenses + bâtiments) → **exactement 3 dépendants externes** à re-pointer vers une base non-forkée :

| Dépendant | Prérequis actuel (forké) | Re-point |
|---|---|---|
| `hyperspaceDrive` (recherche) | `shielding 5` | `impulse 5` (prédécesseur Propulsion) |
| `recycler` (vaisseau) | `shielding 2` | `combustion 2` (drive de base) |
| `frigate` (vaisseau) | `armor 2` | `weapons 2` (Armement T1 commun) |

Les annexes (`glacialShielding`/`aridArmor`) et les 3 autres forks (`sensorNetwork`/`stealthTech`, `temperateProduction`/`semiconductors`) **n'ont aucun dépendant externe** → forkables sans re-point. Substitutions ci-dessus = proposées, ajustables au calibrage ; appliquées via le seed + migration de mise à jour des `prerequisites`.

## Mécaniques

### Fork (choix exclusif, empire-wide)
- Choisir une voie déverrouille ses recherches ; l'autre voie est **verrouillée** (non lançable).
- **Un seul choix par fork pour tout l'empire** (cohérent avec les niveaux empire-wide).
- Le gating fork s'ajoute **par-dessus** les prérequis existants (`prerequisites.research/buildings`).

### Respec (volontaire)
- Coût exilium : `coût = base × facteur^(respec_count du fork)`. **Calibrage chiffré → passe d'équilibrage** (hors S1).
- La voie abandonnée → **niveaux remis à 0**, **sans remboursement**.
- ⚠️ **Défense** : fork en T1 → un respec remet à 0 **2 recherches** (ex. Boucliers→Blindage : `shielding` ET `glacialShielding` → 0).
- `respec_count` du fork +1 à chaque respec.

### Bascule one-time (joueurs existants) — distincte, généreuse car forcée
- Traite, par joueur, **chaque fork où il a investi sur ≥1 voie** :
  - **Une seule voie investie** → cette voie est choisie, aucun remboursement (l'autre est déjà à 0).
  - **Deux voies investies** → voie retenue = plus de **ressources cumulées investies** (départage déterministe = voie listée en premier) ; voie non retenue → niveaux à 0 + **remboursement total** des ressources investies (minerai/silicium/hydrogène) crédité sur la **planète-mère**, dépassement de capacité toléré (exceptionnel, une fois).
  - **Aucune voie investie** → pas de ligne créée ; le joueur choisira plus tard (choix initial gratuit).
- `respec_count` initialisé à 0.
- **Idempotent** : skip un fork déjà présent dans `user_research_choices` pour ce joueur.

## Modèle data

### `research_definitions` (config, admin-éditable, seedée) — colonnes ajoutées
- `branch_id` varchar — `economy` | `propulsion` | `armament` | `defense` | `intel`.
- `tier` smallint — 1/2/3 (organisation + affichage).
- `fork_id` varchar **nullable** — identifiant du fork (ex. `defense_doctrine`, `armament_spec`, `economy_yield`, `intel_warfare`). null = recherche commune/linéaire.
- `fork_path` varchar **nullable** — voie au sein du fork (ex. `shields`/`armor`). null hors fork.

> Colonnes capstone (`unlocks_ship_id`/`unlocks_building_id`) = **S4**, pas S1.

### `universe` config — respec
- `research_respec_base` (exilium) · `research_respec_factor`. Formule unique tous forks (override par-fork = plus tard si besoin).
- Labels des voies via le système `ui-labels` existant.

### `user_research_choices` (data joueur, NOUVELLE table)
`user_id` uuid (FK users ON DELETE CASCADE) · `fork_id` varchar · `chosen_path` varchar · `respec_count` smallint NOT NULL default 0 · **PK `(user_id, fork_id)`**. Empire-wide (par user).

## Contenu neuf (fork Armement)

- **2 `research_definitions`** : **Puissance** (bonus type dégâts, façon `weapons`) et **Anti-bouclier** (nouveau stat `shield_pierce`) — + leurs `bonus_definitions`.
- **Moteur de combat** : ajouter `shield_pierce` dans `applyDamage` (`packages/game-engine/src/formulas/combat.ts`) — réduit l'absorption bouclier de la cible d'une fraction sur le tir (le modèle actuel vide le bouclier en 1 tir → `surplus = damage − shield × (1 − shieldPierce)`), **symétrique à `armor_pierce`** (aujourd'hui boss-only). Threader la fraction depuis la recherche de l'attaquant (via `CombatMultipliers` / input combat). Tests combat dédiés.

## API (tRPC) & Admin

- `research.list` enrichi : métadonnées branch/tier/fork + choix du joueur (`user_research_choices`) + états verrouillés (fork non choisi / mauvaise voie / prérequis).
- `research.chooseFork(forkId, path)` — choix initial **gratuit** (refus si déjà choisi pour ce fork).
- `research.respec(forkId)` — débite exilium (formule), remet à 0 la voie abandonnée (`user_research_levels`), bascule `chosen_path`, `respec_count`+1. Transactionnel.
- `research.start` — **gating fork** : refus si la recherche a un `fork_id` dont `fork_path` ≠ voie choisie (ou aucune voie choisie).
- **Admin** (`apps/admin`) : l'éditeur recherche gagne branch_id / tier / fork_id / fork_path.

## UI (onglet empire `Research.tsx`)

- Grille plate → **vue par branche** : 5 sections, tiers T1→T3 ordonnés, **art des cartes réutilisé**.
- **Fork** = 2 voies côte à côte. Pas de choix → les deux en « choisir cette voie ». Choix fait → voie active + voie adverse grisée/verrouillée avec bouton **Respec**.
- **Choix initial** : confirmation légère. **Respec** : dialog montrant coût exilium + ce qui repart à 0.
- États par nœud : verrouillé (prérequis / fork non choisi / mauvaise voie), dispo, en cours, max.
- Connecteurs « arbre » dessinés = polish **différable** ; S1 = fonctionnel + propre, aligné « OGame moderne ».

## Tests

- **Backend** (filet `exilium_test`) : gating fork (`start` refusé sur voie non choisie), `chooseFork` (refus si déjà choisi), `respec` (débit exilium + reset voie + bascule + `respec_count`++), script bascule (dominante par ressources + remboursement + idempotence).
- **Combat** (game-engine) : effet `shield_pierce` (réduction d'absorption), non-régression du modèle existant.
- Non-régression : tests recherche existants verts.
- Gate complet : `pnpm typecheck && pnpm -r lint && pnpm -r test && pnpm -r build`.

## Migration / déploiement

1. **Migration Drizzle additive** : colonnes `research_definitions` + table `user_research_choices`. Non destructif.
2. **Seed** : branch/tier/fork sur les 21 + les 2 recherches neuves ; **re-pointage des 3 prérequis** (hyperspaceDrive/recycler/frigate) ; respec config universe ; labels.
3. **Script bascule one-time** (TS, idempotent, lancé au déploiement) : calcule la dominante + remboursement via les formules de coût `game-engine` (pas du SQL pur), insère `user_research_choices`, met à 0 la voie abandonnée, crédite la planète-mère.
4. **Backup postgres avant** (le script mute `user_research_levels` + ressources planète-mère). Prod + staging ensemble.

## Hors scope S1

- Exécution décentralisée par planète + onglet planète (**S2**).
- Les 5 capstones + colonnes capstone (**S4**).
- Calibrage chiffré (coûts/temps, base/facteur respec, valeurs `shield_pierce`) — passe d'équilibrage.
- `maxLevel` des recherches (décision séparée).
- Connecteurs « arbre » graphiques (polish ultérieur).
- Respec cost par-fork (global pour l'instant).
