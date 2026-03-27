# Exilium — Redesign Mobile-First

## Contexte

Exilium (clone inspiré par OGame) est un jeu de strategie spatiale sur navigateur avec un frontend React 19 + Vite + Tailwind. Le site actuel a un responsive basique (sidebar overlay, grilles adaptatives) mais n'est pas mobile-first. L'objectif est de repartir sur une architecture mobile-first (Approche "App Shell") pour offrir une vraie jouabilite mobile et tablette, tout en rafraichissant le style visuel.

## Approche retenue

**App Shell mobile-first** : reecrire le layout de zero en partant du mobile. Les breakpoints partent du mobile et s'enrichissent vers tablette puis desktop. Chaque composant est d'abord pense pour un ecran 375px, puis adapte.

**Breakpoints (Tailwind) :**
- Mobile : < 768px (defaut, pas de prefix)
- Tablette : 768px - 1023px (`md:`)
- Desktop : >= 1024px (`lg:`)

Note : le code existant utilise `useMediaQuery('(max-width: 767px)')` pour le mobile et `(min-width: 768px) and (max-width: 1024px)` pour la tablette. Ce dernier sera corrige en `max-width: 1023px` pour eviter le chevauchement a 1024px.

---

## 1. App Shell (Layout global)

### Mobile (< 768px)

```
+----------------------------+
|  TopBar (h-12)             |  <- Nom planete + selecteur + messages
+----------------------------+
|  ResourceBar (h-10)        |  <- 3 ressources + energie, sticky
+----------------------------+
|                            |
|   Contenu page             |  <- Scroll vertical, pleine largeur
|   (flex-1, overflow-y)     |
|                            |
+----------------------------+
|  BottomTabBar (h-14)       |  <- 5 onglets
+----------------------------+
```

### Tablette (768px - 1023px)

Comme mobile mais avec plus d'espace pour le contenu (grilles 2 colonnes). Bottom tab bar toujours presente. Pas de sidebar.

### Desktop (>= 1024px)

```
+---------+-----------------------------+
|         |  TopBar + ResourceBar       |  <- Fusionnes en une seule barre
|  Side   +-----------------------------+
|  bar    |                             |
|  (w-56) |   Contenu page              |
|         |   (max-w-6xl centered)      |
|         |                             |
+---------+-----------------------------+
```

Pas de bottom tab bar sur desktop, la sidebar reprend son role de navigation. La sidebar desktop adopte les memes groupes que la bottom tab bar (Accueil, Base, Galaxie, Social) au lieu des anciens groupes (Economie, Militaire, Social) pour une coherence de navigation entre mobile et desktop.

---

## 2. Bottom Tab Bar & Navigation

### 5 onglets principaux

| Onglet  | Icone SVG         | Action              |
|---------|--------------------|---------------------|
| Accueil | OverviewIcon       | Navigation directe  |
| Base    | BuildingsIcon      | Ouvre bottom sheet   |
| Galaxie | GalaxyIcon         | Ouvre bottom sheet   |
| Social  | AllianceIcon       | Ouvre bottom sheet   |
| Plus    | Nouvelle icone (grille 2x2) | Ouvre bottom sheet |

Toutes les icones sont des SVG custom dans le style stroke existant de `src/lib/icons.tsx`.

### Bottom sheets (sous-menus)

**Base :** Ressources, Batiments, Recherche, Chantier spatial, Defense

**Galaxie :** Vue galaxie, Envoyer une flotte, Mouvements

**Social :** Messages (avec badge non-lus), Alliance, Classement

**Plus :** Parametres (futur), Deconnexion

### Comportement

- L'onglet actif est mis en surbrillance (couleur primaire + glow cyan)
- Si on est sur une page du groupe "Base", l'onglet "Base" reste actif
- Le bottom sheet slide depuis le bas avec fond semi-transparent, hauteur auto selon le contenu
- Tap sur le backdrop ou sur un item ferme le sheet
- Sur desktop (>= 1024px) : la bottom tab bar disparait, la sidebar reprend avec les memes groupes
- Badge messages (non-lus) visible sur l'onglet "Social" (mobile) et dans la sidebar (desktop)

