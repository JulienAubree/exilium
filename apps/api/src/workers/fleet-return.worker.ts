import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { createDb, gameEvents } from '@ogame-clone/db';
import { createResourceService } from '../modules/resource/resource.service.js';
import { createFleetService } from '../modules/fleet/fleet.service.js';
import { createGameConfigService } from '../modules/admin/game-config.service.js';
import { createAsteroidBeltService } from '../modules/pve/asteroid-belt.service.js';
import { createPirateService } from '../modules/pve/pirate.service.js';
import { createPveService } from '../modules/pve/pve.service.js';
import { fleetArrivalQueue, fleetReturnQueue } from '../queues/queue.js';
import { publishNotification } from '../modules/notification/notification.publisher.js';
import { env } from '../config/env.js';
import { UNIVERSE_CONFIG } from '../modules/universe/universe.config.js';

export function startFleetReturnWorker(db: ReturnType<typeof createDb>) {
  const resourceService = createResourceService(db);
  const gameConfigService = createGameConfigService(db);
  const asteroidBeltService = createAsteroidBeltService(db);
  const pirateService = createPirateService(db, gameConfigService);
  const pveService = createPveService(db, asteroidBeltService, pirateService);
  const fleetService = createFleetService(db, resourceService, fleetArrivalQueue, fleetReturnQueue, UNIVERSE_CONFIG.speed, undefined, gameConfigService, pveService, asteroidBeltService, pirateService);
  const redis = new Redis(env.REDIS_URL);

  const worker = new Worker(
    'fleet-return',
    async (job) => {
      const { fleetEventId } = job.data as { fleetEventId: string };
      console.log(`[fleet-return] Processing job ${job.id}`);
      const result = await fleetService.processReturn(fleetEventId);
      if (result) {
        console.log(`[fleet-return] Fleet returned with ${Object.keys(result.ships).length} ship types`);

        if (result.userId) {
          publishNotification(redis, result.userId, {
            type: 'fleet-returned',
            payload: {
              mission: result.mission,
              originName: result.originName,
              targetCoords: result.targetCoords,
            },
          });

          await db.insert(gameEvents).values({
            userId: result.userId,
            planetId: result.originPlanetId,
            type: 'fleet-returned',
            payload: {
              mission: result.mission,
              originName: result.originName,
              targetCoords: result.targetCoords,
              ships: result.ships,
              cargo: result.cargo,
            },
          });
        }
      }
    },
    { connection: { url: env.REDIS_URL }, concurrency: 5 },
  );

  worker.on('failed', (job, err) => {
    console.error(`[fleet-return] Job ${job?.id} failed:`, err);
  });

  return worker;
}
