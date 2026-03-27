import type { Database } from '@exilium/db';
import { createRankingService } from '../modules/ranking/ranking.service.js';
import { createGameConfigService } from '../modules/admin/game-config.service.js';

export async function rankingUpdate(db: Database) {
  const gameConfigService = createGameConfigService(db);
  const rankingService = createRankingService(db, gameConfigService);
  await rankingService.recalculateAll();
}
