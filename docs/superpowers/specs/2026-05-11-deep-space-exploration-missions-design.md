# Missions d'exploration en espace profond — Design

> Version **v2** — corrige les 3 bloquants, 5 importants et 7 mineurs identifiés en auto-revue, triple la section admin, ajoute la convention de wording. Changelog en fin de document.

**Objectif :** Transformer l'exploration en un gameplay narratif autonome. Le joueur engage une flotte sur une **mission en espace profond** (lieu abstrait, hors galaxie cartographique). Le run se déroule en 1→5 étapes asynchrones, chacune pouvant être un événement narratif à choix (réutilise le moteur d'événements d'anomalie). Les récompenses ressources sont **plafonnées par la capacité de soute** de la flotte engagée. À la fin, la flotte rentre avec un rapport narratif et son butin.

**Pourquoi remplacer les missions PvE reconnaissance (`pve_missions.mission_type='exploration'`) :**
- 68% de complétion vs 95% sur minage/pirate — feature en souffrance
- Aucun gameplay propre (cartographie galactique rebrandée)
- Récompenses chiches concurrencées par le marché de rapports
- Ticket joueur "Mission Exploration" (2 mai) confirme la friction

**Périmètre v1 :**
- Pool d'événements dédié (~15-20 seedés)
- 3 missions actives max par joueur, regen 24h
- Pas de combat obligatoire ; combat possible **uniquement** en effet d'événement
- Gates de choix : palier de recherche **+ composition de flotte** (rôle / vaisseau précis)
- Récompenses ressources matérielles bornées par soute (Exilium / modules / révélation biome hors plafond)
- Événement passerelle "Signal d'anomalie" → débloque 1 engagement d'anomalie gratuit
- Réutilise le composant `AnomalyEventCard` (généralisé en `EventCard` partagé)
- Réutilise le pattern admin de `/admin/anomalies` (3 onglets, mutation atomique)

**Hors périmètre :**
- PvP en espace profond (pas de croisement entre joueurs)
- Combat-loop type anomalie
- Multi-flotte par mission (1 mission = 1 flotte)
- Pas d'impact sur la galaxie cartographique

---

## 1. Architecture

### 1.1 Tables

```sql
-- Missions (instances joueur)
CREATE TABLE exploration_missions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sector_id       varchar(64) NOT NULL,
  sector_name     varchar(120) NOT NULL,             -- snapshot affichage
  tier            varchar(16) NOT NULL,              -- 'early' | 'mid' | 'deep'
  total_steps     integer NOT NULL,                  -- 1..5
  current_step    integer NOT NULL DEFAULT 0,
  status          varchar(24) NOT NULL DEFAULT 'available',
                  -- 'available' | 'engaged' | 'awaiting_decision'
                  -- | 'completed' | 'failed' | 'expired'

  -- Flotte engagée (FIGÉ à l'engagement, jamais modifié après)
  fleet_snapshot  jsonb,
                  -- {
                  --   ships: [{ shipId, count, role, cargoPerShip, massPerShip, hullPerShip }],
                  --   totalCargo: int,
                  --   totalMass: int,
                  --   totalHull: int
                  -- }
  fleet_origin_planet_id uuid REFERENCES planets(id) ON DELETE SET NULL,

  -- État courant de la flotte (LIVE — modifié par combats)
  fleet_status    jsonb NOT NULL DEFAULT '{}'::jsonb,
                  -- { shipsAlive: {shipId: count}, hullRatio: float [0..1] }

  -- Événement en attente de décision (si status='awaiting_decision')
  pending_event_id varchar(64),

  -- Cumul des effets appliqués (crédité seulement à completeMission)
  outcomes_accumulated jsonb NOT NULL DEFAULT
    '{"minerai":0,"silicium":0,"hydrogene":0,"exilium":0,"modules":[],"biomeRevealsRequested":0,"hullDeltaTotal":0,"resolvedSteps":0,"anomalyEngagementUnlocked":null}'::jsonb,

  step_log        jsonb NOT NULL DEFAULT '[]'::jsonb,
                  -- StepLogEntry[]

  briefing        text NOT NULL,
  hydrogen_cost   integer NOT NULL DEFAULT 0,
  estimated_duration_seconds integer NOT NULL,
  next_step_at    timestamptz,                       -- nullable quand awaiting_decision

  -- Idempotence
  last_resolution_token uuid,                        -- évite double-clic / replay

  created_at      timestamptz NOT NULL DEFAULT now(),
  engaged_at      timestamptz,
  completed_at    timestamptz,
  expires_at      timestamptz NOT NULL               -- expiration de l'offre dispo (72h)
);

CREATE INDEX exp_missions_user_status_idx ON exploration_missions(user_id, status);
CREATE INDEX exp_missions_tick_idx ON exploration_missions(next_step_at)
  WHERE status = 'engaged';
CREATE INDEX exp_missions_expire_idx ON exploration_missions(expires_at)
  WHERE status = 'available';

-- Contenu admin (singleton JSONB validé Zod, calque anomaly_content)
CREATE TABLE exploration_content (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

Notes :
- **`fleet_snapshot` est figé** à l'engagement, **`fleet_status` est mis à jour** par les combats. **Validation des gates lit toujours `fleet_status.shipsAlive` intersecté avec les rôles de `fleet_snapshot.ships`** — un vaisseau mort ne peut pas valider une requirement.
- **FK `ON DELETE SET NULL`** pour `fleet_origin_planet_id` : si le joueur perd sa planète d'origine, on fallback sur le homeworld actuel à la fin.
- Statut `engaged` remplace `in_progress` pour éviter confusion avec `pve_missions.status`.

### 1.2 Schéma du contenu (`exploration_content.content`)

```ts
type ExplorationContent = {
  sectors: SectorEntry[];      // 8-12 secteurs narratifs
  events:  ExplorationEvent[]; // 15-20 événements
  killSwitch: boolean;         // si true, génération désactivée mais runs en cours finissent
};

