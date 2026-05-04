# Anomaly Tiers + Leaderboard — Spec

**Date :** 2026-05-04
**Sub-projet :** Endgame extension (post-V4 hardening)
**Statut :** Design validé, à planifier
**Sprints précédents :**
- [`2026-05-02-flagship-modules-design.md`](2026-05-02-flagship-modules-design.md)
- [`2026-05-03-talents-removal-design.md`](2026-05-03-talents-removal-design.md)
- [`2026-05-03-anomaly-v4-flagship-only-design.md`](2026-05-03-anomaly-v4-flagship-only-design.md)
- [`2026-05-04-flagship-xp-design.md`](2026-05-04-flagship-xp-design.md)

---

## 1. Contexte

L'Anomaly V4 (flagship-only) couvre un seul "donjon" de profondeur 1-20 avec une difficulté qui sature à 1.3× le player FP. Une fois qu'un joueur a complété depth 20, il n'y a pas d'endgame — pas de raison mécanique de re-engager (sauf grind modules ou XP). Pas non plus de leaderboard PvE.

**Idée user (validé en brainstorm)** : système de **paliers** (tiers) qui se débloquent en finissant le palier précédent. Difficulté ×N par palier, loot scaling capped. Donne :
- Un endgame mesurable (le palier max devient le vrai score)
- Un leaderboard naturel (qui a poussé le plus loin)
- Une motivation à grinder XP + modules (pour pouvoir affronter palier N+1)

**Hors scope :** modules legendary par tier, time-based leaderboard (V2), achievements ("premier palier 10").

---

## 2. Récap des décisions de design

| # | Axe | Choix |
|---|---|---|
| 1 | Transition palier | Run distincte par palier, choix au moment de l'engage |
| 2 | Difficulté inter-palier | `tierMultiplier × intra-palier ratio` (linéaire ×N par défaut, exponentiel via tune) |
| 3 | Cap nombre de paliers | Infini (le leaderboard différencie naturellement) |
| 4 | Loot scaling | Loot ×N capped à palier 10, paliers 11+ score-only |
| 5 | Critère leaderboard | Best palier complété (depth 20), tiebreaker secondaire |

---

## 3. Architecture & flow général

### 3.1 Engage

L'`AnomalyEngageModal` ajoute un sélecteur de palier (1 à `flagship.maxTierUnlocked`). Tous les nouveaux flagships démarrent à `maxTierUnlocked = 1`.

```
┌──────────────────────────────────┐
│ Engager une anomalie             │
├──────────────────────────────────┤
│ Palier : ◀ 3 ▶  / 5 (max)        │
│ Difficulté : ×3 enemy FP          │
│ Loot bonus : ×3 ressources        │
│ Stats preview (avec multiplier)   │
│ Coût : 15 Exilium (palier 3)      │
└──────────────────────────────────┘
```

Le joueur paie un coût scaled : `cost = base × (1 + (tier - 1) × cost_factor)`. Avec `cost_factor = 1.0` par défaut : palier 1 = 5 Ex, palier 5 = 25 Ex. Tunable.

Server valide `tier ≤ flagship.maxTierUnlocked` ; sinon `BAD_REQUEST`.

### 3.2 Pendant la run

Identique au V4. Le `tier` est stocké sur l'anomaly row. La formule de scaling enemy devient :

```
enemy_FP = player_FP × tierMultiplier × min(maxRatio, baseRatio × growth^(depth-1))
```

`tierMultiplier` est appliqué APRÈS le cap intra-palier (cap = 1.3 par défaut), donc les paliers hauts sont vraiment plus difficiles. `ANOMALY_MAX_DEPTH = 20` reste par palier.

### 3.3 Fin de palier (depth 20 atteint avec flagship vivant)

Au moment du `runComplete` (sprint V4) :
- Le run termine proprement comme avant (loot rendu, drops finaux, flagship retour)
- **`max_tier_unlocked` updated** : `max(current, tier + 1)` — le palier suivant est désormais accessible
- **`max_tier_completed` updated** : `max(current, tier)` — utilisé pour le leaderboard
- Toast UI : `🏆 Palier ${tier+1} débloqué !` si nouveau

### 3.4 Wipe / retreat

Identique au V4 : wipe perd tout, retreat conserve loot. `max_tier_unlocked` ne se perd jamais (high water mark).

### 3.5 Re-run paliers inférieurs

Le joueur peut re-engager n'importe quel palier 1 à `max_tier_unlocked`. Utile pour grinder modules / tester loadout / re-completer pour bonus loot. Le coût d'engage est scaled même pour le re-run (cohérent avec "tu paies pour jouer").

