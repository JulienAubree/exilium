# Game Events, Notifications & History

**Date:** 2026-03-16
**Status:** Approved

## Summary

Add a persistent game event system that powers browser notifications, an in-app notification center (bell icon), recent events on the Overview page, and a full event history page. Events are persisted in a single `game_events` table with 30-day retention.

## Requirements

- Browser notifications (Notification API) when an action completes and the tab is not focused
- Dynamic document title showing unread count: `(N) Exilium`
- Bell icon dropdown showing 10 most recent events, with unread styling
- Mark all as read when opening the dropdown
- Overview page shows 10 most recent events for the active planet
- History page (`/history`) with paginated, filterable event log
- 30-day retention with daily cleanup cron

## Event Types

| Type | Trigger | planetId | Payload |
|------|---------|----------|---------|
| `building-done` | Building completion worker | origin planet | `{ buildingId, level, planetName }` |
| `research-done` | Research completion worker | research lab planet | `{ techId, level, planetName }` |
| `shipyard-done` | Shipyard completion worker | origin planet | `{ unitId, count, planetName }` |
| `fleet-arrived` | Fleet arrival worker | origin planet | `{ mission, originName, targetCoords, ships, cargo }` |
| `fleet-returned` | Fleet return worker | origin planet | `{ mission, originName, targetCoords, ships, cargo }` |

**Notes:**
- `planetId` for fleet events refers to the fleet owner's origin planet (events are player-scoped, not destination-scoped).
- `research-done` stores the `planetId` of the planet where the research lab is located, so it appears on that planet's Overview.
- Workers must fetch `planet.name` (via JOIN or separate query) to populate `planetName` in payloads.

## Data Model

```sql
CREATE TABLE game_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  planet_id   UUID REFERENCES planets(id) ON DELETE SET NULL,
  type        TEXT NOT NULL,  -- 'building-done' | 'research-done' | 'shipyard-done' | 'fleet-arrived' | 'fleet-returned'
  payload     JSONB NOT NULL DEFAULT '{}',
  read        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_game_events_user_read_date ON game_events (user_id, read, created_at DESC);
CREATE INDEX idx_game_events_planet_date ON game_events (planet_id, created_at DESC);
```

Uses `uuid` for all IDs and `TIMESTAMP WITH TIME ZONE`, consistent with the existing Drizzle schema conventions.

- `ON DELETE SET NULL` on planetId so events survive planet deletion.

### TypeScript payload types

The `type` discriminator lives in the DB column `game_events.type`, not in the payload JSON. Payload shapes per type:

```typescript
// Payload shapes (type discriminator is the DB column, not in the JSON)
type BuildingDonePayload = { buildingId: string; level: number; planetName: string }
type ResearchDonePayload = { techId: string; level: number; planetName: string }
type ShipyardDonePayload = { unitId: string; count: number; planetName: string }
type FleetPayload = { mission: string; originName: string; targetCoords: string; ships: Record<string, number>; cargo: { minerai: number; silicium: number; hydrogene: number } }

// Discriminated union at the row level
type GameEvent =
  | { type: 'building-done'; payload: BuildingDonePayload }
  | { type: 'research-done'; payload: ResearchDonePayload }
  | { type: 'shipyard-done'; payload: ShipyardDonePayload }
  | { type: 'fleet-arrived'; payload: FleetPayload }
  | { type: 'fleet-returned'; payload: FleetPayload }
```

## Backend

### Workers (modified)

Each worker inserts a `game_events` row at completion, in addition to the existing `publishNotification` SSE call:

- **building-completion.worker.ts** — insert `building-done`
- **research-completion.worker.ts** — insert `research-done`
- **shipyard-completion.worker.ts** — insert `shipyard-done`
- **fleet-arrival.worker.ts** — insert `fleet-arrived` + add missing `publishNotification` call
- **fleet-return.worker.ts** — insert `fleet-returned` + add missing `publishNotification` call

### New tRPC module: `gameEvent`

