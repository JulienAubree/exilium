# Flagship Hull System Design

## Summary

Add a hull selection step to flagship creation. The hull determines the flagship's specialization: combat bonuses, industrial capabilities (mine/recycle), or scientific tools (research speed + scan mission). The hull choice also sets the player's public playstyle and determines which illustration set is available.

## Hulls Overview

Three hulls, each with a passive bonus and an exclusive capability:

| | Combat | Industrial | Scientific |
|---|---|---|---|
| **Passive bonus** | +armor, +2 shots, +weapons, -20% combat ship build time | -20% industrial ship build time | -20% research time |
| **Exclusive ability** | None (raw power is the ability) | Flagship can join mine/recycle missions | Scan mission (ephemeral spy probe) |
| **Active condition** | Stationed on planet | Stationed (bonus) / In mission (mine/recycle) | Stationed (bonus + scan launch) |
| **Playstyle** | `warrior` | `miner` | `explorer` |

### Combat Hull

- **Passive (stationed):** +6 base armor, +2 shot count, +8 weapons, -20% build time for ships built via the Command Center
- All combat bonuses apply only when the flagship is stationed on the planet, same as existing `planet_bonus` talents

### Industrial Hull

- **Passive (stationed):** -20% build time for ships built via the Shipyard
- **Exclusive:** The flagship can participate in mine and recycle fleet missions. Without this hull, sending the flagship on mine/recycle missions is rejected by the fleet service

### Scientific Hull

- **Passive (stationed):** -20% research time on the planet where the flagship is stationed
- **Exclusive:** Scan mission (see dedicated section below)

## Scan Mission (Scientific Hull)

The flagship creates an ephemeral spy probe with +2 espionage bonus over standard probes. The probe is sent on a regular espionage mission and destroyed after completion regardless of outcome.

### Flow

1. Player selects a target planet from the flagship interface
2. System validates: flagship is stationed (`active`), hull is `scientific`, cooldown is expired
3. A spy mission is created using existing `SpyHandler` logic with modifications:
   - No probe consumed from player stock
   - Probe has +2 espionage stat bonus
   - Normal travel time applies
   - Probe is never recovered (destroyed after mission)
4. Player receives standard espionage report
5. Cooldown starts: **1 hour** (configurable in game-config)

### Technical details

- New mission type `scan` in fleet service, delegating to `SpyHandler` with overrides
- Cooldown managed via existing `flagship_cooldowns` table (same mechanism as talent `timed_buff`)
- The flagship itself does not move; only the ephemeral probe travels

## Data Model

### `flagships` table — new columns

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `hullId` | varchar(32) | nullable | Hull identifier: `combat`, `industrial`, `scientific` |
| `hullChangedAt` | timestamp | null | Last hull change timestamp |
| `hullChangeAvailableAt` | timestamp | null | Cooldown expiry for next hull change |
| `refitEndsAt` | timestamp | null | End of hull refit period (flagship unavailable until then) |

### Game config — new `hulls` block

Each hull is defined in the seed config:

```typescript
{
  id: 'combat',
  name: 'Coque de combat',
  description: 'Vaisseau taille pour la guerre.',
  playstyle: 'warrior',
  passiveBonuses: {
    combat_build_time_reduction: 0.20,
    bonus_armor: 6,
    bonus_shot_count: 2,
    bonus_weapons: 8,
  },
  abilities: [],
  changeCost: {
    baseMultiplier: 500, // per total Exilium earned
    resourceRatio: { minerai: 3, silicium: 2, hydrogene: 1 },
  },
  unavailabilitySeconds: 7200,  // 2h refit
  cooldownSeconds: 604800,      // 7 days
}
```

```typescript
{
  id: 'industrial',
  name: 'Coque industrielle',
  description: 'Vaisseau optimise pour l\'extraction et le recyclage.',
  playstyle: 'miner',
  passiveBonuses: {
    industrial_build_time_reduction: 0.20,
  },
  abilities: ['mine_mission', 'recycle_mission'],
  changeCost: {
    baseMultiplier: 500,
    resourceRatio: { minerai: 3, silicium: 2, hydrogene: 1 },
  },
  unavailabilitySeconds: 7200,
  cooldownSeconds: 604800,
}
```

```typescript
{
  id: 'scientific',
  name: 'Coque scientifique',
  description: 'Vaisseau oriente recherche et renseignement.',
  playstyle: 'explorer',
  passiveBonuses: {
    research_time_reduction: 0.20,
  },
  abilities: ['scan_mission'],
  changeCost: {
    baseMultiplier: 500,
    resourceRatio: { minerai: 3, silicium: 2, hydrogene: 1 },
  },
  unavailabilitySeconds: 7200,
  cooldownSeconds: 604800,
  scanCooldownSeconds: 3600, // 1h cooldown for scan mission
  scanEspionageBonus: 2,     // +2 espionage on ephemeral probe
}
```

## Creation Flow

The flagship creation modal (currently name + description only) becomes a single-screen with hull selection:

1. Player sees 3 hull cards side by side (name, description, bonuses, illustration preview)
2. Player selects a hull — selection highlights bonuses and associated playstyle
3. Player enters name (2-32 chars) and optional description (256 chars)
4. Submit: flagship is created with chosen `hullId`, random image from `/assets/flagships/{hullId}/`, and `users.playstyle` is updated automatically

### API changes

`flagship.create` input adds required `hullId: 'combat' | 'industrial' | 'scientific'`.

The service:
- Validates `hullId` exists in hull config
- Picks random image from `/assets/flagships/{hullId}/`
- Creates flagship with `hullId` set
- Updates `users.playstyle` to the hull's mapped playstyle

## Hull Change

### Conditions

- Flagship must be stationed (status `active`)
- Cooldown expired (`hullChangeAvailableAt < now` or `hullChangedAt === null` for first free change)
- Player has sufficient resources

### Cost

- Resource cost scales on `userExilium.totalEarned`
- Formula: `totalCost = totalEarned * baseMultiplier`. Distributed by ratio — with ratio `{minerai: 3, silicium: 2, hydrogene: 1}` (sum=6): minerai = totalCost * 3/6, silicium = totalCost * 2/6, hydrogene = totalCost * 1/6
- Example: player with 100 Exilium earned, baseMultiplier=500 → 50,000 total → 25,000 minerai, 16,667 silicium, 8,333 hydrogene
- First change for migrated players: free (detected by `hullChangedAt === null`)

### Process

1. Player selects new hull (same UI as creation, without naming fields)
2. Resources are deducted
3. Flagship status changes to `hull_refit` (new status value) for 2 hours
4. During refit: flagship cannot be sent on missions, passive bonuses do not apply
5. After refit completes:
   - `hullId` is updated
   - Random image assigned from new hull's image set
   - `users.playstyle` updated
   - `hullChangedAt` set to now
   - `hullChangeAvailableAt` set to now + 7 days
   - Flagship status returns to `active`

### Refit timer

Managed via a scheduled job (same pattern as `flagship.repairEndsAt`). A new field `refitEndsAt` on the flagships table, processed by a worker or checked on next access.

## Illustrations

### Directory structure

Replicate the planet type pattern:

```
/apps/web/public/assets/flagships/
  combat/
    1.webp, 1-thumb.webp, 1-icon.webp
    ...
  industrial/
    1.webp, 1-thumb.webp, 1-icon.webp
    ...
  scientific/
    1.webp, 1-thumb.webp, 1-icon.webp
    ...
```

### API changes

- `flagship-image.util.ts`: `listFlagshipImageIndexes(hullId, assetsDir)` scans `/assets/flagships/{hullId}/`
- `flagship.listImages(hullId)`: returns available indexes for a specific hull
- `flagship.updateImage(imageIndex)`: validates the index belongs to the flagship's current hull

### Frontend changes

- `getFlagshipImageUrl(hullId, imageIndex, size)` replaces `getFlagshipImageUrl(imageIndex, size)`
- Image picker modal filters by current hull
- On hull change: auto-assigned random image from new hull

### Migration of existing images

- Current images in `/assets/flagships/` move to `/assets/flagships/industrial/`
- `combat/` and `scientific/` directories start empty (assets needed before feature ships)

## Migration of Existing Players

- DB migration adds `hullId` column as nullable
- Data migration sets `hullId = 'industrial'` for all existing flagships (matches current illustration)
- `hullChangedAt` stays `null` — signals eligibility for one free hull change (no cost, no cooldown, but 2h refit still applies)
- `users.playstyle` is updated to `'miner'` for players with existing flagships (or left as-is if already set)
- The `playstyle` field on `updateProfile` becomes read-only (derived from hull)

## Impact on Existing Systems

### Combat (`flagship-stats.ts`)

- Apply hull combat bonuses (armor, shots, weapons) on top of talent bonuses when flagship is stationed
- Industrial and scientific hulls add no combat bonuses

### Fleet missions (`fleet.service.ts`)

- Mine/recycle mission validation: if flagship is in the fleet, verify `hullId === 'industrial'`. Reject with clear message otherwise.
- New `scan` mission type: verify `hullId === 'scientific'`, check cooldown, create ephemeral spy mission

### Research (research service)

- When calculating research time: if flagship is stationed on the planet AND `hullId === 'scientific'`, apply -20% reduction

### Ship construction (construction service)

- When calculating build time: if flagship is stationed on the planet:
  - `hullId === 'combat'` + building is Command Center: -20% build time
  - `hullId === 'industrial'` + building is Shipyard: -20% build time

### Profile (`user.service.ts`)

- `playstyle` is no longer editable via `updateProfile` — derived from `flagship.hullId`
- `updateProfile` input: remove `playstyle` from accepted fields
- Profile display: playstyle is read from user record as before (no API change for readers)

## Out of Scope

- New illustration assets for combat and scientific hulls (graphic assets needed)
- Hull-exclusive talents (decision: talents remain independent of hull)
- Additional hull types beyond the initial three
