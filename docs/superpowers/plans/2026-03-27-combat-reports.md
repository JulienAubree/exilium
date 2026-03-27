# Refonte des rapports de mission — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework all mission reports — full combat reports for pirate missions, new list+detail page layout with FP comparison, shot counts, animated replay, and refreshed mine/spy views.

**Architecture:** Backend changes make pirate handler produce structured combat reports (like attack handler), and enrich all combat reports with FP + shot data. Frontend replaces the monolithic 1052-line Reports.tsx split-view with a card list page (`/reports`) and a dedicated detail page (`/reports/:id`) using extracted components per report type.

**Tech Stack:** TypeScript, React 19, tRPC, Drizzle ORM, Tailwind CSS, `@ogame-clone/game-engine` (simulateCombat, computeFleetFP)

---

### Task 1: Backend — Pirate service returns full CombatResult

**Files:**
- Modify: `apps/api/src/modules/pve/pirate.service.ts`

The pirate service currently calls `simulateCombat()` but only returns a simplified `PirateArrivalResult`. We need to also return the full `CombatResult` so the pirate handler can build a structured report.

- [ ] **Step 1: Update PirateArrivalResult interface to include combatResult**

In `apps/api/src/modules/pve/pirate.service.ts`, add the import and extend the interface:

```typescript
// At the top, add CombatResult to the import
import {
  simulateCombat,
  computeFleetFP,
  scaleFleetToFP,
  type CombatMultipliers,
  type CombatConfig,
  type CombatInput,
  type CombatResult,
  type ShipCategory,
  type ShipCombatConfig,
  type UnitCombatStats,
  type FPConfig,
} from '@ogame-clone/game-engine';

// Update the interface
interface PirateArrivalResult {
  outcome: 'attacker' | 'defender' | 'draw';
  survivingShips: Record<string, number>;
  loot: { minerai: number; silicium: number; hydrogene: number };
  bonusShips: Record<string, number>;
  attackerLosses: Record<string, number>;
  combatResult: CombatResult;
}
```

- [ ] **Step 2: Update processPirateArrival to return combatResult**

In the `return` statement at the end of `processPirateArrival` (~line 156), add the `combatResult` field:

```typescript
      return {
        outcome: result.outcome,
        survivingShips,
        loot,
        bonusShips,
        attackerLosses: result.attackerLosses,
        combatResult: result,
      };
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/julienaubree/_projet/ogame-clone && pnpm --filter @ogame-clone/api typecheck`
Expected: PASS (no type errors)

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/pve/pirate.service.ts
git commit -m "feat(api): pirate service returns full CombatResult for report generation"
```

---

### Task 2: Backend — Pirate handler creates structured combat report

**Files:**
- Modify: `apps/api/src/modules/fleet/handlers/pirate.handler.ts`

The pirate handler currently creates only a system message. We need it to also create a full combat report via `reportService.create()`, matching the same structure as attack reports.

- [ ] **Step 1: Add imports for FP computation**

At the top of `pirate.handler.ts`, add:

```typescript
import { eq } from 'drizzle-orm';
import { fleetEvents, pveMissions, planets } from '@ogame-clone/db';
import { totalCargoCapacity, computeFleetFP, type UnitCombatStats, type FPConfig } from '@ogame-clone/game-engine';
import type { MissionHandler, SendFleetInput, GameConfig, MissionHandlerContext, FleetEvent, ArrivalResult } from '../fleet.types.js';
import { buildShipStatsMap, getCombatMultipliers, formatDuration } from '../fleet.types.js';
```

- [ ] **Step 2: Add report creation after system message**

After the `if (ctx.messageService) { ... }` block (after line 93), add the report creation code. Insert before the `return` statement:

```typescript
    // Create structured combat report
    let reportId: string | undefined;
    if (ctx.reportService) {
      // Compute FP
      const shipStats: Record<string, UnitCombatStats> = {};
      for (const [id, ship] of Object.entries(config.ships)) {
        shipStats[id] = { weapons: ship.weapons, shotCount: ship.shotCount ?? 1, shield: ship.shield, hull: ship.hull };
      }
      const fpConfig: FPConfig = {
        shotcountExponent: Number(config.universe.fp_shotcount_exponent) || 1.5,
        divisor: Number(config.universe.fp_divisor) || 100,
      };
      const attackerFP = computeFleetFP(ships, shipStats, fpConfig);
      const defenderFP = params.pirateFP ?? computeFleetFP(params.scaledFleet, shipStats, fpConfig);

      // Compute shots per round from ship configs and round data
      const shipConfigs = config.ships;
      const combatResult = result.combatResult;
      const shotsPerRound = combatResult.rounds.map((round, i) => {
        // Fleet at START of round = initial for round 0, previous round's survivors otherwise
        const attFleet = i === 0 ? ships : combatResult.rounds[i - 1].attackerShips;
        const defFleet = i === 0 ? params.scaledFleet : combatResult.rounds[i - 1].defenderShips;
        const attShots = Object.entries(attFleet).reduce((sum, [id, count]) => sum + count * (shipConfigs[id]?.shotCount ?? 1), 0);
        const defShots = Object.entries(defFleet).reduce((sum, [id, count]) => sum + count * (shipConfigs[id]?.shotCount ?? 1), 0);
        return { attacker: attShots, defender: defShots };
      });

      // Build report result
      const reportResult: Record<string, unknown> = {
        outcome: result.outcome,
        roundCount: combatResult.rounds.length,
        attackerFleet: ships,
        attackerLosses: result.attackerLosses,
        attackerSurvivors: result.survivingShips,
        attackerStats: combatResult.attackerStats,
        defenderFleet: params.scaledFleet,
        defenderDefenses: {},
        defenderLosses: combatResult.defenderLosses,
        defenderSurvivors: (() => {
          const survivors: Record<string, number> = {};
          for (const [type, count] of Object.entries(params.scaledFleet)) {
            const remaining = count - (combatResult.defenderLosses[type] ?? 0);
            if (remaining > 0) survivors[type] = remaining;
          }
          return survivors;
        })(),
        repairedDefenses: {},
        debris: combatResult.debris,
        rounds: combatResult.rounds,
        defenderStats: combatResult.defenderStats,
        attackerFP,
        defenderFP,
        shotsPerRound,
      };

      if (result.outcome === 'attacker') {
        reportResult.pillage = result.loot;
        if (Object.keys(result.bonusShips).length > 0) {
          reportResult.bonusShips = result.bonusShips;
        }
      }

      // Fetch origin planet for report
      const [originPlanet] = await ctx.db.select({
        galaxy: planets.galaxy,
        system: planets.system,
        position: planets.position,
        name: planets.name,
      }).from(planets).where(eq(planets.id, fleetEvent.originPlanetId)).limit(1);

      const report = await ctx.reportService.create({
        userId: fleetEvent.userId,
        fleetEventId: fleetEvent.id,
        pveMissionId: pveMissionId ?? undefined,
        messageId: undefined, // link to message if available
        missionType: 'pirate',
        title: `Mission pirate ${coords} — ${outcomeText}`,
        coordinates: {
          galaxy: fleetEvent.targetGalaxy,
          system: fleetEvent.targetSystem,
          position: fleetEvent.targetPosition,
        },
        originCoordinates: originPlanet ? {
          galaxy: originPlanet.galaxy,
          system: originPlanet.system,
          position: originPlanet.position,
          planetName: originPlanet.name,
        } : undefined,
        fleet: {
          ships,
          totalCargo: preCargoCapacity,
        },
        departureTime: fleetEvent.departureTime,
        completionTime: fleetEvent.arrivalTime,
        result: reportResult,
      });
      reportId = report.id;
    }
