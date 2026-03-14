# Phase 6c: Notifications temps réel

## Objectif

Pousser des événements serveur→client en temps réel via SSE (Server-Sent Events) pour notifier le joueur quand un message arrive ou qu'une construction/recherche/chantier se termine. Afficher un badge non-lu dans le TopBar et des toasts temporaires.

## Périmètre

### Événements poussés

| Type | Payload | Producteur |
|------|---------|------------|
| `new-message` | `{ messageId, type, subject, senderUsername }` | `message.service.ts` (sendMessage + createSystemMessage) |
| `building-done` | `{ planetId, buildingId, level }` | `building-completion.worker.ts` |
| `research-done` | `{ techId, level }` | `research-completion.worker.ts` |
| `shipyard-done` | `{ planetId, unitId, count }` | `shipyard-completion.worker.ts` |

### Hors périmètre

- Mouvements de flotte (déjà countdown côté client)
- Panneau de notifications historique (pas de persistence des notifications)
- WebSocket / bidirectionnel

## Architecture

### Transport : SSE

Endpoint Fastify `GET /sse?token=<jwt>`. SSE ne supporte pas les headers custom, le JWT est passé en query param.

Flux :
1. Client ouvre `EventSource('/sse?token=xxx')`
2. Serveur vérifie le JWT, extrait `userId`
3. Serveur crée un subscriber Redis dédié (nouvelle connexion ioredis)
4. S'abonne au channel `notifications:{userId}`
5. Forward chaque message Redis vers le client SSE : `data: {json}\n\n`
6. Heartbeat `:ping\n\n` toutes les 30s
7. Cleanup à la déconnexion : unsubscribe + close subscriber Redis

### Coordination : Redis Pub/Sub

Les producteurs publient via `publishNotification(redis, userId, event)`.

- Workers BullMQ : publient après chaque job réussi
- Message service : publie après chaque insert message
- Le serveur Fastify (process API) ne partage pas de mémoire avec le process worker — Redis Pub/Sub est le pont

### Schéma des flux

```
[Worker BullMQ] --publish--> [Redis channel notifications:{userId}]
[Message Service] --publish--> [Redis channel notifications:{userId}]

[Client EventSource] <--SSE-- [Fastify /sse] <--subscribe-- [Redis channel notifications:{userId}]
```

## Serveur

### Fichiers à créer

#### `apps/api/src/modules/notification/notification.publisher.ts`

Fonction utilitaire :

```typescript
import type Redis from 'ioredis';

export interface NotificationEvent {
  type: 'new-message' | 'building-done' | 'research-done' | 'shipyard-done';
  payload: Record<string, unknown>;
}

export function publishNotification(redis: Redis, userId: string, event: NotificationEvent) {
  return redis.publish(`notifications:${userId}`, JSON.stringify(event));
}
```

#### `apps/api/src/modules/notification/notification.sse.ts`

Route Fastify enregistrée dans `index.ts`. Reçoit une instance Redis (publisher) et crée un subscriber dédié par connexion.

```typescript
import type { FastifyInstance } from 'fastify';
import { jwtVerify } from 'jose';
import Redis from 'ioredis';

export function registerSSE(app: FastifyInstance, redisUrl: string, jwtSecret: Uint8Array) {
  app.get('/sse', async (req, reply) => {
    // 1. Auth via query param
    const token = (req.query as { token?: string }).token;
    if (!token) return reply.status(401).send({ error: 'Missing token' });

    let userId: string;
    try {
      const { payload } = await jwtVerify(token, jwtSecret);
      userId = payload.userId as string;
    } catch {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    // 2. Hijack response to prevent Fastify from closing it
    reply.hijack();

    // 3. SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    // 4. Subscriber Redis dédié
    const subscriber = new Redis(redisUrl);
    const channel = `notifications:${userId}`;
    await subscriber.subscribe(channel);

    subscriber.on('message', (_ch, message) => {
      reply.raw.write(`data: ${message}\n\n`);
    });

    // 5. Heartbeat
    const heartbeat = setInterval(() => {
      reply.raw.write(':ping\n\n');
    }, 30_000);

    // 6. Cleanup
    req.raw.on('close', () => {
      clearInterval(heartbeat);
      subscriber.unsubscribe(channel);
      subscriber.quit();
    });
  });
}
```

### Fichiers à modifier

#### `apps/api/src/index.ts`

- Importer `registerSSE` et `Redis` (ioredis)
- Créer le `jwtSecret` : `const JWT_SECRET = new TextEncoder().encode(env.JWT_SECRET)` (même pattern que `trpc/router.ts`)
- Créer une instance Redis publisher : `const redis = new Redis(env.REDIS_URL)`
- Appeler `registerSSE(server, env.REDIS_URL, JWT_SECRET)`
- Passer le Redis publisher à `buildAppRouter` : `buildAppRouter(db, redis)`

#### `apps/api/src/trpc/app-router.ts`

- `buildAppRouter(db, redis)` — accepter Redis en paramètre
- Passer Redis à `createMessageService(db, redis)`

#### `apps/api/src/modules/message/message.service.ts`

- `createMessageService(db, redis)` — accepter Redis
- Dans `sendMessage` : après l'insert, récupérer le username de l'expéditeur via une query `SELECT username FROM users WHERE id = senderId`, puis appeler `publishNotification(redis, recipient.id, { type: 'new-message', payload: { messageId: msg.id, type: 'player', subject, senderUsername } })`
- Dans `createSystemMessage` : appeler `publishNotification(redis, recipientId, { type: 'new-message', payload: { messageId: msg.id, type, subject, senderUsername: null } })`