---

## 4. DB schema

### 4.1 Migration `0072_anomaly_tiers.sql`

```sql
-- Anomaly tiers system (2026-05-04)

-- Tier sur l'anomaly row (default 1 pour back-compat des anomalies actives)
ALTER TABLE anomalies
  ADD COLUMN IF NOT EXISTS tier SMALLINT NOT NULL DEFAULT 1;

-- Tier progression sur le flagship
ALTER TABLE flagships
  ADD COLUMN IF NOT EXISTS max_tier_unlocked  SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_tier_completed SMALLINT NOT NULL DEFAULT 0;

-- Universe config tunables
INSERT INTO universe_config (key, value) VALUES
  ('anomaly_tier_multiplier_factor',  '1.0'::jsonb),
  ('anomaly_loot_tier_cap',           '10'::jsonb),
  ('anomaly_tier_engage_cost_factor', '1.0'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Marker idempotence
INSERT INTO _migrations_state (key, value)
VALUES ('anomaly_tiers_init', 'done')
ON CONFLICT (key) DO UPDATE SET value = 'done', set_at = now();
```

### 4.2 Drizzle schema

`packages/db/src/schema/flagships.ts` — ajouter 2 colonnes après `level` (du sprint XP) :

```ts
  /** Anomaly tiers (2026-05-04) : palier max débloqué (peut engager 1..maxTierUnlocked). */
  maxTierUnlocked:  smallint('max_tier_unlocked').notNull().default(1),
  /** Anomaly tiers : palier max complété (depth 20 atteint). Utilisé par leaderboard. */
  maxTierCompleted: smallint('max_tier_completed').notNull().default(0),
```

`packages/db/src/schema/anomalies.ts` — ajouter 1 colonne :

```ts
  /** Anomaly tiers (2026-05-04) : palier sélectionné à l'engage. */
  tier: smallint('tier').notNull().default(1),
```

### 4.3 Pas de table dédiée pour le leaderboard (V1)

