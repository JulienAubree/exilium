import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadBuildings, loadProductionConfig, loadBonuses, loadResearch, loadShips } from './config.js';
import { initState } from './state.js';
import { SimEngine } from './engine.js';
import { EcoPolicy, type Policy } from './policy.js';
import { OptimalPolicy } from './optimal-policy.js';
import { Recorder, type Milestone, type RunResult } from './recorder.js';
import { renderReport } from './reporter.js';

const HORIZON_SEC = 120 * 24 * 3600; // 120 jours simulés (horizon suffisant pour shipyard/researchLab)
export const MILESTONES: Milestone[] = [
  { id: 'firstMine', reach: (s) => (s.levels.get('mineraiMine') ?? 0) >= 1 },
  { id: 'firstShipyard', reach: (s) => (s.levels.get('shipyard') ?? 0) >= 1 },
  { id: 'firstResearchLab', reach: (s) => (s.levels.get('researchLab') ?? 0) >= 1 },
  { id: 'robotics', reach: (s) => (s.levels.get('robotics') ?? 0) >= 1 },
  { id: 'firstResearch', reach: (s) => [...s.techLevels.values()].some((v) => v >= 1) },
  { id: 'energyTech', reach: (s) => (s.techLevels.get('energyTech') ?? 0) >= 1 },
  { id: 'firstShip', reach: (s) => [...s.ships.values()].some((v) => v >= 1) },
];

/** Exported for testing: runs a given policy and returns a RunResult. */
export function runPolicy(policy: Policy): RunResult {
  const buildings = loadBuildings();
  const research = loadResearch();
  const ships = loadShips();
  const engine = new SimEngine(buildings, loadProductionConfig(), loadBonuses(), research, ships);
  const rec = new Recorder(MILESTONES);
  const s = initState();

  for (let i = 0; i < 10000 && s.timeSec < HORIZON_SEC; i++) {
    // --- Research queue: fill if idle and lab is available ---
    if (s.research === null && (s.levels.get('researchLab') ?? 0) >= 1) {
      const ra = policy.decideResearch(s, engine, research);
      if (ra !== null) {
        try {
          engine.startResearch(s, ra.researchId);
        } catch {
          // prereqs or cost not reachable — skip silently
        }
      }
    }

    // --- Ship queue: fill if idle and shipyard is available ---
    if (s.shipBuild === null && (s.levels.get('shipyard') ?? 0) >= 1) {
      const sa = policy.decideShip(s, engine, ships);
      if (sa !== null) {
        try {
          engine.startShip(s, sa.shipId);
        } catch {
          // prereqs or cost not reachable — skip silently
        }
      }
    }

    // --- Build queue: fill if idle ---
    const action = policy.decide(s, engine, buildings);

    if (action.type === 'stop') {
      // No more builds. If research or shipBuild is still running, advance to finish it.
      if (s.research === null && s.shipBuild === null) break;
      const delta = engine.nextEventIn(s);
      if (delta <= 0) break; // guard against stall
      engine.advance(s, delta);
      rec.onAction(s, { type: 'stop' }, 0);
      continue;
    }

    let waitH = 0;
    if (action.type === 'build') {
      waitH = engine.timeToAfford(s, engine.costOf(action.buildingId, (s.levels.get(action.buildingId) ?? 0) + 1));
      if (!isFinite(waitH) || isNaN(waitH)) break;
      engine.startBuild(s, action.buildingId);
    }

    // Advance to the next event (whichever finishes first: build, research, or shipBuild)
    const delta = engine.nextEventIn(s);
    if (delta <= 0) break; // guard against stall

    engine.advance(s, delta);
    rec.onAction(s, action, waitH);
  }
  return rec.result(policy.name);
}

/** Exported for testing: runs the EcoPolicy and returns a RunResult. */
export function runEco(): RunResult {
  return runPolicy(new EcoPolicy());
}

/** Exported for testing: runs all profiles (eco + optimal) and returns their RunResults. */
export function runAll(): RunResult[] {
  return [runPolicy(new EcoPolicy()), runPolicy(new OptimalPolicy())];
}

// Main: write the report to disk when executed directly.
// Vitest imports this module but does NOT run the top-level side-effects block
// because it only imports named exports; the block below is guarded by a check
// so it only fires when run as a script (not under vitest).
const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] != null &&
  (process.argv[1].endsWith('/run.js') || process.argv[1].endsWith('/run.ts'));

if (isMain) {
  const results = runAll();
  const md = renderReport(results);
  const dir = join(process.cwd(), 'reports', '_sim');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `rapport-rythme-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.md`);
  writeFileSync(path, md);
  console.log(`[game-sim] rapport écrit : ${path}`);
}
