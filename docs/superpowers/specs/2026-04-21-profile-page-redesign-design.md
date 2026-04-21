# Profile Page Redesign — Design Spec

**Date:** 2026-04-21
**Status:** approved for implementation
**Scope:** Unified redesign of `/profile` (own) and `/player/:userId` (other) into one visually richer, more welcoming page.

---

## Goal

Turn the current two-column form-style profile pages into a single cinematic page that celebrates the player — hero banner at top, narrative phrase, readable stats, clear social actions. Same layout for own and other views; only the editability and the action buttons differ.

## Non-goals

- No new profile data (achievements, playtime, activity status, stat sparklines) — deferred to a follow-up spec.
- No new alliance visuals beyond the existing `tag` field (no crest upload, no colors).
- No changes to the notification-preferences sub-page (it moves out of the profile entirely).
- No changes to friend/alliance/message backends beyond two tiny payload additions.

---

## Page structure

Single centered column (~720px max width), `glass-card` style matching the rest of the app. The page flows top-to-bottom in a narrative order.

```
┌─────────────────────────────────────────┐
│  HERO (cinematic passerelle)            │  ← always shown
│    starfield + distant planet           │
│    alliance monogram corner (if any)    │
│    avatar | captain line, name,         │
│             tagline, playstyle tag,     │
│             seekingAlliance tag         │
├─────────────────────────────────────────┤
│  STATS card (2×2 grid, icons)           │  ← hidden for others if visibility.stats=false
├─────────────────────────────────────────┤
│  BIO card                               │  ← hidden for others if visibility.bio=false
│    own: inline-editable                 │     own: always shown, even when empty
│    other: read-only                     │
├─────────────────────────────────────────┤
│  ALLIANCE card (if in alliance)         │  ← always shown when applicable
│    monogram + name + role               │
├─────────────────────────────────────────┤
│  SOCIAL card                            │  ← own and other show different content
│    own: friends grid + pending requests │
│    other: friend-action + message btn   │
├─────────────────────────────────────────┤
│  PREFERENCES card (own only)            │  ← own only
│    visibility toggles, seeking alliance,│
│    link → /settings/notifications       │
└─────────────────────────────────────────┘
```

## Hero

Cinematic "passerelle de commandement" treatment, ~180px tall.

**Layers (back-to-front):**
1. Base background: `linear-gradient(180deg, #020617 0%, #1e1b4b 100%)` with radial stars overlay (CSS gradients, no asset).
2. Distant planet: a 90×90 radial-gradient disc positioned top-right, offset partially off-canvas.
3. Alliance monogram (only if the player is in an alliance): shield-clipped badge top-right corner, 28×32px, showing the first 2–3 chars of `allianceTag`. Border + accent uses `#fbbf24` (amber).

**Content row:**
- **Left:** 90×90 circular avatar. Uses `/assets/avatars/{avatarId}.webp` if set, fallback to a gradient disc with the first 2 letters of the username. Ring: `2px solid rgba(148,163,184,0.4)`.
- **Right column (flex-1):**
  - Top accent line (10px, uppercase, tracking 0.2em, `#a5f3fc`): `"Capitaine · Rang {rank}"` — falls back to `"Capitaine"` if rank is null.
  - Name: 22px bold white.
  - Tagline (11px italic, `#94a3b8`): the first logical line of the bio, truncated to 90 chars. Falls back to `"Aux commandes depuis {fmt(createdAt)}"` (e.g. "mars 2025") if bio is empty or null. For other-player view where `visibility.bio = false`, the fallback is always used (bio is masked).
  - Tags row (flex gap 6px, each tag 10px rounded pill):
    - Playstyle: violet (`rgba(139,92,246,...)`) — only if `playstyle` is set. Hidden for others when `visibility.playstyle = false`.
    - Seeking alliance: emerald (`rgba(16,185,129,...)`) — only if `seekingAlliance === true`. Follows same visibility rule as playstyle.

**Edit mode (own only):** hovering the avatar reveals a small pencil SVG bottom-right of the avatar; clicking opens the existing `AvatarPicker` modal. No other edit affordance in the hero — name/playstyle aren't editable here (name is immutable, playstyle stays in preferences or a future edit surface).

**Component:** `ProfileHero.tsx`, props:
```ts
{
  username: string;
  avatarId: string | null;
  rank: number | null;
  bio: string | null;            // null if hidden or empty
  createdAt: Date | string;
  playstyle: 'miner' | 'warrior' | 'explorer' | null;
  seekingAlliance: boolean | null;
  allianceTag: string | null;     // null if not in alliance or hidden
  onEditAvatar?: () => void;      // only passed for own view
}
```

