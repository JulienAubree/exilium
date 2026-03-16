import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { createDb, gameEvents } from '@ogame-clone/db';
import { createResourceService } from '../modules/resource/resource.service.js';
import { createFleetService } from '../modules/fleet/fleet.service.js';
import { createGameConfigService } from '../modules/admin/game-config.service.js';
import { fleetArrivalQueue, fleetReturnQueue } from '../queues/queue.js';
import { publishNotification } from '../modules/notification/notification.publisher.js';
import { env } from '../config/env.js';
import { UNIVERSE_CONFIG } from '../modules/universe/universe.config.js';

export function startFleetArrivalWorker(db: ReturnType<typeof createDb>) {
  const resourceService = createResourceService(db);
  const gameConfigService = createGameConfigService(db);
  const fleetService = createFleetService(db, resourceService, fleetArrivalQueue, fleetReturnQueue, UNIVERSE_CONFIG.speed, undefined, gameConfigService);
  const redis = new Redis(env.REDIS_URL);

  const worker = new Worker(
    'fleet-arrival',
    async (job) => {
      const { fleetEventId } = job.data as { fleetEventId: string };
      console.log(`[fleet-arrival] Processing job ${job.id}`);
      const result = await fleetService.processArrival(fleetEventId);
      if (result) {
        console.log(`[fleet-arrival] Mission ${result.mission} processed`);

        if (result.userId) {
          publishNotification(redis, result.userId, {
            type: 'fleet-arrived',
            payload: {
              mission: result.mission,
              originName: result.originName,
              targetCoords: result.targetCoords,
            },
          });

          await db.insert(gameEvents).values({
            userId: result.userId,
            planetId: result.originPlanetId,
            type: 'fleet-arrived',
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
    { connection: { url: env.REDIS_URL }, concurrency: 3 },
  );

  worker.on('failed', (job, err) => {
    console.error(`[fleet-arrival] Job ${job?.id} failed:`, err);
  });

  return worker;
}
