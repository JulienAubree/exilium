# Notifications d'amitie — Design Spec

## Objectif

Ajouter des notifications temps reel (SSE + toast) et persistees (gameEvents) pour les actions d'amitie : reception d'une demande, acceptation, refus.

## Principes

- **Pas de nouvelle table** : enrichir le systeme `gameEvents` existant avec 3 nouveaux types
- **Meme pattern que les messages** : `publishNotification()` dans le service + insertion `gameEvents` + handler dans `useNotifications()`
- **Pas de nouveau routeur** : les events d'amitie sont des game events standards

---

## Backend

### Signature du friend service

`createFriendService(db)` devient `createFriendService(db, redis, gameEventService)` pour pouvoir publier des notifications SSE et persister les events. `redis` et `gameEventService` sont captures par closure dans la factory — ils ne sont pas passes a chaque methode.

**Changement dans `app-router.ts` :** `gameEventService` est deja instancie (ligne 69) mais **apres** `friendService` (ligne 65). L'ordre d'instanciation doit etre inverse : `gameEventService` avant `friendService`. Puis mettre a jour l'appel : `createFriendService(db, redis, gameEventService)`.

### Username de l'acteur

Le contexte tRPC (`ctx`) ne contient que `userId`, pas `username`. Le service doit resoudre le username lui-meme : chaque methode concernee (request, accept, decline) fait un `SELECT username FROM users WHERE id = actorId` avant d'envoyer la notification. Cela evite de modifier les signatures des methodes ou le contexte tRPC.

### Signatures des methodes

Les signatures existantes ne changent pas :
- `request(requesterId, addresseeId)` — le service query le username du requester
- `accept(friendshipId, userId)` — le service query le username de l'accepteur (= addressee)
- `decline(friendshipId, userId)` — le service query le username du refuseur (= addressee)

### Nouvelles notifications

| Action | Methode | Destinataire | Type SSE | Payload | gameEvent |
|--------|---------|-------------|----------|---------|-----------|
| Demande recue | `request()` | addresseeId | `friend-request` | `{ fromUserId, fromUsername }` | oui (planetId: null) |
| Demande acceptee | `accept()` | requesterId | `friend-accepted` | `{ fromUserId, fromUsername }` | oui (planetId: null) |
| Demande refusee | `decline()` | requesterId | `friend-declined` | `{ fromUserId, fromUsername }` | oui (planetId: null) |

Apres l'action DB existante, chaque methode ajoute :
1. `publishNotification(redis, destinataireId, { type, payload })`
2. `gameEventService.insert(destinataireId, null, type, payload)`

Pour `accept` et `decline`, le `requesterId` est deja connu via le `fs` query existant. Pour `request`, le `addresseeId` est un parametre existant.

### Type GameEventType

Ajouter les 3 types a l'union dans `game-event.service.ts` :

```ts
export type GameEventType = '...' | 'friend-request' | 'friend-accepted' | 'friend-declined';
```

---

## Frontend

### useNotifications()

Ajouter 3 cases dans le switch de `useNotifications()`. Note : l'invalidation existante de `gameEvent.unreadCount` / `gameEvent.recent` / `gameEvent.byPlanet` (lignes 52-56) couvre deja tous les types non-message, donc les 3 nouveaux types en beneficient automatiquement — pas besoin de les re-invalider.

```
case 'friend-request':
  utils.friend.pendingReceived.invalidate();
  addToast("X vous a envoye une demande d'ami");
  showBrowserNotification("Demande d'ami", "X vous a envoye une demande d'ami");
  break;

case 'friend-accepted':
  utils.friend.list.invalidate();
  utils.friend.pendingSent.invalidate();
  addToast("X a accepte votre demande d'ami");
  showBrowserNotification("Ami accepte", "X a accepte votre demande d'ami");
  break;

case 'friend-declined':
  utils.friend.pendingSent.invalidate();
  addToast("X a refuse votre demande d'ami");
  showBrowserNotification("Demande refusee", "X a refuse votre demande d'ami");
  break;
```

Ou `X` = `event.payload.fromUsername`.

### game-events.ts

Ajouter dans les fonctions utilitaires :

**`eventTypeColor()`** :
- `friend-request` → `bg-sky-500`
- `friend-accepted` → `bg-emerald-500`
- `friend-declined` → `bg-red-500`

**`formatEventText()`** :
- `friend-request` → `"Demande d'ami de {fromUsername}"`
- `friend-accepted` → `"{fromUsername} a accepte votre demande"`
- `friend-declined` → `"{fromUsername} a refuse votre demande"`

**`eventNavigationTarget()`** :
- `friend-request` → `"/profile"` (section demandes)
- `friend-accepted` → `"/player/{fromUserId}"` (la route `/player/:userId` existe deja dans le router React)
- `friend-declined` → `"/profile"`

---

## Hors perimetre

- Notification a la suppression d'un ami (`remove`) : pas de notification, action silencieuse
- Notification a l'annulation (`cancel`) : pas de notification, la demande disparait simplement
- Ajout des 3 types dans le filtre UI de l'historique des events (si un tel filtre existe) : a faire ulterieurement si necessaire
