# Phase 6a : Sélecteur de planètes + Recycleurs UX — Design Spec

## Objectif

Ajouter un sélecteur de planètes dans la topbar pour switcher entre colonies, et rendre le badge débris cliquable dans la galaxie pour pré-remplir le wizard fleet en mission recyclage.

---

## 1. Sélecteur de planètes

### Store : `planetStore`

Fichier : `apps/web/src/stores/planet.store.ts`

Zustand store avec localStorage manuelle, même pattern que `authStore` :

```typescript
interface PlanetState {
  activePlanetId: string | null;
  setActivePlanet: (id: string) => void;
  clearActivePlanet: () => void;
}
```

- Au premier login (ou si `activePlanetId` est null), initialisé avec la première planète retournée par `planet.list`.
- `clearActivePlanet()` doit être appelé lors du logout (aux côtés de `clearAuth()`).

### Router tRPC : `planet.list` (existant)

La procédure `planet.list` et la méthode `listPlanets(userId)` existent déjà. Seule modification nécessaire : ajouter un tri par `createdAt` ascendant pour que la planète mère apparaisse en premier.

### Layout.tsx : utiliser `activePlanetId`

`Layout.tsx` est le point central de résolution du `planetId`. Actuellement il utilise `planets?.[0]?.id`. Modifier pour :
- Lire `activePlanetId` depuis `planetStore`
- Si `activePlanetId` est null ou ne correspond à aucune planète du joueur, fallback sur `planets?.[0]?.id` et appeler `setActivePlanet`
- Toutes les pages enfants reçoivent déjà `planetId` via `useOutletContext`, donc aucune modification nécessaire dans les pages individuelles.

### TopBar : dropdown planète

Dans `apps/web/src/components/layout/TopBar.tsx` :
- Dropdown à gauche des compteurs de ressources
- Affiche la planète active : `nom [g:s:p]`
- Liste déroulante avec toutes les planètes du joueur
- Au clic sur une planète : `setActivePlanet(id)`, les compteurs de ressources se rafraîchissent

### Logout : nettoyage

Dans le composant qui appelle `clearAuth()`, ajouter aussi `clearActivePlanet()` pour éviter qu'un autre utilisateur sur le même navigateur hérite d'un `activePlanetId` obsolète.

---

## 2. Recycleurs UX

### Badge DF cliquable — Galaxy.tsx

Le badge "DF" dans la vue galaxie devient un lien cliquable. Au clic :
- Navigation vers `/fleet?mission=recycle&galaxy=X&system=Y&position=Z`

### Fleet wizard — pré-remplissage

Dans `Fleet.tsx`, au montage du composant :
- Lire les query params `mission`, `galaxy`, `system`, `position` depuis l'URL
- Si présents : pré-remplir la destination et la mission
- Si mission === 'recycle' : auto-sélectionner tous les recycleurs disponibles
- Atterrir sur le step 2 (destination + mission) avec les valeurs pré-remplies, pour que le joueur puisse vérifier avant confirmation

**Edge case — zéro recycleurs :** Si le joueur n'a aucun recycleur sur la planète active, atterrir sur le step 1 avec un message d'avertissement : "Aucun recycleur disponible sur cette planète."

---

## 3. Fichiers à créer

| Fichier | Responsabilité |
|---------|---------------|
| `apps/web/src/stores/planet.store.ts` | Store zustand planète active |

## 4. Fichiers à modifier

| Fichier | Modification |
|---------|-------------|
| `apps/api/src/modules/planet/planet.service.ts` | Ajouter `.orderBy(planets.createdAt)` à `listPlanets` |
| `apps/web/src/components/layout/Layout.tsx` | Utiliser `activePlanetId` du store au lieu de `planets?.[0]?.id` |
| `apps/web/src/components/layout/TopBar.tsx` | Dropdown sélecteur de planètes |
| `apps/web/src/pages/Galaxy.tsx` | Badge DF cliquable avec lien vers Fleet |
| `apps/web/src/pages/Fleet.tsx` | Pré-remplissage depuis query params |
| Composant logout (Sidebar ou TopBar) | Appeler `clearActivePlanet()` au logout |