```

Note: The `messageId` can be linked if the system message was created first. Update the `if (ctx.messageService)` block to capture the message id:

Before the messageService block, declare: `let messageId: string | undefined;`

Inside the `if (ctx.messageService)` block, after creating the message, capture: `messageId = msg.id;` (where `msg` is the result of `createSystemMessage`). Then use `messageId` in the report creation.

Update the messageService block:

```typescript
    let messageId: string | undefined;
    if (ctx.messageService) {
      const parts = [`Mission pirate ${coords} — ${outcomeText}\n`];
      parts.push(`Durée du trajet : ${duration}`);
      if (result.outcome === 'attacker') {
        parts.push(`Butin : ${result.loot.minerai} minerai, ${result.loot.silicium} silicium, ${result.loot.hydrogene} hydrogène`);
        if (Object.keys(result.bonusShips).length > 0) {
          const bonusList = Object.entries(result.bonusShips).map(([id, count]) => `${id}: ${count}`).join(', ');
          parts.push(`Vaisseaux bonus : ${bonusList}`);
        }
      }
      const losses: string[] = [];
      for (const [shipId, count] of Object.entries(ships)) {
        const surviving = result.survivingShips[shipId] ?? 0;
        const lost = count - surviving;
        if (lost > 0) losses.push(`${shipId}: ${lost}`);
      }
      if (losses.length > 0) {
        parts.push(`Vaisseaux perdus : ${losses.join(', ')}`);
      }
      const msg = await ctx.messageService.createSystemMessage(
        fleetEvent.userId,
        'mission',
        `Mission pirate ${coords} — ${outcomeText}`,
        parts.join('\n'),
      );
      messageId = msg.id;
    }
```

And in the report creation, replace `messageId: undefined` with `messageId`.

- [ ] **Step 3: Add `planets` import**

Make sure `planets` is imported from `@ogame-clone/db` at the top of the file (needed for origin planet query).

- [ ] **Step 4: Verify build**

Run: `cd /Users/julienaubree/_projet/ogame-clone && pnpm --filter @ogame-clone/api typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/fleet/handlers/pirate.handler.ts
git commit -m "feat(api): pirate handler creates full structured combat report"
```

---

### Task 3: Backend — Attack handler adds FP + shotsPerRound to report result

**Files:**
- Modify: `apps/api/src/modules/fleet/handlers/attack.handler.ts`

Add `attackerFP`, `defenderFP`, and `shotsPerRound` to the report JSONB stored by the attack handler.

- [ ] **Step 1: Add FP imports**

At the top of `attack.handler.ts`, update the game-engine import to include FP utilities:

```typescript
import { simulateCombat, totalCargoCapacity, computeFleetFP, type UnitCombatStats, type FPConfig } from '@ogame-clone/game-engine';
```

- [ ] **Step 2: Compute FP and shotsPerRound before report creation**

Before the `// Create structured mission report` section (~line 243), add:

```typescript
    // Compute FP for both sides
    const unitCombatStats: Record<string, UnitCombatStats> = {};
    for (const [id, ship] of Object.entries(config.ships)) {
      unitCombatStats[id] = { weapons: ship.weapons, shotCount: ship.shotCount ?? 1, shield: ship.shield, hull: ship.hull };
    }
    for (const [id, def] of Object.entries(config.defenses)) {
      unitCombatStats[id] = { weapons: def.weapons, shotCount: def.shotCount ?? 1, shield: def.shield, hull: def.hull };
    }
    const fpConfig: FPConfig = {
      shotcountExponent: Number(config.universe.fp_shotcount_exponent) || 1.5,
      divisor: Number(config.universe.fp_divisor) || 100,
    };
    const attackerFP = computeFleetFP(ships, unitCombatStats, fpConfig);
    const defenderCombinedForFP: Record<string, number> = { ...defenderFleet, ...defenderDefenses };
    const defenderFP = computeFleetFP(defenderCombinedForFP, unitCombatStats, fpConfig);

    // Compute shots per round
    const shotsPerRound = rounds.map((round, i) => {
      const attFleet = i === 0 ? ships : rounds[i - 1].attackerShips;
      const defFleetRound = i === 0 ? defenderCombined : rounds[i - 1].defenderShips;
      const attShots = Object.entries(attFleet).reduce((sum, [id, count]) => {
        const sc = config.ships[id]?.shotCount ?? config.defenses[id]?.shotCount ?? 1;
        return sum + count * sc;
      }, 0);
      const defShots = Object.entries(defFleetRound).reduce((sum, [id, count]) => {
        const sc = config.ships[id]?.shotCount ?? config.defenses[id]?.shotCount ?? 1;
        return sum + count * sc;
      }, 0);
      return { attacker: attShots, defender: defShots };
    });
```

- [ ] **Step 3: Add new fields to reportResult**

In the `reportResult` object (~line 244-261), add the three new fields after `defenderStats`:

```typescript
        attackerFP,
        defenderFP,
        shotsPerRound,
```

- [ ] **Step 4: Verify build**

Run: `cd /Users/julienaubree/_projet/ogame-clone && pnpm --filter @ogame-clone/api typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/fleet/handlers/attack.handler.ts
git commit -m "feat(api): attack reports include FP comparison and shots per round"
```

---

### Task 4: Backend — Report service: markAllRead + exclude pirate from cleanup

**Files:**
- Modify: `apps/api/src/modules/report/report.service.ts`

- [ ] **Step 1: Fix cleanup to exclude pirate reports**

In `cleanupOldReports` (~line 41-51), change the filter to exclude both attack AND pirate:

```typescript
    async cleanupOldReports(userId: string) {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      await db
        .delete(missionReports)
        .where(
          and(
            eq(missionReports.userId, userId),
            lt(missionReports.createdAt, threeDaysAgo),
            sql`${missionReports.missionType}::text NOT IN ('attack', 'pirate')`,
          ),
        );
    },
```

- [ ] **Step 2: Add markAllRead method**

After `countUnread` (~line 133), add:

```typescript
    async markAllRead(userId: string) {
      await db
        .update(missionReports)
        .set({ read: true })
        .where(and(eq(missionReports.userId, userId), eq(missionReports.read, false)));
    },
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/julienaubree/_projet/ogame-clone && pnpm --filter @ogame-clone/api typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/report/report.service.ts
git commit -m "feat(api): report service markAllRead + exclude pirate from cleanup"
```

---

### Task 5: Backend — Report router: markAllRead endpoint

**Files:**
- Modify: `apps/api/src/modules/report/report.router.ts`

- [ ] **Step 1: Add markAllRead mutation**

After the `unreadCount` query (~line 46), add:

```typescript
    markAllRead: protectedProcedure
      .mutation(async ({ ctx }) => {
        await reportService.markAllRead(ctx.userId!);
        return { success: true };
      }),
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/julienaubree/_projet/ogame-clone && pnpm --filter @ogame-clone/api typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/report/report.router.ts
git commit -m "feat(api): add markAllRead endpoint to report router"
```

---

### Task 6: Frontend — Router: add `/reports/:id` route

**Files:**
- Modify: `apps/web/src/router.tsx`

- [ ] **Step 1: Add the detail route**

In `router.tsx`, after the existing `reports` route (~line 146), add:

```typescript
      {
        path: 'reports/:reportId',
        lazy: lazyLoad(() => import('./pages/ReportDetail')),
        errorElement: <ErrorBoundary><RouteErrorFallback /></ErrorBoundary>,
      },
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/router.tsx
git commit -m "feat(web): add /reports/:reportId route for report detail page"
```

---

### Task 7: Frontend — ReportCard component

**Files:**
- Create: `apps/web/src/components/reports/ReportCard.tsx`

- [ ] **Step 1: Create the component**

```typescript
// apps/web/src/components/reports/ReportCard.tsx
import { useNavigate } from 'react-router';
import { getUnitName } from '@/lib/entity-names';
import { cn } from '@/lib/utils';

const OUTCOME_STYLES: Record<string, string> = {
  attacker: 'bg-emerald-500/20 text-emerald-400',
  defender: 'bg-red-500/20 text-red-400',
  draw: 'bg-amber-500/20 text-amber-400',
};

const TYPE_ICONS: Record<string, string> = {
  attack: '⚔',
  pirate: '☠',
  mine: '⛏',
  spy: '👁',
};

function timeAgo(date: string | Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}

interface ReportCardProps {
  report: {
    id: string;
    missionType: string;
    title: string;
    read: boolean;
    createdAt: string | Date;
    result: Record<string, any>;
  };
  gameConfig: any;
}

export function ReportCard({ report, gameConfig }: ReportCardProps) {
  const navigate = useNavigate();
  const result = report.result ?? {};
  const isCombat = report.missionType === 'attack' || report.missionType === 'pirate';

  const outcomeLabel = isCombat
    ? result.outcome === 'attacker' ? 'Victoire' : result.outcome === 'defender' ? 'Défaite' : 'Nul'
    : null;
  const outcomeStyle = isCombat ? (OUTCOME_STYLES[result.outcome] ?? OUTCOME_STYLES.draw) : '';

  // Mining result label
  const isMine = report.missionType === 'mine';
  const rewards = isMine ? result.rewards ?? {} : {};

  // Spy result
  const isSpy = report.missionType === 'spy';

  return (
    <button
      type="button"
      onClick={() => navigate(`/reports/${report.id}`)}
      className={cn(
        'w-full text-left glass-card p-3 space-y-1.5 transition-colors hover:bg-accent/30',
        !report.read && 'border-l-2 border-l-primary',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base shrink-0">{TYPE_ICONS[report.missionType] ?? '📋'}</span>
          <span className={cn('text-sm truncate', !report.read ? 'font-semibold text-foreground' : 'text-foreground')}>
            {report.title}
          </span>
        </div>
        {isCombat && outcomeLabel && (
          <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', outcomeStyle)}>
            {outcomeLabel}
          </span>
        )}
        {isMine && (
          <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase bg-blue-500/20 text-blue-400">
            Terminée
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {isCombat && result.attackerFP != null && (
          <span>{result.attackerFP} FP vs {result.defenderFP} FP</span>
        )}
        {isCombat && result.roundCount != null && (
          <span>{result.roundCount} round{result.roundCount > 1 ? 's' : ''}</span>
        )}
        {isMine && (
          <span>
            {rewards.minerai > 0 && <span className="text-minerai">M: {rewards.minerai.toLocaleString('fr-FR')}</span>}
            {rewards.minerai > 0 && rewards.silicium > 0 && ' · '}
            {rewards.silicium > 0 && <span className="text-silicium">S: {rewards.silicium.toLocaleString('fr-FR')}</span>}
          </span>
        )}
        {isSpy && result.visibility && (
          <span>{Object.values(result.visibility).filter(Boolean).length}/5 sections</span>
        )}
        <span className="ml-auto">{timeAgo(report.createdAt)}</span>
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/reports/ReportCard.tsx
git commit -m "feat(web): add ReportCard component for report list items"
```

---

### Task 8: Frontend — MineReportDetail component

**Files:**
- Create: `apps/web/src/components/reports/MineReportDetail.tsx`

Extract the mine report rendering from the current `Reports.tsx` (lines 224-386) into its own component.

- [ ] **Step 1: Create the component**

