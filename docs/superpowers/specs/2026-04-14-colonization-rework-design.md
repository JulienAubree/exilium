# Colonization Rework — Design Spec

## Problem

Colonizing a planet is trivial: build a colony ship, click, wait for travel, done. There is no challenge, no decision-making, and no sense of achievement. The hard limit of 9 planets per player is an arbitrary gate with no gameplay behind it.

## Goals

- Make colonization a multi-step process that feels like building an outpost: travel, stabilize, secure.
- Replace the hard planet limit with a soft governance system (overextend = penalties, no ceiling).
- Create ongoing engagement during colonization through missions and events.
- Reward exploration without requiring it.

---

## 1. Centre de Pouvoir Impérial (building)

### Location

Homeworld only. Cannot be built on colonies.

### Governance capacity

`1 + building level` planets governed efficiently. Level 0 = homeworld only.

### Overextend

When the player owns more colonies than their governance capacity, **all colonies** (homeworld exempt) suffer penalties:

| Overextend | Resource harvest | Construction time |
|------------|-----------------|-------------------|
| +1         | −15%            | +15%              |
| +2         | −35%            | +35%              |
| +3         | −60%            | +60%              |

Percentages are configurable in `game_config.universe`. The penalty formula scales per step of overextend, not per planet.

### No hard planet limit

There is no maximum number of planets. The overextend penalty is the only constraint. A player can colonize 15 planets with a level-3 building — their empire will crawl, but they can do it.

### Empire view indicator

The Empire page shows a governance indicator: "Gouvernance 3/4" (green) or "Gouvernance 5/3" (red) with the active penalty displayed.

### Migration

Existing players receive the building at `(colony count − 1)` so they have zero overextend.

---

## 2. Colonization process

### Prerequisites

- A colony ship available on any planet.
- No exploration required. However, biomes on the new planet are only active for biomes the player has already discovered at that position. Unexplored = all biomes inactive (zero bonus).

### Phase 1 — Travel (unchanged)

The player sends a colony ship via the "Coloniser" mission. Standard fleet travel.

### Phase 2 — Arrival

On arrival:

1. The fleet event completes.
2. A new planet is created with status `colonizing`. It appears in the player's empire and planet selector, but the Overview page is replaced by the Colonization page.
3. Cargo resources are transferred to the new planet.
4. A `colonization_process` row is created (new table) with `progress = 0`, linked to the planet and the colony ship.
5. Biomes are generated; only previously-discovered biomes are marked active.
6. A colonization worker begins ticking (events, passive progress).

### Phase 3 — Stabilization

**Progress bar:** 0% → 100%.

**Passive progression:** Base rate ~10%/hour, reduced by difficulty factor. Difficulty is derived from:

- Distance from homeworld (system hops)
- Planet type: temperate = easy (×1.0), arid/glacial = medium (×0.7), volcanic/gaseous = hard (×0.5)

Estimated time for an active player:

| Difficulty | Passive only | With missions |
|------------|-------------|---------------|
| Easy       | ~10h        | ~5-6h         |
| Medium     | ~14h        | ~8-10h        |
| Hard       | ~20h        | ~12-14h       |

**Completion (100%):** Planet status changes from `colonizing` to `active`. The colony ship is consumed. The Colonization page gives way to the normal Overview. Notification sent.

**Failure (0%):** The colonization process is deleted. The planet is deleted. The colony ship returns to the homeworld via a standard return fleet. Notification sent.

---

## 3. Missions and events

### Missions (player-initiated)

**Fleet missions (sent from another planet):**

| Mission | Cost | Effect |
|---------|------|--------|
| Ravitaillement | Resources via transport ships | +15-20% progress |
| Renfort militaire | Combat ships sent | +10-15% progress |

These use the existing fleet system. A new mission type `colonize_supply` and `colonize_reinforce` target the colonizing planet. Ships return after delivery.

**Local action (on colonization page):**

| Action | Cost | Cooldown | Effect |
|--------|------|----------|--------|
| Consolider la colonie | Resources from planet cargo | 4h | +8-10% progress |

### Events (system-generated)

One event every ~2 hours (configurable). The player has 4–6 hours to react before the penalty applies.

| Event | Penalty if ignored | Resolved by |
|-------|-------------------|-------------|
| Raid hostile | −10-15% progress | Renfort militaire |
| Pénurie | −10-15% progress | Ravitaillement |

When an event is resolved within the deadline, the penalty is avoided and a small bonus is granted (+3-5% progress).

Events not resolved within the deadline apply their penalty automatically. If progress drops to 0%, the colonization fails immediately.

---

## 4. User interface

### Empire page

- Governance indicator in the KPI bar: "Gouvernance 3/4" with color coding (green = OK, orange = at capacity, red = overextend with penalty shown).
- Colonizations in progress appear as distinct cards showing the progress bar, time estimate, and pending events count.

