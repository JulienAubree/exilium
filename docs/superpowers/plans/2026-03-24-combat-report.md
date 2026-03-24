# Combat Report Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich attack combat reports with initial fleets, survivors, round-by-round detail, and send structured reports to both attacker and defender.

**Architecture:** Enrich `RoundResult` in the combat engine with per-type unit counts. In the attack handler, add the new data to the JSONB `result` and create a second report for the defender. In the frontend, add collapsible round sections and attacker fleet/survivors display.

**Tech Stack:** TypeScript, Vitest, Drizzle ORM, tRPC, React

---

## File Map

**Modify:**
- `packages/game-engine/src/formulas/combat.ts` — enrich `RoundResult` interface, update `simulateCombat` to populate per-type unit counts
- `packages/game-engine/src/formulas/combat.test.ts` — add test for new RoundResult fields
- `apps/api/src/modules/fleet/handlers/attack.handler.ts` — add `attackerFleet`, `attackerSurvivors`, `defenderSurvivors`, `rounds` to report result; create defender report
- `apps/web/src/pages/Reports.tsx` — guard empty fleet section, add attacker fleet display, round-by-round accordions, survivors section

---

### Task 1: Combat engine — enrich RoundResult with per-type unit counts

**Files:**
- Modify: `packages/game-engine/src/formulas/combat.ts`
- Modify: `packages/game-engine/src/formulas/combat.test.ts`

- [ ] **Step 1: Add test for new RoundResult fields**

In `packages/game-engine/src/formulas/combat.test.ts`, add a new test inside the `describe('simulateCombat', ...)` block:

```ts
  it('rounds include per-type ship counts', () => {
    const result = simulateCombat(
      { battleship: 5 },
      { lightFighter: 10, rocketLauncher: 5 },
      unitMultipliers,
      unitMultipliers,
      COMBAT_STATS,
      RAPID_FIRE,
      SHIP_IDS,
      SHIP_COSTS,
      DEFENSE_IDS,
    );
    expect(result.rounds.length).toBeGreaterThanOrEqual(1);
    const firstRound = result.rounds[0];
    expect(firstRound.attackerShips).toBeDefined();
    expect(firstRound.defenderShips).toBeDefined();
    expect(typeof firstRound.attackerShips.battleship).toBe('number');
    // Defender has both ships and defenses in defenderShips
    expect(firstRound.defenderShips).toBeDefined();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/julienaubree/_projet/ogame-clone/packages/game-engine && npx vitest run src/formulas/combat.test.ts`
Expected: FAIL — `attackerShips` is undefined

- [ ] **Step 3: Enrich RoundResult interface and simulateCombat**

In `packages/game-engine/src/formulas/combat.ts`:

1. Update the `RoundResult` interface (lines 23-27) to:

```ts
export interface RoundResult {
  round: number;
  attackersRemaining: number;
  defendersRemaining: number;
  attackerShips: Record<string, number>;
  defenderShips: Record<string, number>;
}
```

2. Add a helper function after `createUnits` (after line 77):

```ts
function countSurvivingByType(units: CombatUnit[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const unit of units) {
    if (!unit.destroyed) {
      counts[unit.type] = (counts[unit.type] ?? 0) + 1;
    }
  }
  return counts;
}
```

3. In `simulateCombat`, update the `rounds.push` call (line 256) to include the new fields:

```ts
    rounds.push({
      round,
      attackersRemaining,
      defendersRemaining,
      attackerShips: countSurvivingByType(attackers),
      defenderShips: countSurvivingByType(defenders),
    });
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/julienaubree/_projet/ogame-clone/packages/game-engine && npx vitest run src/formulas/combat.test.ts`
Expected: All tests pass (15 existing + 1 new = 16)

- [ ] **Step 5: Commit and push**

```bash
cd /Users/julienaubree/_projet/ogame-clone && git add packages/game-engine/src/formulas/combat.ts packages/game-engine/src/formulas/combat.test.ts && git commit -m "feat: enrich RoundResult with per-type unit counts

Each round now includes attackerShips and defenderShips maps showing
surviving unit counts by type, enabling round-by-round combat reports.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>" && git push
```

---

### Task 2: Backend — enrich attack report result + create defender report

