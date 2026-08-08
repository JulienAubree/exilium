import { Worker } from 'bullmq';
import { env } from '../config/env.js';
import type { createMarketService } from '../modules/market/market.service.js';

export function startMarketWorker(marketService: ReturnType<typeof createMarketService>) {
  const worker = new Worker(
    'market',
    async (job) => {
      console.log(`[market] Processing ${job.name} job ${job.id}`);

      switch (job.name) {
        case 'market-expire': {
          const { offerId } = job.data as { offerId: string };
          await marketService.processExpiration(offerId);
          console.log(`[market] Offer ${offerId} expired`);
          break;
        }
        // Il n'y a plus d'étape de réservation séparée depuis le 2026-03-25
        // (9da2195d) : l'achat réserve et libère en quelques millisecondes.
        // Le job 'market-reservation-expire' n'a plus aucun producteur — on ne
        // retire pas un filet de sécurité, il n'y en a plus depuis mars.
        default:
          console.error(`[market] Unknown job name: ${job.name}`);
      }
    },
    {
      connection: { url: env.REDIS_URL },
      concurrency: 3,
    },
  );

  worker.on('failed', (job, err) => {
    console.error(`[market] Job ${job?.id} failed:`, err);
  });

  return worker;
}
