# Plan : Vue Galaxie nommée + Système solaire orbital animé

## Context

La page Galaxie actuelle (`apps/web/src/pages/Galaxy.tsx`) utilise un simple input numérique (1-9) pour choisir la galaxie et (1-499) pour le système, puis affiche un tableau de 15 positions. L'objectif est de rendre cette navigation plus immersive :
1. **Galaxies nommées** — Donner un nom à chaque galaxie (Orion, Pegasus, etc.) avec un sélecteur visuel en grille
2. **Vue orbitale animée** — Afficher le système solaire avec une étoile centrale, des orbites concentriques et des planètes qui tournent lentement en CSS

C'est du **100% frontend** — aucun changement API, DB ou game-engine requis.

---

## Phase 1 : Constantes galaxie + keyframes CSS

### Créer `apps/web/src/lib/galaxy.constants.ts`

Constante mapping numéro → nom + couleur pour le sélecteur :
```ts
export const GALAXY_NAMES: Record<number, { name: string; color: string }> = {
  1: { name: 'Orion', color: '#f0c040' },
  2: { name: 'Pegasus', color: '#6ecfef' },
  3: { name: 'Majoris', color: '#4db8a4' },
  4: { name: 'Andromeda', color: '#c084fc' },
  5: { name: 'Centauri', color: '#8b9dc3' },
  6: { name: 'Vega', color: '#f87171' },
  7: { name: 'Sirius', color: '#60a5fa' },
  8: { name: 'Polaris', color: '#34d399' },
  9: { name: 'Nova', color: '#fb923c' },
};
```

### Modifier `apps/web/src/styles/animations.css`

Ajouter les keyframes pour les orbites :
```css
@keyframes orbit {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes counterOrbit {
  from { transform: rotate(0deg); }
  to { transform: rotate(-360deg); }
}
```

Les durées sont appliquées en inline style (varient par position).

---

## Phase 2 : Composant GalaxySelector

### Créer `apps/web/src/components/features/galaxy/GalaxySelector.tsx`

Grille 3×3 de boutons `glass-card` avec :
- Numéro + nom de la galaxie
- Bordure gauche colorée avec la couleur de la galaxie
- Etat sélectionné : bordure plus vive, léger scale
- Hover avec transition
- Animation `animate-fade-in` à l'entrée

Props : `{ selected: number; onSelect: (galaxy: number) => void }`

---

## Phase 3 : Vue orbitale du système solaire

### Créer `apps/web/src/components/features/galaxy/SolarSystemOrbital.tsx`

Composant principal de la vue orbitale.

**Architecture CSS :**
- Container `relative aspect-square max-w-[600px] mx-auto`
- Étoile centrale : div ronde `bg-energy` avec `box-shadow` glow dorée, `animate-pulse-glow`
- 15 orbites concentriques : divs rondes `border-radius: 50%` centrées
  - Occupée → bordure fine solide semi-transparente
  - Vide → bordure dashed très discrète
- Rayon avec scaling sqrt : `radius = minR + (maxR - minR) * sqrt(index / 14)`
  - minR = 8% du container, maxR = 46%

**Animation des planètes :**
- Chaque planète est dans un container zéro-taille centré sur l'étoile
- Le container tourne : `animation: orbit ${60 + index * 20}s linear infinite`
- La planète (dot) est décalée vers le haut de `radius` pixels
- La planète contre-tourne : `animation: counterOrbit` (même durée) pour rester droite (tooltips lisibles)
- Décalage angulaire initial via `animation-delay` négatif avec l'angle d'or (137.5°) :
  `delay = -(duration * (index * 137.5 % 360) / 360)s`
- `will-change: transform` pour performance GPU

**Interaction :**
- Hover sur une planète → `Tooltip` existant avec nom, propriétaire, tag alliance, lien débris
- Click → sélectionne la planète (highlight + info en dessous)
- Planète : `w-3 h-3` ronde, couleur par position, `hover:scale-150 transition-transform`

**Couleurs des planètes par position :**
```ts
const PLANET_COLORS = [
  '#c9846c', '#d4a574', '#a0845c', '#7c9a5c', '#5c8c7c',
  '#5c7ca0', '#6c8cc0', '#849cc8', '#9cacd0', '#a4b4d4',
  '#8ca4c8', '#7494bc', '#6484b0', '#5474a4', '#446498',
];
```
(Dégradé chaud→froid selon la distance à l'étoile)

### Créer `apps/web/src/components/features/galaxy/PlanetTooltipContent.tsx`

Contenu du tooltip au hover d'une planète :
- Position `[G:S:P]`
- Nom de la planète (bold)
- Propriétaire + tag alliance
- Débris si présents (metal + cristal formatés)
- Lien "Recycler" vers `/fleet?mission=recycle&galaxy=X&system=Y&position=Z`

---

## Phase 4 : Refonte de Galaxy.tsx

### Modifier `apps/web/src/pages/Galaxy.tsx`

**Nouvelle structure :**
```
PageHeader "Galaxie {nom}"
├── GalaxySelector (grille 3×3)
├── Navigateur système (< input >) — code existant conservé
├── Toggle vue orbitale / liste (desktop seulement, hidden md:flex)
└── Card "Système solaire [G:S]"
    ├── SolarSystemOrbital (hidden sur mobile, affiché si mode orbital)
    └── Table existante (toujours sur mobile, toggle sur desktop)
```

**Détails :**
- State `viewMode: 'orbital' | 'table'` (default `'orbital'`)
- Le toggle utilise 2 `Button` variant outline/default
- Mobile (`< md`) : toujours la vue table/cards existante, vue orbitale `hidden`
- Desktop (`>= md`) : toggle entre les deux vues
- Le code table/mobile cards existant est conservé tel quel

---

## Fichiers

| Fichier | Action |
|---------|--------|
| `apps/web/src/lib/galaxy.constants.ts` | Créer — noms + couleurs galaxies |
| `apps/web/src/styles/animations.css` | Modifier — keyframes orbit/counterOrbit |
| `apps/web/src/components/features/galaxy/GalaxySelector.tsx` | Créer — grille sélection galaxie |
| `apps/web/src/components/features/galaxy/SolarSystemOrbital.tsx` | Créer — vue orbitale animée |
| `apps/web/src/components/features/galaxy/PlanetTooltipContent.tsx` | Créer — tooltip info planète |
| `apps/web/src/pages/Galaxy.tsx` | Modifier — intégrer les nouveaux composants |

Composants existants réutilisés :
- `apps/web/src/components/ui/tooltip.tsx` — Tooltip au hover
- `apps/web/src/components/ui/card.tsx` — Card, CardHeader, CardContent
- `apps/web/src/components/ui/button.tsx` — Button pour toggle vue
- `apps/web/src/components/common/PageHeader.tsx` — Titre de page

---

## Vérification

1. `/galaxy` affiche la grille 3×3 avec les 9 noms de galaxies
2. Cliquer une galaxie met à jour le titre et recharge le système
3. Vue orbitale : étoile centrale brillante, 15 orbites visibles, planètes sur positions occupées
4. Les planètes tournent à des vitesses différentes (intérieures plus rapides), positions décalées
5. Hover une planète → tooltip avec nom, propriétaire, alliance, débris
6. Toggle "Vue liste" → tableau classique existant
7. Mobile (< 768px) : vue orbitale cachée, seulement table/cards
8. Système vide : orbites dashed, pas de planètes, étoile toujours visible
9. `npx vite build` dans web — pas d'erreur