**Files:**
- Modify: `apps/api/src/modules/fleet/handlers/attack.handler.ts`

- [ ] **Step 1: Extract `rounds` variable to outer scope**

In `apps/api/src/modules/fleet/handlers/attack.handler.ts`, the `result` from `simulateCombat` is scoped inside the `else` block (lines 118-130). The `rounds` array is not accessible where `reportResult` is built.

Before the `if (!hasDefenders)` block (before line 116), add the import and variable:

1. First, add `RoundResult` to the existing type import on line 5. Change:
```ts
import type { CombatConfig } from '@ogame-clone/game-engine';
```
to:
```ts
import type { CombatConfig, RoundResult } from '@ogame-clone/game-engine';
```

2. Then before line 116, add:
```ts
    let rounds: RoundResult[] = [];
```

Inside the `else` block (after line 129, where `roundCount = result.rounds.length`), add:

```ts
      rounds = result.rounds;
```

- [ ] **Step 2: Add new fields to reportResult**

In the `reportResult` object construction (lines 295-304), add the 4 new keys. Replace the entire block:

```ts
      const reportResult: Record<string, unknown> = {
        outcome,
        roundCount,
        attackerFleet: ships,
        attackerLosses,
        attackerSurvivors: survivingShips,
        defenderFleet,
        defenderDefenses,
        defenderLosses,
        defenderSurvivors: (() => {
          const combined: Record<string, number> = { ...defenderFleet, ...defenderDefenses };
          const survivors: Record<string, number> = {};
          for (const [type, count] of Object.entries(combined)) {
            const remaining = count - (defenderLosses[type] ?? 0) + (repairedDefenses[type] ?? 0);
            if (remaining > 0) survivors[type] = remaining;
          }
          return survivors;
        })(),
        repairedDefenses,
        debris,
        rounds,
      };
```

- [ ] **Step 3: Handle no-defenders edge case**

Currently when `!hasDefenders` (line 116), `outcome` is set to `'attacker'` but `survivingShips` is computed at line 133 which runs regardless. The `rounds` variable is already `[]` from step 1. The `defenderSurvivors` computation will produce `{}` (no losses, no repairs, empty fleet = empty result). `attackerSurvivors` equals `ships` (no losses). No additional change needed — the code paths handle this correctly.

- [ ] **Step 4: Capture defender message ID and create defender report**

Three changes, in order:

1. Before the `if (ctx.messageService)` block (before line 267), declare a variable to bridge scope:

```ts
    let defenderMsgId: string | undefined;
```

2. Inside the `if (ctx.messageService)` block, change the defender's `createSystemMessage` call (line 276) to capture its return value and store the ID. Replace:

```ts
      await ctx.messageService.createSystemMessage(
        targetPlanet.userId,
        'combat',
        `Rapport de combat ${coords} — ${outcome === 'attacker' ? 'Défaite' : outcome === 'defender' ? 'Victoire' : 'Match nul'}`,
        reportBody,
      );
```

with:

```ts
      const defenderMsg = await ctx.messageService.createSystemMessage(
        targetPlanet.userId,
        'combat',
        `Rapport de combat ${coords} — ${outcome === 'attacker' ? 'Défaite' : outcome === 'defender' ? 'Victoire' : 'Match nul'}`,
        reportBody,
      );
      defenderMsgId = defenderMsg.id;
```

3. Inside the `if (ctx.reportService)` block, after `reportId = report.id;` (after line 338), add the defender report creation:

```ts
      const defenderOutcomeText = outcome === 'attacker' ? 'Défaite' :
                                  outcome === 'defender' ? 'Victoire' : 'Match nul';
      await ctx.reportService.create({
        userId: targetPlanet.userId,
        messageId: defenderMsgId,
        missionType: 'attack',
        title: `Rapport de combat ${coords} — ${defenderOutcomeText}`,
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
        fleet: { ships: {}, totalCargo: 0 },
        departureTime: fleetEvent.departureTime,
        completionTime: fleetEvent.arrivalTime,
        result: reportResult,
      });
```

- [ ] **Step 5: TS check**

Run: `cd /Users/julienaubree/_projet/ogame-clone && npx tsc --noEmit -p apps/api/tsconfig.json`
Expected: No errors

- [ ] **Step 6: Commit and push**