## Stats card

Grid: 2 columns on mobile, 4 columns ≥640px. Each cell is a centered vertical stack on a `bg-accent/50` rounded tile: 16×16 icon on top, value (`text-lg font-bold`) below, muted label (`text-xs text-muted-foreground`) at the bottom. Matches the existing stats pill style; only the icon on top is new.

| Stat       | Icon               | Value                                  | Muted label |
|------------|--------------------|----------------------------------------|-------------|
| Rank       | medal SVG (amber)  | `#{rank}` or `—` if null               | "Rang"      |
| Points     | crystal SVG (cyan) | `toLocaleString('fr-FR')` total points | "Points"    |
| Planets    | planet SVG (blue)  | integer                                | "Planètes"  |
| Alliance   | banner SVG (amber) | allianceName or `—`                    | "Alliance"  |

Each icon is a 16×16 inline SVG, same `currentColor`-driven style as the existing `ResourceIcons`. Text stays `text-foreground` on a `bg-accent/50` tile — keeps visual continuity with the current stats grid (nobody has to relearn where stats live).

**Visibility rule:** hidden entirely for other-player view when `visibility.stats = false`. Always shown on own view.

**Component:** `ProfileStatsCard.tsx`, props:
```ts
{
  rank: number | null;
  totalPoints: number;
  planetCount: number;
  allianceName: string | null;
}
```

## Bio card

A single large text block, same `glass-card` frame. Two modes:

**Own view (always shown, even when empty):**
- If bio is non-empty: renders the full text, `whitespace-pre-wrap`, `text-sm text-muted-foreground`. On hover, a pencil SVG appears top-right; clicking anywhere in the card (except the header) enters edit mode.
- If bio is empty: shows placeholder `"Cliquez pour écrire votre log de capitaine."` — same click-to-edit behaviour.
- **Edit mode:** a `<textarea>` replaces the text, auto-focused, `maxLength={500}`, with a `{count}/500` footer. Two buttons: **Enregistrer** (primary) and **Annuler** (ghost). Keyboard: `Esc` cancels, `Cmd/Ctrl+Enter` saves. Saving calls `trpc.user.updateProfile.mutate({ bio: value || null })` and returns to read mode on success. No autosave-on-blur (avoids surprise persists).

**Other-player view:**
- If `bio` is `null` (hidden or truly empty): card is not rendered at all.
- If `bio` is non-empty: read-only block, `whitespace-pre-wrap`.

**Component:** `ProfileBioCard.tsx`, props:
```ts
{
  bio: string | null;
  isOwn: boolean;
  onSave?: (next: string | null) => void;   // required when isOwn=true
  isSaving?: boolean;
}
```

## Alliance card

Only rendered when the player is in an alliance (i.e. `allianceName !== null` and, for other-player view, visibility allows). Layout:

- Left: the monogram badge (larger — 48×56, same shield-clip as hero) using `allianceTag`.
- Middle: alliance name (16px bold), role subtitle (11px muted). Role is only shown on own view (we don't leak other players' role from this card in this iteration — deferred).
- Right: action. On own view: `"Gérer l'alliance →"` link to `/alliance`. On other view: the whole card becomes a link to `/alliance/{allianceId}` (if that route exists; otherwise `/alliance` — the implementer checks existing routes and picks).

**Component:** `ProfileAllianceCard.tsx`, props:
```ts
{
  allianceName: string;
  allianceTag: string;
  allianceRole?: 'founder' | 'officer' | 'member';  // own view only
  isOwn: boolean;
  allianceId?: string;  // for other-view linking
}
```

The monogram itself is a shared primitive: `AllianceTagBadge.tsx`, props `{ tag: string; size?: 'sm' | 'md' | 'lg' }`. Used in hero (`sm`) and alliance card (`lg`).

## Social card

**Own view** (heading: `"Social"`):
- Friends subsection: reuses existing `FriendList` component (no visual changes — it already matches). Header "Amis" + count.
- Pending requests subsection: reuses existing `FriendRequests`. Collapsed by default with a count badge; clicking the header expands. Same pattern as today.

