import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadBuildings, loadProductionConfig } from './config.js';
import { initState } from './state.js';
import { SimEngine } from './engine.js';
import { EcoPolicy, type Policy } from './policy.js';
import { Recorder, type Milestone } from './recorder.js';
import { renderReport } from './reporter.js';

const HORIZON_SEC = 60 * 24 * 3600; // 60 jours simulés
const MILESTONES: Milestone[] = [
  { id: 'firstMine', reach: (s) => (s.levels.get('mineraiMine') ?? 0) >= 1 },
  { id: 'firstShipyard', reach: (s) => (s.levels.get('shipyard') ?? 0) >= 1 },
  { id: 'firstResearchLab', reach: (s) => (s.levels.get('researchLab') ?? 0) >= 1 },
];

function runPolicy(policy: Policy) {
  const buildings = loadBuildings();
  const engine = new SimEngine(buildings, loadProductionConfig());
  const rec = new Recorder(MILESTONES);
  const s = initState();
  for (let i = 0; i < 2000 && s.timeSec < HORIZON_SEC; i++) {
    const action = policy.decide(s, engine, buildings);
    if (action.type === 'stop') break;
    const waitH = engine.timeToAfford(s, engine.costOf(action.buildingId, (s.levels.get(action.buildingId) ?? 0) + 1));
    if (!isFinite(waitH) || isNaN(waitH)) break;
    engine.startBuild(s, action.buildingId);
    rec.onAction(s, action, waitH);
    engine.advance(s, engine.nextEventIn(s));
  }
  return rec.result(policy.name);
}

const results = [runPolicy(new EcoPolicy())];
const md = renderReport(results);
const dir = join(process.cwd(), 'reports', '_sim');
mkdirSync(dir, { recursive: true });
const path = join(dir, `rapport-rythme-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.md`);
writeFileSync(path, md);
console.log(`[game-sim] rapport écrit : ${path}`);
