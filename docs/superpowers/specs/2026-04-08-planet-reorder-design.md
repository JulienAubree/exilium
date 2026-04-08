# Reorganisation des planetes -- Design

## Objectif

Permettre a chaque joueur de reorganiser ses planetes dans la vue Empire et le dropdown de navigation. L'ordre est personnel (par joueur), persiste en base, et se reflete partout ou les planetes sont listees.

## Stockage

### Schema

Nouveau champ sur la table `planets` :

```
sortOrder: smallint, default 0, not null
```

### Migration

- Ajouter la colonne `sort_order` avec default 0
- Initialiser les valeurs pour les planetes existantes en se basant sur `created_at` :
  ```sql
  UPDATE planets SET sort_order = sub.rn
  FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC) - 1 AS rn
    FROM planets
  ) sub
  WHERE planets.id = sub.id;
  ```

### Tri

`planet.service.ts` : `listPlanets` et `getEmpireOverview` trient par `sortOrder ASC, createdAt ASC` (fallback si egalite de sortOrder).

### Nouvelle planete

A la colonisation, la nouvelle planete recoit `sortOrder = max(sortOrder parmi les planetes du joueur) + 1`. Elle apparait en derniere position.

## API

### Nouvel endpoint `planet.reorder`

- Procedure protegee
- Input : `{ order: Array<{ planetId: string, sortOrder: number }> }`
- Validation : toutes les `planetId` doivent appartenir au joueur appelant
- Met a jour `sort_order` en batch (une transaction)
- Invalide les caches cote client apres succes (`planet.list`, `planet.empire`)

## UI -- Vue Empire

### Mode reorganisation

Un bouton "Reorganiser" apparait dans le header de la page Empire, a cote du titre (meme pattern que les autres actions de PageHeader).

Au clic sur "Reorganiser" :
- Les cartes planetes entrent en **mode edition**
- Les raccourcis de navigation sur chaque carte (Batiments, Chantier, Fleet, Defense) sont masques
- Les barres de ressources et badges de statut restent visibles (reperes visuels pour identifier les planetes)
- Un bandeau sticky apparait en bas avec deux boutons : "Annuler" et "Valider"

### Interaction desktop : Drag & Drop

- Librairie : `@dnd-kit/core` + `@dnd-kit/sortable`
- Chaque carte planete devient draggable via un handle (icone 6 points / grip)
- Animation de reordering fluide (les cartes se decalent en temps reel)
- Le handle est visible sur chaque carte en mode edition

### Interaction mobile : Fleches

- Sur chaque carte, deux boutons fleche haut / fleche bas apparaissent
- Clic sur fleche haut : la carte monte d'une position
- Clic sur fleche bas : la carte descend d'une position
- Les fleches sont desactivees aux extremites (premiere / derniere carte)
- Detection desktop vs mobile : `useMediaQuery` ou breakpoint Tailwind (lg)

### Validation

- "Valider" : appel a `planet.reorder` avec le nouvel ordre, sortie du mode edition
- "Annuler" : retour a l'ordre original, sortie du mode edition
- Pendant l'appel API, le bouton "Valider" affiche un spinner et est desactive
- En cas d'erreur, toast d'erreur, le mode edition reste actif

## UI -- Dropdown TopBar

Aucune modification du composant dropdown. Il consomme `planet.list` qui retourne deja les planetes dans le bon ordre. L'invalidation apres `planet.reorder` suffit a rafraichir le dropdown.

## Composants

### `ReorderableEmpireGrid`

Wrapper autour de la grille de cartes existante. Responsabilites :
- Gerer le `DndContext` et `SortableContext` de dnd-kit
- Maintenir l'etat local de l'ordre pendant l'edition
- Exposer les callbacks `onSave` et `onCancel`
- Detecter desktop vs mobile pour choisir l'interaction

### `SortableEmpireCard`

Wrapper autour de `EmpirePlanetCard`. Responsabilites :
- Rendre la carte draggable (via `useSortable` de dnd-kit)
- Afficher le handle de drag (desktop) ou les fleches (mobile)
- Masquer les actions de navigation en mode edition

### Fichiers impactes

- `packages/db/src/schema/planets.ts` : ajout du champ `sortOrder`
- `apps/api/src/modules/planet/planet.service.ts` : tri par sortOrder, logique de reorder
- `apps/api/src/modules/planet/planet.router.ts` : nouvel endpoint `reorder`
- `apps/web/src/pages/Empire.tsx` : integration du mode reorganisation
- `apps/web/src/components/empire/ReorderableEmpireGrid.tsx` : nouveau composant
- `apps/web/src/components/empire/SortableEmpireCard.tsx` : nouveau composant
- Nouvelle migration SQL
- `colonize.handler.ts` : assigner sortOrder a la nouvelle planete

## Hors scope

- Reorganisation depuis le dropdown directement (on passe par la vue Empire)
- Groupement/dossiers de planetes
- Tri automatique par critere (ressources, distance, etc.)