### Integration avec le routeur

Les items du bottom sheet declenchent un `navigate()` React Router classique puis ferment le sheet. Il n'y a pas de changement dans les routes existantes — les memes paths (`/buildings`, `/research`, etc.) sont conserves.

L'onglet actif est determine par le path courant via un mapping statique :

```
const TAB_GROUPS = {
  accueil: ['/'],
  base: ['/resources', '/buildings', '/research', '/shipyard', '/defense'],
  galaxie: ['/galaxy', '/fleet', '/movements'],
  social: ['/messages', '/alliance', '/ranking', '/alliance-ranking'],
} as const;
```

La logique de matching verifie d'abord `accueil` (match exact sur `/`), puis les autres groupes. L'onglet "Plus" n'a pas de routes associees — il n'est jamais "actif" au sens navigation.

Le composant `BottomTabBar` utilise `useLocation()` pour determiner quel onglet mettre en surbrillance. Le state du bottom sheet (ouvert/ferme + quel groupe) est gere dans le store UI existant (`ui.store.ts`) en ajoutant un champ `activeSheet: 'base' | 'galaxie' | 'social' | 'plus' | null`.

### L'onglet "Plus"

Contient : Deconnexion (et Parametres dans une version future). Meme si le sheet est leger, il garde sa place dans la tab bar pour la symetrie visuelle et l'extensibilite. L'icone "compte/parametres" dans la TopBar mobile est supprimee — la deconnexion passe uniquement par le "Plus".

---

## 3. Barre de ressources (ResourceBar)

### Mobile

Nouveau composant `ResourceBar.tsx` (distinct de `TopBar.tsx`). Barre sticky sous la topbar, `h-10`, fond glassmorphism (semi-transparent + backdrop-blur).

4 compteurs en ligne : icone SVG + valeur abregee.

Le sticky fonctionne via `position: sticky; top: 48px` (hauteur de la TopBar h-12 = 48px), ce qui fait que la ResourceBar reste collee sous la TopBar pendant le scroll du contenu.

**Icones de ressources (modifications dans `ResourceIcons.tsx`) :**
- Minerai : remplacer l'icone actuelle (pentagone) par un cristal angulaire (gemme taillee, forme losange avec facettes)
- Silicium : conserver l'icone actuelle (hexagone cristallin) — c'est deja un bon fit
- Hydrogene : remplacer l'icone actuelle (molecule H2 deux cercles) par une goutte d'eau

Style stroke coherent avec les autres icones du fichier `icons.tsx`, couleurs conservees (`text-minerai`, `text-silicium`, `text-hydrogene`).

**Comportement :**
- Valeurs abregees intelligentes : `1 234` -> `1.2K`, `1 234 567` -> `1.2M`
- Couleurs par ressource (minerai bleu-gris, silicium cyan, hydrogene vert, energie jaune)
- L'energie affiche le ratio en % (facteur de production)
- Tap sur la barre -> panneau deroulant (slide-down, max-height 50vh) avec detail : production/h, capacite stockage, consommation energie. Tap en dehors ou swipe-up pour fermer.
- Animation de comptage en temps reel (utilise le hook `useResourceCounter` existant)

### Tablette

Meme barre, affiche les noms courts a cote des valeurs (`Min 1.2M`).

### Desktop

Fusionnee dans la topbar, avec les nouvelles icones SVG.

---

## 4. TopBar

### Mobile (h-12)

```
+--------------------------------------+
|  [Planete v]                 [mail 3]|
+--------------------------------------+
```