```typescript
// apps/web/src/components/reports/MineReportDetail.tsx
import { cn } from '@/lib/utils';

const RESOURCE_COLORS: Record<string, string> = {
  minerai: 'text-orange-400',
  silicium: 'text-emerald-400',
  hydrogene: 'text-blue-400',
};

interface MineReportDetailProps {
  result: Record<string, any>;
  fleet: Record<string, any>;
  gameConfig: any;
}

export function MineReportDetail({ result, fleet, gameConfig }: MineReportDetailProps) {
  const rewards = result.rewards ?? {};
  const gross = result.grossMined ?? {};
  const slagPct = Math.round((result.slagRate ?? 0) * 100);
  const totalRewards = (rewards.minerai ?? 0) + (rewards.silicium ?? 0) + (rewards.hydrogene ?? 0);
  const totalGross = (gross.minerai ?? 0) + (gross.silicium ?? 0) + (gross.hydrogene ?? 0);
  const totalSlag = totalGross - totalRewards;
  const cargoCapacity = result.cargoCapacity ?? fleet?.totalCargo ?? 0;
  const cargoPct = cargoCapacity > 0 ? Math.round((totalRewards / cargoCapacity) * 100) : 0;
  const hasGross = totalGross > 0;

  return (
    <div className="space-y-4">
      {/* Pipeline de minage */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pipeline de minage</h3>
        <div className="glass-card p-4 space-y-4">

          {/* Step 1: Extraction brute */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">1</span>
              <span className="text-xs font-semibold text-foreground">Extraction du gisement</span>
              {result.fleetExtraction && (
                <span className="text-[10px] text-muted-foreground">(capacité d'extraction : {result.fleetExtraction.toLocaleString('fr-FR')}/cycle)</span>
              )}
            </div>
            {hasGross ? (
              <div className="ml-7 flex flex-wrap gap-3">
                {(['minerai', 'silicium', 'hydrogene'] as const).map((r) => {
                  const val = gross[r] ?? 0;
                  if (val === 0) return null;
                  return (
                    <span key={r} className="text-sm">
                      <span className={cn('font-bold', RESOURCE_COLORS[r])}>{val.toLocaleString('fr-FR')}</span>
                      <span className="text-muted-foreground ml-1 capitalize">{r}</span>
                    </span>
                  );
                })}
                <span className="text-xs text-muted-foreground">= {totalGross.toLocaleString('fr-FR')} total</span>
              </div>
            ) : (
              <div className="ml-7 flex flex-wrap gap-3">
                {(['minerai', 'silicium', 'hydrogene'] as const).map((r) => {
                  const val = rewards[r] ?? 0;
                  if (val === 0 && slagPct === 0) return null;
                  const approxGross = slagPct > 0 ? Math.round(val / (1 - result.slagRate)) : val;
                  if (approxGross === 0) return null;
                  return (
                    <span key={r} className="text-sm">
                      <span className={cn('font-bold', RESOURCE_COLORS[r])}>~{approxGross.toLocaleString('fr-FR')}</span>
                      <span className="text-muted-foreground ml-1 capitalize">{r}</span>
                    </span>
                  );
                })}
              </div>
            )}
            <p className="ml-7 mt-1 text-[10px] text-muted-foreground/70">
              Ressources brutes prélevées sur l'astéroïde, réparties proportionnellement aux réserves restantes.
            </p>
          </div>

          {/* Step 2: Scories */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold">2</span>
              <span className="text-xs font-semibold text-foreground">Pertes en scories</span>
              <span className="text-[10px] text-muted-foreground">({slagPct}% du minerai brut)</span>
            </div>
            <div className="ml-7">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-red-500/60" style={{ width: `${slagPct}%` }} />
                </div>
                <span className="text-xs font-medium text-red-400 tabular-nums w-16 text-right">
                  -{totalSlag > 0 ? totalSlag.toLocaleString('fr-FR') : '~' + Math.round(totalRewards * result.slagRate / (1 - result.slagRate)).toLocaleString('fr-FR')}
                </span>
              </div>
            </div>
            <p className="ml-7 mt-1 text-[10px] text-muted-foreground/70">
              {slagPct > 0
                ? "Une partie des ressources est perdue lors du raffinage. Améliorez Raffinage spatial profond pour réduire ce taux."
                : 'Aucune perte ! Votre technologie de raffinage élimine toutes les scories.'}
            </p>
          </div>

          {/* Step 3: Chargement en soute */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">3</span>
              <span className="text-xs font-semibold text-foreground">Chargement en soute</span>
              <span className="text-[10px] text-muted-foreground">({totalRewards.toLocaleString('fr-FR')} / {cargoCapacity.toLocaleString('fr-FR')})</span>
            </div>
            <div className="ml-7">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500/70" style={{ width: `${Math.min(100, cargoPct)}%` }} />
                </div>
                <span className={cn('text-xs font-medium tabular-nums w-10 text-right', cargoPct >= 90 ? 'text-emerald-400' : 'text-muted-foreground')}>
                  {cargoPct}%
                </span>
              </div>
            </div>
            <p className="ml-7 mt-1 text-[10px] text-muted-foreground/70">
              {cargoPct >= 95
                ? 'Soute pleine ! Pour transporter plus, ajoutez des vaisseaux cargo ou améliorez la capacité de soute.'
                : cargoPct >= 50
                  ? "Soute partiellement remplie. Le gisement n'avait plus assez de ressources pour remplir toute la soute."
                  : "Soute faiblement remplie. Le gisement manquait de ressources ou la capacité d'extraction était limitée."}
            </p>
          </div>

          {/* Step 4: Résultat final */}
          <div className="border-t border-border pt-3">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold">4</span>
              <span className="text-xs font-semibold text-foreground">Ressources rapportées</span>
            </div>
            <div className="ml-7 flex flex-wrap gap-4">
              {(['minerai', 'silicium', 'hydrogene'] as const).map((r) => {
                const val = rewards[r] ?? 0;
                if (val === 0) return null;
                return (
                  <div key={r} className="flex items-center gap-2">
                    <span className={cn('text-lg font-bold', RESOURCE_COLORS[r])}>
                      +{val.toLocaleString('fr-FR')}
                    </span>
                    <span className="text-sm text-muted-foreground capitalize">{r}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Technologies */}
      {result.technologies?.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Technologies appliquées</h3>
          <div className="glass-card p-4 space-y-2">
            {result.technologies.map((tech: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-foreground">
                  {tech.name === 'deepSpaceRefining' ? 'Raffinage spatial profond' : 'Bonus de minage'}
                  {tech.level != null && <span className="text-primary ml-1">Niv. {tech.level}</span>}
                </span>
                <span className="text-muted-foreground">{tech.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/reports/MineReportDetail.tsx
git commit -m "feat(web): extract MineReportDetail component from Reports.tsx"
```

---

### Task 9: Frontend — SpyReportDetail component

**Files:**
- Create: `apps/web/src/components/reports/SpyReportDetail.tsx`

Extract spy report rendering from `Reports.tsx` (lines 388-644).

- [ ] **Step 1: Create the component**