**Other-player view** (no heading — the card IS the action zone):
- A horizontal row of action buttons, identical semantics to today's `PlayerProfile`:
  - `friendshipStatus === 'none'` → "Ajouter en ami" (primary)
  - `pending_sent` → "Annuler la demande" (muted)
  - `pending_received` → "Accepter" (primary) + "Refuser" (destructive)
  - `friends` → "Retirer des amis" (destructive-outline)
- Always a trailing "Envoyer un message" button (outline). Clicking opens the existing chat drawer via `useChatStore.openChat(userId, username)`.
- Mutual friends line ("3 amis en commun : Alpha, Beta, Gamma") is **deferred** — no backend endpoint exists for it yet. Not in this spec.

**Component:** `ProfileSocialCard.tsx`. Internal layout decides own vs other by a prop:
```ts
{ kind: 'own' } | {
  kind: 'other';
  userId: string;
  username: string;
  friendshipStatus: 'none' | 'pending_sent' | 'pending_received' | 'friends';
  friendshipId: string | null;
}
```

## Preferences card (own only)

Kept simple, same semantics as today, just grouped in one card:

- Toggle: "Je cherche une alliance" (bound to `seekingAlliance`).
- Three checkboxes: visibility of bio, playstyle, stats (visibility is stored as `profileVisibility` JSON).
- Footer link: `"Préférences de notification →"` pointing to `/settings/notifications`. This route may not yet exist; if so, the implementer adds a thin stub page or falls back to `/profile?tab=notifications` (the current URL). Documenting this as a known follow-up is acceptable.

The `AvatarPicker` modal is still triggered from the hero's pencil, not from this card.

**Component:** `ProfilePreferencesCard.tsx`, props:
```ts
{
  seekingAlliance: boolean;
  visibility: { bio: boolean; playstyle: boolean; stats: boolean };
  onChange: (patch: {
    seekingAlliance?: boolean;
    profileVisibility?: { bio: boolean; playstyle: boolean; stats: boolean };
  }) => void;
  isSaving?: boolean;
}
```

## Notifications tab: removed

The current `activeTab === 'notifications'` branch in `Profile.tsx`, which renders `<NotificationPreferences />`, goes away. The `NotificationPreferences` component itself stays — it is referenced from `/settings/notifications` (existing or new). A link in the new Preferences card sends users there. This redesign does **not** ship `/settings/notifications`; if that route doesn't already exist, the implementer either:
- Creates a minimal `apps/web/src/pages/SettingsNotifications.tsx` that just renders `<NotificationPreferences />` under a `PageHeader title="Préférences de notification"`, plus a router entry; **or**
- Keeps the old `/profile?tab=notifications` URL working by routing the footer link to it temporarily.

The implementer picks based on router conventions, documents the choice in the PR.

## Architecture

- **Two page files stay**, but become thin wrappers:
  - `apps/web/src/pages/Profile.tsx` → `<ProfileView userId={currentUser.id} isOwn />`
  - `apps/web/src/pages/PlayerProfile.tsx` → `<ProfileView userId={params.userId} isOwn={false} />`
- **The orchestrator** `apps/web/src/components/profile/ProfileView.tsx` does the conditional rendering and tRPC calls. It owns no visual layout beyond the vertical stack; each card is its own file.
- **Shared primitive** `apps/web/src/components/profile/AllianceTagBadge.tsx` (used by hero and alliance card).

File layout under `apps/web/src/components/profile/`:

```
ProfileView.tsx              ← orchestrator (~120 lines)
ProfileHero.tsx              ← cinematic banner
ProfileStatsCard.tsx
ProfileBioCard.tsx           ← read + inline-edit modes
ProfileAllianceCard.tsx
ProfileSocialCard.tsx        ← own (friends) + other (actions)
ProfilePreferencesCard.tsx   ← own only
AllianceTagBadge.tsx         ← monogram, sm/md/lg
AvatarPicker.tsx             ← unchanged (already exists)
FriendList.tsx               ← unchanged (already exists)
FriendRequests.tsx           ← unchanged (already exists)
NotificationPreferences.tsx  ← unchanged (moves route, not code)
```

## Backend changes

Two tiny additions, both in `apps/api/src/modules/user/user.service.ts`. No new tables, no new routes.

