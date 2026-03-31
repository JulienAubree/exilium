# Vue Empire — Dashboard de pilotage multi-planètes

## Contexte

Actuellement, le joueur ne voit qu'une seule planète à la fois (sélectionnée via le planet selector dans la TopBar). Pour avoir une vue d'ensemble de son empire, il doit switcher manuellement entre chaque planète. L'Overview (`/`) ne montre que la planète active.

La vue **Empire** est un dashboard global qui permet de :
- Voir l'état de toutes les planètes en un coup d'oeil
- Monitorer les KPIs globaux (production totale, flottes, alertes)
- Naviguer rapidement vers n'importe quelle page d'une planète

## Route

- Nouvelle : `/empire`
- Ajouter à la sidebar dans une nouvelle section "Empire" en haut
- Ajouter au BottomTabBar mobile
- Lazy loading avec error boundary (pattern existant)

## Structure de la page

```
/empire
├── EmpireKpiBar (sous la TopBar, pas sticky)
│   ├── Production totale minerai/h
│   ├── Production totale silicium/h
│   ├── Production totale hydrogene/h
│   ├── Nombre de planètes
│   ├── Flottes en mouvement
│   └── Alerte attaque (conditionnel)
│
├── PageHeader ("Empire" + "Vue d'ensemble de vos colonies")
│
├── Planet Grid (desktop)
│   └── EmpirePlanetCard × N (grille auto-fill, min 340px)
│
└── Planet List (mobile < 768px)
    └── EmpirePlanetRow × N (lignes compactes empilées)
```

## 1. EmpireKpiBar

Barre horizontale sous la TopBar. Affiche les métriques agrégées de l'empire.

### Contenu

| Métrique | Icône (Lucide) | Valeur | Label |
|----------|---------------|--------|-------|
| Minerai total | `Pickaxe` | Somme des taux/h | "Minerai total" |
| Silicium total | `Gem` | Somme des taux/h | "Silicium total" |
| Hydrogene total | `Droplets` | Somme des taux/h | "Hydrogène total" |
| Planètes | `Globe` | Nombre | "Planètes" |
| Flottes en vol | `Rocket` | Nombre de mouvements actifs | "Flottes en vol" |
| Alerte attaque | `ShieldAlert` | Texte "N attaque(s)" | Conditionnel, style danger |

### Style

- Background : `bg-[#0d1628]` avec border-bottom `border-slate-800`
- Icônes dans des carrés arrondis avec background teinté (couleur ressource à 10% opacité)
- Valeurs en gras, couleur ressource. Labels en `text-xs text-slate-500 uppercase`
- Séparateur vertical entre ressources et compteurs
- Alerte : badge rouge avec animation pulse, affiché uniquement si flotte hostile détectée
- Responsive : sur mobile, les KPIs wrap sur 2 lignes, le séparateur disparaît

## 2. EmpirePlanetCard (desktop)

Card compacte affichant l'état d'une planète. Grille responsive : `grid-template-columns: repeat(auto-fill, minmax(340px, 1fr))`.

### Structure de la card

```
┌──────────────────────────────────────────┐
│ [img] Kepler Prime          [Capitale]   │  ← Header
│       [1:42:7] · Aride · 12 400 km      │
├──────────────────────────────────────────┤
│ Fe ████████████░░░░░   +1.2k/h           │  ← Resource bars
│ Si █████████░░░░░░░░   +840/h            │
│ H  ████░░░░░░░░░░░░░   +320/h           │
├──────────────────────────────────────────┤
│ 🔨 Mine Si Nv.12 14:32  🚀 2 flottes    │  ← Status badges
│ ⚠ Attaque 02:15                          │
├──────────────────────────────────────────┤
│ Bâtiments | Chantier | Flottes | Défenses│  ← Nav shortcuts
└──────────────────────────────────────────┘
```

### Header

- **Image planète** : composant `GameImage` existant, rond 44px avec border, utilise `getPlanetImageUrl(planetClassId, planetImageIndex, 'thumb')`
- **Nom** : `text-sm font-semibold text-slate-100`, truncate si trop long
- **Coordonnées** : `text-xs text-slate-500` — format `[galaxy:system:position] · classe · diamètre`
- **Tag** : badge "Capitale" (cyan) pour la première planète, "Colonie" (violet) pour les autres