type SectorEntry = {
  id: string;                  // 'theta-7', 'faille-halsmar'
  name: string;                // "Secteur Theta-7"
  tier: 'early' | 'mid' | 'deep';
  briefingTemplate: string;    // markdown 2-3 lignes
  imageRef?: string;           // ressource uploaded admin
  enabled: boolean;
};

type ExplorationEvent = {
  id: string;
  tier: 'early' | 'mid' | 'deep';
  title: string;               // ex: "Épave recyclable"
  description: string;
  imageRef?: string;
  weight: number;              // pondération du pick (défaut 1)
  enabled: boolean;
  choices: ExplorationChoice[]; // 2 à 5
};

type ExplorationChoice = {
  label: string;
  description?: string;
  tone: 'positive' | 'negative' | 'risky' | 'neutral';
  hidden?: boolean;
  requirements?: ChoiceRequirement[];   // AND logique
  outcome: EventOutcome;
  failureOutcome?: EventOutcome;        // si requirement non remplie
};

type ChoiceRequirement =
  | { kind: 'research'; researchId: string; minLevel: number }
  | { kind: 'shipRole'; role: string; minCount: number }    // ⭐ nouveau
  | { kind: 'shipId';   shipId: string; minCount: number }; // ⭐ nouveau

type EventOutcome = {
  minerai?: number;            // ressources matérielles (bornées soute)
  silicium?: number;
  hydrogene?: number;
  exilium?: number;            // hors soute, crédité À LA FIN seulement
  hullDelta?: number;          // [-1, 1]
  moduleDrop?: { rarity: 'common'|'rare'|'epic'; count: number };
  bonusBiomeReveal?: number;   // appliqué à completeMission
  triggerCombat?: CombatSpec;
  unlockAnomalyEngagement?: { tier: 1|2|3 };
  resolutionText: string;      // narration finale
};

type CombatSpec = {
  fp: number;                          // force adverse
  loot?: Partial<Resources>;           // si victoire
  resolutionTextWin: string;
  resolutionTextLose: string;
};

type StepLogEntry = {
  step: number;
  eventId: string;
  choiceIndex: number;
  outcomeApplied: EventOutcome;
  overflowed?: { minerai?: number; silicium?: number; hydrogene?: number };
  combatResult?: { won: boolean; shipsLost: Record<string, number>; hullAfter: number };
  resolutionText: string;
  resolvedAt: string;          // ISO timestamp
};
```

### 1.3 Modules et fichiers

```
apps/api/src/modules/exploration-mission/
  exploration-mission.service.ts        ← logique métier
  exploration-mission.router.ts         ← tRPC joueur
  exploration-mission.scheduler.ts      ← BullMQ worker
  __tests__/

apps/api/src/modules/exploration-content/
  exploration-content.service.ts        ← load/save + validation Zod
  exploration-content.router.ts         ← tRPC admin

apps/admin/src/pages/
  ExplorationMissions.tsx               ← page maître admin (3 onglets)

apps/admin/src/components/exploration/
  SectorEditor.tsx
  EventEditor.tsx
  LiveMissionsTable.tsx                 ← debug + actions

apps/web/src/pages/
  Missions.tsx                          ← ajout sous-onglet
  ExpeditionsPage.tsx                   ← page dédiée espace profond

apps/web/src/components/expedition/
  MissionOfferCard.tsx
  MissionDetailPanel.tsx
  EngageFleetModal.tsx
  StepEventCard.tsx                     ← réutilise EventCard partagé

apps/web/src/components/common/
  EventCard.tsx                         ← renommage de AnomalyEventCard

packages/game-engine/src/formulas/
  exploration-mission.ts                ← coûts, durées, soute, tiers
  events-engine.ts                      ← refactor : extrait de anomaly-events.ts

packages/db/src/schema/
  exploration-missions.ts
  exploration-content.ts

packages/db/drizzle/
  0082_drop_pve_recon.sql               ← phase 0
  0083_deep_space_expeditions.sql       ← phase 1
