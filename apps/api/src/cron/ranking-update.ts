import type { Database } from '@ogame-clone/db';
import { createRankingService } from '../modules/ranking/ranking.service.js';

export async function rankingUpdate(db: Database) {
  const rankingService = createRankingService(db);
  await rankingService.recalculateAll();
}