### Resource bars

3 lignes, une par ressource :
- **Icône** : label 2 lettres coloré (Fe/Si/H) avec couleur ressource
- **Barre** : hauteur 5px, background `bg-slate-800`, fill avec gradient de la couleur ressource. Largeur = `stock actuel / capacité stockage × 100%`
- **Taux** : `text-xs` couleur ressource, format `+X/h` (arrondi intelligent : 1200 → "1.2k")

### Status badges

Badges compacts avec icône Lucide + texte :
- **Construction** (`Hammer`) : nom du bâtiment + niveau + timer countdown. Style : `bg-slate-800 border-slate-700`
- **Recherche** (`FlaskConical`) : nom de la recherche + timer. Style : `bg-purple-500/10 border-purple-500/20 text-purple-400`
- **Flottes** (`Rocket`) : nombre de flottes sortantes. Style : `bg-slate-800 border-slate-700`
- **Attaque** (`ShieldAlert`) : timer de l'attaque. Style : `bg-red-500/10 border-red-500/20 text-red-500`
- **Idle** (`Check`) : "Aucune activité". Style : `bg-green-500/10 border-green-500/20 text-green-500`. Affiché uniquement si aucun autre badge.

### Nav shortcuts

Barre en bas de la card, border-top. 4 boutons égaux :
- **Bâtiments** (`Building2`), **Chantier** (`Wrench`), **Flottes** (`Layers`), **Défenses** (`Shield`)
- Au clic : `setActivePlanet(planetId)` puis `navigate('/buildings')` (ou `/shipyard`, `/fleet`, `/defense`)
- Style : `text-xs text-slate-500 hover:text-primary hover:bg-primary/5`

### Card states

- **Normal** : `border-slate-800`, hover → `border-primary/25 shadow-primary/5`
- **Alerte attaque** : `border-red-500/25`, hover → `border-red-500/60 shadow-red-500/10`
- **Stockage plein** (>95%) : la barre de ressource concernée pulse doucement

## 3. EmpirePlanetRow (mobile < 768px)

Version compacte de la card pour mobile. Les cards se transforment en lignes empilées sans gap, avec border-radius uniquement sur la première et la dernière.

### Structure

```
┌────────────────────────────────────────┐
│ [img] Kepler Prime    Fe +1.2k  › │
│       [1:42:7]        Si +840     │
│       🔨 Mine 14:32   H  +320     │
└────────────────────────────────────────┘
```

