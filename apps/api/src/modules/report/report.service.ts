import { eq, and, desc, lt, inArray, sql } from 'drizzle-orm';
import { byUser } from '../../lib/db-helpers.js';
import { missionReports } from '@exilium/db';
import type { Database } from '@exilium/db';
import { compressDetailedLog, decompressDetailedLog } from './compact-log.js';

export function createReportService(db: Database) {
  return {
    async create(data: {
      userId: string;
      fleetEventId?: string;
      pveMissionId?: string;
      messageId?: string;
      missionType: string;
      title: string;
      coordinates: { galaxy: number; system: number; position: number };
      originCoordinates?: { galaxy: number; system: number; position: number; planetName: string };
      fleet: { ships: Record<string, number>; totalCargo: number };
      departureTime: Date;
      completionTime: Date;
      result: Record<string, unknown>;
      detailedLog?: Record<string, unknown> | null;
    }) {
      const [report] = await db
        .insert(missionReports)
        .values({
          userId: data.userId,
          fleetEventId: data.fleetEventId ?? null,
          pveMissionId: data.pveMissionId ?? null,
          messageId: data.messageId ?? null,
          missionType: data.missionType as typeof missionReports.$inferInsert.missionType,
          title: data.title,
          coordinates: data.coordinates,
          originCoordinates: data.originCoordinates ?? null,
          fleet: data.fleet,
          departureTime: data.departureTime,
          completionTime: data.completionTime,
          result: data.result,
          detailedLog: data.detailedLog ? compressDetailedLog(data.detailedLog) : null,
        })
        .returning();
      return report;
    },

    async cleanupOldReports(userId: string) {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      await db
        .delete(missionReports)
        .where(
          and(
            byUser(missionReports.userId, userId),
            lt(missionReports.createdAt, threeDaysAgo),
            sql`${missionReports.missionType}::text NOT IN ('attack', 'pirate')`,
          ),
        );

      // Strip detailed_log from combat reports older than 30 days (heavy data, keep result summary)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      await db
        .update(missionReports)
        .set({ detailedLog: null })
        .where(
          and(
            byUser(missionReports.userId, userId),
            lt(missionReports.createdAt, thirtyDaysAgo),
            sql`${missionReports.detailedLog} IS NOT NULL`,
          ),
        );
    },

    async list(userId: string, options?: { cursor?: string; limit?: number; missionTypes?: string[] }) {
      // Cleanup old non-combat reports on first page load
      if (!options?.cursor) {
        await this.cleanupOldReports(userId);
      }

      const limit = options?.limit ?? 20;
      const conditions = [byUser(missionReports.userId, userId)];

      if (options?.cursor) {
        const [cursorReport] = await db
          .select({ createdAt: missionReports.createdAt })
          .from(missionReports)
          .where(eq(missionReports.id, options.cursor))
          .limit(1);
        if (cursorReport) {
          conditions.push(lt(missionReports.createdAt, cursorReport.createdAt));
        }
      }

      if (options?.missionTypes && options.missionTypes.length > 0) {
        conditions.push(
          inArray(missionReports.missionType, options.missionTypes as typeof missionReports.missionType.enumValues),
        );
      } else {
        // V9.4 — par défaut, on EXCLUT les rapports d'anomalie de la liste
        // générale : une run produit jusqu'à 20 rapports de combat (un par
        // depth) et inonde la page Rapports. Ils restent accessibles
        // individuellement via leur URL stockée dans anomalies.report_ids[]
        // (lus avec la méthode `get`, pas `list`). Si l'appelant veut les
        // voir explicitement, il passe `missionTypes: ['anomaly']`.
        conditions.push(sql`${missionReports.missionType}::text != 'anomaly'`);
      }

      const reports = await db
        .select({
          id: missionReports.id,
          userId: missionReports.userId,
          fleetEventId: missionReports.fleetEventId,
          pveMissionId: missionReports.pveMissionId,
          messageId: missionReports.messageId,
          missionType: missionReports.missionType,
          title: missionReports.title,
          coordinates: missionReports.coordinates,
          originCoordinates: missionReports.originCoordinates,
          fleet: missionReports.fleet,
          departureTime: missionReports.departureTime,
          completionTime: missionReports.completionTime,
          result: missionReports.result,
          read: missionReports.read,
          createdAt: missionReports.createdAt,
        })
        .from(missionReports)
        .where(and(...conditions))
        .orderBy(desc(missionReports.createdAt))
        .limit(limit + 1);

      const hasMore = reports.length > limit;
      const results = hasMore ? reports.slice(0, limit) : reports;
      const nextCursor = hasMore ? results[results.length - 1]?.id : undefined;

      return { reports: results, nextCursor };
    },

    async getById(userId: string, reportId: string) {
      const [report] = await db
        .select({
          id: missionReports.id,
          userId: missionReports.userId,
          fleetEventId: missionReports.fleetEventId,
          pveMissionId: missionReports.pveMissionId,
          messageId: missionReports.messageId,
          missionType: missionReports.missionType,
          title: missionReports.title,
          coordinates: missionReports.coordinates,
          originCoordinates: missionReports.originCoordinates,
          fleet: missionReports.fleet,
          departureTime: missionReports.departureTime,
          completionTime: missionReports.completionTime,
          result: missionReports.result,
          read: missionReports.read,
          createdAt: missionReports.createdAt,
        })
        .from(missionReports)
        .where(and(eq(missionReports.id, reportId), byUser(missionReports.userId, userId)))
        .limit(1);

      if (report && !report.read) {
        await db
          .update(missionReports)
          .set({ read: true })
          .where(eq(missionReports.id, reportId));
      }

      return report ?? null;
    },

    async getDetailedLog(userId: string, reportId: string) {
      const [report] = await db
        .select({ detailedLog: missionReports.detailedLog })
        .from(missionReports)
        .where(and(eq(missionReports.id, reportId), byUser(missionReports.userId, userId)))
        .limit(1);
      return decompressDetailedLog(report?.detailedLog);
    },

    async getByMessageId(userId: string, messageId: string) {
      const [report] = await db
        .select({
          id: missionReports.id,
          userId: missionReports.userId,
          fleetEventId: missionReports.fleetEventId,
          pveMissionId: missionReports.pveMissionId,
          messageId: missionReports.messageId,
          missionType: missionReports.missionType,
          title: missionReports.title,
          coordinates: missionReports.coordinates,
          originCoordinates: missionReports.originCoordinates,
          fleet: missionReports.fleet,
          departureTime: missionReports.departureTime,
          completionTime: missionReports.completionTime,
          result: missionReports.result,
          read: missionReports.read,
          createdAt: missionReports.createdAt,
        })
        .from(missionReports)
        .where(and(eq(missionReports.messageId, messageId), byUser(missionReports.userId, userId)))
        .limit(1);
      return report ?? null;
    },

    async deleteReport(userId: string, reportId: string) {
      await db
        .delete(missionReports)
        .where(and(eq(missionReports.id, reportId), byUser(missionReports.userId, userId)));
      return { success: true };
    },

    async countUnread(userId: string) {
      const [result] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(missionReports)
        .where(and(byUser(missionReports.userId, userId), eq(missionReports.read, false)));
      return result?.count ?? 0;
    },

    async markAllRead(userId: string) {
      await db
        .update(missionReports)
        .set({ read: true })
        .where(and(byUser(missionReports.userId, userId), eq(missionReports.read, false)));
    },
  };
}
