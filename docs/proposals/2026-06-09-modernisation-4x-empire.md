# Modernisation d'Exilium — d'un ogame-like à un 4X « XXIᵉ siècle »

> **Statut** : brainstorm ouvert (proposal). Rien d'implémenté.
> **Date** : 2026-06-09
> **Nature** : document vivant — vision + chantier en cours. À faire évoluer au fil des sessions.
> **Focus actif** : **Chantier #1 — Empire** (voir section dédiée).

## Comment utiliser ce doc
Point d'entrée pour reprendre la réflexion sur n'importe quelle machine (`git pull`).
La **vision** et les **principes** sont stables ; la section **Empire** est le chantier qu'on développe en premier ; le **backlog** garde le contexte des autres piliers pour plus tard. Quand un chantier passe en implémentation, on en fait une spec dans `docs/plans/`.

---

## 1. Thèse centrale

**Aujourd'hui, Exilium fait jouer un comptable, pas un empereur.**

On remplit N files de construction identiques sur N planètes, on optimise un tableur. C'est ça, le vrai « côté daté » d'OGame — **pas le thème spatial, mais l'altitude des décisions**. Un empereur ne pose pas les briques : il donne une direction, délègue, négocie, fait la guerre pour des enjeux.

➡️ **La modernisation centrale = remonter l'altitude des décisions.** Déléguer le micro (corvée), faire émerger le macro (spécialisation, politique, carte, alliances). Et ça sert pile le fantasme cible.

**Fantasme central** (validé) : *être un empereur galactique qui gère sa flotte, son empire et ses alliances.*
**Ambition d'échelle** : des **centaines de joueurs** actifs.

---

## 2. Diagnostic : ce qui « date » dans un ogame-like

Trois frictions de game design de 2002 :

1. **Le temps comme punition** — timers en heures/jours, et se déconnecter = se faire raider et perdre. Le jeu ne respecte pas le temps du joueur.
2. **Le PvP somme-nulle** — attaquer = détruire/voler. Le fort écrase le faible, le nouveau se fait farmer, personne ne coopère vraiment.
3. **Un univers mort** — statique, pas de saisons, pas d'histoire émergente, aucune raison de revenir *aujourd'hui* plutôt que demain.

### Cadre assumé : 4X, **pas** roguelite
- **Roguelite** = runs randomisées, joueur vs contenu procédural, on recommence.
- **4X** = empire **persistant**, stratégie long terme, joueur vs autres joueurs + la carte.

Les **anomalies** et **expéditions** (retirées le 2026-06-09, cf. commits `d0ad2533`→`905ba267`) étaient du solo-instancié greffé sur un jeu de territoire et de rivalité → elles tiraient vers le roguelite et sortaient du cœur 4X. Leçon : **les nouveaux systèmes doivent approfondir la boucle 4X, pas être des modes annexes.**

---

## 3. Principes directeurs

À garder en tête pour chaque décision de design :

- **Rester 4X.** Approfondir eXplore / eXpand / eXploit / eXterminate. Pas de mode « run » solo détaché.
- **Émergent > authored.** Dev solo : privilégier les systèmes qui *génèrent du contenu tout seuls* (social, territorial, politique) plutôt que du contenu écrit à la main qu'il faut nourrir en permanence (le piège anomalies/expéditions).
- **Remonter l'altitude.** Chaque feature devrait soit *retirer de la corvée*, soit *ajouter une décision d'empereur*.
- **Respecter le temps du joueur.** Sessions mobiles courtes et utiles, catch-up offline, pas de punition pour absence. (PWA + push déjà en place.)
- **Lisible sur mobile.** L'UX doit tenir sur un téléphone — pas un tableur.
- **Anti-snowball by design.** À des centaines de joueurs, le vrai tueur c'est : vétérans imbattables qui farment les nouveaux → churn de masse. Tout système doit être pensé pour *ne pas* aggraver ça.

---

## 4. La carte complète (vue d'ensemble)

Quatre directions. On creuse **Empire** d'abord (fondation), les autres viennent par-dessus.