- **Image** : 34px
- **Nom + coordonnées** : empilés à gauche
- **Badge principal** : le badge le plus prioritaire (attaque > construction > recherche > idle)
- **Production** : 3 valeurs en colonne, juste le taux avec couleur, pas de barre
- **Chevron** : `ChevronRight` en `text-slate-700` indiquant que la ligne est cliquable
- **Au clic** : `setActivePlanet(planetId)` puis `navigate('/')` (vers l'Overview de cette planète)
- **Nav shortcuts** : masqués sur mobile (le clic sur la row suffit)

## 4. Backend — nouveau endpoint `planet.empire`

### Objectif

Agréger toutes les données nécessaires au dashboard en une seule requête pour éviter le waterfall N+1.

### Signature

```typescript
// planet.router.ts
empire: protectedProcedure.query(async ({ ctx }) => {
  return planetService.getEmpireOverview(ctx.userId!)
})
```

### Données retournées

```typescript
interface EmpireOverview {
  planets: EmpirePlanet[]
  totalRates: {
    mineraiPerHour: number
    siliciumPerHour: number
    hydrogenePerHour: number
  }
  activeFleetCount: number
  inboundAttackCount: number
}

interface EmpirePlanet {
  // Identité
  id: string
  name: string
  galaxy: number
  system: number
  position: number
  planetClassId: string | null
  planetImageIndex: number | null
  diameter: number
  minTemp: number
  maxTemp: number

  // Ressources actuelles
  minerai: number
  silicium: number
  hydrogene: number

  // Taux de production
  mineraiPerHour: number
  siliciumPerHour: number
  hydrogenePerHour: number

  // Capacité stockage
  storageMineraiCapacity: number
  storageSiliciumCapacity: number
  storageHydrogeneCapacity: number

  // Énergie
  energyProduced: number
  energyConsumed: number

  // Activités en cours
  activeBuild: {
    buildingId: string
    level: number
    endTime: string // ISO
  } | null

  activeResearch: {
    researchId: string
    level: number
    endTime: string // ISO
  } | null

  // Flottes sortantes de cette planète
  outboundFleetCount: number

  // Attaque en cours vers cette planète
  inboundAttack: {
    arrivalTime: string // ISO
  } | null
}
```

### Implémentation backend

Nouvelle méthode `getEmpireOverview(userId)` dans `planet.service.ts` :

1. `listPlanets(userId)` — récupère toutes les planètes
2. Pour chaque planète, en parallèle (`Promise.all`) :
   - `resourceService.materializeResources(planetId, userId)` — met à jour les ressources
   - `resourceService.getProductionRates(planetId, planet, bonus, userId)` — calcule les taux
   - Query `buildQueue` pour le build actif (status = 'active')
   - Query `researchQueue` pour la recherche active
   - Count `fleetEvents` sortants de cette planète
   - Query `fleetEvents` hostiles entrants vers cette planète
3. Agrège les totaux (production, flottes, attaques)
4. Retourne `EmpireOverview`

Note : `materializeResources` est nécessaire pour avoir les valeurs de stock à jour.

## 5. Navigation

### Sidebar (desktop)

Ajouter une nouvelle section en première position :

```typescript
{
  title: 'Empire',
  items: [
    { label: 'Empire', path: '/empire', icon: Crown }
  ]
}
```

L'icône `Crown` de Lucide convient bien pour représenter l'empire du joueur.

### BottomTabBar (mobile)

Ajouter `/empire` dans les tabs. Options :
- Nouveau groupe "Empire" avec icône `Crown`
- Ou l'intégrer dans le groupe "planète" existant

Recommandation : nouveau groupe dédié car c'est une vue transversale, pas liée à une planète.

### Router

```typescript
{
  path: 'empire',
  lazy: lazyLoad(() => import('./pages/Empire')),
  errorElement: <ErrorBoundary><RouteErrorFallback /></ErrorBoundary>,
}
```

## 6. Composants frontend

| Composant | Fichier | Responsabilité |
|-----------|---------|----------------|
| `EmpirePage` | `pages/Empire.tsx` | Page assemblant KPI bar + grille |
| `EmpireKpiBar` | `components/empire/EmpireKpiBar.tsx` | Barre de métriques globales |
| `EmpirePlanetCard` | `components/empire/EmpirePlanetCard.tsx` | Card desktop par planète |
| `EmpirePlanetRow` | `components/empire/EmpirePlanetRow.tsx` | Ligne mobile par planète |

### Data flow

```
EmpirePage
├── trpc.planet.empire.useQuery()
├── EmpireKpiBar(totalRates, planetCount, fleetCount, attackCount)
└── planets.map(planet =>
    ├── desktop: <EmpirePlanetCard planet={planet} />
    └── mobile:  <EmpirePlanetRow planet={planet} />
    )
```

Le switch desktop/mobile se fait via classes Tailwind (`hidden lg:grid` / `lg:hidden`) comme dans le reste de l'app.

### Formatage des nombres

Réutiliser les utilitaires existants. Pour les taux de production :
- < 1000 : afficher tel quel (ex: "840/h")
- >= 1000 : format "Xk" (ex: "1.2k/h")
- >= 1000000 : format "XM" (ex: "1.2M/h")

### Timer des badges

Réutiliser le composant `Timer` existant (`components/common/Timer.tsx`) pour les countdowns de construction, recherche et attaque.

## 7. Loading state

- Skeleton loader avec le même pattern que les autres pages (`PageSkeleton`)
- Pendant le chargement : afficher la structure de la grille avec des cards skeleton (barres grises animées)
- La KPI bar affiche des tirets "--" pendant le chargement

## 8. Edge cases

- **Joueur avec 1 seule planète** : la grille affiche 1 card. Les KPIs sont les mêmes que la prod de cette planète. Utile quand même pour les raccourcis nav.
- **Aucune activité sur aucune planète** : les badges idle s'affichent. Pas de message spécial.
- **Énergie négative** : si `energyConsumed > energyProduced`, afficher un badge warning énergie sur la card.
- **Stockage plein** (>95%) : la barre de ressource concernée a une animation pulse subtile pour attirer l'attention.