```

### 1.4 Scheduler — architecture choisie

**Tech :** BullMQ worker single-instance (cohérent avec le reste du projet — anomaly utilise déjà BullMQ).

- Une queue `exploration-mission-tick`, un worker, **concurrence = 1** (séquentialise les ticks).
- Job cron répété toutes les 60 secondes : `tickPendingMissions()` qui boucle sur les missions où `next_step_at <= now AND status='engaged'`.
- **Verrou row-level** dans chaque tick : `SELECT ... FOR UPDATE SKIP LOCKED` sur la mission. Si une autre opération (resolveStep) la tient, on saute et on retentera au prochain tick.
- **Idempotence** : si le worker plante après avoir pick l'événement mais avant la mise à jour status, la mission reste `engaged` avec `next_step_at` ancien → réessayé au tick suivant (no-op si déjà avancé entretemps).
- **Rattrapage redémarrage** : au boot, le worker query toutes les missions `engaged` avec `next_step_at <= now` et les passe.

Cron complémentaires :
- **Refill horaire** : `ensureAvailableMissionsForAllActiveUsers()` (joueurs connectés <7j) — appel `ensureAvailableMissions(userId)` pour chacun, indépendant de la connexion.
- **Purge `available` expirées** : toutes les 6h, `UPDATE exploration_missions SET status='expired' WHERE status='available' AND expires_at < now()`.
- **Timeout des décisions** : toutes les 1h, missions `awaiting_decision` depuis >7 jours → applique choix "neutre" par défaut (premier choix non-risqué, ou simple battre-en-retraite défini en seed) et continue.

---

## 2. Génération du pool

### 2.1 `ensureAvailableMissions(userId)`

Appelé :
1. À la connexion (middleware `app-router`) — lazy
2. À la fin de `completeMission` / `failMission` / `expireMission` (refill immédiat)
3. Par le cron horaire de refill global

Logique :
```ts
async function ensureAvailableMissions(userId: string) {
  if (content.killSwitch) return;
  if (userResearch.planetaryExploration < 1) return; // gate techno

  const activeCount = await countActiveMissions(userId);
  // active = available OR engaged OR awaiting_decision
  if (activeCount >= MAX_ACTIVE_MISSIONS) return;

  const slotsToFill = MAX_ACTIVE_MISSIONS - activeCount;
  for (let i = 0; i < slotsToFill; i++) {
    const tier = pickTierForResearchLevel(userResearch.planetaryExploration);
    const sector = pickSector(tier, recentSectorIds);
    if (!sector) continue;
    await insertMissionOffer(userId, sector, tier);
  }
}
```

- `MAX_ACTIVE_MISSIONS = 3`
- Pondération tier selon recherche :
  - lvl 1-3 → 80% early, 20% mid, 0% deep
  - lvl 4-7 → 40% early, 50% mid, 10% deep
  - lvl 8+ → 10% early, 50% mid, 40% deep
- Anti-répétition : on évite de retirer un secteur déjà servi au joueur dans les 7 derniers jours (lecture du `step_log` historique).

### 2.2 Caractéristiques d'une offre

```ts
function generateMissionAttributes(tier: Tier): {
  totalSteps: number;
  stepDurationSeconds: number;
  hydrogenBaseCost: number;  // additionné à fleet.totalMass * factor à l'engagement
  recommendedCargo: number;
}
```

| tier | totalSteps | stepDuration | hydrogenBaseCost | recommendedCargo |
|---|---|---|---|---|
| early | 1-2 | 10 min | 200 | 3 000 |
| mid | 2-3 | 20 min | 800 | 8 000 |
| deep | 3-5 | 30 min | 2 400 | 18 000 |

Valeurs **paramétrables via universe_config** (cf. §6).

---

## 3. Mécaniques

### 3.1 Engagement (`engageMission`)

```
INPUT: missionId, ships: Record<shipId, count>, planetId

VALIDATION (en TX) :
  1. mission.status === 'available' AND user_id matches AND not expired
  2. mission.killSwitch=false
  3. planetId appartient au joueur
  4. Chaque shipId existe dans game config, le compte est dispo sur la planète
  5. Au moins 1 vaisseau de rôle 'exploration' (sinon erreur "Au moins un explorateur requis")
  6. Joueur a assez d'hydrogène pour hydrogen_cost
  7. cargoCapacity calculée = sum(ship.cargo * count) — stockée snapshot

ACTIONS (en TX) :
  - décrément ships sur la planète (table `planet_ships`, UPDATE FOR UPDATE)
  - décrément hydrogène
  - update mission : status='engaged', engaged_at=now,
    fleet_snapshot=<figé>, fleet_status={shipsAlive: copy(ships), hullRatio: 1.0},
    next_step_at = now + stepDuration, hydrogen_cost stocké

  COMMIT.
```

**Note importante :** les vaisseaux engagés ne sont **plus listés** dans l'inventaire de la planète (table `planet_ships`). Ils sont entièrement transférés dans `fleet_snapshot` jusqu'au retour. C'est cohérent avec le système existant des flottes en vol.

### 3.2 Tick scheduler (`advanceMission`)

```
EN TX, avec FOR UPDATE SKIP LOCKED sur la mission :
  1. Re-check status === 'engaged' AND next_step_at <= now
  2. Pick event tier-pondéré, exclu de step_log existant
     - si pool épuisé pour ce tier → repick avec exclusion seulement de l'event précédent
  3. UPDATE mission :
     status='awaiting_decision',
     pending_event_id=<id>,
     next_step_at=NULL
  4. Push notif SSE : `mission-expedition-event-pending`
  COMMIT.