```typescript
// apps/web/src/components/reports/SpyReportDetail.tsx
import { cn } from '@/lib/utils';
import { getShipName, getDefenseName, getBuildingName, getResearchName } from '@/lib/entity-names';

const RESOURCE_COLORS: Record<string, string> = {
  minerai: 'text-orange-400',
  silicium: 'text-emerald-400',
  hydrogene: 'text-blue-400',
};

interface SpyReportDetailProps {
  result: Record<string, any>;
  gameConfig: any;
}

export function SpyReportDetail({ result, gameConfig }: SpyReportDetailProps) {
  const visibility = result.visibility ?? {};
  const visibilityKeys = ['resources', 'fleet', 'defenses', 'buildings', 'research'] as const;
  const probeCount: number = result.probeCount ?? 0;
  const attackerTech: number = result.attackerTech ?? 0;
  const defenderTech: number = result.defenderTech ?? 0;
  const detectionChance: number = result.detectionChance ?? 0;
  const techDiff = defenderTech - attackerTech;
  const effectiveInfo = probeCount - techDiff;
  const thresholds = [1, 3, 5, 7, 9];
  const thresholdLabels = ['Ressources', 'Flotte', 'Défenses', 'Bâtiments', 'Recherches'];

  return (
    <div className="space-y-4">
      {/* Visibility & Detection */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Informations obtenues</h3>
        <div className="glass-card p-4">
          <div className="flex flex-wrap gap-2 mb-3">
            {visibilityKeys.map((key) => (
              <span
                key={key}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium',
                  visibility[key]
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-white/5 text-muted-foreground',
                )}
              >
                {visibility[key] ? '\u2713' : '\u2717'} {gameConfig?.labels[`spy_visibility.${key}`] ?? key}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span>Sondes : <span className="text-foreground font-medium">{probeCount}</span></span>
            <span>Tech espionnage : <span className="text-foreground font-medium">{attackerTech}</span> vs <span className="text-foreground font-medium">{defenderTech}</span></span>
            <span>Chance de détection : <span className={cn('font-medium', detectionChance > 50 ? 'text-red-400' : 'text-foreground')}>{detectionChance}%</span></span>
            {result.detected && <span className="text-red-400 font-medium">Sondes détruites</span>}
          </div>
        </div>
      </div>

      {/* Pipeline explanation */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Comment ce rapport a été calculé</h3>
        <div className="space-y-3">
          {/* Step 1: Effective info */}
          <div className="glass-card p-4">
            <div className="flex items-start gap-2.5">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-[10px] font-bold text-violet-400">1</div>
              <div className="flex-1 space-y-1.5">
                <div className="text-xs font-medium text-foreground">Calcul de l'info effective</div>
                <div className="text-[11px] text-muted-foreground">
                  <span className="text-violet-400 font-mono">{probeCount}</span> sondes
                  {techDiff !== 0 && (
                    <> − (<span className="text-red-400 font-mono">{defenderTech}</span> tech ennemi − <span className="text-emerald-400 font-mono">{attackerTech}</span> votre tech) </>
                  )}
                  {techDiff === 0 && <> (tech égale : pas de malus) </>}
                  = <span className="text-foreground font-bold font-mono">{effectiveInfo}</span> info effective
                </div>
                {techDiff > 0 && (
                  <div className="text-[10px] text-amber-400/80">
                    L'ennemi a {techDiff} niveau{techDiff > 1 ? 'x' : ''} d'avance en espionnage, ce qui réduit vos informations de {techDiff} point{techDiff > 1 ? 's' : ''}.
                  </div>
                )}
                {techDiff < 0 && (
                  <div className="text-[10px] text-emerald-400/80">
                    Vous avez {-techDiff} niveau{-techDiff > 1 ? 'x' : ''} d'avance en espionnage, ce qui augmente vos informations de {-techDiff} point{-techDiff > 1 ? 's' : ''}.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Step 2: Visibility thresholds */}
          <div className="glass-card p-4">
            <div className="flex items-start gap-2.5">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-[10px] font-bold text-violet-400">2</div>
              <div className="flex-1 space-y-1.5">
                <div className="text-xs font-medium text-foreground">Seuils de visibilité</div>
                <div className="text-[11px] text-muted-foreground mb-1">
                  Votre score de <span className="text-foreground font-bold">{effectiveInfo}</span> débloque les catégories dont le seuil est inférieur ou égal.
                </div>
                <div className="space-y-0.5">
                  {thresholds.map((t, i) => {
                    const unlocked = effectiveInfo >= t;
                    return (
                      <div key={i} className="flex items-center gap-2 text-[11px]">
                        <div className={cn('w-14 text-right font-mono', unlocked ? 'text-emerald-400' : 'text-muted-foreground/50')}>
                          ≥ {t}
                        </div>
                        <div className={cn('h-1.5 flex-1 rounded-full', unlocked ? 'bg-emerald-500/30' : 'bg-white/5')}>
                          <div
                            className={cn('h-full rounded-full', unlocked ? 'bg-emerald-500' : 'bg-transparent')}
                            style={{ width: unlocked ? '100%' : '0%' }}
                          />
                        </div>
                        <span className={cn('w-24 text-[10px]', unlocked ? 'text-emerald-400' : 'text-muted-foreground/50')}>
                          {unlocked ? '\u2713' : '\u2717'} {thresholdLabels[i]}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {effectiveInfo < 9 && (
                  <div className="text-[10px] text-slate-500 mt-1">
                    Pour tout voir : envoyez {9 + techDiff} sonde{9 + techDiff > 1 ? 's' : ''}{techDiff > 0 ? ` (ou montez votre tech espionnage pour réduire l'écart)` : ''}.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Step 3: Detection */}
          <div className="glass-card p-4">
            <div className="flex items-start gap-2.5">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-[10px] font-bold text-violet-400">3</div>
              <div className="flex-1 space-y-1.5">
                <div className="text-xs font-medium text-foreground">Risque de détection</div>
                <div className="text-[11px] text-muted-foreground">
                  <span className="text-violet-400 font-mono">{probeCount}</span> × 2
                  {attackerTech !== defenderTech && (
                    <> − (<span className="text-emerald-400 font-mono">{attackerTech}</span> − <span className="text-red-400 font-mono">{defenderTech}</span>) × 4</>
                  )}
                  {' '}= <span className={cn('font-bold font-mono', detectionChance >= 50 ? 'text-red-400' : detectionChance > 0 ? 'text-amber-400' : 'text-emerald-400')}>{detectionChance}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', detectionChance >= 50 ? 'bg-red-500' : detectionChance > 0 ? 'bg-amber-500' : 'bg-emerald-500')}
                      style={{ width: `${Math.min(100, detectionChance)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground w-8 text-right">{detectionChance}%</span>
                </div>
                {result.detected ? (
                  <div className="text-[10px] text-red-400">Vos sondes ont été détectées et détruites par l'ennemi.</div>
                ) : detectionChance > 0 ? (
                  <div className="text-[10px] text-emerald-400/80">Vos sondes n'ont pas été détectées cette fois-ci.</div>
                ) : (
                  <div className="text-[10px] text-emerald-400/80">Aucun risque de détection grâce à votre avance technologique.</div>
                )}
                <div className="text-[10px] text-slate-500">
                  Chaque niveau d'avance en tech espionnage réduit la détection de 4%. Chaque sonde supplémentaire augmente le risque de 2%.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Spy data sections */}
      {result.resources && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Ressources</h3>
          <div className="glass-card p-4">
            <div className="flex flex-wrap gap-4">
              {Object.entries(result.resources as Record<string, number>).map(([resource, amount]) => (
                <div key={resource} className="flex items-center gap-2">
                  <span className={cn('text-lg font-bold', RESOURCE_COLORS[resource])}>{amount.toLocaleString('fr-FR')}</span>
                  <span className="text-sm text-muted-foreground capitalize">{resource}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {result.fleet && Object.keys(result.fleet).length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Flotte ennemie</h3>
          <div className="glass-card p-4">
            <div className="flex flex-wrap gap-3">
              {Object.entries(result.fleet as Record<string, number>).map(([ship, count]) => (
                <span key={ship} className="text-sm">
                  <span className="text-foreground font-medium">{count.toLocaleString('fr-FR')}x</span>{' '}
                  <span className="text-muted-foreground">{getShipName(ship, gameConfig)}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {result.defenses && Object.keys(result.defenses).length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Défenses</h3>
          <div className="glass-card p-4">
            <div className="flex flex-wrap gap-3">
              {Object.entries(result.defenses as Record<string, number>).map(([def, count]) => (
                <span key={def} className="text-sm">
                  <span className="text-foreground font-medium">{count.toLocaleString('fr-FR')}x</span>{' '}
                  <span className="text-muted-foreground">{getDefenseName(def, gameConfig)}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {result.buildings && Object.keys(result.buildings).length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Bâtiments</h3>
          <div className="glass-card p-4 space-y-1">
            {Object.entries(result.buildings as Record<string, number>).map(([building, level]) => (
              <div key={building} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{getBuildingName(building, gameConfig)}</span>
                <span className="text-foreground font-medium">Niv. {level}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.research && Object.keys(result.research).length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recherches</h3>
          <div className="glass-card p-4 space-y-1">
            {Object.entries(result.research as Record<string, number>).map(([tech, level]) => (
              <div key={tech} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{getResearchName(tech, gameConfig)}</span>
                <span className="text-foreground font-medium">Niv. {level}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/reports/SpyReportDetail.tsx
git commit -m "feat(web): extract SpyReportDetail component from Reports.tsx"
```

---

### Task 10: Frontend — CombatReportDetail component

**Files:**
- Create: `apps/web/src/components/reports/CombatReportDetail.tsx`

The main new component: FP bar, stats grid, losses, loot, debris, bonus ships, and collapsible RoundDisplay replay.

- [ ] **Step 1: Create the component**

```typescript
// apps/web/src/components/reports/CombatReportDetail.tsx
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { getUnitName, getDefenseName } from '@/lib/entity-names';
import { RoundDisplay } from '@/components/combat-guide/RoundDisplay';
import type { CombatResult } from '@ogame-clone/game-engine';

const RESOURCE_COLORS: Record<string, string> = {
  minerai: 'text-orange-400',
  silicium: 'text-emerald-400',
  hydrogene: 'text-blue-400',
};

const fmt = (n: number) => Math.floor(n).toLocaleString('fr-FR');

interface CombatReportDetailProps {
  result: Record<string, any>;
  missionType: 'attack' | 'pirate';
  gameConfig: any;
}

export function CombatReportDetail({ result, missionType, gameConfig }: CombatReportDetailProps) {
  const [replayOpen, setReplayOpen] = useState(false);

  const outcome = result.outcome as string;
  const outcomeLabel = outcome === 'attacker' ? 'Victoire' : outcome === 'defender' ? 'Défaite' : 'Match nul';
  const outcomeColor = outcome === 'attacker' ? 'text-emerald-400' : outcome === 'defender' ? 'text-red-400' : 'text-amber-400';
  const outcomeBg = outcome === 'attacker' ? 'bg-emerald-500/20' : outcome === 'defender' ? 'bg-red-500/20' : 'bg-amber-500/20';

  const attackerFP = result.attackerFP as number | undefined;
  const defenderFP = result.defenderFP as number | undefined;
  const totalFP = (attackerFP ?? 0) + (defenderFP ?? 0);
  const attackerFPPct = totalFP > 0 ? ((attackerFP ?? 0) / totalFP) * 100 : 50;

  const roundCount = result.roundCount as number ?? 0;
  const shotsPerRound = result.shotsPerRound as { attacker: number; defender: number }[] | undefined;
  const totalShots = shotsPerRound?.reduce((sum, r) => sum + r.attacker + r.defender, 0) ?? 0;

  const attStats = result.attackerStats as { shieldAbsorbed: number; armorBlocked: number; overkillWasted: number; damageDealtByCategory: Record<string, number> } | undefined;
  const defStats = result.defenderStats as typeof attStats | undefined;
  const totalShield = (attStats?.shieldAbsorbed ?? 0) + (defStats?.shieldAbsorbed ?? 0);
  const totalArmor = (attStats?.armorBlocked ?? 0) + (defStats?.armorBlocked ?? 0);

  const hasAttackerLosses = result.attackerLosses && Object.keys(result.attackerLosses).length > 0;
  const hasDefenderLosses = result.defenderLosses && Object.keys(result.defenderLosses).length > 0;

  // Build CombatResult-like object for RoundDisplay
  const combatResultForReplay: CombatResult | null = result.rounds ? {
    rounds: result.rounds,
    outcome: result.outcome,
    attackerLosses: result.attackerLosses ?? {},
    defenderLosses: result.defenderLosses ?? {},
    debris: result.debris ?? { minerai: 0, silicium: 0 },
    repairedDefenses: result.repairedDefenses ?? {},
    attackerStats: result.attackerStats ?? { shieldAbsorbed: 0, armorBlocked: 0, overkillWasted: 0, damageDealtByCategory: {}, damageReceivedByCategory: {} },
    defenderStats: result.defenderStats ?? { shieldAbsorbed: 0, armorBlocked: 0, overkillWasted: 0, damageDealtByCategory: {}, damageReceivedByCategory: {} },
  } : null;

  return (
    <div className="space-y-4">
      {/* FP Comparison Bar */}
      {attackerFP != null && defenderFP != null && (
        <div className="glass-card p-4">
          <div className="flex justify-between text-xs mb-2">
            <span className="text-blue-400 font-semibold">Votre flotte : {fmt(attackerFP)} FP</span>
            <span className="text-rose-400 font-semibold">{missionType === 'pirate' ? 'Pirates' : 'Défenseur'} : {fmt(defenderFP)} FP</span>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden">
            <div className="bg-blue-500 transition-all" style={{ width: `${attackerFPPct}%` }} />
            <div className="bg-rose-500 transition-all" style={{ width: `${100 - attackerFPPct}%` }} />
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-card p-3 text-center">
          <div className="text-xs text-muted-foreground">Rounds</div>
          <div className="text-xl font-bold text-foreground">{roundCount}</div>
        </div>
        <div className="glass-card p-3 text-center">
          <div className="text-xs text-muted-foreground">Tirs</div>
          <div className="text-xl font-bold text-foreground">{fmt(totalShots)}</div>
        </div>
        <div className="glass-card p-3 text-center">
          <div className="text-xs text-muted-foreground">Bouclier absorbé</div>
          <div className="text-xl font-bold text-cyan-400">{fmt(totalShield)}</div>
        </div>
        <div className="glass-card p-3 text-center">
          <div className="text-xs text-muted-foreground">Armure bloquée</div>
          <div className="text-xl font-bold text-amber-400">{fmt(totalArmor)}</div>
        </div>
      </div>

      {/* Losses */}
      {(hasAttackerLosses || hasDefenderLosses) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="glass-card p-4">
            <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">Vos pertes</h4>
            {hasAttackerLosses ? (
              <div className="flex flex-wrap gap-2">
                {Object.entries(result.attackerLosses as Record<string, number>).map(([unit, count]) => (
                  <span key={unit} className="text-sm">
                    <span className="text-red-400 font-medium">-{fmt(count)}</span>{' '}
                    <span className="text-muted-foreground">{getUnitName(unit, gameConfig)}</span>
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">Aucune</div>
            )}
          </div>
          <div className="glass-card p-4">
            <h4 className="text-xs font-semibold text-rose-400 uppercase tracking-wider mb-2">Pertes ennemies</h4>
            {hasDefenderLosses ? (
              <div className="flex flex-wrap gap-2">
                {Object.entries(result.defenderLosses as Record<string, number>).map(([unit, count]) => (
                  <span key={unit} className="text-sm">
                    <span className="text-red-400 font-medium">-{fmt(count)}</span>{' '}
                    <span className="text-muted-foreground">{getUnitName(unit, gameConfig)}</span>
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">Aucune</div>
            )}
          </div>
        </div>
      )}

      {/* Loot + Debris */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {result.pillage && (
          <div className="glass-card p-4">
            <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">Butin</h4>
            <div className="flex flex-wrap gap-3">
              {Object.entries(result.pillage as Record<string, number>).map(([resource, amount]) => (
                amount > 0 && (
                  <div key={resource} className="flex items-center gap-1.5">
                    <span className={cn('text-sm font-bold', RESOURCE_COLORS[resource])}>+{fmt(amount)}</span>
                    <span className="text-xs text-muted-foreground capitalize">{resource}</span>
                  </div>
                )
              ))}
            </div>
          </div>
        )}
        {result.debris && (result.debris.minerai > 0 || result.debris.silicium > 0) && (
          <div className="glass-card p-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Débris</h4>
            <div className="flex flex-wrap gap-3">
              {result.debris.minerai > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className={cn('text-sm font-bold', RESOURCE_COLORS.minerai)}>{fmt(result.debris.minerai)}</span>
                  <span className="text-xs text-muted-foreground">Minerai</span>
                </div>
              )}
              {result.debris.silicium > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className={cn('text-sm font-bold', RESOURCE_COLORS.silicium)}>{fmt(result.debris.silicium)}</span>
                  <span className="text-xs text-muted-foreground">Silicium</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bonus ships (pirate only) */}
      {result.bonusShips && Object.keys(result.bonusShips).length > 0 && (
        <div className="glass-card border-emerald-500/20 bg-emerald-500/5 p-4">
          <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M2 12h20" /></svg>
            Vaisseaux capturés
          </h4>
          <div className="flex flex-wrap gap-3">
            {Object.entries(result.bonusShips as Record<string, number>).map(([ship, count]) => (
              <span key={ship} className="text-sm">
                <span className="text-emerald-400 font-medium">+{count}</span>{' '}
                <span className="text-foreground">{getUnitName(ship, gameConfig)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Repaired defenses */}
      {result.repairedDefenses && Object.keys(result.repairedDefenses).length > 0 && (
        <div className="glass-card p-4">
          <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Défenses réparées</h4>
          <div className="flex flex-wrap gap-3">
            {Object.entries(result.repairedDefenses as Record<string, number>).map(([def, count]) => (
              <span key={def} className="text-sm">
                <span className="text-emerald-400 font-medium">+{fmt(count as number)}</span>{' '}
                <span className="text-muted-foreground">{getDefenseName(def, gameConfig)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Combat stats detail (attacker/defender) */}
      {(attStats || defStats) && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Statistiques détaillées</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {attStats && (
              <div className="glass-card p-4">
                <div className="text-xs font-medium text-blue-400 mb-2">Attaquant</div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Bouclier absorbé</span><span className="text-cyan-400 font-medium">{fmt(attStats.shieldAbsorbed)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Armure bloquée</span><span className="text-amber-400 font-medium">{fmt(attStats.armorBlocked)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Dégâts gaspillés</span><span className="text-red-400/60 font-medium">{fmt(attStats.overkillWasted)}</span></div>
                  {attStats.damageDealtByCategory && Object.keys(attStats.damageDealtByCategory).length > 0 && (
                    <div className="pt-1 border-t border-border/30">
                      <div className="text-xs text-muted-foreground mb-1">Dégâts par catégorie</div>
                      {Object.entries(attStats.damageDealtByCategory).map(([cat, dmg]) => (
                        <div key={cat} className="flex justify-between text-xs">
                          <span className="text-muted-foreground capitalize">{cat}</span>
                          <span className="text-foreground">{fmt(dmg)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            {defStats && (
              <div className="glass-card p-4">
                <div className="text-xs font-medium text-rose-400 mb-2">Défenseur</div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Bouclier absorbé</span><span className="text-cyan-400 font-medium">{fmt(defStats.shieldAbsorbed)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Armure bloquée</span><span className="text-amber-400 font-medium">{fmt(defStats.armorBlocked)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Dégâts gaspillés</span><span className="text-red-400/60 font-medium">{fmt(defStats.overkillWasted)}</span></div>
                  {defStats.damageDealtByCategory && Object.keys(defStats.damageDealtByCategory).length > 0 && (
                    <div className="pt-1 border-t border-border/30">
                      <div className="text-xs text-muted-foreground mb-1">Dégâts par catégorie</div>
                      {Object.entries(defStats.damageDealtByCategory).map(([cat, dmg]) => (
                        <div key={cat} className="flex justify-between text-xs">
                          <span className="text-muted-foreground capitalize">{cat}</span>
                          <span className="text-foreground">{fmt(dmg)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Replay section (collapsible) */}
      {combatResultForReplay && combatResultForReplay.rounds.length > 0 && (
        <div className="glass-card border-blue-500/20 overflow-hidden">
          <button
            type="button"
            className="w-full p-4 flex items-center justify-center gap-2 text-sm font-medium text-blue-400 hover:bg-blue-500/5 transition-colors"
            onClick={() => setReplayOpen(!replayOpen)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={replayOpen ? 'rotate-90 transition-transform' : 'transition-transform'}>
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            {replayOpen ? 'Masquer le replay' : `Voir le replay du combat (${roundCount} rounds)`}
          </button>
          {replayOpen && (
            <div className="p-4 pt-0 border-t border-border/30">
              <RoundDisplay
                key={`replay-${result.outcome}`}
                result={combatResultForReplay}
                initialAttacker={result.attackerFleet ?? {}}
                initialDefender={{ ...(result.defenderFleet ?? {}), ...(result.defenderDefenses ?? {}) }}
                autoPlayDelay={0}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/reports/CombatReportDetail.tsx
git commit -m "feat(web): add CombatReportDetail component with FP bar, stats, replay"
```

---

### Task 11: Frontend — ReportDetail page wrapper

**Files:**
- Create: `apps/web/src/pages/ReportDetail.tsx`

The page that loads a report by ID and dispatches to the correct detail component.

- [ ] **Step 1: Create the page**

```typescript
// apps/web/src/pages/ReportDetail.tsx
import { useParams, useNavigate } from 'react-router';
import { trpc } from '@/trpc';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/PageHeader';
import { useGameConfig } from '@/hooks/useGameConfig';
import { getShipName, getUnitName } from '@/lib/entity-names';
import { CombatReportDetail } from '@/components/reports/CombatReportDetail';
import { MineReportDetail } from '@/components/reports/MineReportDetail';
import { SpyReportDetail } from '@/components/reports/SpyReportDetail';

function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

function formatCoords(coords: { galaxy: number; system: number; position: number }) {
  return `[${coords.galaxy}:${coords.system}:${coords.position}]`;
}

export default function ReportDetail() {
  const { reportId } = useParams<{ reportId: string }>();
  const navigate = useNavigate();
  const { data: gameConfig } = useGameConfig();
  const utils = trpc.useUtils();

  const { data: report, isLoading } = trpc.report.detail.useQuery(
    { id: reportId! },
    { enabled: !!reportId },
  );

  const deleteMutation = trpc.report.delete.useMutation({
    onSuccess: () => {
      utils.report.list.invalidate();
      utils.report.unreadCount.invalidate();
      navigate('/reports');
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 lg:space-y-6 lg:p-6">
        <PageHeader title="Rapport" />
        <div className="glass-card p-8 text-center text-sm text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="space-y-4 p-4 lg:space-y-6 lg:p-6">
        <PageHeader title="Rapport" />
        <div className="glass-card p-8 text-center text-sm text-muted-foreground">Rapport introuvable.</div>
        <Button variant="outline" size="sm" onClick={() => navigate('/reports')}>← Rapports</Button>
      </div>
    );
  }

  const result = report.result as Record<string, any>;
  const coords = report.coordinates as { galaxy: number; system: number; position: number };
  const origin = report.originCoordinates as { galaxy: number; system: number; position: number; planetName: string } | null;
  const fleet = report.fleet as { ships: Record<string, number>; totalCargo: number };
  const isCombat = report.missionType === 'attack' || report.missionType === 'pirate';

  const outcomeLabel = isCombat
    ? result.outcome === 'attacker' ? 'Victoire' : result.outcome === 'defender' ? 'Défaite' : 'Match nul'
    : null;
  const outcomeBg = isCombat
    ? result.outcome === 'attacker' ? 'bg-emerald-500/20 text-emerald-400'
    : result.outcome === 'defender' ? 'bg-red-500/20 text-red-400'
    : 'bg-amber-500/20 text-amber-400'
    : '';

  return (
    <div className="space-y-4 p-4 lg:space-y-6 lg:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/reports')}>
          ← Rapports
        </Button>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-foreground">{report.title}</h1>
          <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
            <div>
              Cible : {formatCoords(coords)}
              {origin && <> — Origine : {origin.planetName} {formatCoords(origin)}</>}
            </div>
            <div>{formatDate(report.completionTime)}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {outcomeLabel && (
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${outcomeBg}`}>
              {outcomeLabel}
            </span>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={() => deleteMutation.mutate({ id: report.id })}
            disabled={deleteMutation.isPending}
          >
            Supprimer
          </Button>
        </div>
      </div>

      {/* Fleet summary (if non-empty) */}
      {Object.keys(fleet.ships).length > 0 && (
        <div className="glass-card p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Flotte envoyée</h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(fleet.ships).map(([ship, count]) => (
              <span key={ship} className="text-sm">
                <span className="text-foreground font-medium">{String(count)}x</span>{' '}
                <span className="text-muted-foreground">{getShipName(ship, gameConfig)}</span>
              </span>
            ))}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Capacité cargo : {fleet.totalCargo.toLocaleString('fr-FR')}
          </div>
        </div>
      )}

      {/* Type-specific detail */}
      {(report.missionType === 'attack' || report.missionType === 'pirate') && (
        <CombatReportDetail
          result={result}
          missionType={report.missionType as 'attack' | 'pirate'}
          gameConfig={gameConfig}
        />
      )}
      {report.missionType === 'mine' && (
        <MineReportDetail result={result} fleet={fleet} gameConfig={gameConfig} />
      )}
      {report.missionType === 'spy' && (
        <SpyReportDetail result={result} gameConfig={gameConfig} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/julienaubree/_projet/ogame-clone && pnpm --filter @ogame-clone/web typecheck`
Expected: PASS (or warnings about unused imports in old Reports.tsx — fine, we replace it next)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/ReportDetail.tsx
git commit -m "feat(web): add ReportDetail page with type-specific rendering"
```

---

### Task 12: Frontend — Reports list page rewrite

**Files:**
- Rewrite: `apps/web/src/pages/Reports.tsx`

Replace the entire 1052-line monolith with a clean list page.

- [ ] **Step 1: Rewrite Reports.tsx**

```typescript
// apps/web/src/pages/Reports.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { trpc } from '@/trpc';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/PageHeader';
import { useGameConfig } from '@/hooks/useGameConfig';
import { ReportCard } from '@/components/reports/ReportCard';

const FILTER_OPTIONS = [
  { label: 'Tous', types: [] },
  { label: 'Combat', types: ['attack', 'pirate'] },
  { label: 'Mine', types: ['mine'] },
  { label: 'Espionnage', types: ['spy'] },
];

export default function Reports() {
  const [activeFilter, setActiveFilter] = useState(0);
  const { data: gameConfig } = useGameConfig();
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const loaderRef = useRef<HTMLDivElement>(null);
  const lastAppendedCursorRef = useRef<string | undefined>(undefined);
  const utils = trpc.useUtils();

  const typeFilter = FILTER_OPTIONS[activeFilter].types;
  const currentCursor = cursors[cursors.length - 1];

  const { data, isFetching } = trpc.report.list.useQuery(
    { cursor: currentCursor, limit: 20, missionTypes: typeFilter.length > 0 ? typeFilter as any : undefined },
    { placeholderData: (prev: any) => prev },
  );

  const { data: unreadData } = trpc.report.unreadCount.useQuery();

  const markAllReadMutation = trpc.report.markAllRead.useMutation({
    onSuccess: () => {
      utils.report.list.invalidate();
      utils.report.unreadCount.invalidate();
    },
  });

  const pages = useRef<Map<string | undefined, any[]>>(new Map());
  if (data && data.reports.length > 0) {
    pages.current.set(currentCursor, data.reports);
  }

  const handleFilterChange = (index: number) => {
    setActiveFilter(index);
    pages.current.clear();
    setCursors([undefined]);
    lastAppendedCursorRef.current = undefined;
  };

  const handleLoadMore = useCallback(() => {
    if (data?.nextCursor && !isFetching && lastAppendedCursorRef.current !== data.nextCursor) {
      lastAppendedCursorRef.current = data.nextCursor;
      setCursors((prev) => [...prev, data.nextCursor]);
    }
  }, [data?.nextCursor, isFetching]);

  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) handleLoadMore(); },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleLoadMore]);

  const allReports = Array.from(pages.current.values()).flat();
  const hasMore = !!data?.nextCursor;
  const unreadCount = unreadData?.count ?? 0;

  return (
    <div className="space-y-4 p-4 lg:space-y-6 lg:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <PageHeader title="Rapports" />
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
          >
            Tout marquer comme lu ({unreadCount})
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((option, i) => (
          <button
            key={option.label}
            type="button"
            onClick={() => handleFilterChange(i)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm transition-colors ${
              activeFilter === i
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Report list */}
      <div className="space-y-2">
        {isFetching && allReports.length === 0 && (
          <div className="glass-card p-8 text-center text-sm text-muted-foreground">Chargement...</div>
        )}
        {!isFetching && allReports.length === 0 && (
          <div className="glass-card p-8 text-center text-sm text-muted-foreground">Aucun rapport.</div>
        )}
        {allReports.map((report) => (
          <ReportCard key={report.id} report={report} gameConfig={gameConfig} />
        ))}
        {hasMore && (
          <div ref={loaderRef} className="flex justify-center py-3">
            {isFetching ? (
              <span className="text-xs text-muted-foreground">Chargement...</span>
            ) : (
              <button
                type="button"
                onClick={handleLoadMore}
                className="text-xs text-primary hover:text-primary/80 transition-colors"
              >
                Charger plus
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/julienaubree/_projet/ogame-clone && pnpm --filter @ogame-clone/web typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/Reports.tsx
git commit -m "feat(web): rewrite Reports page as clean card list with filters"
```

---

### Task 13: Cleanup — Delete old reports + push

**Files:** None (SQL + git)

- [ ] **Step 1: Generate SQL to delete all existing reports**

```sql
DELETE FROM mission_reports;
```

This will be run on the VPS after deployment. The new reports will be generated with the correct format going forward.

- [ ] **Step 2: Verify full build**

Run: `cd /Users/julienaubree/_projet/ogame-clone && pnpm typecheck`
Expected: All packages pass

- [ ] **Step 3: Push to main**

```bash
git push origin main
```

- [ ] **Step 4: Deploy and run cleanup**

On the VPS:
```bash
source /opt/ogame-clone/.env && psql $DATABASE_URL -c "DELETE FROM mission_reports;"
```

Then deploy as usual.
