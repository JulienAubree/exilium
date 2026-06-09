# Refonte de l'architecture d'information — audit & proposition

> **Statut** : brainstorm ouvert (proposal). Rien d'implémenté.
> **Date** : 2026-06-09
> **Origine** : ressenti user « c'est encore trop fouilli » + audit complet de la navigation.
> **Lié à** : `2026-06-09-modernisation-4x-empire.md` (principes : altitude, mobile-first, empereur).

---

## 1. État des lieux (audit)

### 1.1 L'inventaire brut

**Deux systèmes de navigation concurrents sur desktop :**
- **Sidebar** (thématique, 13 entrées / 4 sections) : Empire (Empire, Recherche, Vaisseau amiral) · Espace (Galaxie, Flotte, Missions, Marché) · Communauté (Messages, Alliance, Classement, Classement Alliances) · Développement (Nouveautés, Feedback)
- **Bloc planète** (contextuel, 7 onglets) : Vue d'ensemble, Ressources, Énergie, Infrastructures, Chantier spatial, Centre de commandement, Défense

**Mobile** : 4 groupes (Empire, Planète, Espace, Social) → bottom sheets, **20 destinations**.

**Routes orphelines** (accessibles uniquement par icônes topbar ou liens profonds) : `/reports` (rapports), `/history` (historique), `/profile`, `/guide/combat`, `/fleet/send`, `/fleet/stationed`, `/fleet/movements`, `/settings/notifications`.

**Total : ~27 destinations.** C'est le « fouilli » : pas une question de design visuel (les pages sont propres), mais de **structure**.

### 1.2 Les cinq problèmes structurels

**P1 — Les pages planète = des familles de bâtiments, pas des intentions.**
Ressources / Énergie / Infrastructures / Chantier / Centre de commandement / Défense : 6 pages pour répondre à 2 questions du joueur — *« développer cette planète »* et *« produire des unités »*. Le découpage recopie les catégories de bâtiments (héritage ogame) : produire des unités est éclaté sur 3 pages selon la catégorie (utilitaires au Chantier, combat au Centre de commandement, défenses à Défense). C'est l'anti-pattern « comptable » pointé par la proposal 4X : 7 onglets × N planètes = la corvée.

**P2 — Deux mondes parallèles : planète vs reste.**
Le bloc planète est un silo vertical (tout sur LA planète active), la sidebar un classement thématique. Le joueur doit jongler entre deux logiques : « je suis *sur* une planète » vs « je navigue le jeu ». Et la frontière fuit : la Vue d'ensemble (planète) affiche des alertes d'empire, la page Empire affiche des données par planète, la Flotte est partout.

**P3 — Quatre tableaux de bord qui se recouvrent.**
Vue d'ensemble (1 planète), Empire (toutes), Dashboard Flotte, et bientôt le profil-empereur. Quatre « homes » partiels = aucun vrai home. Au moment où la délégation (chantier Empire §5.3) arrivera, la vue par-planète perdra encore de la valeur au profit de la vue empire.

**P4 — Le parcours Flotte est fragmenté.**
`/fleet` (dashboard) → `/fleet/send` → `/fleet/movements` → `/fleet/stationed` + `/reports` (orphelin topbar) + `/flagship` (section Empire !). Un seul workflow — *armer, envoyer, suivre, lire le résultat* — réparti sur 6 destinations dans 3 zones de nav différentes.