Le leaderboard est un `SELECT` sur `flagships` JOIN `users` avec ORDER BY `max_tier_completed DESC, level DESC, xp DESC`. Tiebreakers :
1. Niveau pilote (XP plus élevé = plus de jeu = priorité)
2. XP cumulé (granularité fine au sein d'un même level)

Si on veut plus tard un leaderboard time-based ou per-palier, ajouter une table `anomaly_tier_completions(flagshipId, tier, completedAt)`.

---

## 5. Engine formulas

Modifier `packages/game-engine/src/formulas/anomaly.ts` :

```ts
export interface AnomalyDifficulty {
  baseRatio: number;
  growth: number;
  maxRatio: number;
  /** V5-Tiers : multiplier appliqué après le cap intra-palier (default 1.0 = palier 1). */
  tierMultiplier?: number;
}

export const DEFAULT_DIFFICULTY: AnomalyDifficulty = {
  baseRatio: 0.5,
  growth: 1.15,
  maxRatio: 1.3,
  tierMultiplier: 1.0,
};

export function anomalyEnemyFP(
  playerFP: number,
  depth: number,
  difficulty: Partial<AnomalyDifficulty> = {},
): number {
  const baseRatio = difficulty.baseRatio ?? DEFAULT_DIFFICULTY.baseRatio;
  const growth = difficulty.growth ?? DEFAULT_DIFFICULTY.growth;
  const maxRatio = difficulty.maxRatio ?? DEFAULT_DIFFICULTY.maxRatio;
  const tierMult = difficulty.tierMultiplier ?? DEFAULT_DIFFICULTY.tierMultiplier!;
  const rawRatio = baseRatio * Math.pow(growth, depth - 1);
  const ratio = Math.min(maxRatio, rawRatio);
  return playerFP * ratio * tierMult;
}

/**
 * Compute the difficulty multiplier for a given tier.
 * Linear by default (factor=1.0): tier N → multiplier = N.
 * For exponential progression, use factor > 1.0: tier N → 1 + (N-1) × factor.
 */
export function tierMultiplier(tier: number, factor: number = 1.0): number {
  return 1 + (tier - 1) * factor;
}
```

Exemples :
- `tierMultiplier(1, 1.0)` = 1.0 (palier 1 = baseline V4)
- `tierMultiplier(5, 1.0)` = 5.0
- `tierMultiplier(10, 1.0)` = 10.0
- `tierMultiplier(5, 2.0)` = 9.0 (plus dur, factor 2.0)

---

## 6. Backend service

### 6.1 `anomaly.router.ts` — engage prend `tier`

```ts
engage: protectedProcedure
  .input(z.object({
    ships: z.record(z.string(), z.number().int().min(0)).optional().default({}),
    tier: z.number().int().min(1).max(1000).default(1),
  }))
  .mutation(async ({ ctx, input }) => {
    return anomalyService.engage(ctx.userId!, { ships: input.ships ?? {}, tier: input.tier });
  }),
```

Et nouvelle route :

```ts
leaderboard: protectedProcedure
  .input(z.object({ limit: z.number().int().min(1).max(100).default(50) }).optional())
  .query(async ({ input }) => {
    return anomalyService.getLeaderboard(input?.limit ?? 50);
  }),
```

### 6.2 `anomalyService.engage` — valide tier + scale cost

Changements dans la méthode existante :

```ts
async engage(userId: string, input: { ships: Record<string, number>; tier: number }) {
  const config = await gameConfigService.getFullConfig();
  const baseCost = Number(config.universe.anomaly_entry_cost_exilium) || 5;
  const costFactor = parseConfigNumber(config.universe.anomaly_tier_engage_cost_factor, 1.0);
  const cost = Math.round(baseCost * (1 + (input.tier - 1) * costFactor));
  const repairChargesMax = Number(config.universe.anomaly_repair_charges_per_run) || 3;

  return await db.transaction(async (tx) => {
    // ... advisory lock + active anomaly check ...

    // Flagship validation + tier validation
    const flagship = await flagshipService.get(userId);
    if (!flagship) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Vaisseau amiral requis' });
    if (flagship.status !== 'active') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Vaisseau amiral indisponible' });
    
    const maxTierUnlocked = (flagship as { maxTierUnlocked?: number }).maxTierUnlocked ?? 1;
    if (input.tier > maxTierUnlocked) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Palier ${input.tier} non débloqué (max disponible : ${maxTierUnlocked})`,
      });
    }

    // ... origin planet ownership ...
    // ... spend Exilium with the SCALED cost ...

    // ... existing flagship setInMission + module loadout snapshot ...

    // Insert anomaly with tier field
    const [created] = await tx.insert(anomalies).values({
      userId,
      originPlanetId,
      status: 'active',
      currentDepth: 0,
      fleet,
      exiliumPaid: cost,
      nextNodeAt,
      nextEnemyFleet: firstEnemy.enemyFleet,
      nextEnemyFp: Math.round(firstEnemy.enemyFP),
      nextNodeType: 'combat',
      combatsUntilNextEvent: pickEventGap(Math.random),
      equippedModules: equippedSnapshot,
      pendingEpicEffect: null,
      repairChargesCurrent: repairChargesMax,
      repairChargesMax,
      tier: input.tier,  // V5-Tiers
    }).returning();

    return created;
  });
}
```

### 6.3 Enemy FP scaling

Modifier `generateAnomalyEnemy` et `runAnomalyNode` (dans `anomaly.combat.ts`) pour passer le tier :

```ts
// Dans generateAnomalyEnemy + runAnomalyNode :
const tierMult = tierMultiplier(
  args.tier ?? 1,
  parseConfigNumber(config.universe.anomaly_tier_multiplier_factor, 1.0),
);

const enemyFP = anomalyEnemyFP(playerFP, depth, {
  baseRatio: ...,
  growth: ...,
  maxRatio: ...,
  tierMultiplier: tierMult,
});
```

Le `tier` est récupéré depuis `row.tier` au moment de l'appel dans `advance()`.

### 6.4 Loot scaling capped

Dans la branche `survived` de `advance` :

```ts
const lootTierCap = Number(config.universe.anomaly_loot_tier_cap) || 10;
const effectiveTierForLoot = Math.min(row.tier, lootTierCap);
const lootMultiplier = effectiveTierForLoot;  // Palier 1=×1, palier 10=×10, palier 11+=×10

const loot = anomalyLoot(newDepth, lootBase * lootMultiplier, lootGrowth);
```

`anomalyLoot` reste inchangée — on multiplie juste son `lootBase`.

### 6.5 runComplete — unlock next tier

À depth 20 atteint avec flagship vivant (existing branch, sprint V4) :

```ts
// V5-Tiers : unlock next tier
const oldMaxUnlocked = flagship.maxTierUnlocked ?? 1;
const oldMaxCompleted = flagship.maxTierCompleted ?? 0;
const newMaxCompleted = Math.max(oldMaxCompleted, row.tier);
const newMaxUnlocked = Math.max(oldMaxUnlocked, row.tier + 1);

await tx.update(flagships).set({
  maxTierCompleted: newMaxCompleted,
  maxTierUnlocked: newMaxUnlocked,
  updatedAt: new Date(),
}).where(eq(flagships.id, flagship.id));

