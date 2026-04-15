# Overview Dashboard Rework

## Objectif

Transformer la page "Vue d'ensemble" d'une planete en un dashboard actionnable, dense et immersif. S'inspirer du pattern KPI bar de la page Empire pour la coherence UX. Maximiser l'information visible au premier ecran tout en gardant l'identite visuelle du jeu (hero banner avec image planete).

## Architecture de la page

La page se compose de 6 zones empilees verticalement :

1. Hero banner compact (~100px)
2. KPI bar avec depliants
3. Activites en cours (3 slots horizontaux)
4. Alerte attaque (conditionnel)
5. Grille 2x2 (flotte, mouvements, defenses, flagship)
6. Evenements recents (replie par defaut)

---

## 1. Hero banner compact

**Hauteur cible : ~100px** (contre ~180px actuellement).

- **Fond** : image de la planete en `object-cover`, `opacity-40`, `blur-sm`, `scale-110`, avec gradient `from-background via-background/80 to-transparent` de bas en haut. Identique au design actuel, juste plus court.
- **Contenu gauche** :
  - Thumbnail planete 48px, rond, `border-2 border-primary/30`, cliquable (ouvre `EntityDetailOverlay` avec `PlanetDetailContent` comme aujourd'hui)
  - Nom de la planete a cote : `text-xl font-bold`, cliquable pour renommer si `!planet.renamed`
  - Icone flagship inline si le flagship est sur cette planete
  - Sous-titre : `[galaxy:system:position] · diametre km · minTemp°C a maxTemp°C`
- **Contenu droite** : badges de biomes via le composant `BiomeBadge` existant avec hover popover portal
- **Fonctionnalites conservees** : rename, detail overlay au clic thumbnail, indicateur flagship

## 2. KPI bar

Conteneur `rounded-xl border border-border/30 bg-card/60 overflow-hidden`, meme pattern que `EmpireKpiBar`.

### Pills

Rangee horizontale de pills cliquables dans un flex `items-center justify-between gap-1 px-2 py-2`. Chaque pill = icone + valeur + chevron.

| Pill | Icone | Valeur affichee | Couleur |
|------|-------|-----------------|---------|
| Minerai | `MineraiIcon` | `{taux}/h` | `text-minerai` |
| Silicium | `SiliciumIcon` | `{taux}/h` | `text-silicium` |
| Hydrogene | `HydrogeneIcon` | `{taux}/h` | `text-hydrogene` |
| *separateur* | | | |
| Energie | eclair | `+{balance}` ou `-{deficit}` | `text-yellow-400` (positif) / `text-red-400` (deficit) |
| *separateur* | | | |
| Flotte | vaisseau | `{total} vsx` | `text-cyan-400` |

### Depliants

Au clic sur un pill, un panneau se deplie en dessous (un seul ouvert a la fois, toggle). Pattern identique a `EmpireKpiBar`.

**Depliant Minerai/Silicium/Hydrogene** :
- Reutilise le composant `ResourceGauge` existant (jauge circulaire SVG)
- Affiche : stock actuel (live via `useResourceCounter`), capacite, taux/h, quantite protegee
- Le composant `ProductionStorageCard` existant contient deja cette logique, on l'adapte pour un rendu en ligne

**Depliant Energie** :
- Produite / Consommee / Balance
- Barre visuelle produite vs consommee
- Couleur rouge si deficit, jaune/verte sinon

**Depliant Flotte** :
- Liste des types de vaisseaux presents (count > 0) avec compteurs
- Resume compact, le detail complet est dans le bloc grille en dessous

## 3. Activites en cours

Ligne horizontale de 3 mini-cartes (`display: flex`, `gap-3`), toujours visible.

### Slots

| Slot | Source de donnees | Lien |
|------|-------------------|------|
| Construction | `trpc.building.list` → `find(b.isUpgrading)` | `/buildings` |
| Chantier spatial | `trpc.shipyard.queue` → items actifs dans queue shipyard | `/shipyard` |
| Centre de commandement | `trpc.shipyard.queue` → items actifs dans queue command-center | `/command-center` |

### Etat actif (slot occupe)

- Icone de l'entite via `GameImage` (20x20px, `rounded-md`)
- Nom de l'entite + "Niv. X" (construction) ou "xN" (production)
- Barre de progression fine (2px), couleur par type :
  - Construction : `#38bdf8` (cyan)
  - Chantier : `#f59e0b` (amber)
  - Centre de commandement : `#8b5cf6` (violet)
- Timer live (composant `Timer` existant)
- Cliquable → navigation vers la page dediee
- Style : `bg-card/60`, `border border-white/6`, `rounded-lg`

### Etat vide (slot libre)

- Fond en pointilles : `border-dashed border-white/8`, `bg-card/30`
- Icone placeholder grise (20x20, `bg-white/4`)
- Texte : "Aucune construction" / "Chantier libre" / "Commandement libre"
- Sous-texte cliquable : "Lancer →" qui navigue vers la page
- Couleur muted (`text-muted-foreground`)

### Mobile

Les 3 cartes restent en ligne horizontale, `overflow-x-auto` si l'espace manque. Chaque carte a `min-width: 140px`.

## 4. Alerte attaque (conditionnel)

S'affiche uniquement si `inboundFleets` contient des flottes hostiles. Se positionne entre les activites et la grille.

Design identique a l'actuel :
- Bordure `border-red-500/40`, fond gradient rouge sombre
- Barre rouge en haut (accent)
- Scan line animee (`@keyframes scan`)
- Pour chaque flotte hostile : nom attaquant (selon tier de detection), coordonnees origine, compteur vaisseaux, timer live, barre de progression
- Cliquable → `/fleet/movements`

Aucun changement fonctionnel, on conserve le composant tel quel.

## 5. Grille 2x2

`display: grid`, `grid-template-columns: 1fr 1fr`, `gap-3`. Chaque bloc est une `glass-card` cliquable.

### Bloc Flotte stationnee (cyan)

- Header : icone `FleetIcon` + "Flotte stationnee" en `text-cyan-400 font-semibold` + compteur total a droite en muted
- Contenu : grille 2 colonnes des vaisseaux presents (`count > 0`). Chaque ligne = nom vaisseau (`text-muted-foreground`) + compteur (`font-semibold`), fond `bg-white/3`, `rounded`
- Etat vide : "Aucun vaisseau stationne" en muted italic
- Clic → `/fleet`

### Bloc Mouvements de flotte (violet)

- Header : icone `MovementsIcon` + "Mouvements" en `text-purple-400 font-semibold` + compteur
- Contenu : liste des mouvements depuis/vers cette planete. Pour chaque :
  - Dot couleur mission + label mission + phase (via `gameConfig.labels`)
  - Coordonnees route (origine → destination)
  - Timer live + mini barre de progression (2px)
- Inclut les flottes propres entrantes (depuis d'autres planetes du joueur, `phase === 'outbound'` vers cette planete)
- Inclut les flottes entrantes pacifiques d'autres joueurs
- Etat vide : "Aucun mouvement" en muted italic
- Clic → `/fleet/movements`

### Bloc Defenses planetaires (vert)

- Header : icone `DefenseIcon` + "Defenses" en `text-emerald-400 font-semibold` + compteur total
- Contenu : grille 2 colonnes des defenses presentes (`count > 0`). Meme style que flotte.
- Etat vide : "Aucune defense" en muted italic
- Clic → `/defense`

### Bloc Vaisseau amiral (jaune/or)

- Header : icone `FlagshipIcon` + "Vaisseau amiral" en `text-yellow-400 font-semibold`
- Contenu :
  - Image du flagship via `getFlagshipImageUrl` (28x28, `rounded-md`)
  - Nom du flagship
  - Statut avec dot couleur : vert "Operationnel" / bleu "En mission" / rouge "Incapacite"
- Si le flagship n'est pas sur cette planete : texte muted "Pas sur cette planete" + indication planete ou il se trouve
- Si pas de flagship : texte muted "Aucun vaisseau amiral"
- Clic → `/flagship`

### Responsive mobile

```
Desktop (lg+) :
┌──────────┬──────────┐
│  Flotte  │ Mouvmts  │
├──────────┼──────────┤
│ Defenses │ Flagship │
└──────────┴──────────┘

Mobile :
┌──────────┬──────────┐
│  Flotte  │ Mouvmts  │
├──────────┴──────────┤
│     Defenses        │
├─────────────────────┤
│     Flagship        │
└─────────────────────┘
```

Implementation : `grid-cols-2` par defaut pour les 2 premiers blocs, puis `col-span-2` pour defenses et flagship en dessous de `lg:` breakpoint. Sur desktop, les 4 restent en grille 2x2.

## 6. Evenements recents

- S'affiche uniquement si `recentEvents.length > 0`
- **Replie par defaut** : conteneur `glass-card` compact avec chevron `▶` + "X evenements recents" + "Voir" a droite. Toggle via `useState`.
- **Deplie** : chevron `▼` + liste des evenements. Meme rendu qu'aujourd'hui :
  - Dot couleur via `eventTypeColor(event.type)`
  - Texte via `formatEventText(event, { missions })`
  - Temps relatif via `formatRelativeTime(event.createdAt)`
  - Groupement via `groupEvents(recentEvents)`
- Les fonctions utilitaires `eventTypeColor`, `formatEventText`, `formatRelativeTime`, `groupEvents` existent deja dans `@/lib/game-events`.

---

## Elements retires

- **Section "Actions rapides"** : les boutons (Batiments, Recherche, Chantier, Defenses, Flotte, Galaxie) sont redondants avec la grille et la navigation existante. Supprimes.
- **Section "Informations planete"** (sidebar) : energie/diametre/temperature/biomes sont maintenant dans le KPI bar (energie) et le hero (biomes, diametre, temperature). Supprimee.
- **Jauges circulaires de production** (sidebar) : remplacees par les depliants du KPI bar.
- **Layout 2 colonnes main+sidebar** : remplace par la grille 2x2 unique.
- **Recherche dans les activites** : retiree car uniquement disponible sur la planete mere.

## Donnees consommees (queries tRPC)

Pas de nouvelle query. La page reutilise les queries existantes :

| Query | Usage |
|-------|-------|
| `trpc.planet.list` | Donnees planete + biomes |
| `trpc.resource.production` | Taux, stocks, energie, capacites, protege |
| `trpc.building.list` | Construction en cours |
| `trpc.shipyard.queue` | Queue chantier + centre de commandement |
| `trpc.shipyard.ships` | Vaisseaux stationnes |
| `trpc.shipyard.defenses` | Defenses presentes |
| `trpc.fleet.movements` | Mouvements sortants + propres entrants |
| `trpc.fleet.inbound` | Flottes entrantes (hostiles + pacifiques) |
| `trpc.gameEvent.byPlanet` | Evenements recents |
| `trpc.flagship.get` | Donnees flagship |
| `trpc.colonization.status` | Redirect vers page colonisation si en cours |

## Hooks et composants reutilises

- `useResourceCounter` : compteur live des ressources
- `Timer` : countdown live
- `GameImage` : icones batiments/unites
- `BiomeBadge` : badges biomes avec hover popover
- `EntityDetailOverlay` + `PlanetDetailContent` : overlay detail planete
- `ResourceGauge` : jauges circulaires dans les depliants
- `getPlanetImageUrl`, `getFlagshipImageUrl` : URLs images
- `getUnitName` : noms d'unites depuis gameConfig
- `eventTypeColor`, `formatEventText`, `formatRelativeTime`, `groupEvents` : formatage evenements

## Decomposition des fichiers

Le fichier `Overview.tsx` actuel fait ~1200 lignes. Le rework le decompose :

| Fichier | Responsabilite |
|---------|---------------|
| `pages/Overview.tsx` | Page principale, queries, orchestration des sections, guards (loading/colonization/error) |
| `components/overview/OverviewHero.tsx` | Hero banner compact (thumbnail, nom, coords, biomes, rename) |
| `components/overview/OverviewKpiBar.tsx` | KPI bar avec pills et depliants (ressources, energie, flotte) |
| `components/overview/OverviewActivities.tsx` | Ligne des 3 slots d'activites |
| `components/overview/OverviewGrid.tsx` | Grille 2x2 (flotte, mouvements, defenses, flagship) |
| `components/overview/OverviewEvents.tsx` | Evenements recents repliables |
| `components/overview/AttackAlert.tsx` | Bandeau d'alerte attaque (extrait de Overview.tsx) |

Les composants existants (`BiomeBadge`, `ResourceGauge`, `PlanetDetailContent`) restent dans leurs fichiers actuels ou sont extraits si necessaire.
