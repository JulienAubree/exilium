import { sql, eq } from 'drizzle-orm';
import { byUser } from '../../lib/db-helpers.js';
import { TRPCError } from '@trpc/server';
import { empireProgression, empireXpLog } from '@exilium/db';
import type { Database } from '@exilium/db';
import {
  buildEmpireLevelConfig,
  empireLevelFromXp,
  empireXpRequiredForLevel,
  empireGovernanceCapacity,
  empireMissionLevel,
} from '@exilium/game-engine';
import type { GameConfigService } from '../admin/game-config.service.js';
import type Redis from 'ioredis';
import { publishNotification } from '../notification/notification.publisher.js';

export type EmpireXpSource =
  | 'building'
  | 'research'
  | 'pve'
  | 'pvp'
  | 'colonization'
  | 'admin';

export interface EmpireXpEvent {
  type: string;
  userId: string;
  payload: Record<string, unknown>;
}

export function createEmpireProgressionService(
  db: Database,
  gameConfigService: GameConfigService,
  redis: Redis,
) {
  async function getOrCreate(userId: string) {
    const [existing] = await db
      .select()
      .from(empireProgression)
      .where(byUser(empireProgression.userId, userId))
      .limit(1);
    if (existing) return existing;

    const [created] = await db
      .insert(empireProgression)
      .values({ userId })
      .onConflictDoNothing()
      .returning();
    if (created) return created;

    // Race : un insert concurrent a gagné — relire.
    const [row] = await db
      .select()
      .from(empireProgression)
      .where(byUser(empireProgression.userId, userId))
      .limit(1);
    return row;
  }

  async function award(userId: string, amount: number, source: EmpireXpSource, details?: unknown) {
    if (amount <= 0) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Le montant doit etre positif' });

    await getOrCreate(userId);
    const config = await gameConfigService.getFullConfig();
    const levelConfig = buildEmpireLevelConfig(config.universe);

    let levelUp: { from: number; to: number } | null = null;

    await db.transaction(async (tx) => {
      const [locked] = await tx
        .select({ xp: empireProgression.xp, level: empireProgression.level })
        .from(empireProgression)
        .where(eq(empireProgression.userId, userId))
        .for('update');
      if (!locked) return;

      const newXp = locked.xp + amount;
      const newLevel = empireLevelFromXp(newXp, levelConfig);

      await tx
        .update(empireProgression)
        .set({
          xp: sql`${empireProgression.xp} + ${amount}`,
          level: newLevel,
          updatedAt: new Date(),
        })
        .where(eq(empireProgression.userId, userId));

      await tx
        .insert(empireXpLog)
        .values({ userId, amount, source, details: details ?? null });

      if (newLevel > locked.level) {
        levelUp = { from: locked.level, to: newLevel };
      }
    });

    if (levelUp !== null) {
      const { from, to } = levelUp;
      publishNotification(redis, userId, {
        type: 'empire-level-up',
        payload: {
          from,
          to,
          capacity: empireGovernanceCapacity(to, levelConfig),
        },
      }).catch((e) => console.warn('[empire-progression] level-up notification failed:', e));
    }

    return levelUp;
  }

  return {
    getOrCreate,
    award,

    async getProgression(userId: string) {
      const record = await getOrCreate(userId);
      const config = await gameConfigService.getFullConfig();
      const levelConfig = buildEmpireLevelConfig(config.universe);
      const missionDefault = Number(config.universe.mission_default_level) || 3;

      const level = record?.level ?? 1;
      const xp = record?.xp ?? 0;

      return {
        xp,
        level,
        currentLevelXp: empireXpRequiredForLevel(level, levelConfig),
        nextLevelXp: level >= levelConfig.maxLevel ? null : empireXpRequiredForLevel(level + 1, levelConfig),
        maxLevel: levelConfig.maxLevel,
        capacity: empireGovernanceCapacity(level, levelConfig),
        missionLevel: empireMissionLevel(level, missionDefault, levelConfig),
        capacityLevelsPerColony: levelConfig.capacityLevelsPerColony,
        missionLevelsPerBonus: levelConfig.missionLevelsPerBonus,
      };
    },

    /**
     * Traiter un événement de gameplay et accorder l'XP correspondante.
     * Même pattern que dailyQuestService.processEvent — appelé aux mêmes
     * sites d'émission, fire-and-forget côté appelant.
     */
    async processEvent(event: EmpireXpEvent) {
      const config = await gameConfigService.getFullConfig();
      const universe = config.universe;

      let amount = 0;
      let source: EmpireXpSource | null = null;
      let details: Record<string, unknown> | undefined;

      switch (event.type) {
        case 'construction:completed': {
          const level = Number(event.payload.level) || 0;
          if (level <= 0) return null;
          const kind = event.payload.kind;
          if (kind === 'building') {
            amount = level * (Number(universe.empire_xp_per_building_level) || 2);
            source = 'building';
          } else if (kind === 'research') {
            amount = level * (Number(universe.empire_xp_per_research_level) || 5);
            source = 'research';
          } else {
            return null; // unités shipyard : pas d'XP (spammable)
          }
          details = { itemId: event.payload.itemId, level };
          break;
        }
        case 'pve:victory':
          amount = Number(universe.empire_xp_pve_victory) || 15;
          source = 'pve';
          details = { missionId: event.payload.missionId };
          break;
        case 'pvp:battle_resolved':
          if (event.payload.role !== 'attacker' || event.payload.result !== 'attacker') return null;
          amount = Number(universe.empire_xp_pvp_victory) || 40;
          source = 'pvp';
          break;
        case 'colonization:completed':
          amount = Number(universe.empire_xp_colonization) || 150;
          source = 'colonization';
          details = { planetId: event.payload.planetId };
          break;
        default:
          return null;
      }

      if (!source || amount <= 0) return null;
      return award(event.userId, amount, source, details);
    },
  };
}