### Galaxy view

- A position being colonized shows an intermediate visual state (not empty, not colonized — a "colonizing" marker).
- Clicking it shows the colonization status in the detail panel.

### Colonization page (replaces Overview for colonizing planets)

Displayed whenever the player selects a planet with status `colonizing`. Contains:

- **Progress bar** with current percentage and estimated completion time.
- **Active events** with countdown timer showing remaining reaction time and a button to resolve (links to fleet send or local action).
- **Action buttons:** "Ravitaillement", "Renfort militaire", "Consolider" (with cooldown indicator).
- **Event history:** Resolved and missed events with their impact.

### Notifications

- Push on new event: "Raid hostile sur votre colonie en cours !"
- Push on success: "Colonisation réussie !"
- Push on danger: "Votre colonie est en péril !" (below 25%)
- Push on failure: "Colonisation échouée, vaisseau en retrait."

---

## 5. Data model

### New table: `colonization_processes`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK |
| planetId | uuid | FK → planets.id |
| userId | uuid | FK → users.id |
| colonyShipEntryId | varchar | Reference to consumed colony ship |
| progress | real | 0.0 to 1.0 |
| difficultyFactor | real | 0.5 to 1.0, affects passive rate |
| basePassiveRate | real | Configurable, default 0.10 (10%/h) |
| status | enum | 'active', 'completed', 'failed' |
| startedAt | timestamp | When stabilization began |
| lastTickAt | timestamp | Last passive progress update |
| createdAt | timestamp | Row creation |

### New table: `colonization_events`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK |
| processId | uuid | FK → colonization_processes.id |
| eventType | enum | 'raid', 'shortage' |
| status | enum | 'pending', 'resolved', 'expired' |
| penalty | real | Progress penalty if expired (e.g. 0.12) |
| resolveBonus | real | Bonus if resolved (e.g. 0.04) |
| expiresAt | timestamp | Deadline to react |
| resolvedAt | timestamp | Null if not resolved |
| createdAt | timestamp | When event was generated |

### Modified table: `planets`

Add column `status` with enum `'active' | 'colonizing'`. Default `'active'`. All existing planets are `'active'`.

### New building: `imperialPowerCenter`

Added to game config `buildings` with:
- Homeworld only flag (new `homeworldOnly: true` field on building definition)
- Standard exponential cost curve (high-tier)
- Prerequisite: QG level (TBD during implementation balancing)

### Config keys (universe)

| Key | Default | Description |
|-----|---------|-------------|
| colonization_passive_rate | 0.10 | Base %/hour passive progress |
| colonization_event_interval_min | 7200 | Seconds between events |
| colonization_event_deadline_min | 14400 | Min seconds to react |
| colonization_event_deadline_max | 21600 | Max seconds to react |
| governance_penalty_harvest | [0.15, 0.35, 0.60] | Harvest penalty per overextend step |
| governance_penalty_construction | [0.15, 0.35, 0.60] | Construction time penalty per overextend step |

---

## 6. Backend architecture

### ColonizationService

New service in `apps/api/src/modules/colonization/`. Responsibilities:

- `startColonization(planetId, userId, colonyShipData)` — called by colonize handler on arrival.
- `tick(processId)` — advances passive progress, checks for 0%/100% thresholds.
- `generateEvent(processId)` — creates a new random event.
- `resolveEvent(eventId, userId, resolutionType)` — marks event resolved, applies bonus.
- `expireEvents(processId)` — applies penalty for overdue events.
- `getStatus(planetId)` — returns full colonization state for frontend.
- `cancel(processId)` — triggers failure/retreat.

### Colonization worker

A BullMQ repeatable job (or cron) that runs every few minutes:

1. For each active `colonization_process`:
   - Call `tick()` to advance passive progress.
   - Call `expireEvents()` for any past-deadline events.
   - If time since last event ≥ interval: call `generateEvent()`.
   - If progress ≥ 1.0: finalize colonization (planet → active, consume ship, notify).
   - If progress ≤ 0.0: fail colonization (delete planet, return ship, notify).

### Modified: colonize.handler.ts

On arrival, instead of creating a fully-formed planet:

1. Create planet with `status: 'colonizing'`.
2. Create `colonization_process` row.
3. Consume fleet event.
4. First event scheduled by the worker on next tick.

### Fleet mission types (new)

- `colonize_supply` — sends resources to a colonizing planet. On arrival: resolves pending 'shortage' event if any, boosts progress.
- `colonize_reinforce` — sends combat ships to a colonizing planet. On arrival: resolves pending 'raid' event if any, boosts progress.

---

## 7. Scope and phasing

This is a single deliverable. No phasing — all pieces are interdependent:

- The building gates governance.
- The colonization process requires the new data model.
- The missions require the process to exist.
- The UI requires all of the above.

Estimated implementation: significant. The writing-plans skill will decompose into ordered tasks.
