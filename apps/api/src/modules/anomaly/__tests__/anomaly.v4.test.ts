import { describe, it } from 'vitest';

/**
 * Anomaly V4 integration tests — SQUELETTE.
 *
 * Real integration mocking for engage/advance/retreat would require mocking
 * 8+ DB queries + flagshipService + modulesService + reportService +
 * buildCombatReportData per test. That's a heavy lift (~3-4h).
 *
 * Decision (per plan §10) : ship V4 with `it.todo()` markers + rely on :
 *  - Existing useRepairCharge tests (5 cases, sprint 4)
 *  - Existing activateEpic tests (sprint Modules)
 *  - Smoke prod testing (Task 11 Step 6)
 *
 * Future hardening sprint : implement these as real integration tests with
 * a Postgres test container (vitest globalSetup pattern).
 */

describe('anomalyService V4 — engage', () => {
  it.todo('inserts anomaly with flagship-only fleet + repair charges initialized');
  it.todo('refuses if Exilium balance < cost');
  it.todo('refuses if flagship is not active');
});

describe('anomalyService V4 — advance wipe', () => {
  it.todo('marks status=wiped and incapacitates flagship when flagship destroyed');
  it.todo('does NOT refund Exilium on wipe');
  it.todo('does NOT credit loot resources to planet on wipe');
});

describe('anomalyService V4 — retreat', () => {
  it.todo('does NOT refund Exilium on voluntary retreat (V4 change)');
  it.todo('credits loot resources to origin planet on retreat');
});

describe('anomalyService V4 — resolveEvent gating', () => {
  it.todo('refuses choice with requiredHull mismatch');
  it.todo('refuses choice with requiredResearch level too low');
  it.todo('grants module via outcome.moduleDrop and persists in eventLog');
});