1. **`getPlayerStats`** (line ~127) must also return `allianceTag`:
   ```ts
   const [membership] = await db.select({
     allianceName: alliances.name,
     allianceTag: alliances.tag,
     allianceId: alliances.id,
     allianceRole: allianceMembers.role,
   }).from(allianceMembers)
     .innerJoin(alliances, eq(allianceMembers.allianceId, alliances.id))
     .where(eq(allianceMembers.userId, userId))
     .limit(1);

   return {
     rank: ranking?.rank ?? null,
     totalPoints: ranking?.totalPoints ?? 0,
     planetCount: planetCount?.count ?? 0,
     allianceName: membership?.allianceName ?? null,
     allianceTag: membership?.allianceTag ?? null,
     allianceId: membership?.allianceId ?? null,
     allianceRole: membership?.allianceRole ?? null,
   };
   ```
   (The extra three fields — tag, id, role — are all used by the frontend.)

2. **`getProfile`** (other-player view, line ~57) must include `createdAt` in its returned payload so the hero fallback line works:
   ```ts
   return {
     id: user.id,
     username: user.username,
     avatarId: user.avatarId,
     createdAt: user.createdAt,   // ← added
     bio: ...,
     ...
   };
   ```

No schema changes, no migrations.

## Visibility rules (unchanged)

Repeated here so the implementer doesn't have to re-derive them:

- `profileVisibility.bio = false` → other-player view: bio card hidden; hero tagline falls back to `"Aux commandes depuis …"`.
- `profileVisibility.playstyle = false` → other-player view: playstyle tag AND seekingAlliance tag both hidden from the hero (existing grouping in `getProfile`).
- `profileVisibility.stats = false` → other-player view: stats card hidden AND rank line in the hero falls back to `"Capitaine"` (no number). Alliance card also hidden (since alliance is part of stats).
- Own view ignores all toggles (you always see your own everything).

## Copy (all French, vouvoiement enforced)

Every user-facing string, for reference:

- Hero top line: `"Capitaine · Rang {n}"` / fallback `"Capitaine"`.
- Hero tagline fallback: `"Aux commandes depuis {mois} {année}"` (e.g. `"Aux commandes depuis mars 2025"`). Use `Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })`.
- Playstyle labels: `Mineur` / `Guerrier` / `Explorateur` (keep existing `PLAYSTYLE_LABELS` map).
- Seeking-alliance tag: `"Cherche une alliance"`.
- Stats labels: `"Rang"`, `"Points"`, `"Planètes"`, `"Alliance"`.
- Bio placeholder (own, empty): `"Cliquez pour écrire votre log de capitaine."`
- Bio edit buttons: `"Enregistrer"`, `"Annuler"`.
- Bio counter: `"{n}/500"`.
- Alliance card own action: `"Gérer l'alliance →"`.
- Alliance card role subtitle: `"Fondateur"` / `"Officier"` / `"Membre"`.
- Social card (own) headings: `"Amis"`, `"Demandes"` (with badge count).
- Social card (other) buttons: `"Ajouter en ami"`, `"Annuler la demande"`, `"Accepter"`, `"Refuser"`, `"Retirer des amis"`, `"Envoyer un message"`.
- Preferences card heading: `"Préférences"`.
- Preferences toggle: `"Je cherche une alliance"`.
- Preferences sub-heading: `"Visibilité du profil"` with helper `"Choisissez ce que les autres joueurs peuvent voir."`
- Preferences visibility items: `"Bio"`, `"Style de jeu"`, `"Statistiques"`.
- Preferences footer link: `"Préférences de notification →"`.
- Not-found page (other-player): unchanged (`"Ce profil n'existe pas ou a été supprimé."`).

## Testing

No unit tests. Visual verification in a browser, like the colonization reports. Scenarios to check:

- `/profile` with a populated bio, playstyle set, alliance member, several friends, pending requests.
- `/profile` with empty bio, no playstyle, no alliance, zero friends.
- `/player/:userId` of a friend.
- `/player/:userId` of a stranger with all visibility toggles off (bio, playstyle, stats all hidden).
- `/player/:userId` of a stranger with `seekingAlliance = true`.
- `/player/:userId` of a stranger without an alliance.
- Hover / edit flows: avatar picker, bio inline edit (save + cancel + Esc + Cmd+Enter), all preference toggles.
- Mobile width (single column, hero still readable).

## Out of scope (follow-ups to consider)

- Mutual friends line on other-player view (needs a new backend query).
- Activity status / last-seen indicator.
- Achievements / medal badges.
- Alliance crest as a real image asset (upload, storage).
- Dedicated `/settings` area grouping notifications + account + theme + security.
- Stat progression sparklines (needs historical data).
- Tagline as a first-class field separate from bio.

These can each be their own spec.
