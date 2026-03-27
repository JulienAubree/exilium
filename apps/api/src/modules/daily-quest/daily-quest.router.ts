import { protectedProcedure, router } from '../../trpc/router.js';
import type { createDailyQuestService } from './daily-quest.service.js';
import type { GameConfigService } from '../admin/game-config.service.js';
import { DAILY_QUEST_REGISTRY } from './quest-registry.js';

export function createDailyQuestRouter(
  dailyQuestService: ReturnType<typeof createDailyQuestService>,
  gameConfigService: GameConfigService,
) {
  return router({
    getQuests: protectedProcedure
      .query(async ({ ctx }) => {
        const state = await dailyQuestService.getQuests(ctx.userId!);
        const config = await gameConfigService.getFullConfig();
        // Enrichir avec les noms/descriptions du registre, interpoler les placeholders
        return {
          ...state,
          quests: state.quests.map(q => {
            const def = DAILY_QUEST_REGISTRY[q.id];
            let description = def?.description ?? '';
            // Remplacer les {clé} par la valeur de la config univers
            description = description.replace(/\{(\w+)\}/g, (_, key) => {
              const val = config.universe[key];
              return val != null ? String(val) : key;
            });
            return {
              ...q,
              name: def?.name ?? q.id,
              description,
            };
          }),
        };
      }),
  });
}
