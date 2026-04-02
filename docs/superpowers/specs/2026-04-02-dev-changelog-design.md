# Journal de developpement — Changelog joueurs

## Contexte

Les joueurs veulent suivre les nouveautes du jeu au quotidien. Un changelog automatique est genere chaque jour a 7h depuis les commits git, editable par l'admin avant publication.

## Schema DB

Table `changelogs` :
- `id` : UUID, PK
- `date` : date, unique (un seul changelog par jour)
- `title` : varchar(256), ex: "Nouveautes du 2 avril 2026"
- `content` : text (markdown)
- `published` : boolean, default false
- `createdAt` : timestamp
- `updatedAt` : timestamp

## Backend

### Route admin : generation automatique

`POST /api/admin/changelog/generate` (protegee admin) :
1. Execute `git log --oneline --since="24 hours ago" --no-merges` via `child_process.execSync`
2. Parse les commits par prefixe (feat, fix, refactor, etc.)
3. Genere un markdown structure avec categories
4. Upsert dans `changelogs` (si entree du jour existe, met a jour le contenu)
5. Cree avec `published: false` (brouillon a valider)

### CRUD admin

- `GET /api/admin/changelog/list` — toutes les entrees, triees par date desc
- `PUT /api/admin/changelog/:id` — editer titre, contenu, published
- `DELETE /api/admin/changelog/:id`

### Route publique joueur

- `GET /api/changelog/list` — entrees `published: true` uniquement, triees par date desc, paginee (20 par page)

### Cron

Crontab systeme sur le serveur :
```
0 7 * * * curl -s -X POST -H "Authorization: Bearer ADMIN_TOKEN" http://localhost:PORT/trpc/admin.changelog.generate
```

## Frontend joueur

Page `/changelog` :
- Liste des entrees publiees
- Chaque entree : titre, date formatee, contenu markdown rendu
- Style glass-card coherent avec le jeu
- Scroll infini ou pagination simple

## Frontend admin

Page admin avec :
- Liste des changelogs (date, titre, status published/brouillon)
- Formulaire d'edition : titre (input), contenu (textarea), toggle published
- Bouton "Generer maintenant" qui appelle la route generate

## Sidebar

Nouvelle section "Developpement" dans la sidebar, positionnee apres "Communaute" :
- "Nouveautes" → `/changelog`
- "Feedback" → `/feedback` (deplace depuis "Communaute")

## Pas de changement

- Le systeme de feedback existant ne change pas, juste son emplacement dans la sidebar
- Pas de notifications pour les nouveaux changelogs (YAGNI)
