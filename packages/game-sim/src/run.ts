import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadBuildings, loadProductionConfig } from './config.js';
import { initState } from './state.js';
import { SimEngine } from './engine.js';
import { EcoPolicy, type Policy } from './policy.js';
import { Recorder, type Milestone, type RunResult } from './recorder.js';
import { renderReport } from './reporter.js';

const HORIZON_SEC = 120 * 24 * 3600; // 120 jours simulés (horizon suffisant pour shipyard/researchLab)
const MILESTONES: Milestone[] = [
  { id: 'firstMine', reach: (s) => (s.levels.get('mineraiMine') ?? 0) >= 1 },
  { id: 'firstShipyard', reach: (s) => (s.levels.get('shipyard') ?? 0) >= 1 },
  { id: 'firstResearchLab', reach: (s) => (s.levels.get('researchLab') ?? 0) >= 1 },
  { id: 'robotics', reach: (s) => (s.levels.get('robotics') ?? 0) >= 1 },
];

function runPolicy(policy: Policy): RunResult {
  const buildings = loadBuildings();
  const engine = new SimEngine(buildings, loadProductionConfig());
  const rec = new Recorder(MILESTONES);
  const s = initState();
  for (let i = 0; i < 5000 && s.timeSec < HORIZON_SEC; i++) {
    const action = policy.decide(s, engine, buildings);
    if (action.type === 'stop') break;
    const waitH = engine.timeToAfford(s, engine.costOf(action.buildingId, (s.levels.get(action.buildingId) ?? 0) + 1));
    if (!isFinite(waitH) || isNaN(waitH)) break;
    engine.startBuild(s, action.buildingId);
    engine.advance(s, engine.nextEventIn(s)); // complète la construction → niveaux à jour
    rec.onAction(s, action, waitH); // …puis horodate les jalons avec l'état post-construction
                                    // (sinon les temps de jalon sont décalés/manqués)
  }
  return rec.result(policy.name);
}

/** Exported for testing: runs the EcoPolicy and returns a RunResult. */
export function runEco(): RunResult {
  return runPolicy(new EcoPolicy());
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
  const results = [runEco()];
  const md = renderReport(results);
  const dir = join(process.cwd(), 'reports', '_sim');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `rapport-rythme-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.md`);
  writeFileSync(path, md);
  console.log(`[game-sim] rapport écrit : ${path}`);
}