#### Workers BullMQ (pattern commun aux 3 workers)

Chaque worker (`building-completion.worker.ts`, `research-completion.worker.ts`, `shipyard-completion.worker.ts`) suit le même pattern :

1. Importer `Redis` (ioredis), `publishNotification`, `buildQueue` (schema), `eq` (drizzle-orm)
2. Créer une instance Redis publisher dans la fonction `start*Worker` : `const redis = new Redis(env.REDIS_URL)`
3. Avant d'appeler la méthode `complete*`, query le `buildQueue` pour récupérer `userId` et `planetId` :
   ```typescript
   const [entry] = await db.select({ userId: buildQueue.userId, planetId: buildQueue.planetId })
     .from(buildQueue).where(eq(buildQueue.id, buildQueueId)).limit(1);
   ```
4. Après le `complete*` réussi, publier la notification avec `entry.userId`

**Par worker :**

- `building-completion.worker.ts` : publier `{ type: 'building-done', payload: { planetId: entry.planetId, buildingId: result.buildingId, level: result.newLevel } }`
- `research-completion.worker.ts` : publier `{ type: 'research-done', payload: { techId: result.researchId, level: result.newLevel } }`
- `shipyard-completion.worker.ts` : publier `{ type: 'shipyard-done', payload: { planetId: entry.planetId, unitId: result.itemId, count: result.totalCompleted } }` — **uniquement quand `result.completed === true`** (toutes les unités du batch terminées)

## Client

### Fichiers à créer

#### `apps/web/src/hooks/useSSE.ts`

Hook qui ouvre un EventSource et dispatch les événements :

```typescript
import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/auth.store';

type SSEHandler = (event: { type: string; payload: Record<string, unknown> }) => void;

export function useSSE(onEvent: SSEHandler) {
  const token = useAuthStore((s) => s.accessToken);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!token) return;

    const es = new EventSource(`/sse?token=${token}`);

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        onEventRef.current(data);
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => {
      // EventSource reconnecte automatiquement
    };

    return () => es.close();
  }, [token]);
}
```

#### `apps/web/src/hooks/useNotifications.ts`

Consomme `useSSE`, invalide les queries tRPC, et affiche les toasts :

```typescript
import { useSSE } from './useSSE';
import { trpc } from '@/trpc';
import { useToastStore } from '@/stores/toast.store';

export function useNotifications() {
  const utils = trpc.useUtils();
  const addToast = useToastStore((s) => s.addToast);

  useSSE((event) => {
    switch (event.type) {
      case 'new-message':
        utils.message.inbox.invalidate();
        utils.message.unreadCount.invalidate();
        addToast(`Nouveau message : ${event.payload.subject}`);
        break;
      case 'building-done':
        utils.building.list.invalidate();
        utils.resource.production.invalidate();
        addToast(`Construction terminée : ${event.payload.buildingId} niv. ${event.payload.level}`);
        break;
      case 'research-done':
        utils.research.list.invalidate();
        addToast(`Recherche terminée : ${event.payload.techId} niv. ${event.payload.level}`);
        break;
      case 'shipyard-done':
        utils.shipyard.queue.invalidate();
        utils.shipyard.list.invalidate();
        addToast(`Chantier terminé : ${event.payload.unitId} (x${event.payload.count})`);
        break;
    }
  });
}
```

#### `apps/web/src/stores/toast.store.ts`

Store Zustand minimaliste pour gérer les toasts :

```typescript
import { create } from 'zustand';

interface Toast { id: string; message: string; }

interface ToastState {
  toasts: Toast[];
  addToast: (message: string) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message) => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, message }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 5000);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
```

#### `apps/web/src/components/ui/Toaster.tsx`

Composant rendu de la liste de toasts, positionné en bas à droite :

```tsx
import { useToastStore } from '@/stores/toast.store';

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map((t) => (
        <div key={t.id} className="...styles..." onClick={() => removeToast(t.id)}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
```

### Fichiers à modifier

#### `apps/web/src/components/layout/TopBar.tsx`

- Ajouter un `trpc.message.unreadCount.useQuery()` (pas besoin de refetchInterval car invalidé en temps réel)
- Ajouter une icône cloche avec badge avant le bouton Déconnexion
- Clic sur la cloche → `navigate('/messages')` (via `useNavigate` de react-router)

#### `apps/web/src/components/layout/Layout.tsx`

- Importer et appeler `useNotifications()` pour activer le SSE
- Importer et rendre `<Toaster />` dans le layout

#### `apps/web/vite.config.ts`

- Ajouter proxy SSE : `'/sse': 'http://localhost:3000'`

## Points d'attention

1. **JWT en query param** : le token est visible dans les logs serveur. Acceptable pour du dev, en prod on utiliserait un token SSE court-durée dédié. Hors périmètre pour l'instant.

2. **Subscriber Redis par connexion** : chaque client SSE crée sa propre connexion Redis subscriber. Pour un petit nombre de joueurs (MVP), c'est acceptable. Pour scaler, on pourrait multiplexer les subscriptions dans un seul subscriber.

3. **Reconnexion EventSource** : native dans le navigateur. Le serveur n'a rien à gérer.

4. **Workers et Redis** : les workers ont déjà une connexion Redis (BullMQ). On crée une instance Redis supplémentaire pour le pub/sub dans chaque worker (BullMQ ne partage pas ses connexions pour le pub/sub).

5. **Invalidation queries** : les toasts sont un feedback visuel, l'invalidation tRPC est le vrai mécanisme — les données se mettent à jour automatiquement sur la page active.

6. **Proxy Vite** : il faut ajouter `/sse` au proxy Vite pour le dev local.
