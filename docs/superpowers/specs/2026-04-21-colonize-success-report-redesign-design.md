# Rapport de colonisation — refonte du succès

**Date :** 2026-04-21
**Scope :** branche `result.success === true` de `apps/web/src/components/reports/ColonizeReportDetail.tsx`

## Problème

Dans le rapport de colonisation réussie (écran « Nouvelle colonie » / « Débarquement réussi »), deux problèmes :

1. Le lien **« Suivre l'avancement → »** pointe vers `/colonization/${planetId}`, route qui n'existe pas dans `router.tsx`. Il mène à une page 404.
2. L'encart **« Difficulté du monde »** (étoiles 0-5) n'apporte aucune information exploitable au joueur. Il faut le remplacer par des infos utiles : type de monde, bonus aux ressources du type, biomes connus.

## Design

### 1. Correction du lien de suivi

Le pattern standard dans le projet (voir `apps/web/src/pages/Galaxy.tsx:267-270`, `apps/web/src/components/empire/EmpireKpiBar.tsx:197`) est :

```ts
setActivePlanet(planetId);
navigate('/');
```

`Overview.tsx` affiche automatiquement `<ColonizationProgress />` quand la planète active est en cours de colonisation (`apps/web/src/pages/Overview.tsx:343-353`).

**Changement :**
- Remplacer le `<Link to={/colonization/${planetId}}>` par un `<button onClick={...}>` qui fait `setActivePlanet(planetId); navigate('/')`.
- Conserver le styling cyan souligné actuel.
- Conserver la condition `{planetId && ...}`.
- Ajouter les imports `useNavigate` (react-router) et `usePlanetStore`.

### 2. Remplacement de l'encart difficulté

**Supprimer :**
- Le composant local `Star` et sa variable `difficulty`.
- Le bloc `<div className="glass-card p-4">` des lignes 97-110.

**Ajouter : un encart unique « Monde découvert »** composé de trois sous-blocs dans cet ordre :

#### a) Type de monde
- En-tête de l'encart : nom du type (`gameConfig.planetTypes.find(t => t.id === planetClassId)?.name`).
- Miniature `<PlanetVisual planetClassId={planetClassId} size={48} variant="thumb" />` à gauche du nom.
- Si la planète n'est pas encore dans `trpc.planet.list` (cas rare juste après colonisation), fallback sur le texte « Nouveau monde » sans visuel.

#### b) Bonus du type de monde
- Les types de monde exposent des multiplicateurs plats : `mineraiBonus`, `siliciumBonus`, `hydrogeneBonus` (1.0 = neutre), définis dans `packages/db/src/seed-game-config.ts:174-181` et consommés tel quel dans `apps/web/src/components/overview/OverviewHero.tsx:82-86`.
- Conversion en pourcentage : `(bonus - 1) × 100`, affiché uniquement si `bonus !== 1`.
- Format : `+20% Minerai` (vert si > 1), `-30% Hydrogène` (rouge si < 1), côte à côte en ligne.
- Si les trois bonus valent 1.0 (type tempéré / homeworld) : sous-bloc masqué.

#### c) Biomes connus
- Titre : « Biomes identifiés ».
- Source : `trpc.galaxy.system.useQuery({ galaxy, system })` puis `slots[position - 1].biomes` (voir `ExploreReportDetail.tsx:180-202`).
- Rendu : réutilise la carte biome (bordure gauche colorée par rareté + badge rareté + effets) de `ExploreReportDetail.tsx:322-371`.
- Si aucun biome connu : placeholder discret *« Planète non explorée — lancez une mission d'exploration pour cartographier ses biomes. »*

### 3. Extraction de code partagé

Pour éviter la duplication entre `ExploreReportDetail` et `ColonizeReportDetail` :

- **Nouveau fichier** `apps/web/src/lib/biome-display.ts` :
  - Exporte `RARITY_COLORS`, `RARITY_LABELS`, `STAT_LABELS` (actuellement dans `ExploreReportDetail.tsx:47-71`).
- **Nouveau composant** `apps/web/src/components/reports/shared/BiomeCard.tsx` :
  - Props : `{ biome: BiomeDiscovery; gameConfig: any }`.
  - Rendu identique au bloc `ExploreReportDetail.tsx:332-369`.
- Mise à jour de `ExploreReportDetail.tsx` pour consommer ces modules (pas de régression visuelle attendue).

## Hors-scope

- Pas de refonte du `ReportHero`.
- Pas de changement sur les branches `asteroid_belt` et `occupied` du même fichier.
- Pas de création de route `/colonization/:planetId`.
- Pas de changement backend (toutes les données sont déjà exposées via `trpc.planet.list`, `trpc.galaxy.system`, `useGameConfig`).
- Pas d'ajustement des autres rapports (`ColonizeReinforceReportDetail`, `ColonizationRaidReportDetail`).

## Critères d'acceptation

1. Cliquer sur « Suivre l'avancement » depuis un rapport de colonisation réussie ouvre l'écran `ColonizationProgress` (pas 404).
2. L'encart « Difficulté du monde » / étoiles n'apparaît plus.
3. Un nouvel encart affiche le type de monde + ses bonus + les biomes connus (ou le placeholder d'exploration si 0 biome).
4. L'affichage visuel des cartes biome dans le rapport d'exploration est inchangé après l'extraction.
5. Aucune erreur TypeScript, aucun warning de build.

## Fichiers touchés

- `apps/web/src/components/reports/ColonizeReportDetail.tsx` (modifié — branche `success` uniquement)
- `apps/web/src/components/reports/ExploreReportDetail.tsx` (modifié — consomme l'extraction)
- `apps/web/src/lib/biome-display.ts` (nouveau)
- `apps/web/src/components/reports/shared/BiomeCard.tsx` (nouveau)