```

### 3.3 Résolution d'un choix (`resolveStep`)

```
INPUT: missionId, choiceIndex, resolutionToken (UUID généré côté front, idempotence)

EN TX, avec FOR UPDATE :
  1. Re-check status === 'awaiting_decision'
  2. Si last_resolution_token === resolutionToken → return last state (idempotent)
  3. Charger event depuis content, get choice
  4. Validation requirements (cf. §3.4)
     - si fail ET pas de failureOutcome → reject 400 'choice_locked'
     - si fail ET failureOutcome → outcome = choice.failureOutcome
     - sinon → outcome = choice.outcome
  5. Application outcome :
     a) Ressources matérielles → clamp soute, append outcomes_accumulated, log overflow
     b) Exilium → append outcomes_accumulated.exilium (PAS crédit immédiat)
     c) Modules → append outcomes_accumulated.modules (PAS crédit immédiat)
     d) hullDelta → mise à jour fleet_status.hullRatio (clamp [0.01, 1.0])
     e) bonusBiomeReveal → outcomes_accumulated.biomeRevealsRequested += N
     f) unlockAnomalyEngagement → outcomes_accumulated.anomalyEngagementUnlocked = {tier}
     g) triggerCombat → cf. §3.5
  6. Append step_log
  7. current_step++, last_resolution_token=resolutionToken
  8. Si current_step >= total_steps OU combat wipe :
     → completeMission ou failMission (cf. §3.6)
  9. Sinon :
     → status='engaged', next_step_at = now + stepDuration
  COMMIT.

  Si étape réussie → push notif SSE.
```

### 3.4 Validation des requirements

```ts
function validateRequirements(
  choice: ExplorationChoice,
  ctx: {
    userResearch: Record<string, number>,
    fleetSnapshot: FleetSnapshot,
    fleetStatus: FleetStatus,
    gameConfig: GameConfig,
  }
): { pass: boolean; reason?: string }
```

- Pour `research` : `userResearch[id] >= minLevel` — pas affecté par les pertes.
- Pour `shipRole` : compte les ships **vivants** (`fleetStatus.shipsAlive[shipId] > 0`) ayant le rôle requis, somme ≥ `minCount`. Le rôle est lu depuis le `game-config`.
- Pour `shipId` : `fleetStatus.shipsAlive[shipId] ?? 0 >= minCount`.

Les **vaisseaux morts ne comptent jamais**. Cette politique évite les exploits ("je garde un recycleur dans le snapshot mais il est mort, je peux quand même valider").

### 3.5 Combat ponctuel

- Résolution **synchrone** dans `resolveStep` via l'engine combat (rapide, ≤ 500ms typique pour les FP attendus).
- Adversaire généré : `scaleFleetToFP(spec.fp, biomeContext='deep-space')`.
- Player side = `fleet_status.shipsAlive` (vivants uniquement, hull = `fleet_status.hullRatio * hullPerShip`).
- Résultat :
  - **Victoire** → applique `spec.loot` (ressources clamp soute, exilium queue), met à jour `fleet_status.shipsAlive` et `hullRatio`. Continue.
  - **Wipe** (toutes ships à 0) → `failMission()` immédiat. Toutes ressources/modules/exilium accumulés **perdus**. Notif "Flotte perdue dans l'espace profond."
  - **Survie partielle avec hull < 0.05** → `failMission()` aussi (ne peut pas rentrer).
- Le `combatResult` est ajouté dans `step_log[].combatResult` pour affichage UI ("Pertes : 2× Frégate, coque restante 47%").

**Pas de combat-loop**, max **1 combat par étape** (limite imposée par la structure d'un événement).

### 3.6 Fin de mission

**`completeMission`** :
```
EN TX :
  - Trouver planet destination : fleet_origin_planet_id si encore valide, sinon homeworld actuel
  - Crédite minerai/silicium/hydrogene sur la planète (capacité de stockage respectée — overflow logué)
  - Crédite exilium via exiliumService.credit() (transactionnel)
  - Insère modules dans inventory flagship (réuse moduleService.grant)
  - Pour biomeRevealsRequested > 0 :
      SELECT N positions du joueur dans discovered_positions avec biome non révélé
      (LEFT JOIN discovered_biomes IS NULL).
      Pour chacune INSERT discovered_biomes avec biome aléatoire pondéré.
      Si < N positions dispo : on grant ce qu'on peut, le reste est mentionné dans
      la narration du rapport comme "fragment de carte non exploitable cette fois-ci".
      Pas de table de crédits en v1 (KISS — < 5% des cas, et le joueur a
      ses outcomes principaux).
  - Si anomalyEngagementUnlocked : INSERT dans nouvelle table
    `expedition_anomaly_credits(id, user_id, tier, source_mission_id, consumed_at, created_at)`
    créée dans la migration 0083. Le module anomaly lit cette table à
    l'engagement et consomme un crédit si dispo (offre l'engagement gratuit).
  - status='completed', completed_at=now
  - Génère mission_report type='expedition' avec narration consolidée
  - Push notif SSE 'mission-expedition-completed'
  - Call ensureAvailableMissions(userId) pour refill le slot