| Procedure | Auth | Input | Output | Description |
|-----------|------|-------|--------|-------------|
| `getRecent` | protected | — | `GameEvent[]` (max 10) | 10 most recent events for the user, ordered by `createdAt DESC` |
| `getUnreadCount` | protected | — | `{ count: number }` | Count of unread events for the user |
| `markAllRead` | protected | — | `{ updated: number }` | Set `read = true` for all unread events of the user |
| `getByPlanet` | protected | `{ planetId }` | `GameEvent[]` (max 10) | 10 most recent events for a specific planet |
| `getHistory` | protected | `{ cursor?, limit?, types? }` | `{ events: GameEvent[], nextCursor? }` | Cursor-based pagination, optional type filter |

### SSE

Extend `NotificationEvent.type` in `notification.publisher.ts` to include `'fleet-arrived' | 'fleet-returned'`. Update `useNotifications.ts` to handle these new event types (cache invalidation for fleet queries, toast display).

Workers continue publishing ephemeral events via Redis for real-time toasts. The DB provides persistence.

### Fleet service enrichment

`fleetService.processArrival()` and `fleetService.processReturn()` return values must be enriched to include `userId`, `originPlanetId`, `originName`, `targetCoords`, `ships`, and `cargo` so the fleet workers can build both the DB insert payload and the SSE notification.

### Cron job: `cron/event-cleanup.ts`

- Runs once per day (`setInterval` with `24 * 60 * 60_000` in `worker.ts`)
- `DELETE FROM game_events WHERE created_at < now() - interval '30 days'`
- Registered in `worker.ts` alongside existing crons

## Frontend

### 1. Browser Notifications (`useNotifications.ts`)

- On first SSE event received, call `Notification.requestPermission()` once
- On subsequent events, if permission granted and `document.hidden === true`:
  - Show `new Notification(title, { body, icon })` with event-specific text
- In-app toast continues to display regardless

### 2. Dynamic Document Title (`useDocumentTitle` hook)

- Queries `gameEvent.getUnreadCount` (invalidated by SSE events)
- Updates `document.title`:
  - `count > 0` → `(${count}) Exilium`
  - `count === 0` → `Exilium`
- Called in `Layout.tsx`

### 3. Bell Icon Dropdown (TopBar)

Current bell only shows unread message count and links to `/messages`. Transform it into a game event notification center. A separate message icon (envelope) remains in the TopBar for quick access to `/messages` with its own unread badge.

- **Badge**: shows `gameEvent.getUnreadCount` (game events only, not messages)
- **Click**: opens a dropdown/sheet (not navigation)
- **Dropdown content**:
  - 10 most recent events via `gameEvent.getRecent`
  - Unread events: bold text / slightly colored background
  - Each row: type icon + descriptive text + relative time ("3min ago")
  - Clickable: navigates to relevant page (Buildings, Research, Shipyard, Fleet)
  - Footer: "Voir l'historique complet" link → `/history`
- **On open**: calls `gameEvent.markAllRead`, resets badge to 0

### 4. Overview — Recent Events Section

New section "Événements récents" after "Activités en cours":

- Shows 10 most recent events for the active planet via `gameEvent.getByPlanet`
- Same compact row format as the bell dropdown
- Empty state: "Aucun événement récent"

### 5. History Page (`/history`)

New page accessible from bell dropdown and navigation menu:

- Paginated list of all player events (cursor-based infinite scroll)
- Filter by event type (multi-select dropdown: buildings, research, shipyard, fleets)
- Each entry: type icon + description + planet name + datetime
- Mobile-first design consistent with existing pages
- Added to navigation (BottomTabBar "Plus" sheet on mobile, sidebar on desktop)

## Notification Text Templates

| Type | Title | Body |
|------|-------|------|
| `building-done` | Construction terminée | `${buildingName} niveau ${level} sur ${planetName}` |
| `research-done` | Recherche terminée | `${techName} niveau ${level}` |
| `shipyard-done` | Production terminée | `${count}x ${unitName} sur ${planetName}` |
| `fleet-arrived` | Flotte arrivée | `Mission ${mission} arrivée en ${targetCoords}` |
| `fleet-returned` | Flotte de retour | `Flotte rentrée sur ${originName}` |

## Out of Scope

- Web Push / Service Worker (offline notifications) — future enhancement
- Event types for actions initiated by the player (start construction, send fleet)
- Events for actions suffered (attack received, espionage) — will come with combat maturity
- Per-event read/unread management — all marked read at once on dropdown open
- Notification preferences / mute — future enhancement
