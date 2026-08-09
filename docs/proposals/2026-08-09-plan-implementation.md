# Exilium — plan d'implémentation du rework

> Document d'EXÉCUTION, écrit le 2026-08-09 pour être donné tel quel à une session de codage.
> Il dérive de trois sources : le plan de rework (`2026-08-09-plan-rework-exilium.md`, design
> verrouillé avec Julien), la cartographie fonctionnelle (`docs/reference/cartographie-fonctionnelle.md`),
> et une cartographie technique par 13 agents-enquêteurs dont les sorties brutes — constats,
> preuves fichier:ligne, requêtes SQL — sont dans
> `docs/reference/cartographie-technique-2026-08-09/` (**à lire avant chaque lot**).
>
> Chaque affirmation de ce plan est adossée à une preuve dans ces cartographies. En cas de
> contradiction entre ce plan et le code réel, le code gagne : vérifier, puis corriger le plan.

---

## 0. Règles d'or de l'atelier (non négociables)

1. **Jamais de build ni de deploy automatique.** Caddy sert `apps/web/dist` en live ; un build
   écrase la prod. Le déploiement est un acte de Julien (deploy manuel ciblé, puis
   `scripts/deploy-staging.sh` enchaîné — prod et staging toujours ensemble, `pm2 save` après tout
   changement de process).
2. **`pnpm typecheck` après chaque lot de modifications**, suites vitest concernées avant chaque
   commit.
3. **Git** : branche dédiée par lot ; `git add` par chemins précis (working dir partagé avec
   Julien) ; jamais un fichier supprimé (`git rm`) dans un `git add` de chemins qui suit ;
   `git status` après chaque commit.
4. **Base de données** : toute commande d'écriture exige `DATABASE_URL` explicite. Prod =
   `exilium`, staging = `exilium_staging`, tests = `exilium_test`
   (`bash scripts/setup-test-db.sh`). Migrations SQL versionnées dans `packages/db/drizzle/`
   (prochain numéro libre : 0114+), appliquées par `scripts/apply-migrations.sh`.
5. **Le worker n'est pas importable en test** (await top-level + files BullMQ à l'import) : tester
   les fonctions exportées (`resourceTick`, services) sur `exilium_test`, jamais en lançant le
   worker.
