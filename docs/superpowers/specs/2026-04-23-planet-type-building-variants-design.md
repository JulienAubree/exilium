# Variantes d'illustrations bâtiments & défenses par type de planète

**Status:** Design validé, prêt pour planning
**Date:** 2026-04-23

## Objectif

Permettre d'afficher une illustration différente pour un même bâtiment ou une même défense en fonction du type de planète sur laquelle ils sont construits, afin de renforcer l'immersion visuelle. Une planète aride affichera des mines à l'aspect désertique, une planète volcanique montrera des forges incandescentes, etc.

## Périmètre

**Inclus :**
- Bâtiments (`buildingDefinitions`, 22 entrées actuellement)
- Défenses (`defenseDefinitions`, 5 entrées actuellement)
- 6 types de planètes existants : `volcanic`, `arid`, `temperate`, `glacial`, `gaseous`, `homeworld`

**Exclus :**
- Planètes elles-mêmes (déjà gérées via `/assets/planets/{planetClassId}/{imageIndex}...`)
- Ships, flagships, research : illustration unique par entité, pas de variation planétaire
- Génération procédurale d'illustrations : hors scope, l'admin uploade manuellement

## Principes de conception

- **Opt-in, fallback sur la base** : aucune obligation d'uploader les 6 variantes pour un bâtiment. Si une variante existe pour le type courant, on l'affiche. Sinon, on affiche l'illustration de base actuelle. Le joueur voit toujours une image.
- **Explicite** : le composant `GameImage` reçoit le `planetType` en prop. Pas de context magique, pas de résolution automatique depuis la donnée.
- **Déterministe** : la présence d'une variante est enregistrée en base dans un champ `variantPlanetTypes`, pas découverte par 404 au runtime. Zéro requête réseau parasite.

## Convention de stockage sur disque

En miroir du pattern déjà utilisé pour les planètes (`/assets/planets/{id}/...`) :

```
/assets/buildings/minerai-mine-icon.webp              ← base (inchangé)
/assets/buildings/minerai-mine-thumb.webp             ← base (inchangé)
/assets/buildings/minerai-mine.webp                   ← base (inchangé)

/assets/buildings/minerai-mine/volcanic-icon.webp     ← variante icon
/assets/buildings/minerai-mine/volcanic-thumb.webp    ← variante thumb
/assets/buildings/minerai-mine/volcanic.webp          ← variante full
/assets/buildings/minerai-mine/arid-icon.webp
…
```

Même schéma pour les défenses : `/assets/defenses/{defenseId}/{planetType}{size}.webp`.

**Rationale** : le sous-dossier par bâtiment regroupe ses variantes, évite la pollution du dossier racine (sinon 132 fichiers pour les bâtiments + 30 pour les défenses au max), et reste cohérent avec la convention `planets/`.

## Modèle de données

Deux migrations Drizzle, une colonne chacune :

```ts
// packages/db/src/schema/game-config.ts
export const buildingDefinitions = pgTable('building_definitions', {
  // … colonnes existantes
  variantPlanetTypes: jsonb('variant_planet_types').notNull().default([]),
});

export const defenseDefinitions = pgTable('defense_definitions', {
  // … colonnes existantes
  variantPlanetTypes: jsonb('variant_planet_types').notNull().default([]),
});
```

- Type logique : `string[]` — ids de `planetTypes` pour lesquels une variante a été uploadée.
- Choix du type `jsonb` (et pas `text[]`) pour cohérence avec `allowedPlanetTypes` déjà présent sur la même table.
- `default([])` : rétrocompatibilité, tous les bâtiments/défenses existants démarrent sans variante.

**Mise à jour** : l'upload ajoute l'id du type à l'array (idempotent via `Set`). Le delete le retire. Aucune autre écriture.

## API : endpoints d'upload

Extension du route file existant `apps/api/src/modules/admin/asset-upload.route.ts`.

### Upload variante

`POST /admin/upload-asset` — on étend l'endpoint existant avec un champ optionnel `planetType` dans le multipart.