```bash
cd /Users/julienaubree/_projet/ogame-clone && git add apps/api/src/modules/fleet/handlers/attack.handler.ts && git commit -m "feat: enrich attack report with full combat data + defender report

Add attackerFleet, attackerSurvivors, defenderSurvivors, rounds to report
result. Create a structured report for the defender with inverted perspective.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>" && git push
```

---

### Task 3: Frontend — enriched attack report display

**Files:**
- Modify: `apps/web/src/pages/Reports.tsx`

- [ ] **Step 1: Guard the generic "Flotte" section for empty fleet**

In `apps/web/src/pages/Reports.tsx`, the generic "Flotte" section (lines 187-203) renders `selectedReport.fleet.ships` unconditionally. For defender reports, `fleet.ships` is `{}`.

Wrap the entire "Flotte" section with a guard. Replace lines 187-203:

```tsx
        {/* Fleet — hide if empty (defender attack reports) */}
        {Object.keys((selectedReport.fleet as any).ships ?? {}).length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Flotte</h3>
            <div className="rounded border border-border p-3">
              <div className="flex flex-wrap gap-3">
                {Object.entries((selectedReport.fleet as any).ships).map(([ship, count]) => (
                  <span key={ship} className="text-sm">
                    <span className="text-foreground">{String(count)}x</span>{' '}
                    <span className="text-muted-foreground">{getShipName(ship, gameConfig)}</span>
                  </span>
                ))}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Capacite cargo : {((selectedReport.fleet as any).totalCargo ?? 0).toLocaleString('fr-FR')}
              </div>
            </div>
          </div>
        )}
```

- [ ] **Step 2: Replace attack report section with enriched version**

Replace the entire attack-specific section (lines 387-543, the `{selectedReport.missionType === 'attack' && (() => { ... })()}` block) with:

```tsx
        {/* Attack-specific results */}
        {selectedReport.missionType === 'attack' && (() => {
          const result = selectedReport.result as any;
          const OUTCOME_STYLES: Record<string, string> = {
            attacker: 'bg-emerald-500/20 text-emerald-400',
            defender: 'bg-red-500/20 text-red-400',
            draw: 'bg-amber-500/20 text-amber-400',
          };
          const outcomeClassName = OUTCOME_STYLES[result.outcome] ?? OUTCOME_STYLES.draw;
          const outcomeLabel = gameConfig?.labels[`outcome.${result.outcome}`] ?? result.outcome;
          const hasAttackerLosses = result.attackerLosses && Object.keys(result.attackerLosses).length > 0;
          const hasDefenderLosses = result.defenderLosses && Object.keys(result.defenderLosses).length > 0;
          return (
            <>
              {/* Outcome */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Resultat</h3>
                <div className="rounded border border-border p-3">
                  <div className="flex items-center gap-3">
                    <span className={cn('rounded-full px-4 py-1.5 text-sm font-bold', outcomeClassName)}>
                      {outcomeLabel}
                    </span>
                    <span className="text-sm text-muted-foreground">{result.roundCount} round{result.roundCount > 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>

              {/* Initial forces — attacker + defender */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Forces initiales</h3>
                <div className="rounded border border-border p-3 space-y-3">
                  {/* Attacker fleet */}
                  {result.attackerFleet && Object.keys(result.attackerFleet).length > 0 && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Attaquant</div>
                      <div className="flex flex-wrap gap-3">
                        {Object.entries(result.attackerFleet as Record<string, number>).map(([ship, count]) => (
                          <span key={ship} className="text-sm">
                            <span className="text-foreground font-medium">{(count as number).toLocaleString('fr-FR')}x</span>{' '}
                            <span className="text-muted-foreground">{getShipName(ship, gameConfig)}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Defender fleet + defenses */}
                  {((result.defenderFleet && Object.keys(result.defenderFleet).length > 0) ||
                    (result.defenderDefenses && Object.keys(result.defenderDefenses).length > 0)) && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Defenseur</div>
                      <div className="flex flex-wrap gap-3">
                        {result.defenderFleet && Object.entries(result.defenderFleet as Record<string, number>).map(([ship, count]) => (
                          <span key={ship} className="text-sm">
                            <span className="text-foreground font-medium">{(count as number).toLocaleString('fr-FR')}x</span>{' '}
                            <span className="text-muted-foreground">{getShipName(ship, gameConfig)}</span>
                          </span>
                        ))}
                        {result.defenderDefenses && Object.entries(result.defenderDefenses as Record<string, number>).map(([def, count]) => (
                          <span key={def} className="text-sm">
                            <span className="text-foreground font-medium">{(count as number).toLocaleString('fr-FR')}x</span>{' '}
                            <span className="text-muted-foreground">{getDefenseName(def, gameConfig)}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Round-by-round detail — collapsible */}
              {result.rounds && result.rounds.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Detail des rounds</h3>
                  <div className="space-y-1">
                    {(result.rounds as any[]).map((round: any) => (
                      <details key={round.round} className="rounded border border-border">
                        <summary className="cursor-pointer px-3 py-2 text-sm font-medium hover:bg-accent/50 transition-colors">
                          Round {round.round}
                          <span className="ml-3 text-xs text-muted-foreground">
                            Att: {round.attackersRemaining} — Def: {round.defendersRemaining}
                          </span>
                        </summary>
                        <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border/50">
                          {round.attackerShips && Object.keys(round.attackerShips).length > 0 && (
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Attaquant</div>
                              <div className="flex flex-wrap gap-3">
                                {Object.entries(round.attackerShips as Record<string, number>).map(([ship, count]) => (
                                  <span key={ship} className="text-xs">
                                    <span className="text-foreground">{(count as number).toLocaleString('fr-FR')}x</span>{' '}
                                    <span className="text-muted-foreground">{getShipName(ship, gameConfig)}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {round.defenderShips && Object.keys(round.defenderShips).length > 0 && (
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Defenseur</div>
                              <div className="flex flex-wrap gap-3">
                                {Object.entries(round.defenderShips as Record<string, number>).map(([ship, count]) => (
                                  <span key={ship} className="text-xs">
                                    <span className="text-foreground">{(count as number).toLocaleString('fr-FR')}x</span>{' '}
                                    <span className="text-muted-foreground">{getUnitName(ship, gameConfig)}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {round.attackerShips && Object.keys(round.attackerShips).length === 0 &&
                           round.defenderShips && Object.keys(round.defenderShips).length === 0 && (
                            <div className="text-xs text-muted-foreground">Toutes les unites ont ete detruites</div>
                          )}
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              )}

              {/* Survivors */}
              {(result.attackerSurvivors || result.defenderSurvivors) && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Survivants</h3>
                  <div className="rounded border border-border p-3 space-y-3">
                    {result.attackerSurvivors && Object.keys(result.attackerSurvivors).length > 0 && (
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Attaquant</div>
                        <div className="flex flex-wrap gap-3">
                          {Object.entries(result.attackerSurvivors as Record<string, number>).map(([ship, count]) => (
                            <span key={ship} className="text-sm">
                              <span className="text-emerald-400 font-medium">{(count as number).toLocaleString('fr-FR')}x</span>{' '}
                              <span className="text-muted-foreground">{getShipName(ship, gameConfig)}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {result.defenderSurvivors && Object.keys(result.defenderSurvivors).length > 0 && (
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Defenseur</div>
                        <div className="flex flex-wrap gap-3">
                          {Object.entries(result.defenderSurvivors as Record<string, number>).map(([ship, count]) => (
                            <span key={ship} className="text-sm">
                              <span className="text-emerald-400 font-medium">{(count as number).toLocaleString('fr-FR')}x</span>{' '}
                              <span className="text-muted-foreground">{getUnitName(ship, gameConfig)}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {(!result.attackerSurvivors || Object.keys(result.attackerSurvivors).length === 0) &&
                     (!result.defenderSurvivors || Object.keys(result.defenderSurvivors).length === 0) && (
                      <div className="text-sm text-muted-foreground">Aucun survivant</div>
                    )}
                  </div>
                </div>
              )}

              {/* Losses */}
              {(hasAttackerLosses || hasDefenderLosses) && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pertes</h3>
                  <div className="rounded border border-border p-3 space-y-3">
                    {hasAttackerLosses && (
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Attaquant</div>
                        <div className="flex flex-wrap gap-3">
                          {Object.entries(result.attackerLosses as Record<string, number>).map(([ship, count]) => (
                            <span key={ship} className="text-sm">
                              <span className="text-red-400 font-medium">-{(count as number).toLocaleString('fr-FR')}</span>{' '}
                              <span className="text-muted-foreground">{getShipName(ship, gameConfig)}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {hasDefenderLosses && (
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Defenseur</div>
                        <div className="flex flex-wrap gap-3">
                          {Object.entries(result.defenderLosses as Record<string, number>).map(([unit, count]) => (
                            <span key={unit} className="text-sm">
                              <span className="text-red-400 font-medium">-{(count as number).toLocaleString('fr-FR')}</span>{' '}
                              <span className="text-muted-foreground">{getUnitName(unit, gameConfig)}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Repaired defenses */}
              {result.repairedDefenses && Object.keys(result.repairedDefenses).length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Defenses reparees</h3>
                  <div className="rounded border border-border p-3">
                    <div className="flex flex-wrap gap-3">
                      {Object.entries(result.repairedDefenses as Record<string, number>).map(([def, count]) => (
                        <span key={def} className="text-sm">
                          <span className="text-emerald-400 font-medium">+{(count as number).toLocaleString('fr-FR')}</span>{' '}
                          <span className="text-muted-foreground">{getDefenseName(def, gameConfig)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Debris */}
              {result.debris && (result.debris.minerai > 0 || result.debris.silicium > 0) && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Champ de debris</h3>
                  <div className="rounded border border-border p-3">
                    <div className="flex flex-wrap gap-4">
                      {result.debris.minerai > 0 && (
                        <div className="flex items-center gap-2">
                          <span className={cn('text-lg font-bold', RESOURCE_COLORS.minerai)}>
                            {(result.debris.minerai as number).toLocaleString('fr-FR')}
                          </span>
                          <span className="text-sm text-muted-foreground">Minerai</span>
                        </div>
                      )}
                      {result.debris.silicium > 0 && (
                        <div className="flex items-center gap-2">
                          <span className={cn('text-lg font-bold', RESOURCE_COLORS.silicium)}>
                            {(result.debris.silicium as number).toLocaleString('fr-FR')}
                          </span>
                          <span className="text-sm text-muted-foreground">Silicium</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Pillage */}
              {result.pillage && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Ressources pillees</h3>
                  <div className="rounded border border-border p-3">
                    <div className="flex flex-wrap gap-4">
                      {Object.entries(result.pillage as Record<string, number>).map(([resource, amount]) => (
                        <div key={resource} className="flex items-center gap-2">
                          <span className={cn('text-lg font-bold', RESOURCE_COLORS[resource])}>
                            +{(amount as number).toLocaleString('fr-FR')}
                          </span>
                          <span className="text-sm text-muted-foreground capitalize">{resource}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          );
        })()}
```