| Pilier | Idée-force | Sert |
|---|---|---|
| **🏛️ Empire** *(focus)* | De « gérer des planètes » à « régner » : spécialisation, édits politiques, délégation | Fantasme empereur + retire la corvée |
| **🚀 Flotte** | De la décision, pas du spam de chiffres : méta de composition (contres), flottes persistantes avec identité | Fantasme amiral + profondeur de combat |
| **🤝 Alliances** | À grande échelle, c'est LE jeu : territoire sur la carte, diplomatie inter-alliances, rôles internes | Fantasme alliances + contenu émergent |
| **🌌 Saisons / Victoire** | Un univers avec un début et une fin : galaxies saisonnières + conditions de victoire + reset propre | Anti-snowball, protection des nouveaux, rétention |

> **Ordre recommandé** : Empire → (cadre saisonnier en parallèle/juste après) → Alliances/territoire → profondeur de combat. Ajouter du PvP avant l'altitude + le cadre, ce serait décorer une maison sans fondations.

---

## 5. 🏛️ CHANTIER #1 — EMPIRE

> Objectif : faire ressentir qu'on **règne** sur un empire qui a une *forme* et une *identité*, au lieu de cliquer 9 files identiques.

Trois sous-systèmes complémentaires.

### 5.1 Spécialisation des mondes
**Problème** : chaque colonie est un clone interchangeable. Aucune décision, juste de la répétition.

**Direction** : on ne peut pas tout maxer partout → chaque planète prend un **rôle** et l'empire a une *forme* qu'on dessine.