// Return shape adds tierCompleted + newTierUnlocked (front toast)
return {
  outcome: 'survived' as const,
  runComplete: true,
  tierCompleted: row.tier,
  newTierUnlocked: newMaxUnlocked > oldMaxUnlocked ? newMaxUnlocked : null,
  // ... existing fields (xpGained, finalDrops, etc.) ...
};
```

### 6.6 `getLeaderboard` endpoint

```ts
async getLeaderboard(limit: number) {
  const rows = await db.select({
    username: users.username,
    maxTierCompleted: flagships.maxTierCompleted,
    maxTierUnlocked: flagships.maxTierUnlocked,
    level: flagships.level,
    xp: flagships.xp,
    hullId: flagships.hullId,
  })
    .from(flagships)
    .innerJoin(users, eq(users.id, flagships.userId))
    .where(gt(flagships.maxTierCompleted, 0))
    .orderBy(
      desc(flagships.maxTierCompleted),
      desc(flagships.level),
      desc(flagships.xp),
    )
    .limit(limit);
  return { entries: rows };
}
```

Pas d'authentification spécifique — endpoint protégé standard, accessible à tout joueur connecté.

---

## 7. Frontend

### 7.1 `AnomalyEngageModal` — sélecteur palier

Ajouter un block sélecteur (entre la stats card et le coût) :

```tsx
const maxUnlocked = (flagship as { maxTierUnlocked?: number }).maxTierUnlocked ?? 1;
const [selectedTier, setSelectedTier] = useState(maxUnlocked);

const tierFactor = Number(gameConfig?.universe?.anomaly_tier_multiplier_factor) || 1.0;
const tierMult = 1 + (selectedTier - 1) * tierFactor;
const lootTierCap = Number(gameConfig?.universe?.anomaly_loot_tier_cap) || 10;
const lootMult = Math.min(selectedTier, lootTierCap);
const costFactor = Number(gameConfig?.universe?.anomaly_tier_engage_cost_factor) || 1.0;
const scaledCost = Math.round(cost * (1 + (selectedTier - 1) * costFactor));

<div className="flex items-center gap-3 border-t border-panel-border pt-3">
  <span className="text-gray-500 text-sm flex items-center gap-1.5">🏆 Palier</span>
  <button
    onClick={() => setSelectedTier(Math.max(1, selectedTier - 1))}
    disabled={selectedTier <= 1}
    className="px-2 py-1 rounded hover:bg-panel-hover disabled:opacity-30"
  >◀</button>
  <span className="font-bold text-lg w-8 text-center">{selectedTier}</span>
  <button
    onClick={() => setSelectedTier(Math.min(maxUnlocked, selectedTier + 1))}
    disabled={selectedTier >= maxUnlocked}
    className="px-2 py-1 rounded hover:bg-panel-hover disabled:opacity-30"
  >▶</button>
  <span className="text-xs text-gray-500">/ {maxUnlocked}</span>
</div>

<div className="text-xs text-gray-500 text-right">
  Difficulté ×{tierMult.toFixed(1)} • Loot ×{lootMult}
</div>
```

Mutation : `engageMutation.mutate({ ships: {}, tier: selectedTier })`. Coût affiché = `scaledCost`.

### 7.2 `Anomaly.tsx` run view — affiche palier en cours

Dans le hero, ajouter un indicateur :

```tsx
<div className="flex items-center gap-1.5 text-sm text-violet-300">
  <span>🏆 Palier {(current as { tier?: number }).tier ?? 1}</span>
  <span>•</span>
  <span>Profondeur {current.currentDepth} / {ANOMALY_MAX_DEPTH}</span>
