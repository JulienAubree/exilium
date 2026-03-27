# Admin Image Upload — Upload, conversion et classement automatique

## Contexte

Les illustrations du jeu (bâtiments, recherches, vaisseaux, défenses) doivent pouvoir être uploadées directement depuis le panneau d'admin. Actuellement, les images sont converties manuellement via un script CLI (`scripts/optimize-images.ts`). Cette spec ajoute un endpoint d'upload REST qui reçoit un PNG/JPG, le convertit en 3 tailles WebP, et le stocke dans le bon dossier.

## Décisions de design

| Question | Décision |
|----------|----------|
| Catégories couvertes | Toutes : buildings, research, ships, defenses |
| Endpoint API | REST `POST /admin/upload-asset` (multipart/form-data) |
| Conversion | sharp côté serveur, mêmes paramètres que le script existant |
| Stockage prod | Dossier uploads séparé (`/opt/exilium/uploads/assets/`), servi par Caddy |
| Stockage dev | `apps/web/public/assets/` (servi par Vite dev server) |
| UX admin | Colonne image dans les tableaux + composant `AdminImageUpload` |

## 1. Endpoint API — `POST /admin/upload-asset`

### Route

Endpoint REST Fastify (pas tRPC — les uploads binaires sont mieux gérés en multipart natif).

Enregistré dans `apps/api/src/index.ts` comme route Fastify classique.

### Input (multipart/form-data)

| Champ | Type | Description |
|-------|------|-------------|
| `file` | File | Image PNG, JPG ou WebP, max 10 MB |
| `category` | string | `buildings`, `research`, `ships` ou `defenses` |
| `entityId` | string | ID camelCase de l'entité (ex: `mineraiMine`) |

### Process

1. **Auth** : Extraire le JWT du header `Authorization: Bearer <token>`, vérifier le rôle admin. La route importe `db` depuis `packages/db` et `JWT_SECRET` depuis `./config/env.ts` (mêmes imports que `createAdminProcedure` dans `trpc/router.ts`). Décoder le JWT, chercher l'utilisateur en DB, vérifier `isAdmin`.
2. **Validation** :
   - `category` doit être une des 4 valeurs autorisées
   - `entityId` ne doit pas être vide
   - Le fichier doit être une image (`image/png`, `image/jpeg`, `image/webp`)
   - Taille < 10 MB
3. **Conversion** : Appeler `processImage(buffer, category, entityId)` qui :
   - Convertit `entityId` en kebab-case via `toKebab()`
   - Génère 3 fichiers WebP avec sharp :
     - `{kebab-id}.webp` — hero, 1200px de large, qualité 85
     - `{kebab-id}-thumb.webp` — thumb, 400px de large, qualité 80
     - `{kebab-id}-icon.webp` — icon, 64x64 crop centre, qualité 75
   - Écrit dans `{ASSETS_DIR}/{category}/`
   - Crée le sous-dossier si nécessaire
4. **Réponse** : `{ success: true, files: string[] }` (liste des noms de fichiers générés)

### Erreurs

| Code | Cas |
|------|-----|
| 401 | Pas de JWT ou pas admin |
| 400 | Catégorie invalide, entityId manquant, fichier manquant ou type invalide |
| 413 | Fichier > 10 MB |
| 500 | Erreur de conversion sharp |

### Variable d'environnement

`ASSETS_DIR` — chemin absolu vers le dossier d'assets.

Défaut (calculé dans `env.ts`) :
```ts
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Depuis apps/api/src/config/env.ts → ../../../../apps/web/public/assets
path.resolve(__dirname, '../../../../apps/web/public/assets')
```

Note : l'API est un module ESM (`"type": "module"`), donc `__dirname` n'existe pas nativement — il faut le reconstruire via `fileURLToPath(import.meta.url)`.

En prod : `ASSETS_DIR=/opt/exilium/uploads/assets`

## 2. Utilitaire de conversion d'images

### Fichier : `apps/api/src/lib/image-processing.ts`

Extraire la logique de conversion sharp du script `scripts/optimize-images.ts` dans un module réutilisable :

```ts
export async function processImage(
  buffer: Buffer,
  category: AssetCategory,
  entityId: string,
  assetsDir: string,
): Promise<string[]>
```

- Prend le buffer brut de l'image uploadée
- Retourne la liste des noms de fichiers générés
- Réutilise les mêmes paramètres de taille/qualité que le script existant
- Crée les sous-dossiers si nécessaire (`fs.mkdirSync({ recursive: true })`)