Note: This replaces the entire existing attack section. It preserves all existing sections (outcome, losses, repairs, debris, pillage) and adds: attacker fleet in "Forces initiales", round-by-round `<details>` accordions, and survivors section.

The `getUnitName`, `getShipName`, `getDefenseName`, `RESOURCE_COLORS`, and `cn` helpers are already available in the file.

- [ ] **Step 3: TS check**

Run: `cd /Users/julienaubree/_projet/ogame-clone && npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: No errors

- [ ] **Step 4: Commit and push**

```bash
cd /Users/julienaubree/_projet/ogame-clone && git add apps/web/src/pages/Reports.tsx && git commit -m "feat: enriched combat report UI with rounds and survivors

Add attacker fleet in initial forces, collapsible round-by-round detail,
survivors section. Guard empty fleet for defender reports.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>" && git push
```

---

### Task 4: Final verification

**Files:** None (verification only)

- [ ] **Step 1: TS check all projects**

Run: `cd /Users/julienaubree/_projet/ogame-clone && npx tsc --noEmit -p apps/api/tsconfig.json && npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: No errors

- [ ] **Step 2: Run game-engine tests**

Run: `cd /Users/julienaubree/_projet/ogame-clone/packages/game-engine && npx vitest run`
Expected: All tests pass (including new combat test)

- [ ] **Step 3: Run API tests**

Run: `cd /Users/julienaubree/_projet/ogame-clone/apps/api && npx vitest run`
Expected: All tests pass