- Si `planetType` absent → comportement actuel (illustration de base).
- Si `planetType` présent :
  - Valide que `category` est `buildings` ou `defenses` (sinon 400).
  - Valide que `planetType` existe dans la table `planet_types` (sinon 400).
  - Génère les 3 tailles (full/thumb/icon) via `processImage` avec chemin custom `{category}/{kebab(entityId)}/{planetType}`.
  - Met à jour `variantPlanetTypes` dans `buildingDefinitions` ou `defenseDefinitions` (ajoute l'id au set).

### Delete variante

`DELETE /admin/asset-variant/:category/:entityId/:planetType` — nouveau endpoint.

- Auth admin.
- Validation regex sur les 3 params (lettres, chiffres, `_`, `-` uniquement — anti path traversal).
- Supprime les 3 fichiers (`{planetType}.webp`, `{planetType}-thumb.webp`, `{planetType}-icon.webp`).
- Retire l'id du `variantPlanetTypes` en BD.
- Idempotent : un delete sur une variante inexistante retourne 404.

### Adaptation de `processImage`

Actuellement `processImage(buffer, category, entityId, assetsDir)` écrit dans `{category}/{kebab(entityId)}{size}.webp`. Pour les variantes, on écrit dans `{category}/{kebab(entityId)}/{planetType}{size}.webp`. Deux options :

1. **Nouvelle fonction dédiée** `processBuildingVariant(buffer, category, entityId, planetType, assetsDir)` — clair, découplé, pas de régression sur l'existant.
2. Surcharge de `processImage` avec paramètre optionnel `planetType`.

**Recommandation : option 1** pour isoler et faciliter les tests.

## Résolution côté frontend

### URL builder

`apps/web/src/lib/assets.ts` : nouvelle fonction dédiée et extension de l'existante.

```ts
export function getAssetUrl(
  category: AssetCategory,
  id: string,
  size: AssetSize = 'full',
  options?: { planetType?: string; hasVariant?: boolean },
): string {
  const slug = toKebab(id);
  const sfx = SUFFIX[size];
  if (options?.planetType && options.hasVariant && (category === 'buildings' || category === 'defenses')) {
    return `/assets/${category}/${slug}/${options.planetType}${sfx}.webp`;
  }
  return `/assets/${category}/${slug}${sfx}.webp`;
}
```

**Signature rétrocompatible** : les call sites existants qui ne passent pas `options` continuent à recevoir l'URL de base.

### Composant `GameImage`

`apps/web/src/components/common/GameImage.tsx` reçoit deux nouvelles props optionnelles :

```tsx
interface GameImageProps {
  category: AssetCategory;
  id: string;
  size?: AssetSize;
  alt: string;
  className?: string;
  planetType?: string;     // nouveau
  hasVariant?: boolean;    // nouveau (défaut false)
}
```

Elles sont passées telles quelles à `getAssetUrl`. Le fallback `onError` existant (initiale colorée) reste en place comme ultime filet.

### Enrichissement des données tRPC

Les endpoints tRPC qui retournent des bâtiments et défenses dans un contexte planétaire doivent inclure `variantPlanetTypes` dans leur DTO. La liste exhaustive dépend de l'audit des `select()` Drizzle existants — à identifier dans le plan d'implémentation. À minima :
- Endpoint qui retourne la liste des bâtiments d'une planète (vue « mes bâtiments »).
- Endpoint qui retourne la liste des défenses d'une planète (vue « mes défenses »).

Le calcul `hasVariant = variantPlanetTypes.includes(planetType)` se fait côté React au moment du render.

### Call sites à adapter

Composants qui affichent des bâtiments/défenses dans un contexte planète et doivent passer `planetType` + `hasVariant` :
- Vue liste des bâtiments d'une planète (empire, planète active).
- Vue liste des défenses d'une planète.
- Détail d'un bâtiment/défense avec le type de planète en contexte.

Les call sites **hors contexte planète** (catalogue global, arbre de recherche, menus, etc.) ne passent rien : ils restent sur l'illustration de base. Comportement actuel préservé.

## Admin UI

### Composant réutilisable

Nouveau composant `apps/admin/src/components/ui/PlanetTypeVariantsPanel.tsx` :

```tsx
interface PlanetTypeVariantsPanelProps {
  category: 'buildings' | 'defenses';
  entityId: string;
  entityName: string;
  variantPlanetTypes: string[];    // array actuel depuis la BD
  planetTypes: Array<{ id: string; name: string }>;
  onChange: () => void;            // pour rafraîchir la query parent
}
```

Rendu : accordéon « Variantes par type de planète » avec 6 slots (un par `planetType`). Chaque slot :
- Si variante présente (`id` dans `variantPlanetTypes`) → miniature cliquable + bouton « Supprimer ».
- Sinon → zone drag & drop qui réutilise la logique d'`AdminImageUpload` mais avec le champ `planetType` ajouté au multipart.

### Intégration

- `apps/admin/src/pages/Buildings.tsx` : on insère le panel sous l'`AdminImageUpload` principal dans la vue détail du bâtiment.
- `apps/admin/src/pages/Defenses.tsx` : idem.

Les pages existantes listent déjà les bâtiments/défenses et exposent `variantPlanetTypes` via les endpoints admin tRPC — il faut s'assurer que ces endpoints retournent bien la nouvelle colonne.

## Découpage en unités isolées

1. **DB / schema** — migration Drizzle pour `variantPlanetTypes` sur `buildingDefinitions` et `defenseDefinitions`.
2. **Image processing** — `processBuildingVariant` dans `apps/api/src/lib/image-processing.ts`.
3. **Endpoints API** — extension de `POST /admin/upload-asset` avec champ `planetType` + nouveau `DELETE /admin/asset-variant/:category/:entityId/:planetType`. Mise à jour de l'array `variantPlanetTypes` en BD.
4. **URL builder** — `apps/web/src/lib/assets.ts` + tests.
5. **GameImage** — nouvelles props `planetType` / `hasVariant`.
6. **DTO tRPC** — audit et enrichissement des endpoints qui retournent bâtiments/défenses pour inclure `variantPlanetTypes`.
7. **Call sites planète** — composants qui rendent des listes de bâtiments/défenses depuis une planète : passer `planetType` et `hasVariant` à `GameImage`.
8. **Admin UI** — `PlanetTypeVariantsPanel` + intégration dans `Buildings.tsx` et `Defenses.tsx`.

## Tests

- **URL builder** (`assets.ts`) : matrice `category` × `planetType fourni/absent` × `hasVariant true/false` × `size` — vérifier chemin correct et fallback.
- **`processBuildingVariant`** : écrit bien les 3 tailles au bon chemin, ne touche pas à la base existante.
- **Endpoint upload avec variante** : création + idempotence (ré-upload sur même variante n'ajoute pas de doublon dans `variantPlanetTypes`).
- **Endpoint delete variante** : supprime les 3 fichiers, retire du tableau BD, 404 si variante inexistante.
- **Validation** : path traversal bloqué, `planetType` inconnu refusé, catégorie invalide refusée.

## Ce qui ne change pas

- Aucune illustration existante n'est déplacée ou supprimée.
- Les catégories `ships`, `flagships`, `research`, `planets`, `avatars` ne sont pas touchées.
- Le composant de fallback (initiale colorée) de `GameImage` reste.
- La signature actuelle de `getAssetUrl` est rétrocompatible (options optionnel).

## Migration opérationnelle

- Aucune donnée à migrer : les colonnes `variantPlanetTypes` démarrent à `[]`, tous les bâtiments/défenses existants continuent d'afficher leur base.
- Déploiement sûr en un seul push : le jour de la release, aucun comportement utilisateur ne change tant qu'aucune variante n'a été uploadée.
- L'équipe commence ensuite à uploader progressivement les variantes via l'admin UI.