- Gauche : selecteur de planete (nom + dropdown)
- Droite : icone messages avec badge non-lus (la deconnexion/parametres est dans l'onglet "Plus" de la bottom tab bar)
- Fond glassmorphism (semi-transparent + backdrop-blur)

### Desktop

```
+----------------------------------------------------+
|  [Homeworld [1:45:3] v]   res1  res2  res3  nrj    [mail 3] [*] |
+----------------------------------------------------+
```

- Selecteur de planete avec coordonnees
- ResourceBar integree
- Meme style glassmorphism

### Selecteur de planete

- Tap/clic -> dropdown avec liste des planetes du joueur
- Chaque entree : nom + coordonnees + icone type (planete/lune)
- Sur mobile : dropdown en bottom sheet pleine largeur
- Sur desktop : dropdown classique sous le bouton

---

## 5. Page Ressources

### Mobile

Page dediee a la gestion de la production. Sections empilees verticalement :

1. **Production actuelle** : 3 barres de progression (minerai, silicium, hydrogene) montrant le remplissage du stockage. Chaque barre affiche : production/h + stockage actuel / capacite max.

2. **Reglage production** : sliders pour le pourcentage de production de chaque mine (0-100%). Chaque slider affiche l'impact sur la production/h et la consommation d'energie. Bouton "Sauvegarder" en bas pour appliquer les changements.

3. **Bilan energetique** : carte resume avec energie produite vs consommee, facteur de production resultant. Si deficit, affichage en rouge avec indication de la penalite.

### Tablette

Meme layout, les barres de production et sliders ont plus d'espace horizontal.

### Desktop

Layout 2 colonnes : production + stockage a gauche, reglages energie a droite.

---

## 6. Pages de listes (Batiments, Recherche, Chantier, Defense)

Ces 4 pages partagent le meme pattern mobile (liste compacte) et desktop (grille de cartes).

Le composant `PageHeader` existant est conserve sur toutes les pages. Sur mobile, il est simplifie (titre seul, sans description) pour economiser l'espace vertical.

Le composant `EntityDetailOverlay` existant est reutilise et adapte pour le "detail panel" mobile : au lieu d'un overlay plein ecran, il devient un bottom sheet (slide depuis le bas, max-height 85vh, scrollable).

### Mobile - Vue liste compacte

Chaque ligne :
- Rangee 1 : miniature (32x32) + nom + niveau/quantite (badge a droite)
- Rangee 2 : timer de construction en cours (barre de progression), ou couts pour le prochain niveau, ou prerequis manquant (verrouille)
- Bouton action a droite : upgrade ou desactive si prerequis/ressources manquants
- Tap sur la ligne -> detail panel (slide depuis le bas) : image grande, description, stats production courante vs niveau suivant, couts detailles, prerequis, bouton d'action

### Categories de batiments

La page Batiments est organisee par categories avec headers sticky :

- **Industrie** : Mine de minerai, Mine de silicium, Synthetiseur d'hydrogene, Centrale solaire
- **Stockage** : Hangar de minerai, Hangar de silicium, Hangar d'hydrogene
- **Defense et armement** : Usine de robots, Chantier spatial
- **Recherche** : Laboratoire de recherche

Chaque categorie est collapsible (tap sur le header pour replier/deplier). Toutes ouvertes par defaut.

### Chantier et Defense (quantites)

- Le niveau est remplace par la quantite possedee (x12)
- Le bouton action ouvre un input de quantite a construire
- File d'attente visible en haut de page si une construction est en cours

### Construction en cours

- Item en construction apparait en premier avec bandeau de progression
- Timer + barre de progression + bouton annuler
- File d'attente affichee sous l'item actif

### Tablette

Grille 2 colonnes de cartes compactes.

### Desktop

Grille 2-3 colonnes de cartes completes, groupees par categories avec headers de section.

---

## 7. Vue Galaxie

### Mobile - Liste verticale

Chaque position :
- Numero de position + indicateur planete (point colore si occupee, vide sinon)
- Nom de planete + nom du joueur
- Si debris : ligne supplementaire avec quantites + bouton recycler (lien vers flotte)
- Tap sur une ligne -> panneau detail : infos joueur, alliance, actions (espionner, attaquer, transporter)

### Navigation systeme

- Selecteurs galaxie/systeme en haut de page avec boutons stepper
- Sur mobile : selecteurs pleine largeur, inputs numeriques avec steppers
- Swipe horizontal gauche/droite pour changer de systeme (via touch events natifs : `onTouchStart`/`onTouchEnd` avec delta X > 50px, pas de dependance externe)

### Tablette & Desktop

Tableau classique avec colonnes (Position, Planete, Joueur, Alliance, Debris, Actions).

---

## 8. Flotte (wizard 3 etapes)

Chaque etape en plein ecran sur mobile.

### Etape 1 - Selection des vaisseaux

- Liste des types de vaisseaux disponibles avec quantite possedee
- Input numerique pour chaque type
- Bouton "Tout selectionner"
- Bouton "Suivant" en bas

### Etape 2 - Destination & Mission

- 3 inputs coordonnees (galaxie, systeme, position)
- Grille de boutons missions disponibles (2-3 colonnes)
- Slider de vitesse tactile
- Affichage duree + consommation H2
- Missions non disponibles grisees

### Etape 3 - Cargo & Confirmation

- Inputs pour chaque ressource avec bouton "Max" (uniquement pour missions de transport)
- Resume complet : destination, mission, vaisseaux, duree, consommation
- Bouton "Envoyer" bien visible en bas

### Indicateur d'etape

Indicateur visuel 1/3, 2/3, 3/3 en haut. Bouton retour pour revenir a l'etape precedente.

### Tablette & Desktop

Meme wizard avec plus d'espace horizontal.

---

## 9. Messages

### Mobile

- Filtres par type en haut : pills/chips scrollables horizontalement
- Boites (Recus, Envoyes) en pills egalement
- Point bleu pour les messages non lus
- Chaque ligne : type + date a droite, apercu du contenu en dessous
- Tap -> vue detail plein ecran avec bouton retour
- Rapports de combat/espionnage : contenu formate

### Desktop - Layout boite mail (3 colonnes)

```
+-----------+------------------+---------------------+
| Boites    | Liste messages   | Contenu message     |
|           |                  |                     |
| Recus     | Message 1        | Detail du message   |
| Envoyes   | Message 2        | selectionne         |
|           | Message 3        |                     |
| Filtres:  |                  |                     |
| Combat    |                  |                     |
| Espion    |                  |                     |
| Systeme   |                  |                     |
| Joueur    |                  |                     |
| Alliance  |                  |                     |
| Coloni.   |                  |                     |
+-----------+------------------+---------------------+
```

- Gauche : boites (Recus, Envoyes) + filtres par type
- Centre : liste des messages/fils de la boite selectionnee
- Droite : contenu du message ou fil selectionne

Le layout 3 colonnes s'active a partir de `xl:` (1280px) pour avoir suffisamment d'espace avec la sidebar. Entre `lg:` (1024px) et `xl:`, le layout reste en 2 colonnes (boites+filtres en sidebar fine + liste|contenu).

### Tablette

2 colonnes : boites + filtres en haut en pills, puis liste | contenu.

---

## 10. Overview (Dashboard)

### Mobile - Sections empilees verticalement

1. **En-tete planete** : nom + coordonnees
2. **Activites en cours** : constructions, recherches, chantier avec timers. Tap -> page concernee. Masque si rien en cours.
3. **Mouvements de flotte** (nouveau) : flottes en vol avec timers + direction. Tap -> page mouvements. Masque si aucun mouvement. Cette section n'existe pas dans l'Overview actuel — a ajouter.
4. **Production /h** : resume des 3 ressources par heure
5. **Infos planete** : champs utilises, temperature, diametre

Chaque section est une carte glassmorphism. Les sections vides ne s'affichent pas.

### Desktop

Meme contenu en grille 2-3 colonnes.

---

## 11. Pages restantes

### Mouvements

- Mobile : liste verticale des flottes en vol (direction + destination + mission + timer countdown). Bouton rappeler en swipe gauche ou via tap -> detail.
- Desktop : tableau (Origine, Destination, Mission, Vaisseaux, Arrivee, Actions)

### Alliance

- Mobile : navigation par tabs en haut (Infos, Membres, Invitations, Candidatures)
- Infos : nom, tag, description, bouton quitter/dissoudre
- Membres : liste compacte (nom + role + score), tap pour actions
- Pas d'alliance : ecran avec 2 boutons (Creer / Chercher)
- Desktop : meme layout tabs avec tableau pour les membres

### Classements

Deux pages distinctes conservees : `/ranking` (joueurs) et `/alliance-ranking` (alliances). Les deux sont accessibles depuis le bottom sheet "Social" sous l'entree "Classement" qui mene a `/ranking`, avec un toggle (tabs) en haut de page pour basculer entre "Joueurs" et "Alliances".

- Mobile : liste simple (rang + nom + score), joueur/alliance du user en surbrillance. Pagination classique conservee (le scroll infini necessiterait des changements backend).
- Desktop : tableau avec colonnes supplementaires

### Login / Register

- Plein ecran centre, logo Exilium en haut
- Formulaire compact : email + mot de passe + "Se souvenir de moi"
- Fond spatial avec gradient
- Lien pour basculer entre login et register
- Desktop : formulaire dans carte centree, max-width ~400px

---

## 12. Style visuel global

### Direction : Glassmorphism spatial inspire du logo Exilium

Le logo Exilium utilise des tons bleu glace / cyan metallique avec des reflets lumineux (lens flare) sur fond spatial profond. Le design s'en inspire directement.

### Palette (remplace les CSS variables existantes dans `global.css`)

Les valeurs actuelles sont modifiees intentionnellement pour s'aligner sur le logo Exilium (plus sombre, primary decale vers le cyan). Les CSS variables HSL dans `:root` seront mises a jour.

| Token         | Ancienne valeur               | Nouvelle valeur                | Usage                         |
|---------------|-------------------------------|--------------------------------|-------------------------------|
| background    | `222 47% 6%`                  | `220 55% 3%`                   | Fond principal, plus sombre   |
| card          | `222 47% 9%`                  | `220 50% 8%` / 80% opacite    | Cartes glassmorphism          |
| primary       | `210 80% 55%`                 | `200 85% 65%`                  | Bleu glace/cyan du logo       |
| foreground    | `210 20% 90%`                 | `210 20% 85%`                  | Texte, legerement plus doux   |
| accent-glow   | (nouveau)                     | `195 100% 90%`                 | Reflets, glows, lens flare. A ajouter dans `tailwind.config.js` comme couleur custom (`accentGlow`) et dans les CSS variables. |
| muted-fg      | (existant)                    | `210 15% 55%`                  | Texte secondaire              |
| minerai       | `#8b9dc3`                     | `#8b9dc3` (inchange)           | Bleu-gris                     |
| silicium      | `#6ecfef`                     | `#6ecfef` (inchange)           | Cyan                          |
| hydrogene     | `#4db8a4`                     | `#4db8a4` (inchange)           | Vert                          |
| energy        | `#f0c040`                     | `#f0c040` (inchange)           | Jaune                         |

### Glassmorphism

- Cartes et barres : `bg-card/80` + `backdrop-blur-md` + `border-white/10`
- Ombres douces teintees de bleu
- Fond de page : gradient radial sombre + pattern etoile existant (`.bg-stars`)

### Animations & micro-interactions

- Transitions entre pages : `fade-in` 200ms
- Bottom sheet : slide-up avec spring easing
- Boutons : `active:scale-95` au tap
- Compteurs de ressources : animation d'incrementation fluide
- Items de liste : `fade-in` sequentiel au chargement (stagger 50ms)
- Construction en cours : barre de progression avec pulse subtil

### Typographie

- Police systeme (performance)
- Contraste de tailles : titres plus grands, body plus petit
- Nombres/compteurs en `tabular-nums`

### Touch targets

- Minimum 44x44px pour tous les elements interactifs (Apple HIG)
- Espacement genereux entre elements tapables
- Padding `p-4` minimum sur les lignes de liste