Pistes à explorer :
- **Vocation de planète** (mine / forge-chantier / forteresse / hub recherche / capitale / ravitaillement…) qui octroie un bonus fort mais impose des contraintes ou un coût d'opportunité (on ne peut pas tout faire sur la même planète).
- **S'appuyer sur l'existant** : les **biomes** et **types de planètes** donnent déjà des modificateurs de production → la spécialisation est un *choix par-dessus* la nature de la planète (jouer avec ou contre son biome).
- **Synergies / adjacence** : un monde spécialisé profite à ses voisins (forge près d'une mine) → on réfléchit à la *forme* de l'empire, pas planète par planète.
- **Arbitrage forcé** : caps par rôle, ou extension de la **gouvernance/surextension** existante pour taxer l'étalement et récompenser la spécialisation (levier *tall vs wide*).

Questions ouvertes :
- Rôle **verrouillé** (engagement fort, identité claire) vs **incitations douces** (souplesse) ? Coût de reconversion ?
- Combien de rôles pour rester lisible ? Comment l'afficher proprement sur mobile ?
- Comment éviter le « rôle optimal unique » → il faut que chaque rôle brille dans un contexte différent.

### 5.2 Édits & politiques d'empire
**Problème** : aucun levier à l'échelle de l'empire. Le joueur n'a pas de « manette d'empereur ».

**Direction** : des décisions globales avec de **vrais arbitrages** (pas de choix gratuit).

Pistes à explorer :
- **Axes de politique** (curseurs/postures) : économie de guerre ↔ croissance, fiscalité ↔ contentement/rendement, centralisation ↔ autonomie, focus recherche… Choisir une posture = modificateurs globaux + un coût.
- **Édits temporaires** : activer « Mobilisation » X jours (+production militaire, −recherche) → crée un *rythme* et des décisions liées au contexte (guerre imminente → on mobilise).
- **Ressource de gating** (« Influence » / « Autorité ») : limite combien de politiques actives → on **priorise**, on ne prend pas tout. C'est le cœur de l'espace de décision impérial. À gagner via taille d'empire / contentement / alliance ?

Questions ouvertes :
- Quelle est la ressource qui gate les politiques ? Nouvelle ressource ou réutilise l'Exilium ?
- Combien de politiques simultanées ? Comment garantir qu'il n'y a pas une « meilleure build » évidente (→ arbitrages situationnels) ?
- UX : un écran « salle du trône » / gouvernance, clair et mobile-first.

### 5.3 Délégation & automatisation
**Problème** : la corvée (micro répétitif) empêche de jouer à l'altitude d'empereur — et empêche de gérer un *grand* empire (frein à l'ambition d'échelle).

**Direction** : retirer le pénible, garder la décision.

Pistes à explorer :
- **Gouverneurs** : assigner à une planète une *consigne* (focus mine / focus croissance / fortifier / ordre de construction autonome) et elle se gère seule vers cet objectif. Commencer **systémique et simple** (directives), pas des personnages écrits — les traits/RPG viendraient plus tard et avec prudence (éviter le piège authored-content).
- **Templates de construction** : files répétables, « monter au niveau X », « construire ceci sur chaque monde-mine ».
- **Dashboard d'empire** : voir tout l'empire d'un coup d'œil, agir sur les *exceptions*, pas sur chaque planète.
- **Bons défauts** : une nouvelle colonie ne doit pas demander 20 clics manuels.

Questions ouvertes :
- Jusqu'où automatiser avant que « ça se joue tout seul » ? → automatiser l'évident, garder manuelles les décisions qui comptent.
- Gouverneurs = simples directives d'abord ; personnages/traits = backlog (risque roguelite/authored à surveiller).

### 5.4 Pourquoi ça sert le fantasme **et** l'échelle
- **Spécialisation** → ton empire a une *forme* et une identité (« l'empire-forge »).
- **Édits** → tu sens les leviers du pouvoir.
- **Délégation** → tu cesses d'être comptable ; tu peux gérer un empire *plus grand* (sert l'ambition « centaines de joueurs ») sans tendinite.
- **Synergie anti-snowball** : spécialisation + caps de surextension = les vétérans qui s'étalent paient une taxe ; le jeu *tall* reste compétitif face au *wide*.

### 5.5 Ce qui existe déjà dans le code (à exploiter)
- **Gouvernance / surextension** (module `colonization`) : malus quand on a trop de colonies → fondation directe du *tall vs wide* et de l'arbitrage de spécialisation.
- **Biomes + types de planètes** : modificateurs de production déjà en place → support naturel de la spécialisation.
- **Recherche, bâtiments, chantier** : la base économique à réorienter vers des *rôles*.
- **Catégories de combat** (light/medium/heavy) : utile plus tard pour la méta de flotte.
- **Alliances + chat + SSE temps réel + logs**, **PWA + push**, **marché**, **espionnage/scan** : fondations pour les piliers suivants.

---

## 6. Backlog des autres piliers (contexte pour plus tard)

### 🚀 Flotte
- **Méta de composition** : contres (pierre-feuille-ciseaux) sur light/medium/heavy → composer = décision, pas « plus gros nombre ».
- **Flottes persistantes avec identité** (vs jetables). Le **vaisseau amiral** (déjà la pièce d'identité, coques conservées) en devient le cœur.
- **eXterminate moderne** : la guerre porte sur le *territoire/les systèmes* conquis, pas sur le farm de flotte. Penser PvP moins destructif / asymétrique (raid pour ressources + vraie couche défensive à concevoir + protections nouveaux).

### 🤝 Alliances
- **Territoire d'alliance sur la carte** : contrôler des régions, tenir des frontières, se disputer des zones → la guerre a un *but*, le conflit s'auto-génère.
- **Projets d'alliance partagés** (mégastructures, portes de saut, recherche commune, capitale d'alliance).
- **Diplomatie inter-alliances** (PNA, guerres, pactes) + **rôles internes** (général, éco, diplomate, éclaireur) → la politique galactique comme endgame émergent.

### 🌌 Saisons / Victoire
- **Galaxies saisonnières avec condition de victoire** (domination / fédération / économie / merveille) → arc partagé par le serveur, raison de se liguer/s'affronter.
- **Reset propre** en fin de saison → remet tout le monde à égalité : règle le snowball, protège les nouveaux, booste la rétention.
- **Événements galactiques** systémiques (pas des « modes ») qui font *bouger la carte* et auxquels le serveur réagit politiquement.

---

## 7. Questions ouvertes & prochaines étapes

**À trancher pour avancer sur l'Empire :**
1. Spécialisation : rôles verrouillés ou incitations douces ? Quel coût de reconversion ?
2. Édits : quelle ressource de gating (« Influence » ?), combien de politiques simultanées, comment éviter la build optimale unique ?
3. Délégation : périmètre des gouverneurs v1 (directives simples) ; jusqu'où pousser l'automatisation ?
4. Par lequel des 3 sous-systèmes prototyper en premier ? *(Intuition : spécialisation + délégation d'abord — elles transforment la sensation moment-à-moment ; les édits ajoutent la couche stratégique par-dessus.)*

**Process** : une fois une direction tranchée, en faire une **spec technique** dans `docs/plans/` avant de coder.

---

*Document de travail Exilium — vision « modernisation 4X ». Co-construit en session, à faire vivre.*