**P5 — La découvrabilité repose sur la topbar.**
Rapports et Historique, deux pages de feedback de boucle de jeu (qu'ai-je gagné/subi ?), n'existent que comme icônes. Le Classement et Classement Alliances sont 2 pages pour 1 concept. « Développement » (Nouveautés/Feedback) est du méta mélangé à la nav de jeu.

### 1.3 Ce qui marche déjà (à garder)

- La **divulgation progressive** (`sidebar-visibility.ts`) : la nav grandit avec le tutoriel — très bon, à conserver tel quel.
- Le **bloc planète unifié** (sélecteur + ressources + onglets dans un seul cadre) : la bonne idée, à pousser plus loin.
- Les pages **hero + KPI bar + cartes** : langage visuel cohérent.
- Le **bottom tab bar 4 groupes** mobile : le bon nombre ; c'est le *contenu* des sheets qui déborde.

---

## 2. Proposition : 4 hubs + 1 profil

> Principe directeur : **naviguer par intention, pas par bâtiment**. Chaque hub répond à une question du joueur. La planète devient un *détail* de l'Empire, pas un monde parallèle.

### 🏛️ EMPIRE — « Que se passe-t-il chez moi ? » *(home)*
- **Fusion Vue d'ensemble + Empire** : un seul home, vue tous-mondes (la vue 1-planète actuelle devient le drill-down).
- Alertes (surextension, attaques entrantes, files vides), gouvernance, recherche en cours, file globale.
- **Drill-down planète : 2 pages au lieu de 7** :
  - **Développement** = Ressources + Énergie + Infrastructures fusionnées (sections/filtres dans la page, une seule file de construction visible).
  - **Production** = Chantier + Centre de commandement + Défense fusionnés (onglets internes Utilitaires / Combat / Défenses).
  - La Vue d'ensemble planète devient l'en-tête du drill-down (hero + KPI), pas une page.
- **Recherche** reste ici (c'est de l'empire, pas de la planète).

### 🌌 GALAXIE — « Qu'y a-t-il dehors ? » *(l'eXplore/eXpand)*
- Carte (inchangée), **Missions** (la découverte PvE, c'est « dehors »), colonisations en cours, rapports d'exploration.
- Le **Marché** y trouve sa place (le commerce galactique est une activité « dehors ») — ou reste un hub propre si le flux le justifie.

### 🚀 FLOTTE — « Mes forces » *(l'eXterminate)*
- Un hub unique avec onglets internes : Dashboard · Envoyer · Mouvements · Stationnées · **Vaisseau amiral** (il quitte la section "Empire" — c'est une force) · **Rapports de combat** (ils quittent la topbar).
- Le workflow complet — armer, envoyer, suivre, débriefer — au même endroit.

### 🤝 GALACTOPOLITIQUE — « Les autres » *(le futur pilier Alliances)*
- Alliance (hub existant), **Classements fusionnés** (1 page, onglets Joueurs/Alliances), profils publics, et demain : diplomatie, territoire.
- Messages reste en topbar (transversal) mais le chat d'alliance vit ici.

### 👤 EMPEREUR — « Moi » *(profil, déjà amorcé aujourd'hui)*
- Niveau + XP (fait), futurs talents/doctrines, historique personnel (`/history` quitte la topbar), réglages, et le méta : Nouveautés + Feedback (la section « Développement » de la sidebar disparaît — c'est du menu profil).

### Récapitulatif des gains

| | Avant | Après |
|---|---|---|
| Destinations nav principale | ~27 | **4 hubs + profil** |
| Pages par planète | 7 | **2** (+ en-tête) |
| Pages production d'unités | 3 | **1** (onglets) |
| Tableaux de bord « home » | 4 | **1** |
| Pages classement | 2 | **1** |
| Routes orphelines | 8 | ~2 (settings, guide) |

Mobile : les 4 tabs du bottom bar = exactement les 4 hubs (+ profil dans la topbar). Les sheets passent de 20 items à ~4-6 par hub.

---

## 3. Ordre de mise en œuvre proposé

Chaque lot est livrable indépendamment (pas de big-bang) :

1. **Lot 0 — quick wins** (peu de risque, gain immédiat) : fusion Classements (onglets), Rapports → hub Flotte, Historique + Nouveautés + Feedback → menu profil, suppression section « Développement ».
2. **Lot 1 — hub Flotte** : regrouper dashboard/envoyer/mouvements/stationnées/flagship/rapports sous une nav interne unique. C'est le parcours le plus fragmenté → gain max.
3. **Lot 2 — fusion Production** : Chantier + Centre de commandement + Défense → une page à onglets. (Attention : décision produit — les *bâtiments* chantier/centre/hangars restent des prérequis, seule la *page* fusionne.)
4. **Lot 3 — fusion Développement** : Ressources + Énergie + Infrastructures → une page. La plus grosse (3×~500 lignes) mais la plus rentable en « altitude ».
5. **Lot 4 — home Empire unifié** : fusion Vue d'ensemble/Empire + drill-down planète. À faire en dernier : c'est lui qui bénéficie des lots 2-3 (la planète n'a plus que 2 sous-pages à présenter).
6. **Lot 5 — Galactopolitique** : renommage/regroupement léger, en préparation du pilier Alliances.

**Prérequis transverses** : conserver la divulgation progressive (adapter `sidebar-visibility.ts` aux hubs), rediriger les anciennes URLs (`Navigate`), PWA autoUpdate fait le reste.

---

## 4. Questions ouvertes

1. **Marché** : dans Galaxie, ou hub autonome ? (dépend de l'usage réel — à vérifier dans les stats de fréquentation si on en a).
2. **Missions** : Galaxie (cohérence « dehors ») ou Flotte (c'est la flotte qui les exécute) ? Intuition : Galaxie pour la découverte, l'envoi se fait déjà via Flotte.
3. La fusion Développement (lot 3) doit-elle attendre les **gouverneurs/templates** du chantier Empire (§5.3) pour fusionner directement vers la bonne cible (consignes plutôt que listes de bâtiments) ?
4. Nommage : « Galactopolitique » vs « Diplomatie » vs garder « Alliance » ?

---

*Document de travail — audit du 2026-06-09. À discuter avant toute spec dans `docs/plans/`.*
