import { eq, and, asc } from 'drizzle-orm';
import { tutorialProgress, planets, planetBuildings, planetShips, tutorialQuestDefinitions } from '@ogame-clone/db';
import type { Database } from '@ogame-clone/db';

export interface TutorialQuest {
  id: string;
  order: number;
  title: string;
  narrativeText: string;
  condition: {
    type: 'building_level' | 'ship_count' | 'mission_complete';
    targetId: string;
    targetValue: number;
  };
  reward: { minerai: number; silicium: number; hydrogene: number };
}

export interface CompletedQuestEntry {
  questId: string;
  completedAt: string;
}

export function createTutorialService(db: Database) {
  async function loadQuests(): Promise<TutorialQuest[]> {
    const rows = await db
      .select()
      .from(tutorialQuestDefinitions)
      .orderBy(asc(tutorialQuestDefinitions.order));
    return rows.map(r => ({
      id: r.id,
      order: r.order,
      title: r.title,
      narrativeText: r.narrativeText,
      condition: {
        type: r.conditionType as 'building_level' | 'ship_count' | 'mission_complete',
        targetId: r.conditionTargetId,
        targetValue: r.conditionTargetValue,
      },
      reward: {
        minerai: r.rewardMinerai,
        silicium: r.rewardSilicium,
        hydrogene: r.rewardHydrogene,
      },
    }));
  }

  return {
    async getOrCreateProgress(userId: string) {
      const [existing] = await db
        .select()
        .from(tutorialProgress)
        .where(eq(tutorialProgress.userId, userId))
        .limit(1);

      if (existing) return existing;

      const [created] = await db
        .insert(tutorialProgress)
        .values({ userId })
        .returning();
      return created;
    },

    async getCurrent(userId: string) {
      const progress = await this.getOrCreateProgress(userId);

      if (progress.isComplete) {
        return { isComplete: true, quest: null, completedQuests: progress.completedQuests as CompletedQuestEntry[] };
      }

      const quests = await loadQuests();
      const quest = quests.find(q => q.id === progress.currentQuestId);
      return {
        isComplete: false,
        quest: quest ?? null,
        completedQuests: progress.completedQuests as CompletedQuestEntry[],
      };
    },

    async checkAndComplete(userId: string, event: {
      type: 'building_level' | 'ship_count' | 'mission_complete';
      targetId: string;
      targetValue: number;
    }) {
      const progress = await this.getOrCreateProgress(userId);
      if (progress.isComplete) return null;

      const quests = await loadQuests();
      const quest = quests.find(q => q.id === progress.currentQuestId);
      if (!quest) return null;

      // Check if the event matches the quest condition
      if (quest.condition.type !== event.type) return null;
      if (quest.condition.targetId !== event.targetId) return null;
      if (event.targetValue < quest.condition.targetValue) return null;

      // Quest is complete — award resources and advance
      const completedQuests = (progress.completedQuests as CompletedQuestEntry[]) || [];
      completedQuests.push({ questId: quest.id, completedAt: new Date().toISOString() });

      const nextQuest = quests.find(q => q.order === quest.order + 1);

      // Award resources to user's first planet
      const [planet] = await db
        .select()
        .from(planets)
        .where(eq(planets.userId, userId))
        .limit(1);

      if (planet) {
        await db
          .update(planets)
          .set({
            minerai: String(Number(planet.minerai) + quest.reward.minerai),
            silicium: String(Number(planet.silicium) + quest.reward.silicium),
            hydrogene: String(Number(planet.hydrogene) + quest.reward.hydrogene),
          })
          .where(eq(planets.id, planet.id));
      }

      // Update progress
      await db
        .update(tutorialProgress)
        .set({
          currentQuestId: nextQuest ? nextQuest.id : quest.id,
          completedQuests,
          isComplete: !nextQuest,
          updatedAt: new Date(),
        })
        .where(eq(tutorialProgress.id, progress.id));

      return {
        completedQuest: quest,
        reward: quest.reward,
        nextQuest: nextQuest ?? null,
        tutorialComplete: !nextQuest,
      };
    },

    async checkCompletion(userId: string) {
      const progress = await this.getOrCreateProgress(userId);
      if (progress.isComplete) return null;

      const quests = await loadQuests();
      const quest = quests.find(q => q.id === progress.currentQuestId);
      if (!quest) return null;

      // Check if current quest condition is met
      let conditionMet = false;

      if (quest.condition.type === 'building_level') {
        const levels = await db
          .select({ level: planetBuildings.level })
          .from(planetBuildings)
          .innerJoin(planets, eq(planets.id, planetBuildings.planetId))
          .where(
            and(
              eq(planets.userId, userId),
              eq(planetBuildings.buildingId, quest.condition.targetId),
            ),
          )
          .limit(1);

        conditionMet = (levels[0]?.level ?? 0) >= quest.condition.targetValue;
      } else if (quest.condition.type === 'ship_count') {
        const col = quest.condition.targetId;
        const ships = await db
          .select()
          .from(planetShips)
          .innerJoin(planets, eq(planets.id, planetShips.planetId))
          .where(eq(planets.userId, userId));

        const totalCount = ships.reduce((sum, row) => {
          return sum + ((row.planet_ships[col as keyof typeof row.planet_ships] ?? 0) as number);
        }, 0);

        conditionMet = totalCount >= quest.condition.targetValue;
      }
      // mission_complete is checked via direct event from fleet return

      if (!conditionMet) return null;

      return this.checkAndComplete(userId, {
        type: quest.condition.type,
        targetId: quest.condition.targetId,
        targetValue: quest.condition.targetValue,
      });
    },
  };
}