6. **Staging = checkout séparé** (`/opt/exilium-staging`, DB `exilium_staging`,
   `deploy-staging.sh <ref>` accepte n'importe quelle branche) : c'est le mécanisme canonique pour
   livrer un chantier sans le merger — aucune infra de feature-flag n'existe côté web, et il n'en
   faut pas pour ça.
7. **Principes produit qui arbitrent** (section 5 du plan de rework) : pas de PvP entre joueurs ;
   aucune mécanique ne punit le joueur hebdomadaire ; on développe les missions, on entretient le
   reste ; le plaisir de construire est une ressource du projet.

---

## 1. État des décisions

**Design (verrouillé par Julien — ne pas rediscuter)** : coop sans PvP · fiction de l'exil et les
Premiers (pirates, parlent, tiennent des systèmes entiers, un capitaine nommé par système) ·
cycle d'un système : tenu → repris à plusieurs → bonus d'empire et/ou zones de minage
exceptionnelles pendant une fenêtre → les Premiers reviennent · cœur du jeu = planètes (pluriel)
+ flotte industrielle + chasseurs + centre de missions · récompenses qualitatives : vaisseaux
spéciaux posables + as de pilotage (l'as EST le pilote de son vaisseau spécial) · capitaines =
lignes `users` avec `isNpc` · carte neuve à égalité, dimensionnement paramétrable (différé) ·
exilium = super-ressource détenue par les Premiers · l'arbre de recherche « rend » au lieu
d'inventer · marché/alliances/espionnage/recyclage/exploration restent en soutien.

**Défauts techniques adoptés (recommandations des cartographies — Julien peut poser un veto,
sinon coder tel quel)** :

| # | Décision | Défaut adopté |
|---|---|---|
| D1 | Recherche énergie dans le crédit | Incluse PARTOUT (production + consommation) — condition du « au centime » |
| D2 | Sémantique de cumul des bonus | Additive serveur `1 + Σ deltas` ; game-sim s'aligne (golden re-relevés) |
| D3 | Talents dans le chemin unifié | Gardés et câblés dans le worker (mine dormante levée) |
| D4 | Hook quêtes dans le tick | NON (créditerait les hors-ligne) — écart assumé, documenté |
| D5 | Aperçus pages Bâtiments | Libellé « hors bonus » en v1 ; endpoint réel plus tard |
| D6 | Race lost-update tick↔spend | Fermée par `WHERE resources_updated_at = prev` (rattrapage au tick suivant) |
| D7 | Qu'est-ce qu'une « partie » | Singleton snapshot actif (pas de table games tant qu'il n'y a qu'un univers) |
| D8 | Historique des snapshots | Insert-only, on garde tout ; diff calculable après coup |
| D9 | Périmètre du snapshot | INTÉGRAL en v1 (partition cosmétique/gameplay plus tard) |
| D10 | 4 clés config orphelines | Conservées, commentées « sans consommateur » (purge = lot ménage ultérieur) |
| D11 | World seed | OUI : sans sel, une carte neuve aux mêmes dimensions serait IDENTIQUE (le seed PRNG est un pur produit de g:s:p) |
| D12 | Topologie de la carte neuve | **Bord de carte, plus d'anneau** — la fiction (« posés au bord ») l'exige ; le wrap hardcodé 9/499 de `fleet.ts` devient un paramètre qu'on éteint |
| D13 | Matérialisation des systèmes | Seuls les systèmes tenus par les Premiers ont une ligne en table ; le reste de l'univers reste virtuel-lazy |
| D14 | Missions de groupe | Table world-anchored (modèle `asteroid_belts`/`deposits`, déjà partagé et concurrency-safe) plutôt que `user_id` nullable sur `pve_missions` |
| D15 | Renseignement pirate | Information graduée : FP seul → classes → composition exacte via espionnage (la donnée existe, figée à la génération ; boucher la fuite `getMissionById` → `parameters.scaledFleet`) |
| D16 | Perte d'un vaisseau spécial | Incapacité + réparation, jamais détruit (comme l'amiral) — protège le joueur hebdo ; la mission dangereuse coûte la flotte, pas la collection |
| D17 | Amiral vs collection | COEXISTENCE : `flagships` intouché (~30 sites), nouvelle table `special_ships` à côté ; migration éventuelle plus tard |
| D18 | Agrégation des bonus spéciaux | Via `computeTalentContext` étendu — les ~30 consommateurs marchent sans modification et le test D2 reconnaît déjà ce producteur |
| D19 | Diffusion du fil de l'univers | Polling 30-60 s en v1 (le rythme du jeu ne justifie pas un canal SSE broadcast) |
| D20 | Faits d'armes | Catalogue typé (table de définitions, payloads Zod façon `alliance_logs`) — pas un flux libre |
| D21 | **Effectif de départ** | **20 joueurs** (décision de Julien, 2026-08-09, explicitement provisoire — « puis on verra ») |

### Dimensionnement dérivé des 20 joueurs

Le chiffre n'est pas une prévision, c'est un paramètre : deux clés de config, changeables jusqu'au moment du reset.

- **1 galaxie.** Un saut de galaxie coûte 20 000 de distance contre ~8 300 pour traverser 60 systèmes : à plusieurs galaxies, les joueurs seraient injoignables entre eux. La carte tient donc dans une seule.
- **~60 systèmes**, en topologie `bounded` : les exilés aux deux bords, les Premiers au centre — la fiction devient une lecture de la carte.
- **~540 emplacements habitables** (60 systèmes × 9 positions hors ceintures), soit 27 par joueur. Large sans être vide : le défaut mesuré de la carte actuelle, ce sont 91 planètes perdues dans 9 × 499 systèmes.
- ⚠️ À changer **en base ET dans `game-config-data.ts`** (cf. le script de reset).

---

## 2. Lot 0 — Rendre les chiffres honnêtes

> Source détaillée : `cartographie-technique-2026-08-09/acte0-economie.md` (diagnostic complet,
> 10 étapes, risques, tests). Résumé opératoire ici ; l'ordre est contraignant.

**Le diagnostic en une phrase** : quatre chemins de calcul divergents — affichage (tout inclus),
accrual API (sans recherche énergie), tick worker 15 min (le verseur dominant : sans biomes, sans
politiques, sans energy_production, sans bouclier), game-sim (multiplicatif direct) — d'où
~528 423/h affichés vs ~425 740/h versés.

1. **Garde-fou seed** : supprimer le fallback prod de `seed-game-config.ts:27` (exit 1 sans
   `DATABASE_URL`), flag `--allow-prod` pour écrire vers la base `exilium`, `deploy.sh` passe
   l'URL explicite (modèle : `apply-migrations.sh`).
2. **Valider D1-D6** (tableau ci-dessus) — déjà adoptés par défaut, veto possible.
3. **Assembleur de contexte partagé** : extraire `buildBonusContext` en module pur
   (`bonus-context.ts`) avec façade par-planète + BatchLoader (contrat perf : 50k planètes en
   O(requêtes constantes), jamais N+1) ; supprimer `withEnergyResearch` (D1) ; corriger
   `getGovernancePenalty` (rôle homeworld par config, pas id en dur) ; câbler `talentService`
   dans `worker.ts` et retirer l'entrée d'`ECARTS_CONNUS`.
4. **`resource-tick` réécrit** sur l'assembleur batché : biomes + politiques + énergie + bouclier
   (`shieldPercent` dans la projection) + skip `status='colonizing'` + caps storage bonifiés +
   D6.
5. **LE test « affiché = versé au centime »** : `production-parity.test.ts` sur `exilium_test`,
   fixture cumulant TOUTES les sources (biomes, recherche énergie, vocation, politique,
   gouvernance, bouclier 50 %, satellites, curseurs) ; `getProductionRates` == crédit
   `materializeResources` sur 1 h == crédit `resourceTick`, égalité stricte, dates injectées.
6. **Biomes — effet réel complété** : migration 0114 (activer les 7 `planet_biomes` dormants dont
   le propriétaire a la découverte) + correctif `explore.handler` (activer à la découverte sur
   planète possédée).
7. **game-sim re-pointé** sur `calculateProductionRates` (D2) ; les 14 golden re-relevés en DEUX
   commits (sémantique, puis effet fuite) — c'est la mesure d'impact officielle du lot.
8. **Snapshot de config** : table `config_snapshots` (payload = `GameConfig` de
   `buildConfigFromDb`, un seul actif), `getFullConfig` sert le snapshot actif sinon fallback,
   mutation admin `publishConfig` + UI « Publier » (draft ≠ publié affiché clairement).
9. **Seed non-destructif** : `onConflictDoUpdate` → `onConflictDoNothing` par défaut ; DELETE de
   prérequis scopés aux entités insérées par ce run ; l'ancien comportement derrière
   `--force-overwrite` ; les deletions OLD_SHIP_IDS déplacées en migration versionnée.
   ⚠️ Étapes 1+9 doivent partir ensemble ou avant tout déploiement.
10. **Vérification finale** : typecheck global + toutes suites + contre-preuve SQL lecture seule
    sur les 91 planètes (écart résiduel nul) + doc dans `CLAUDE.md`. Aucun deploy.

**Risque assumé à communiquer aux joueurs** : corriger la fuite est un buff (~+24 % pour les
inactifs) et D1 fait BAISSER localement les planètes en brown-out/bouclier — c'est le prix de
l'honnêteté.

---

## 3. Lot 1 — Infrastructure de la carte neuve

> Terrain : carte « Génération d'univers » de `terrain-actes123.md`. L'univers est 100 %
> virtuel-lazy (aucune table galaxie/système), dimensionné par 3 clés `universe_config`
> (9/499/16), PRNG seedé par g:s:p uniquement. `compact-universe.sql` (jamais appliqué) est le
> prior art du remap.

1. **World seed (D11)** : clé `universe_config.world_seed`, injectée dans `coordinateSeed`
   (`packages/game-engine/src/formulas/biomes.ts:34-49`) et dans TOUS ses appelants dupliqués
   (`galaxy.service`, `colonize.handler`, `explore.handler` — même logique aux trois endroits,
   cohérence par le seed partagé).
2. **Bord de carte (D12)** : câbler `maxGalaxies`/`maxSystems` depuis `universe_config` dans
   `buildFleetConfig` (`fleet.helpers.ts:8-18` — aujourd'hui jamais passés, fallbacks 9/499 en
   dur dans `fleet.ts:59,65`) + clé `topology: 'ring' | 'bounded'` consommée par le calcul de
   distance. La carte neuve est `bounded` : les exilés sont au bord, les Premiers au centre.
3. **Ceintures configurables** : `asteroid-belt.service.ts` est typé littéralement `8 | 16` avec
   probabilités/quantités hardcodées — refonte data-driven (probabilités par position depuis la
   config) pour pouvoir placer des ceintures riches dans les systèmes des Premiers.
4. **Script de reset « carte neuve »** (SQL versionné, sur le modèle `compact-universe.sql`, JOUÉ
   UNIQUEMENT PAR JULIEN) : truncate état-carte (`planets` et cascades, `asteroid_belts`,
   `debris_fields`, `discovered_*`, `fleet_events`, `pve_missions`, `mission_reports`,
   `exploration_reports`, `mission_center_state`) ET état-joueur (recherches,
   `empire_progression`, `flagships`, exilium, `tutorial_progress`) en GARDANT les comptes.
   Nouvelles dimensions écrites dans `game-config-data.ts` (pas seulement en base : le seed
   upserterait l'ancienne taille — piège levé par le Lot 0 étape 9, vérifier l'ordre).
5. **Spawn** : politique de départ paramétrable (`spawn_radius` existe en code mais la clé n'est
   jamais seedée — la seeder) ; le clustering actuel (ancrage dernier homeworld) convient à
   « posés au bord » ; dimensionnement N joueurs = paramètre, décision différée.
6. **Mur hydrogène** (verrou mesuré : prospecteur 375 H, dotation 100) : sortir l'hydrogène des
   coûts early (config vaisseaux tier 1) — un kit de départ ne suffit PAS, le mur reviendrait au
   deuxième vaisseau.
7. **Économie accélérée** : multiplicateur plat via `universe_config.speed` (seul levier mesuré
   homothétique — ne PAS toucher aux exposants, non-monotone).

---

## 4. Lot 2 — Les Premiers et le combat

> Terrain : cartes « Moteur de combat » et « Centre de missions » de `terrain-actes123.md`.
> Le moteur pur est SAIN (config-driven, RNG seedé, 50 tests, 12 snapshots) — c'est l'assemblage
> PvE qui est trivial : budget FP décorrélé (ratio médian 20×), templates re-scalés en 4-7
> intercepteurs, multiplicateurs 1/1/1, butin ×0,1. On refait la génération du contenu, pas le
> moteur.

1. **`isNpc` sur `users`** (migration posée AVANT toute création de capitaine) : exclusion des
   classements, du fil, des compteurs, de l'admin ; migrer `ensure-debug-bot.sh` dessus (le bot
   de debug se déguise aujourd'hui en admin faute de mieux).
2. **Capitaines et systèmes** : N lignes `users` isNpc (un capitaine nommé par système tenu) ;
   nouvelle table `premier_systems` (galaxy, system, captain_user_id, état
   `held/contested/liberated`, `window_ends_at`, `returns_at`, config de garnison) — seuls les
   systèmes tenus sont matérialisés (D13). Leurs planètes = vraies lignes `planets` appartenant
   au capitaine : flottes, défenses, bouclier planétaire, espionnage fonctionnent sans code neuf.
3. **Combat refait — 5 chantiers de génération** (le moteur ne bouge pas) :
   (a) garnisons FIXES par système (fini le scaling au FP du joueur — la formule `fp.ts` sert de
   règle pour les composer) ; (b) unités Premiers dédiées = nouvelles `ship_definitions` avec
   `weapon_profiles` propres (contre-jeu anti-capital pour menacer l'amiral) ; (c) router le PvE
   sur le chemin PvP complet (`attack.handler` : 7 catégories, weaponProfiles, défenses, bouclier
   planétaire — le chemin pirate actuel ignore tout ça) ; (d) multiplicateurs de recherche par
   capitaine (fini le 1/1/1) ; (e) la défaite coûte : garnison à état persistant entamée assaut
   après assaut (pattern `asteroid_deposits`, déjà concurrency-safe en prod) — c'est aussi ce qui
   rend le siège JOUABLE À PLUSIEURS ; `PhasedMissionHandler` porte les missions multi-phases.
4. **Le cycle** : à la libération → fenêtre de bonus (`window_ends_at`) : bonus d'empire pour
   tous ET/OU spawn de gisements exceptionnels dans le système (le substrat `asteroid_deposits`
   partagé existe) ; à `returns_at` → cron de retour des Premiers (état `held` restauré, garnison
   recomposée). Durée/forme/courbe = clés config, réglées en jeu via l'admin.
5. **Missions de groupe (D14)** : les cibles Premiers sont world-anchored (table dédiée ou
   `premier_systems` directement), découvertes par TOUS — rupture avec le lazy par joueur ;
   participation multi-joueurs par état de garnison partagé, pas par instance par joueur.
6. **Renseignement (D15)** : gradation FP → classes → composition ; l'espionnage existant devient
   la sonde d'avant-assaut ; boucher la fuite `getMissionById`.
7. **Exilium recentré** : drop rates marché/recyclage/PvP → 0, la source = les Premiers (drop PvE
   conservé + récompenses de libération) ; débouchés : long-courrier et déblocages (design
   détaillé au moment du lot).
8. **Ménage du centre de missions** (au passage, c'est le cœur maintenant) : brancher ou
   supprimer l'expiration (cron mort, 55 missions pourrissent), implémenter ou retirer le
   cooldown de dismiss annoncé par l'aide (24 h, jamais implémenté).
9. **Critère d'arrêt de l'équilibrage, ÉCRIT AVANT d'ouvrir les fichiers** (proposition à valider
   par Julien) : trois flottes de référence (petite/moyenne/grosse) définies à l'avance ; une
   garnison de système est bien réglée quand `combat.service.simulate` (200 runs) donne un
   winRate 40-70 % à FP comparable et des pertes attaquantes non nulles dans 80 % des victoires ;
   deux soirées de calibrage max, le reste se règle en config via l'admin en jouant.

---

## 5. Lot 3 — Récompenses qualitatives : vaisseaux spéciaux et as

> Terrain : carte « Vaisseau amiral » de `terrain-actes123.md`. La boucle récompense existe déjà
> (`pveMissions.rewards.bonusShips` {shipId,count,chance} accordés au retour) ; les 7 leviers de
> bonus morts sont cartographiés site par site et le test `bonus-levers.test.ts` EXIGE de les
> retirer de `LEVIERS_MORTS_CONNUS` dès qu'un producteur apparaît.

1. **Table `special_ships`** (D17 : `flagships` intouché) : `user_id`, `definition_id`,
   `planet_id` nullable (posé ↔ en mission, états exclusifs comme l'amiral), `status`,
   `repair_ends_at`, `acquired_at`, `UNIQUE(user_id, definition_id)` — **plus les colonnes de
   l'as** (D : l'as EST le pilote) : `pilot_name`, `pilot_story`, `pilot_image_index`. Pas de
   table pilotes séparée.
2. **Définitions en config** (comme `hulls` : éditables via l'admin, snapshotées par le Lot 0
   étape 8) : stats, bonus produits (vocabulaire = les 7 leviers morts), abilities éventuelles
   (le mécanisme `flagship_cooldowns` par (ship_id, ability_id) se généralise tel quel).
3. **Production des bonus (D18)** : `computeTalentContext` étendu — bonus de flotte
   (`fleet_speed`, `fleet_fuel`, `fleet_cargo`) actifs quand le vaisseau est DANS la flotte ;
   bonus de planète (`military_build_time`, `industrial_build_time`, `pve_loot`) actifs quand il
   est POSÉ (le hook par-planète existe : `talent.service.ts:71-81`). `market_fee` : gardé,
   produit par un vaisseau spécial dédié au commerce (le marché reste en soutien). Retirer chaque
   clé de `LEVIERS_MORTS_CONNUS` au fur et à mesure — le test le force.
4. **Rattachement flotte** : généraliser le pattern clé réservée de l'amiral — clés
   `special:<definition_id>` dans `fleetEvents.ships`, validation à l'envoi, injection
   stats/combat à l'arrivée, exclusion des colonnes `planet_ships`.
5. **Attribution en mission** : étendre le mécanisme `bonusShips` — un type de récompense
   `specialShip` qui insère une ligne `special_ships` au retour (au lieu d'incrémenter
   `planet_ships`). Premier arrivé sur LA mission qui le porte, ou exemplaire par joueur :
   par-joueur en v1 (l'unicité d'univers est une variante d'événement, plus tard).
6. **Perte (D16)** : incapacité + réparation, jamais détruit ; l'as survit avec son vaisseau.
7. **Correctifs au passage** (bugs prouvés du système amiral) : les passifs de combat de coque ne
   s'appliquent JAMAIS en combat (condition `status==='active'` vs lecture en `in_mission` —
   `flagship.service.ts:127-132` vs `attack.handler.ts:144-161`) ; `defaultWeaponProfile` seedé
   mais jamais consommé. Les corriger dans le cadre du câblage des vaisseaux spéciaux.

---

## 6. Lot 4 — Le monde vivant

> Terrain : carte « Fil de l'univers et faits d'armes ». `game_events` est per-user et purgé à
> 30 j — inutilisable tel quel. Le prior art architectural direct est le fil d'alliance
> (`alliance_logs` : payloads Zod discriminés, curseur temporel, unread par lastSeen).

1. **Table `universe_events`** : scope global, acteur nullable, type + payload Zod discriminé,
   rétention longue (les faits d'armes exemptés de toute purge). Diffusion : polling 30-60 s
   (D19).
2. **Émissions** : première découverte d'un biome à l'échelle univers (ajouter `created_at` à
   `discovered_biomes` — carte neuve, aucun backfill) ; recherches notables SEULEMENT (seuil de
   notabilité : capstones/forks, premier joueur à un palier — pas chaque niveau, trop bavard) ;
   bascules du front (système contesté/libéré/repris) émises par les handlers du Lot 2 ;
   attribution d'un vaisseau spécial.
3. **Faits d'armes (D20)** : table de définitions typées + attributions ; « états de service »
   sur le profil joueur ; AUCUN classement de puissance — débrancher pages `/ranking` +
   `/alliance-ranking` + cron `ranking-update` (consommateurs uniques vérifiés : les deux pages).
4. **Score collectif** : métrique canonique = l'état du front (systèmes libérés / fenêtre en
   cours / total), affiché sur l'écran du front, remplace la page classement.
5. **Déblocages lisibles** : chaque recherche/bâtiment affiche ce qu'il OUVRE (les prérequis sont
   en config — les inverser en « débloque X ») + le texte de fiction « mémoire retrouvée » par
   nœud (écrit par Julien au fil de l'eau, colonne de config, pas un système).
6. **Écran du front** : la carte galaxie montre les systèmes des Premiers (état, capitaine,
   fenêtre) — aujourd'hui les repaires pirates sont des instances fantômes invisibles ; les
   systèmes matérialisés du Lot 2 deviennent des objets de carte de premier rang.

---

## 7. Lot 5 — Shell et onboarding

> Terrain : cartes « Shell front » et « Onboarding ». ⚠️ Leçon Passerelle (2 commits, 2 reverts
> le même cycle) : ce lot vit sur une BRANCHE déployée sur staging via `deploy-staging.sh <ref>`,
> retours des amis, PUIS merge — jamais entremêlé avec du gameplay.

1. **`/` devient le hub Missions** (la page Missions est déjà empire-wide, zéro dépendance à
   `activePlanetId`) ; l'Overview planète déménage sur `/planete` ; re-pointer les redirections
   `PLANET_PAGES` + l'interception `colonizing` de `Layout.tsx:21-24,49-60` ; PWA `start_url` ok.
2. **Navigation** : Sidebar (sections re-hiérarchisées, missions en tête), BottomTabBar
   (`TAB_GROUPS`, `SHEET_ITEMS`, cas spécial `pathname === '/'`) — et ALIGNER le mobile sur
   `getVisibleSidebarPaths` (les sheets ignorent aujourd'hui tout gating — bug Politiques déjà
   payé).
3. **Onboarding neuf** (remplace le tutoriel 23 quêtes — 86 % d'abandon, 10 comptes scellés par
   `is_complete`, 23 % bloqués dès la quête 1) : intro linéaire ~5 étapes sur le moteur de quêtes
   EXISTANT (data-driven, `mission_complete` branché sur le PvE, récompenses en unités ok, pont
   tutoriel→PvE déjà codé : `generateDiscoveredMission`) avec 3 correctifs structurels : ids
   stables + ordre séparé (le renumbering a corrompu des historiques), pas de scellage
   `is_complete` (flux sans fin), auto-complétion des premières étapes (2 comptes figés faute
   d'avoir cliqué « Suivant »). Cible des 5 minutes : première mission de minage lancée + le
   front VISIBLE sur la carte (on voit vers où ça va dès la première session).
4. **Dévoilement progressif** re-piloté par jalons de gameplay (premier chantier, première
   flotte) au lieu des chapitres de tutoriel, unifié desktop/mobile. La Recherche est VISIBLE et
   verrouillée narrativement (teasing « mémoire ») plutôt que masquée.

---

## 8. Le lancement

Le reset (Lot 1 étape 4) n'est joué qu'une fois TOUT le seuil franchi :

- [ ] Lot 0 complet (chiffres honnêtes, seed durci, snapshot) — déployé et vérifié en prod
      AVANT le reset
- [ ] Carte neuve : world seed, bord, dimensions, spawn, hydrogène early, vitesse
- [ ] Systèmes des Premiers visibles et attaquables, combat refait, cycle fonctionnel
- [ ] Au moins 3-5 vaisseaux spéciaux attribuables en mission (avec leurs as nommés)
- [ ] Fil de l'univers + front sur la carte + faits d'armes v1
- [ ] Onboarding 5 minutes + shell hub validé sur staging par de vrais retours
- [ ] Textes : noms des capitaines et des systèmes, 1 ligne de dialogue par capitaine, textes
      des premiers nœuds « mémoire » (Julien)
- [ ] Note de lancement aux amis (le pitch en trois phrases de la section 3.1 du plan de rework)

C'est l'événement « les Premiers sont venus voir » : une seule mise en ligne, pas un
égouttement de features.

---

## 9. Ordre et dépendances

```
Lot 0 (fondations) ──┬── Lot 1 (carte)    ──┐
                     ├── Lot 2 (Premiers) ──┤
                     ├── Lot 3 (récompenses)┼── §8 LANCEMENT (reset + deploy unique)
                     ├── Lot 4 (monde vivant)┤
                     └── Lot 5 (shell, staging en parallèle) ──┘
```

- Lot 0 d'abord, intégralement — tout le reste s'appuie sur le crédit unique, le seed durci et
  le snapshot. Étapes 1+9 (seed) avant tout déploiement intermédiaire.
- Lots 1 et 2 partagent la carte : `isNpc` (2.1) et `premier_systems` (2.2) se posent dans la
  même passe de migrations que le world seed (1.1).
- Lot 3 dépend du Lot 2 pour l'attribution en mission, mais la table et le câblage des leviers
  (3.1-3.4) peuvent se coder dès la fin du Lot 0.
- Lot 4 consomme les événements des Lots 2-3 ; le squelette (table + fil + écran) peut partir
  avant.
- Lot 5 vit sur sa branche staging pendant tout le reste.
- Ordre de codage recommandé : **0 → (1+2 entrelacés) → 3 → 4 → 5 → lancement**.

## 10. Ce qui reste à trancher avec Julien (au bon moment, pas avant)

- Veto éventuel sur les défauts D1-D20 (section 1).
- Réglage du cycle : durée de fenêtre, forme du bonus, courbe de retour (clés config, en jouant).
- Le critère d'arrêt d'équilibrage proposé en 4.9 (à valider tel quel ou amender).
- Combien de vaisseaux spéciaux au lancement, lesquels, leurs noms d'as (créatif — pitchs à
  présenter avant fabrication).
- Compensation éventuelle des 10 comptes scellés par l'ancien tutoriel (sans objet si reset
  total : trancher au moment du reset).
- Textes de fiction (capitaines, systèmes, nœuds mémoire) — écriture au fil de l'eau avec
  Julien.
