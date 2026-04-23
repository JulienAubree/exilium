import { eq } from 'drizzle-orm';
import type Redis from 'ioredis';
import { AllianceLogPayloadSchema, type AllianceLogPayload, type AllianceLogVisibility } from '@exilium/shared';
import { allianceLogs, allianceMembers } from '@exilium/db';
import type { Database } from '@exilium/db';
import { publishNotification, type NotificationEvent } from '../notification/notification.publisher.js';

export interface AllianceLogInsert {
  allianceId: string;
  payload: AllianceLogPayload;
  visibility: AllianceLogVisibility;
}

export type PublishFn = (userId: string, event: NotificationEvent) => unknown;

/** Pure: dispatches one notification per member. Errors swallowed (fire-and-forget). */
export function fanoutAllianceLogNotifications(
  publish: PublishFn,
  args: { allianceId: string; logId: string; visibility: AllianceLogVisibility; memberUserIds: string[] },
): void {
  const event: NotificationEvent = {
    type: 'alliance-log:new',
    payload: { allianceId: args.allianceId, logId: args.logId, visibility: args.visibility },
  };
  for (const userId of args.memberUserIds) {
    try {
      publish(userId, event);
    } catch {
      // Fire-and-forget; poll fallback will catch up.
    }
  }
}

export function createAllianceLogService(db: Database, redis: Redis | null) {
  return {
    /**
     * Insert one alliance log row and fan-out a light SSE ping to every member.
     * Validates the payload against the Zod schema — throws on malformed input.
     */
    async add(insert: AllianceLogInsert): Promise<{ id: string }> {
      const payload = AllianceLogPayloadSchema.parse(insert.payload);

      const [row] = await db.insert(allianceLogs).values({
        allianceId: insert.allianceId,
        type: payload.type,
        visibility: insert.visibility,
        payload,
      }).returning({ id: allianceLogs.id });

      if (redis) {
        const members = await db
          .select({ userId: allianceMembers.userId })
          .from(allianceMembers)
          .where(eq(allianceMembers.allianceId, insert.allianceId));

        fanoutAllianceLogNotifications(
          (userId, event) => publishNotification(redis, userId, event),
          {
            allianceId: insert.allianceId,
            logId: row.id,
            visibility: insert.visibility,
            memberUserIds: members.map((m) => m.userId),
          },
        );
      }

      return { id: row.id };
    },
  };
}

export type AllianceLogService = ReturnType<typeof createAllianceLogService>;
