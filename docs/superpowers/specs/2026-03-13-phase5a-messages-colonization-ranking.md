# Phase 5a : Messages, Colonisation, Classement — Design Spec

## Objectif

Ajouter le système de messagerie (messages système + joueur-à-joueur), la mission de colonisation fonctionnelle, et le classement des joueurs.

---

## 1. Messages

### Schema DB : `messages`

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid PK | Identifiant unique |
| senderId | uuid nullable FK→users | null pour messages système |
| recipientId | uuid FK→users | Destinataire |
| type | enum(`system`, `colonization`, `player`) | Type de message |
| subject | varchar(255) | Sujet |
| body | text | Corps du message |
| read | boolean default false | Lu/non-lu |
| createdAt | timestamp with timezone | Date de création |

Index sur `(recipientId, createdAt DESC)` pour la pagination.

### Service : `createMessageService(db)`

- `sendMessage(senderId, recipientUsername, subject, body)` — message joueur→joueur, résout le username en userId
- `createSystemMessage(recipientId, type, subject, body)` — message système (colonisation, etc.)
- `listMessages(userId, filters?)` — inbox paginée, filtrable par type et read
- `getMessage(userId, messageId)` — détail d'un message (vérifie ownership)
- `markAsRead(userId, messageId)` — marquer comme lu
- `deleteMessage(userId, messageId)` — supprimer un message
- `countUnread(userId)` — nombre de messages non lus (pour badge sidebar)

### Router : `createMessageRouter(messageService)`

| Procédure | Type | Input | Description |
|-----------|------|-------|-------------|
| inbox | query | `{ page?, limit?, type?, unreadOnly? }` | Liste paginée |
| detail | query | `{ messageId }` | Détail message |
| send | mutation | `{ recipientUsername, subject, body }` | Envoi joueur→joueur |
| markAsRead | mutation | `{ messageId }` | Marquer lu |
| delete | mutation | `{ messageId }` | Supprimer |
| unreadCount | query | — | Nombre non lus |

### Frontend : page Messages

- Liste : sujet, expéditeur (ou "Système"), date relative, badge non-lu
- Vue détail dans un panneau à droite ou en expansion
- Formulaire d'envoi : champ destinataire (username), sujet, corps texte
- Filtre par type (Tous / Système / Joueur) et par statut (Tous / Non lus)
- Badge non-lu dans la sidebar sur le lien Messages

---

## 2. Colonisation

### Game Engine : `generateColonyProperties(position)`

Fichier : `packages/game-engine/src/formulas/colonization.ts`

- **Diamètre** : aléatoire, influencé par la position. Positions centrales (4-9) ont des diamètres plus grands, positions extrêmes (1-3, 13-15) plus petits.
  - Base : `8000 + random(-2000, 5000)` pour positions 4-9
  - Base : `7000 + random(-1500, 3000)` pour positions 1-3 et 13-15
  - Base : `7500 + random(-1500, 4000)` pour positions 10-12
- **Température max** : basée sur la position, `220 - position * 20 + random(-20, 20)`
- **Température min** : `tempMax - 40`
- **Max fields** : `floor((diameter / 1000)²)`

Export : `{ diameter, maxFields, tempMin, tempMax }`

Tests : vérifier les bornes par position, que maxFields suit la formule.

### Handler fleet.service : mission `colonize`

Quand un fleet event `colonize` arrive (dans `processArrival`) :

1. Vérifier que la position cible est **libre** (pas de planète existante)
2. Vérifier que le joueur a **< 9 planètes**
3. Si OK :
   - Générer les propriétés aléatoires avec `generateColonyProperties(position)`
   - Créer la planète en DB (avec ressources de départ identiques à la planète mère initiale)
   - Créer les rows `planetShips` et `planetDefenses` associées
   - Le vaisseau de colonisation est **consommé** (pas de retour)
   - Les autres vaisseaux de la flotte retournent à l'origine (avec le cargo restant)
   - Envoyer un message système type `colonization` : "Colonisation réussie sur [g:s:p]"
4. Si position occupée :
   - La flotte entière (y compris le vaisseau de colo) **retourne** à l'origine
   - Message système : "Colonisation échouée — position [g:s:p] déjà occupée"
5. Si limite 9 planètes atteinte :
   - La flotte entière **retourne** à l'origine
   - Message système : "Colonisation échouée — nombre maximum de planètes atteint"

### Dépendances

- `messageService.createSystemMessage()` est appelé par le handler de colonisation
- Le `fleetService` a besoin d'une référence au `messageService`

---

## 3. Classement