COMMIT.
```

**`failMission`** :
```
EN TX :
  - PAS de crédit. Tout est perdu.
  - status='failed', completed_at=now
  - Génère mission_report type='expedition' avec narration de l'échec
  - Push notif SSE 'mission-expedition-failed'
  - Call ensureAvailableMissions
COMMIT.
```

**`expireMission`** (cron 7j sur awaiting_decision) :
- Applique choix "neutre" automatique → puis recall `resolveStep` interne avec ce choix.
- Cas dégradé, le joueur a sa flotte qui rentre quand même mais sans gloire.

### 3.7 Soute et débordement

```ts
function addResourceToOutcomes(
  outcomes, fleetSnapshot, kind: 'minerai'|'silicium'|'hydrogene', amount: number
): { granted: number; overflowed: number }
```

Logique :
- `usedCargo = outcomes.minerai + outcomes.silicium + outcomes.hydrogene`
- `remaining = fleetSnapshot.totalCargo - usedCargo`
- `granted = min(amount, remaining)`
- `overflowed = amount - granted`
- Outcomes mis à jour, overflow logué dans step_log.
- `resolutionText` mentionne explicitement la perte si overflowed > 0.

**Exilium et modules ne consomment pas la soute.**

---

## 4. UI joueur

> ⚠️ **Tout le wording joueur est en français** (cf. §7 conventions de wording).

### 4.1 Navigation
- Page `/missions` existante : on ajoute un sous-onglet **"Espace profond"** à côté des onglets actuels.
- Le sous-onglet ouvre `/missions/expeditions` (`ExpeditionsPage.tsx`).

### 4.2 Page `ExpeditionsPage`

```
┌──────────────────────────────────────────────────────────────┐
│ Expéditions en espace profond                                │
│ ────────────────────────────────────────────────────────     │
│ Disponibles (1 sur 3)                                         │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ [Palier intermédiaire] Secteur Theta-7               │    │
│  │ « Un signal répétitif provient du système… »         │    │
│  │ 3 étapes · ~60 min · Coût : 1 200 hydrogène          │    │
│  │ Soute conseillée : 8 000+                            │    │
│  │ [Engager une flotte →]            Expire dans 41h    │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                                │
│ En cours (1)                                                  │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ Secteur Faille-Halsmar (profond) · Étape 2 sur 4     │    │
│  │ Flotte : 3 explorateurs, 1 recycleur, 2 chasseurs    │    │
│  │ Coque flotte : 92% · Soute : 4 200 / 12 000          │    │
│  │ ⚠️ Décision requise — « Épave spectrale »            │    │
│  │ [Résoudre l'événement →]                             │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### 4.3 `EngageFleetModal`
Calque sur `AnomalyEngageModal`. Sélecteur ships par type, calcule en direct :
- Capacité de soute totale
- Masse totale
- Coût hydrogène (`base + mass * factor`)
- Coque totale (somme)
- Validation "Au moins 1 explorateur requis"
- Bouton "Engager (1 250 hydrogène)"

### 4.4 `StepEventCard`
**Réutilise `EventCard` partagé** (renommage de `AnomalyEventCard`). Props enrichies pour gates flotte :

```ts
type EventCardProps = {
  event: GenericEvent;
  context: {
    kind: 'anomaly' | 'expedition';
    research: Record<string, number>;
    fleet?: FleetContext;        // optionnel selon kind
  };
  onChoose: (choiceIndex: number) => void;
  disabled: boolean;
};
```

Pour chaque choix verrouillé :
- Gate recherche non remplie → badge rouge `Recherche : Recyclage niv. 3+ (vous : niv. 1)`
- Gate `shipRole` non remplie → badge rouge `Requis : 1× Recycleur` (avec vivants count)
- Si `failureOutcome` présent ET gate fail → choix cliquable, badge ambre "Tentative risquée"
- Sinon → choix grisé non-cliquable

### 4.5 Notifications (SSE)

Nouveaux types à ajouter au schéma SSE :
```ts
| { type: 'mission-expedition-event-pending'; missionId: uuid; eventTitle: string; sectorName: string }
| { type: 'mission-expedition-completed'; missionId: uuid; rewardsSummary: string }
| { type: 'mission-expedition-failed'; missionId: uuid; reason: 'combat_wipe' | 'hull_critical' | 'timeout' }
```

Toast + badge sur l'onglet Missions. Mission report archivé dans `/reports` avec filtre dédié "Expéditions".

---

## 5. Panneau admin

> Couverture **iso-anomalies** : tout ce qui est administrable pour les anomalies doit l'être ici, plus une vue debug live qui manque côté anomaly.

### 5.1 Page maître `/admin/exploration-missions`

3 onglets, pattern `Anomalies.tsx` :

#### Onglet 1 : **Secteurs**
- Liste éditable des secteurs (`id`, `name`, `tier`, `briefingTemplate`, `enabled`)
- Slot image par secteur via `AnomalyImageSlot` réutilisé (upload `/admin/upload-asset`, fallback graphique)
- Bouton "Ajouter un secteur" / "Dupliquer" / "Supprimer" / "Réordonner par tier"
- Bouton **"Exporter Markdown des secteurs sans illustration"** (pareil que `exportMissingImagesMarkdown` côté anomaly)

#### Onglet 2 : **Événements**
- Liste éditable des événements groupés par tier
- Édition inline : titre, description, image, weight, enabled, tier
- Pour chaque choix :
  - label, description, tone (selecteur), hidden
  - Liste des `requirements` (ajout/suppression de gates research / shipRole / shipId)
  - Éditeur de outcome + failureOutcome (formulaire structuré, pas du JSON brut)
- Bouton "Dupliquer un événement"
- Bouton **"Exporter Markdown des events sans illustration"**
- Validation **client-side** + **server-side** via Zod avant commit

#### Onglet 3 : **Missions live** (la nouveauté absente côté anomaly)
- Tableau filtrable par statut, par joueur, par tier, par secteur
- Pour chaque mission affichée :
  - id, joueur (lien), statut, étape courante / total, prochaine action, créée le, engagée le
  - Actions :
    - **Inspecter** : modal avec `step_log` complet, `fleet_snapshot`, `fleet_status`, `outcomes_accumulated`
    - **Forcer la résolution du step** (admin choisit le choice index → bypass requirements)
    - **Expirer maintenant** (status='expired', flotte renvoyée à origine, aucun crédit)
    - **Compléter d'office** (force `completeMission` avec outcomes actuels — pour débloquer des cas)
- Filtre rapide "missions zombies > 7j"

#### Bandeau global
- **Kill-switch** en haut : toggle `content.killSwitch` (suspend la génération de nouvelles offres, runs en cours continuent)
- **Bouton Reset** : restaure `DEFAULT_EXPLORATION_CONTENT` (avec confirmation double)
- **Bouton Reseed** : applique le seed initial sans toucher aux missions live

### 5.2 Endpoints tRPC admin

```ts
explorationContent.admin.update(content: ExplorationContent)
explorationContent.admin.reset()
explorationContent.admin.reseed()

explorationMission.admin.listMissions(filter: { status?, userId?, tier?, sectorId?, zombie?: boolean })
explorationMission.admin.inspectMission(missionId: uuid)
explorationMission.admin.forceResolveStep(missionId: uuid, choiceIndex: number)
explorationMission.admin.expireMission(missionId: uuid, refundShips: boolean)
explorationMission.admin.forceComplete(missionId: uuid)
explorationMission.admin.grantManualOffer(userId: uuid, sectorId: string) // pour QA
```

Toutes mutations admin journalisées via `logger.info` structuré (pattern existant). Pas de table `admin_audit_log` en v1 — `step_log` et l'historique des updates de `exploration_content.updated_at` suffisent pour traçabilité. Création d'une vraie table d'audit globale = sujet transverse hors périmètre.

### 5.3 Universe config (paramètres seedables)

À ajouter dans `seed-game-config.ts` :

```
expedition_max_active                   3
expedition_offer_expiration_hours       72
expedition_awaiting_decision_timeout_hours  168    -- 7j
expedition_step_duration_early_seconds  600
expedition_step_duration_mid_seconds    1200
expedition_step_duration_deep_seconds   1800
expedition_hydrogen_base_cost_early     200
expedition_hydrogen_base_cost_mid       800
expedition_hydrogen_base_cost_deep      2400
expedition_hydrogen_mass_factor         0.4
expedition_total_steps_early_min        1
expedition_total_steps_early_max        2
expedition_total_steps_mid_min          2
expedition_total_steps_mid_max          3
expedition_total_steps_deep_min         3
expedition_total_steps_deep_max         5
expedition_required_research_min_level  1          -- gating planetaryExploration
```

---

## 6. Interactions avec autres systèmes

| Système | Impact | Comportement attendu |
|---|---|---|
| **Défense planétaire** | Vaisseaux engagés non comptés dans la défense de leur planète d'origine (ils ne sont plus là) | Cohérent avec flottes en vol existantes — pas de changement de logique |
| **Espionnage** | Une mission expedition n'est pas une cible d'espionnage (lieu abstrait) | Le module spionnage ignore les missions `exploration_missions` |
| **Alliance / guerre** | Aucune participation, aucun ciblage | Pas d'interaction |
| **Galaxie carto** | Aucun impact direct ; `bonusBiomeReveal` modifie `discovered_biomes` au retour | Documenté §3.6 |
| **Marché de rapports** | Indépendant. Une expedition ne génère pas de rapport vendable directement | Bonus future v1.5 si pertinent |
| **Anomalies** | `unlockAnomalyEngagement` crédite un engagement gratuit | Implémenter via nouvelle table `anomaly_engagement_credits` ou logique équivalente |
| **Pénurie de joueurs sans homeworld** | Cas absurde : fleet revient mais aucune destination | Log warn + alerte admin, ships en attente dans un état spécial `pending_owner_planet` jusqu'à colonisation |

---

## 7. Convention de wording (français pur)

**À bannir côté UI joueur :**

| ❌ Anglicisme | ✅ Français |
|---|---|
| briefing | ordre de mission / note préliminaire |
| deep-space | espace profond |
| tier | palier |
| early / mid / deep | initial / intermédiaire / profond |
| step | étape |
| loot | butin |
| event | événement |
| run | expédition |
| spawn | apparition |
| drop | gain / chute |
| token | crédit / jeton |
| timeout | échéance / délai dépassé |
| wipe | flotte perdue |
| respawn | régénération |
| skill check | test (de compétence / de recherche) |

**Tolérés côté code/admin/log uniquement :**
- noms de colonnes DB (`status`, `tier`, `step_log`)
- valeurs d'enums internes (`available`, `engaged`, `awaiting_decision`)
- types TS / noms de fonctions
- chaînes des logs serveurs

**Règle d'or :** **toute string qui apparaît à l'écran d'un joueur en jeu est en français**, y compris les noms de secteurs, titres d'événements, libellés de choix, messages d'erreur, notifications, textes de résolution.

Vérification : avant chaque PR touchant l'UI joueur, `grep -i` sur les anglicismes listés.

---

## 8. Cas limites

| Cas | Comportement |
|---|---|
| Joueur engage avec 0 explorateur | UI bloque le bouton, serveur rejette si forge |
| Joueur engage flotte > stock dispo | TX atomique : décrément ships en `FOR UPDATE`, rejet si stock insuffisant |
| Ferme l'onglet pendant `awaiting_decision` | Cron 7j applique choix neutre, mission continue ou se termine |
| Combat wipe au step 2/5 | `failed`, tout perdu, notif claire, `step_log` conservé |
| Crash serveur pendant resolveStep | TX rollback, mission `awaiting_decision` intacte, idempotence par `last_resolution_token` |
| 2 onglets résolvent simultanément | TX `FOR UPDATE` : 2ème lecture voit `status='engaged'` → rejette 409 'already_resolved' |
| Joueur perd planète d'origine pendant le run | FK `SET NULL`, fallback homeworld à la fin |
| Joueur perd toutes ses planètes | Status `pending_owner_planet`, alerte admin |
| Module drop avec inventory plein | Pas de cap actuel, on insère. Si cap apparaît plus tard : queue admin |
| `bonusBiomeReveal` mais < N positions dispo | Grant ce qu'on peut, mentionne le manque dans la narration du rapport. Pas de système de crédits différé en v1. |
| Refresh refuse de générer (anti-répétition trop strict) | Recule à 3j d'anti-répétition. Si toujours bloqué, accepte répétition (warn log) |
| Joueur reroll en laissant les offres expirer | Pas de pénalité v1. Si exploit avéré en obs, ajouter cooldown 24h après 3 expirations |
| Kill-switch activé pendant mission engaged | La mission continue normalement (kill-switch n'affecte que la génération) |
| Reset content pendant mission engaged | Mission garde `sector_name` snapshot et resolved event en `step_log` snapshot → continue sans crash |

---

## 9. Tests

### Game-engine (pur, prioritaire)
`packages/game-engine/src/formulas/exploration-mission.test.ts` :
- `pickTierForResearchLevel` : 8 cas de pondération
- `generateMissionAttributes(tier)` : ranges respectés
- `addResourceToOutcomes` : 6 cas (under, exact, over, multi-resources clamp pro-rata)
- `validateRequirements`(choice, ctx) : 12 cas (research pass/fail, shipRole pass/fail avec vivants, shipId, multi-AND, ship mort exclu, failureOutcome path)

### Service API
`apps/api/src/modules/exploration-mission/__tests__/` :
- `ensureAvailableMissions` : respect cap, kill-switch, anti-répétition, gating recherche
- `engageMission` : validation tx, FK, hydrogène, stock ships, snapshot complet
- `advanceMission` : tick correct, lock SKIP LOCKED, idempotence
- `resolveStep` : idempotence par token, outcome appliqué, gate rejet, failureOutcome, transaction rollback safe
- Combat : victoire crédite, wipe → failMission, hull<5% → failMission
- `completeMission` : tous les types d'outcome crédités, refill triggered, mission_report créé
- `expireMission` cron timeout
- Race condition : 2 resolves concurrents (1 commit, 1 reject 409)

### tRPC routers
- joueur : auth, ownership, Zod input
- admin : auth admin, audit log, validation contenu Zod

### UI
- `StepEventCard` (= EventCard) avec context expedition : gates affichés, soft-fail
- `EngageFleetModal` : calculs live cohérents
- `MissionDetailPanel` : transition awaiting → engaged après résolution

### Migration
- Test d'application 0082 sur seed + données : aucune mission `pve.mission_type='exploration'` ne reste, colonnes proprement dropées

---

## 10. Migration & déploiement

### Phase 0 — Nettoyage des PvE recon (`0082_drop_pve_recon.sql`)

```sql
BEGIN;

-- 1. Marque les missions actives comme expirées (audit conservé)
UPDATE pve_missions
  SET status = 'expired'
  WHERE mission_type = 'exploration'
    AND status IN ('available', 'in_progress');

-- 2. Drop la colonne du cron
ALTER TABLE mission_center_state
  DROP COLUMN IF EXISTS next_exploration_discovery_at;

-- 3. Cleanup universe_config
DELETE FROM universe_config
  WHERE key IN (
    'pve_max_exploration_missions',
    'pve_exploration_min_distance',
    'pve_exploration_expiration_hours'
  );

COMMIT;
```

**Code à retirer :**
- `apps/api/src/modules/pve/exploration-mission.service.ts` (l'ancien)
- Bloc `generateExplorationMission` dans `pve.service.materializeDiscoveries`
- Hook `pveService.checkExplorationCompletion` dans `explore.handler` et son no-op fallback
- Composants `ExplorationMissionCard.tsx` + `ExplorationMissionsList.tsx`
- Tests associés

**Ticket joueur "Mission Exploration"** → marqué `resolved` avec admin_note expliquant retrait + remplacement.

### Phase 1 — Backend (`0083_deep_space_expeditions.sql`)

Création de **trois** tables :
- `exploration_missions`
- `exploration_content`
- `expedition_anomaly_credits` (pour l'event passerelle)

Seed initial `exploration_content` (8 secteurs + 15 events dont 1 "Signal d'anomalie"), seed universe_config keys, service, scheduler BullMQ, router.

### Phase 2 — UI joueur

`ExpeditionsPage` + composants + intégration onglet `Missions`. Notifs SSE.

### Phase 3 — Admin

Page maître 3 onglets + endpoints admin + audit. Réutilise `AnomalyImageSlot`.

### Phase 4 — Contenu

Compléter à 15-20 events bien équilibrés, polish narratif, patchnote, bannière in-game.

---

## 11. Phases ultérieures (hors v1)

- **v1.1** : événement passerelle inverse (anomalie → débloque expedition premium)
- **v1.2** : escorte multi-flotte (cargo + chasse)
- **v1.3** : boss narratif récurrent (« Le Capitaine Spectre »)
- **v2** : co-op alliance

---

## 12. Décisions actées (récap)

| # | Décision |
|---|---|
| 1 | Flotte réelle mobilisée pendant le run |
| 2 | 3 missions actives max par joueur |
| 3 | 1→5 étapes selon palier |
| 4 | Pas de combat obligatoire ; combat possible en effet d'événement ; gates de choix = recherche + rôle vaisseau + vaisseau précis |
| 5 | Soute = plafond dur sur ressources matérielles ; Exilium et modules hors plafond |
| 6 | Sous-onglet "Espace profond" dans `/missions` |
| 7 | Nom officiel : "Mission d'exploration en espace profond" (ou "Expédition en espace profond" en raccourci) |

---

## Changelog v1 → v2

**Références infra corrigées (passe finale v2.1) :**
- `ships_per_planet` → `planet_ships` (vraie table)
- `admin_audit_log` → `logger.info` structuré (table n'existe pas, hors périmètre)
- `user_credits` → suppression du fallback, narration du rapport explicite à la place
- `anomaly_engagement_credits` → nouvelle table `expedition_anomaly_credits` créée dans 0083

**Bloquants corrigés :**
- `fleet_snapshot` figé vs `fleet_status` live clarifiés ; validation gates lit `fleetStatus.shipsAlive`
- Race conditions sur `advanceMission` / `resolveStep` : transactions `FOR UPDATE` + `last_resolution_token` idempotent
- Scheduler explicité : BullMQ worker single-instance, `SKIP LOCKED`, rattrapage redémarrage

**Importants corrigés :**
- Exilium : **plus de crédit immédiat** ; queue dans `outcomes_accumulated`, crédit à `completeMission` seulement
- FK `fleet_origin_planet_id` : `ON DELETE SET NULL`, fallback homeworld à la fin
- `bonusBiomeReveal` : table `discovered_biomes` ; fallback `user_credits` si 0 position dispo
- `ensureAvailableMissions` : cron horaire global indépendant de la connexion + purge cron 6h des `available` expirées
- Status `in_progress` → `engaged` (évite collision avec `pve_missions`)

**Mineurs corrigés :**
- `step_log` schéma typé Zod (`StepLogEntry`)
- `moduleDrop` enrichi `{rarity, count}` + comportement défini si inventory plein
- 3 types de notif SSE listés explicitement
- `triggerCombat` : sync inline, max 1 par étape, conditions de failMission précisées
- `last_resolution_token` idempotence resolveStep
- Pas de cooldown anti-farm en v1 (obs first, ajout si exploit)
- Interactions cross-systèmes documentées (défense, espionnage, alliance, marché)

**Section admin triplée :**
- 3 onglets (Secteurs, Événements, Missions live)
- 9 endpoints tRPC admin listés
- Kill-switch + reset + reseed
- Audit log

**Wording :**
- Convention française pure documentée §7
- Toutes les UI text visibles joueur en français dans la spec
- Tableau d'anglicismes à bannir
