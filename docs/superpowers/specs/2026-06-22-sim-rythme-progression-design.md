# Simulateur de rythme de progression — design

- Date : 2026-06-22
- Statut : design validé (brainstorm), à planifier
- Lié : [[project_friction_bots]] (les bots-personas UX existants, distincts) ; `packages/game-engine`

## Intention

Un **simulateur de rythme de progression** pour Exilium (jeu 4X). À la différence des
bots-personas de friction UX (`apps/web/e2e/bots/`, qui jugent « est-ce clair ? »), ce
système répond à : **où se trouvent les murs, les temps morts, et combien de temps faut-il
pour atteindre chaque jalon, sur tout l'arc d'une partie ?** L'objectif produit est la
**courbe d'engagement / la rétention** : un rythme fluide, sans blocage ni longueur.

C'est un **outil d'analyse d'équilibrage pour le dev**, pas du feedback joueur.

## But mesuré (priorité unique)

**Rythme de progression.** Pas l'équilibrage des combats (→ futurs « agents combat » dédiés,
qui s'appuieront sur `combat.ts` + le CombatSimulator existant), ni les exploits.

## Profils de jeu modélisés

Trois, branchés sur le **même** moteur via une interface `Policy` :

1. **Optimal (borne basse)** — vise le jalon le plus tôt → révèle les murs *incompressibles*.
2. **Archétypes** — `eco`, `expansion` (heuristiques codées) → révèle si chaque *style*
   progresse correctement ou stagne.
3. **Naïf / réaliste** — choix sous-optimaux d'un débutant (heuristiques « erronées » ou LLM)
   → révèle les blocages par méconnaissance. **Couche ultérieure** (plus coûteuse/floue).

## Approche : simulateur léger qui réutilise le game-engine (Approche A)

Le live est exclu (une partie complète = jours/semaines réels). On **simule** en avançant le
temps simulé. Fidélité par **réutilisation** des formules pures (`@exilium/game-engine`) + de
la **vraie config de seed** ; on ne ré-implémente que la fine boucle d'**orchestration**
(accumulation des ressources, fin de file de construction). Conçu pour pouvoir migrer plus
tard vers un « noyau de jeu » partagé serveur+sim (Approche B) si la fidélité l'exige.

## Périmètre

**MVP — colonne vertébrale éco + expansion :** production → bâtiments → recherche → colonies →
**construction** de vaisseaux (puits de temps/ressources + jalon « 1er vaisseau »), sur tout
l'arc. Profils : **optimal + 1 archétype** d'abord.

**Hors MVP (couches ultérieures) :** résolution de combat, revenus de missions PvE, profil
naïf-LLM, interactions multijoueur (marché, alliances, attaques), le refactor « noyau
partagé » (Approche B).

## Architecture

Nouveau package workspace **`packages/game-sim`** (Node headless ; dépend de
`@exilium/game-engine` ; lit la config de seed). Lancé via `scripts/run-gamesim.sh` → écrit un
rapport dans `reports/_sim/`. Unités à responsabilité unique, testables isolément :

| Unité | Rôle | Dépend de |
|---|---|---|
| **Config** | Charge les définitions réelles (bâtiments/recherches/vaisseaux : coûts, durées, effets) depuis **la source de seed** → mêmes chiffres que la prod | seed config |
| **SimState** | État d'un empire simulé : planètes, ressources, niveaux, files, flotte, **temps simulé** | — |
| **SimEngine** | Boucle : saute au **prochain événement**, accumule via `production.ts`, applique les actions. Déterministe. **Agnostique de la stratégie.** | game-engine, Config, SimState |
| **Policy** `decide(state)→action` | Cerveau **branchable** : `OptimalPolicy`, `EcoPolicy`/`ExpansionPolicy`, (plus tard `NaivePolicy`) | SimState |
| **Recorder** | Journalise la timeline + **horodate les jalons** + marque les attentes | — |
| **Reporter** | Agrège les runs → `rapport-rythme-<date>.md` | Recorder |

Point clé : **SimEngine ne connaît pas les stratégies** ; les profils ne sont que des `Policy`
différentes. La fidélité vient de la réutilisation des formules + de la vraie config.

## Flux de données

```
Config → SimState initial (empire neuf, t=0)
  └─loop:
      action = Policy.decide(state)        // construire / rechercher / coloniser / bâtir vaisseau / attendre
      SimEngine.apply(action)              // débite le coût, met en file avec une durée (formule)
      SimEngine.advanceToNextEvent()       // saute à la prochaine fin de file / seuil de ressource
      production.ts accumule les ressources sur le temps écoulé
      Recorder.log(action, t, jalons atteints, attente?)
  └─fin : jeu de jalons atteint OU horizon de temps
Reporter.aggregate(runs) → rapport
```

## Métriques & rapport (`reports/_sim/rapport-rythme-<date>.md`)

- **Temps-jusqu'au-jalon** (tableau par profil) : 1er bâtiment, 1re recherche, 1er vaisseau,
  1re colonie, niveau d'empire N, palier de tech N… L'optimal = borne basse.
- **Murs** 🧱 : tranches d'**attente > seuil** sans action utile abordable (où / quand / durée).
- **Temps morts** 😴 : tranches où il n'y a **rien à décider** (choix forcé ou pure attente).
- **Courbe d'engagement** : décisions par tranche de temps simulé (creux = plateaux d'ennui).
- **Comparaison entre profils** : un style est-il puni par le rythme ?

Le **jeu de jalons** et le **seuil de « mur »** sont déclarés dans une petite config réglable.

## Fidélité (que le sim ne mente pas)

1. **Réutiliser, jamais ré-implémenter** les formules (production, coûts, durées, effets) :
   identiques à la prod.
2. **Une seule source de config** : charger les mêmes définitions que le serveur → un
   changement d'équilibrage dans le seed coule automatiquement dans le sim.
3. **Valider l'orchestration** : calquer la logique du worker (traitement des files) + tests ;
   quelques **spot-checks live** sur les jalons précoces contre l'API staging.

## Tests

- **Unitaires SimEngine** : scénarios vérifiés à la main (façon `combat.scenarios.test.ts`).
- **Golden file** du rapport pour une stratégie fixe → une régression d'équilibrage devient un
  **diff visible**.
- **Déterminisme** : même config + même politique → rapport identique (RNG seedé si ajouté).
- **Policy** : l'optimal ne choisit jamais d'action inabordable ; les archétypes suivent leur
  priorité.

## Points ouverts (à trancher au plan)

- **Accélération du temps** pour la validation live : sans bouton dev, le spot-check live se
  limite aux tout premiers jalons. Confiance principale = formules réutilisées + tests
  unitaires ; le live est un bonus.
- **Jeu de jalons exact** et **archétype MVP** (eco probable) à figer.
- **Chargement de la config de seed** depuis le sim : réutiliser la source de seed
  (`packages/db`) sans dépendre d'une base live.
