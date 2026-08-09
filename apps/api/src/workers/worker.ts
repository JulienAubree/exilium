import Redis from 'ioredis';
import { createDb } from '@exilium/db';
import { env } from '../config/env.js';
import { createResourceService } from '../modules/resource/resource.service.js';
import { createBuildingService } from '../modules/building/building.service.js';
import { createResearchService } from '../modules/research/research.service.js';
import { createShipyardService } from '../modules/shipyard/shipyard.service.js';
import { createFleetService } from '../modules/fleet/fleet.service.js';
import { createGameConfigService } from '../modules/admin/game-config.service.js';
import { createTutorialService } from '../modules/tutorial/tutorial.service.js';
import { createAsteroidBeltService } from '../modules/pve/asteroid-belt.service.js';
import { createPirateService } from '../modules/pve/pirate.service.js';
import { createPveService } from '../modules/pve/pve.service.js';
import { createReportService } from '../modules/report/report.service.js';
import { createPushService } from '../modules/push/push.service.js';
import { createExiliumService } from '../modules/exilium/exilium.service.js';
import { createFlagshipService } from '../modules/flagship/flagship.service.js';
import { createTalentService } from '../modules/flagship/talent.service.js';
import { createDailyQuestService } from '../modules/daily-quest/daily-quest.service.js';
import { createEmpireProgressionService } from '../modules/empire-progression/empire-progression.service.js';
import { createGameEventService } from '../modules/game-event/game-event.service.js';
import { buildCompletionQueue, fleetQueue, marketQueue } from '../queues/queues.js';
import { startBuildCompletionWorker } from './build-completion.worker.js';
import { startFleetWorker } from './fleet.worker.js';
import { createMarketService } from '../modules/market/market.service.js';
import { startMarketWorker } from './market.worker.js';
import { createColonizationService } from '../modules/colonization/colonization.service.js';
import { startColonizationWorker } from './colonization.worker.js';
import { createAllianceLogService } from '../modules/alliance/alliance-log.service.js';
import { eventCatchup } from '../cron/event-catchup.js';
import { resourceTick } from '../cron/resource-tick.js';
import { governorTick } from '../cron/governor-tick.js';
import { rankingUpdate } from '../cron/ranking-update.js';
import { eventCleanup } from '../cron/event-cleanup.js';
import { allianceLogPurge } from '../cron/alliance-log-purge.js';
import { scheduleCron } from '../lib/cron-lock.js';

// Shared instances
const db = createDb(env.DATABASE_URL);
const redis = new Redis(env.REDIS_URL);
const gameConfigService = createGameConfigService(db, redis);
const exiliumService = createExiliumService(db, gameConfigService);
const dailyQuestService = createDailyQuestService(db, exiliumService, gameConfigService, redis);
const empireProgressionService = createEmpireProgressionService(db, gameConfigService, redis);
const resourceService = createResourceService(db, gameConfigService, dailyQuestService);
const pushService = createPushService(db);
const asteroidBeltService = createAsteroidBeltService(db);
const pirateService = createPirateService(db, gameConfigService);
const pveService = createPveService(db, asteroidBeltService, pirateService, gameConfigService);
const reportService = createReportService(db);
const tutorialService = createTutorialService(db, pveService);

// Talent & flagship services.
// talentService est declare AVANT flagshipService parce que ce dernier le
// consomme : `incapacitate` (atteint depuis le worker quand un vaisseau amiral
// tombe au combat) lit `repair_time_reduction` dans le contexte talent. Sans
// lui, le bonus de coque — pourtant AFFICHE au joueur — etait ignore et la
// reparation durait 7200 s au lieu de 4966 s sur une coque combat.
// assetsDir / resourceService / reportService ne sont volontairement pas
// passes ici : ils ne servent que dans create/listImages/changeHull/scan, qui
// ne sont pas atteignables depuis le worker.
const talentService = createTalentService(db, gameConfigService);
const flagshipService = createFlagshipService(db, exiliumService, gameConfigService, talentService);

