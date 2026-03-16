import type { Database } from '@ogame-clone/db';
import { createGameEventService } from '../modules/game-event/game-event.service.js';

export async function eventCleanup(db: Database) {
  const service = createGameEventService(db);
  const count = await service.cleanup();
  if (count > 0) {
    console.log(`[event-cleanup] Deleted ${count} events older than 30 days`);
  }
}