</div>
```

### 7.3 Toast unlock

Dans `advanceMutation.onSuccess`, après les autres toasts :

```tsx
if ((data as { newTierUnlocked?: number | null }).newTierUnlocked) {
  addToast(
    `🏆 PALIER ${(data as { newTierUnlocked: number }).newTierUnlocked} DÉBLOQUÉ !`,
    'success',
  );
}
```

### 7.4 Page Leaderboard `/anomaly/leaderboard`

Nouvelle route + nouveau component `AnomalyLeaderboard.tsx` :

```tsx
export default function AnomalyLeaderboard() {
  const { data: leaderboard } = trpc.anomaly.leaderboard.useQuery({ limit: 50 });
  return (
    <div className="space-y-4 p-4 lg:p-6">
      <PageHeader title="Leaderboard Anomaly" />
      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-panel-light/50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left">Rang</th>
              <th className="px-3 py-2 text-left">Joueur</th>
              <th className="px-3 py-2 text-right">Palier max</th>
              <th className="px-3 py-2 text-right">Niveau</th>
              <th className="px-3 py-2 text-right">XP</th>
            </tr>
          </thead>
          <tbody>
            {(leaderboard?.entries ?? []).map((entry, i) => (
              <tr key={entry.username} className="border-t border-panel-border hover:bg-panel-hover">
                <td className="px-3 py-2 font-mono">{i + 1}</td>
                <td className="px-3 py-2">{entry.username}</td>
                <td className="px-3 py-2 text-right font-bold">🏆 {entry.maxTierCompleted}</td>
                <td className="px-3 py-2 text-right">{entry.level}</td>
                <td className="px-3 py-2 text-right text-gray-400">{entry.xp.toLocaleString()}</td>
              </tr>
            ))}
            {(!leaderboard?.entries || leaderboard.entries.length === 0) && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                Aucun joueur n'a encore complété un palier.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

Route ajoutée dans `apps/web/src/router.tsx`. Bouton "Leaderboard" dans la page `/anomaly` qui pointe vers `/anomaly/leaderboard`.

---

## 8. Tests

### 8.1 Engine

- `tierMultiplier(1, 1.0)` = 1.0
- `tierMultiplier(5, 1.0)` = 5.0
- `tierMultiplier(10, 2.0)` = 1 + 9×2 = 19.0
- `anomalyEnemyFP(1000, 5, { tierMultiplier: 3 })` = 1000 × min(0.5×1.15^4, 1.3) × 3 ≈ 2622

### 8.2 Service

- `engage(tier=1)` happy path
- `engage(tier=999)` → BAD_REQUEST si maxTierUnlocked < 999
- `advance` runComplete tier 1, max=1 → unlock tier 2 (newTierUnlocked = 2)
- `advance` runComplete tier 1, max=5 → no change (re-run un palier inférieur)
- `getLeaderboard` ordering correct

---

## 9. Estimation

| Phase | Effort |
|---|---|
| DB migration 0072 + Drizzle schema (flagships + anomalies) | 0.5h |
| Engine `tierMultiplier` + tests | 1h |
| Backend `engage` tier validation + cost scaling | 1h |
| Backend `advance` enemy FP scaling + loot scaling + runComplete unlock | 1.5h |
| Backend `getLeaderboard` endpoint | 0.5h |
| Frontend EngageModal selector + cost preview | 1.5h |
| Frontend run view tier indicator + toast unlock | 0.5h |
| Frontend leaderboard page + route | 1.5h |
| Tests + lint + push + deploy + annonce | 1h |
| **Total** | **~9h** |

---

## 10. Hors scope

- **Modules legendary par tier** : pool 57 fixe pour V1
- **Time-based leaderboard** : table dédiée nécessaire (V2)
- **Achievements** ("premier palier 10") : sub-projet séparé
- **Per-tier event seeded content** : events identiques across paliers
- **Multi-flagship per user** : `maxTierUnlocked` sur flagship, donc spécifique à ce flagship si on autorise plusieurs un jour
- **Re-run free** : le re-run paie le cost scaled même pour un palier déjà completed (cohérent V4)

---

## 11. Rollout & risques

### 11.1 Ordre

Mono-PR :
1. Migration 0072
2. Engine + tests
3. Backend integration (engage + advance + leaderboard)
4. Frontend (EngageModal + Anomaly.tsx + Leaderboard page)
5. Lint + tests verts → commit + push + deploy
6. Smoke test prod
7. Annonce in-game

### 11.2 Risques

| Risque | Mitigation |
|---|---|
| Tier 2 trop dur même pour L60 max-équipé | Tunable via `anomaly_tier_multiplier_factor` (baisse à 0.5 → palier N = ×(1+0.5(N-1)) plus doux) |
| Inflation économique (paliers 1-10 loot ×N) | Cap loot à palier 10 + Exilium engage scaled (palier 10 = 50 Ex perdus si wipe) limite le ROI |
| Joueurs débloquent palier 2 vite, pas de défi | Tunable factor + observe meta — si saturation rapide à L1, raise factor ou raise base difficulty |
| Anomalies actives V4 avec `tier` non set → default 1 OK | `DEFAULT 1` dans la migration assure back-compat |
| Leaderboard avec 0 flagship complété → page vide | Affiche message "Aucun joueur n'a encore complété un palier" |

### 11.3 Tunables universe_config

- `anomaly_tier_multiplier_factor` (default 1.0) — formule tier
- `anomaly_loot_tier_cap` (default 10) — cap loot scaling
- `anomaly_tier_engage_cost_factor` (default 1.0) — scaling coût engage