### Schema DB : `rankings`

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid PK | Identifiant unique |
| userId | uuid unique FK→users | Joueur |
| totalPoints | integer default 0 | Score total |
| rank | integer default 0 | Classement |
| calculatedAt | timestamp with timezone | Dernière mise à jour |

Index sur `rank` pour le tri.

### Calcul des points

Fichier game-engine : `packages/game-engine/src/formulas/ranking.ts`

Formule : `points = floor((metal + crystal + deuterium) / 1000)`

On somme le coût cumulé de :
- **Bâtiments** : pour chaque bâtiment de niveau N, somme des coûts des niveaux 1 à N (coût exponentiel `base * factor^level`)
- **Recherches** : même principe (coût exponentiel, somme de 1 à N)
- **Vaisseaux** : quantité × coût unitaire fixe
- **Défenses** : quantité × coût unitaire fixe

Fonctions exportées :
- `calculateBuildingPoints(buildingLevels)` — prend un objet `{ metalMineLevel, crystalMineLevel, ... }` et retourne les points
- `calculateResearchPoints(researchLevels)` — prend un objet `{ espionageTech, ... }` et retourne les points
- `calculateFleetPoints(shipCounts)` — prend un objet `{ smallCargo, ... }` et retourne les points
- `calculateDefensePoints(defenseCounts)` — prend un objet `{ rocketLauncher, ... }` et retourne les points
- `calculateTotalPoints(building, research, fleet, defense)` — somme

Tests : valeurs manuelles pour quelques cas connus.

### Service : `createRankingService(db)`

- `recalculateAll()` — scan tous les joueurs, calcule les points, met à jour la table rankings, assigne les rangs (ORDER BY totalPoints DESC)
- `getRankings(page, limit)` — classement paginé
- `getPlayerRank(userId)` — rang d'un joueur spécifique

### Cron : toutes les 30 minutes

Dans `apps/api/src/workers/worker.ts`, ajouter un `setInterval` de 30 minutes qui appelle `rankingService.recalculateAll()`.

Alternativement, un fichier cron dédié `apps/api/src/cron/ranking-update.ts` avec la fonction, appelé depuis worker.ts.

### Router : `createRankingRouter(rankingService)`

| Procédure | Type | Input | Description |
|-----------|------|-------|-------------|
| list | query | `{ page?, limit? }` | Classement paginé |
| me | query | — | Mon rang |

### Frontend : page Classement

- Tableau : rang, joueur, points
- Pagination
- Highlight du joueur connecté dans la liste

---

## 4. Wiring

### app-router.ts

Ajouter :
- `messageService` + `messageRouter`
- `rankingService` + `rankingRouter`
- Passer `messageService` au `fleetService` pour les rapports de colonisation

### worker.ts

Ajouter :
- Cron ranking (30 min)

### event-catchup.ts

Pas de changement nécessaire — les fleet events sont déjà rattrapés.

### router.tsx (frontend)

Ajouter routes : `/messages`, `/ranking`

### Sidebar

Les liens Messages et Classement existent déjà dans la sidebar. Ajouter le badge non-lu sur Messages.

---

## 5. Fichiers à créer

| Fichier | Responsabilité |
|---------|---------------|
| `packages/game-engine/src/formulas/colonization.ts` | generateColonyProperties |
| `packages/game-engine/src/formulas/colonization.test.ts` | Tests colonisation |
| `packages/game-engine/src/formulas/ranking.ts` | Calcul de points |
| `packages/game-engine/src/formulas/ranking.test.ts` | Tests ranking |
| `packages/db/src/schema/messages.ts` | Schema messages |
| `packages/db/src/schema/rankings.ts` | Schema rankings |
| `apps/api/src/modules/message/message.service.ts` | Service messages |
| `apps/api/src/modules/message/message.router.ts` | Router messages |
| `apps/api/src/modules/ranking/ranking.service.ts` | Service classement |
| `apps/api/src/modules/ranking/ranking.router.ts` | Router classement |
| `apps/api/src/cron/ranking-update.ts` | Cron recalcul 30min |
| `apps/web/src/pages/Messages.tsx` | Page messages |
| `apps/web/src/pages/Ranking.tsx` | Page classement |

## 6. Fichiers à modifier

| Fichier | Modification |
|---------|-------------|
| `packages/game-engine/src/index.ts` | Exports colonization + ranking |
| `packages/db/src/schema/index.ts` | Exports messages + rankings |
| `apps/api/src/modules/fleet/fleet.service.ts` | Handler colonize (remplacer stub) |
| `apps/api/src/trpc/app-router.ts` | Wiring message + ranking services/routers |
| `apps/api/src/workers/worker.ts` | Cron ranking 30min |
| `apps/web/src/router.tsx` | Routes /messages, /ranking |
