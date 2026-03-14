# Phase 6a : Sélecteur de planètes + Recycleurs UX — Design Spec

## Objectif

Ajouter un sélecteur de planètes dans la topbar pour switcher entre colonies, et rendre le badge débris cliquable dans la galaxie pour pré-remplir le wizard fleet en mission recyclage.

---

## 1. Sélecteur de planètes

### Store : `planetStore`

Fichier : `apps/web/src/stores/planet.store.ts`

Zustand store avec persist (localStorage), même pattern que `authStore` :

```typescript
interface PlanetState {
  activePlanetId: string | null;
  setActivePlanet: (id: string) => void;
}
```

Au premier login (ou si `activePlanetId` est null), initialisé avec la première planète retournée par `planet.list`.

### Router tRPC : `planet.list`

Ajouter une procédure `list` au `planetRouter` existant :
- Retourne toutes les planètes du joueur : `id`, `name`, `galaxy`, `system`, `position`
- Triées par date de création (planète mère en premier)

### TopBar : dropdown planète

Dans `apps/web/src/components/layout/TopBar.tsx` :
- Dropdown à gauche des compteurs de ressources
- Affiche la planète active : `nom [g:s:p]`
- Liste déroulante avec toutes les planètes du joueur
- Au clic sur une planète : `setActivePlanet(id)`, les compteurs de ressources se rafraîchissent

### Impact sur les pages existantes

Toutes les pages qui utilisent un `planetId` doivent lire depuis `planetStore.activePlanetId` :
- Overview, Resources, Buildings, Research, Shipyard, Defense, Fleet
- Les queries tRPC de ces pages doivent utiliser `activePlanetId` au lieu d'un ID hardcodé

Vérifier comment `planetId` est actuellement résolu dans chaque page et unifier vers le store.

---

## 2. Recycleurs UX

### Badge DF cliquable — Galaxy.tsx

Le badge "DF" dans la vue galaxie devient un lien cliquable. Au clic :
- Navigation vers `/fleet?mission=recycle&galaxy=X&system=Y&position=Z`

### Fleet wizard — pré-remplissage

Dans `Fleet.tsx`, au montage du composant :
- Lire les query params `mission`, `galaxy`, `system`, `position` depuis l'URL
- Si présents : pré-remplir la destination et la mission dans le wizard
- Si mission === 'recycle' : auto-sélectionner tous les recycleurs disponibles
- Passer directement au step 2 ou 3 du wizard (destination + mission déjà remplis)

---

## 3. Fichiers à créer

| Fichier | Responsabilité |
|---------|---------------|
| `apps/web/src/stores/planet.store.ts` | Store zustand planète active |

## 4. Fichiers à modifier

| Fichier | Modification |
|---------|-------------|
| `apps/api/src/modules/planet/planet.service.ts` | Ajouter méthode listPlanets(userId) |
| `apps/api/src/modules/planet/planet.router.ts` | Ajouter procédure list |
| `apps/web/src/components/layout/TopBar.tsx` | Dropdown sélecteur de planètes |
| `apps/web/src/pages/Galaxy.tsx` | Badge DF cliquable avec lien vers Fleet |
| `apps/web/src/pages/Fleet.tsx` | Pré-remplissage depuis query params |
| `apps/web/src/pages/Overview.tsx` | Utiliser activePlanetId du store |
| `apps/web/src/pages/Resources.tsx` | Utiliser activePlanetId du store |
| `apps/web/src/pages/Buildings.tsx` | Utiliser activePlanetId du store |
| `apps/web/src/pages/Shipyard.tsx` | Utiliser activePlanetId du store |
| `apps/web/src/pages/Defense.tsx` | Utiliser activePlanetId du store |
