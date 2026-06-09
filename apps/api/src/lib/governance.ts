import { byUser } from '../lib/db-helpers.js';
import { planets, empireProgression } from '@exilium/db';
import {
  calculateGovernancePenalty,
  buildEmpireLevelConfig,
  empireGovernanceCapacity,
} from '@exilium/game-engine';
import type { Database } from '@exilium/db';

export async function getGovernancePenalty(
  db: Database,
  userId: string,
  planetClassId: string | null,
  config: { universe: Record<string, unknown> },
) {
  // Homeworld is exempt from governance penalties
  if (planetClassId === 'homeworld') {
    return { overextend: 0, harvestMalus: 0, constructionMalus: 0 };
  }

  // Count active colonies (active planets - 1 for homeworld)
  const userPlanets = await db.select({ id: planets.id, status: planets.status })
    .from(planets).where(byUser(planets.userId, userId));
  const colonyCount = Math.max(0, userPlanets.filter(p => p.status === 'active').length - 1);

  // Capacité portée par le niveau d'empire (+ plancher grandfathered ex-IPC)
  const [progression] = await db
    .select({ level: empireProgression.level, governanceFloor: empireProgression.governanceFloor })
    .from(empireProgression)
    .where(byUser(empireProgression.userId, userId))
    .limit(1);
  const levelConfig = buildEmpireLevelConfig(config.universe);
  const capacity = empireGovernanceCapacity(
    progression?.level ?? 1,
    levelConfig,
    progression?.governanceFloor ?? 0,
  );

  const harvestPenalties = (config.universe.governance_penalty_harvest as number[]) ?? [0.15, 0.35, 0.60];
  const constructionPenalties = (config.universe.governance_penalty_construction as number[]) ?? [0.15, 0.35, 0.60];

  return calculateGovernancePenalty(colonyCount, capacity, harvestPenalties, constructionPenalties);
}