// Build services (receive the unified build queue)
const buildingService = createBuildingService(db, resourceService, buildCompletionQueue, gameConfigService);
const researchService = createResearchService(db, resourceService, buildCompletionQueue, gameConfigService);
const shipyardService = createShipyardService(db, resourceService, buildCompletionQueue, gameConfigService, talentService, flagshipService);
const gameEventService = createGameEventService(db);

// Colonization service
const colonizationService = createColonizationService(db, gameConfigService, empireProgressionService);

const allianceLogService = createAllianceLogService(db, redis);

const fleetService = createFleetService(db, resourceService, fleetQueue, gameConfigService, redis, pveService, asteroidBeltService, pirateService, reportService, exiliumService, dailyQuestService, flagshipService, talentService, gameEventService, colonizationService, allianceLogService, empireProgressionService);

// Market service
const marketService = createMarketService(db, resourceService, gameConfigService, marketQueue, redis, dailyQuestService, exiliumService);

console.log('[worker] Starting workers...');

startBuildCompletionWorker(db, redis, { buildingService, researchService, shipyardService, tutorialService, pushService, dailyQuestService, empireProgressionService });
console.log('[worker] Build completion worker started');

startFleetWorker(db, redis, { fleetService, tutorialService, pushService });
console.log('[worker] Fleet worker started');

startMarketWorker(marketService);
console.log('[worker] Market worker started');

startColonizationWorker(db, redis, colonizationService, gameConfigService, fleetQueue);
console.log('[worker] Colonization worker started');

// Crons — wrapped with a Redis lock so at most one worker runs a given tick
// at a time. Safe for horizontal scaling and idempotent by design.
scheduleCron(redis, () => eventCatchup(db), { name: 'event-catchup', intervalMs: 30_000 });
console.log('[worker] Event catchup cron started (30s)');

scheduleCron(redis, () => resourceTick(db, gameConfigService), { name: 'resource-tick', intervalMs: 15 * 60_000 });
console.log('[worker] Resource tick cron started (15min)');

// `governor_tick_minutes` est editable depuis le back-office : on lit la valeur
// au lieu de la coder en dur. Avant ce correctif, un admin qui passait le
// reglage a 15 min croyait ralentir les gouverneurs alors que rien ne changeait.
// La valeur est lue au demarrage du worker : une modification prend effet au
// prochain redemarrage (donc a chaque deploiement). Repli sur 5 min.
const governorTickMinutes = Math.max(
  1,
  Number((await gameConfigService.getFullConfig()).universe.governor_tick_minutes) || 5,
);
scheduleCron(redis, async () => { await governorTick(db, gameConfigService, buildingService, resourceService); }, {
  name: 'governor-tick',
  intervalMs: governorTickMinutes * 60_000,
});
console.log(`[worker] Governor tick cron started (${governorTickMinutes}min)`);

scheduleCron(redis, () => rankingUpdate(db, gameConfigService), { name: 'ranking-update', intervalMs: 30 * 60_000 });
console.log('[worker] Ranking update cron started (30min)');

scheduleCron(redis, () => eventCleanup(db), { name: 'event-cleanup', intervalMs: 24 * 60 * 60_000 });
console.log('[worker] Event cleanup cron started (24h)');

scheduleCron(redis, () => asteroidBeltService.regenerateDepletedDeposits(), {
  name: 'deposit-regen',
  intervalMs: 30 * 60_000,
});
console.log('[worker] Deposit regeneration cron started (30min)');

scheduleCron(
  redis,
  async () => {
    const res = await allianceLogPurge(db);
    if (res.deleted > 0) {
      console.log(`[alliance-log-purge] Deleted ${res.deleted} rows.`);
    }
  },
  { name: 'alliance-log-purge', intervalMs: 60 * 60_000 },
);
console.log('[worker] Alliance log purge cron started (1h)');

process.on('SIGTERM', () => {
  console.log('[worker] Shutting down...');
  process.exit(0);
});