La fonction `toKebab` est dupliquée depuis `apps/web/src/lib/assets.ts` (petite fonction utilitaire, pas besoin d'un package partagé pour ça). Ajouter un commentaire `// Must match toKebab in apps/web/src/lib/assets.ts` pour signaler la source de vérité.

## 3. Composant admin — `AdminImageUpload`

### Fichier : `apps/admin/src/components/ui/AdminImageUpload.tsx`

### Props

```ts
interface AdminImageUploadProps {
  category: 'buildings' | 'research' | 'ships' | 'defenses';
  entityId: string;
  entityName: string;
}
```

### Comportement

1. **Affichage par défaut** : `<img>` de 48x48 chargé depuis `/assets/{category}/{kebab-id}-icon.webp`
   - Si l'image échoue (404) : placeholder dashed avec l'initiale de `entityName`
2. **Clic** : Ouvre un `<input type="file" accept="image/png,image/jpeg,image/webp" />` caché
3. **Pendant l'upload** :
   - Spinner/overlay sur le thumbnail
   - `fetch` POST vers `/admin/upload-asset` avec le FormData (file + category + entityId)
   - Header `Authorization: Bearer <token>` depuis le store auth
4. **Après succès** :
   - Recharger l'image avec un cache-bust (`?t={timestamp}`)
   - Toast de succès (optionnel, si le composant Toast est dispo dans l'admin)
5. **En cas d'erreur** : Afficher l'erreur (alert ou toast)

### Intégration dans les 4 pages admin

Chaque page (Buildings, Research, Ships, Defenses) ajoute une colonne "Image" dans son tableau HTML, utilisant `<AdminImageUpload category="buildings" entityId={row.id} entityName={row.name} />`.

La colonne est placée en première ou deuxième position pour être visible immédiatement.

## 4. Stockage & déploiement

### Dev

- `ASSETS_DIR` non défini → défaut vers `apps/web/public/assets`
- Vite dev server sert `public/` automatiquement
- Les images uploadées sont visibles immédiatement dans le jeu
- `apps/admin/vite.config.ts` doit proxy `/admin` vers `http://localhost:3000` (le proxy existant ne couvre que `/trpc`)

### Prod

- `ASSETS_DIR=/opt/exilium/uploads/assets` dans `.env`
- Le dossier est créé au premier upload (`mkdirSync recursive`)

### Caddy

#### `exilium-game.com`

Ajouter un block `route /assets/*` (pas `handle` — `route` exécute les directives dans l'ordre sans court-circuiter). Il sert d'abord depuis le dossier uploads, puis fallback vers le dossier dist (pour les images non encore re-uploadées) :

```
route /assets/* {
    @uploads file /opt/exilium/uploads{path}
    handle @uploads {
        root * /opt/exilium/uploads
        file_server
    }
    handle {
        root * /opt/exilium/current/apps/web/dist
        file_server
    }
}
```

Ce block doit être **avant** le fallback SPA. Il essaie d'abord le dossier uploads, puis le dossier dist build par Vite (où les images commitées dans `public/assets/` sont copiées au build).

#### `admin.exilium-game.com`

Ajouter un proxy `/admin/*` vers l'API (la route REST `POST /admin/upload-asset` n'est pas couverte par le proxy `/trpc/*` existant) :

```
handle /admin/* {
    reverse_proxy localhost:3000
}
```

Plus le même block `/assets/*` pour afficher les thumbnails dans l'admin.

### Deploy script

Modifier `scripts/deploy.sh` pour :
1. Créer `/opt/exilium/uploads/assets/{buildings,research,ships,defenses}` si inexistant
2. Si `uploads/assets/buildings/` est vide et `apps/web/public/assets/buildings/` contient des fichiers, copier les images existantes (migration one-shot)

### Dépendance sharp

`sharp` doit être ajouté comme dépendance de **production** dans `apps/api/package.json` (pas devDep, car l'API en a besoin au runtime pour la conversion).

## 5. Fichiers impactés

### Nouveaux fichiers

| Fichier | Description |
|---------|-------------|
| `apps/api/src/lib/image-processing.ts` | Utilitaire de conversion sharp (3 tailles WebP) |
| `apps/api/src/modules/admin/asset-upload.route.ts` | Route REST POST /admin/upload-asset |
| `apps/admin/src/components/ui/AdminImageUpload.tsx` | Composant d'upload d'image avec preview |

### Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| `apps/api/src/index.ts` | Enregistrer `@fastify/multipart` (avec `limits: { fileSize: 10 * 1024 * 1024 }`) + la route upload |
| `apps/api/package.json` | Ajouter `sharp` et `@fastify/multipart` |
| `apps/admin/src/pages/Buildings.tsx` | Ajouter colonne Image dans le tableau |
| `apps/admin/src/pages/Research.tsx` | Ajouter colonne Image dans le tableau |
| `apps/admin/src/pages/Ships.tsx` | Ajouter colonne Image dans le tableau |
| `apps/admin/src/pages/Defenses.tsx` | Ajouter colonne Image dans le tableau |
| `scripts/deploy.sh` | Créer dossier uploads, migration images |
| `Caddyfile` | Ajouter route /assets/* + proxy /admin/* sur admin subdomain |
| `apps/admin/vite.config.ts` | Ajouter proxy `/admin` → `http://localhost:3000` pour le dev |
| `apps/api/src/config/env.ts` | Ajouter `ASSETS_DIR` optionnel |

### Fichiers inchangés

- `apps/web/src/lib/assets.ts` — les URLs d'assets ne changent pas (`/assets/{category}/{id}.webp`)
- `apps/web/src/components/common/GameImage.tsx` — inchangé, fonctionne déjà
- `scripts/optimize-images.ts` — conservé pour usage CLI ponctuel

## 6. Vérification

1. **Upload en dev** : Uploader un PNG via l'admin, vérifier que 3 WebP apparaissent dans `apps/web/public/assets/{category}/`
2. **Affichage** : Le thumbnail se met à jour dans l'admin après upload. L'image est visible sur la page Buildings du jeu.
3. **Remplacement** : Uploader une nouvelle image pour la même entité → les fichiers sont écrasés, le nouveau thumbnail apparaît.
4. **Erreurs** : Tester avec un fichier non-image, un fichier > 10MB, sans auth → erreurs correctes.
5. **Prod** : Après deploy, vérifier que Caddy sert les images depuis `/opt/exilium/uploads/assets/`.
