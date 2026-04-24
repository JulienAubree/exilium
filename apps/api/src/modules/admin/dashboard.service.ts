import { sql, and, gte } from 'drizzle-orm';
import type { Queue } from 'bullmq';
import type { Database } from '@exilium/db';
import { users, planets, alliances, fleetEvents, buildQueue, gameEvents, loginEvents } from '@exilium/db';

export interface DashboardStats {
  users: { total: number; active1h: number; active24h: number; active7d: number; banned: number };
  world: { planets: number; alliances: number; activeFleets: number; activeBuilds: number };
  activity24h: { fleetsSent: number; buildsCompleted: number; loginsSuccess: number; loginsFailed: number };
  queues: Array<{ name: string; active: number; waiting: number; delayed: number; failed: number; completed: number }>;
  timestamp: string;
}

export function createDashboardService(db: Database, queues: Record<string, Queue>) {
  async function getStats(): Promise<DashboardStats> {
    const now = new Date();
    const h1 = new Date(now.getTime() - 60 * 60_000);
    const h24 = new Date(now.getTime() - 24 * 60 * 60_000);
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60_000);

    // Users + activity in a single query per-dataset so the planner gets
    // everything in parallel.
    const [
      userCounts,
      worldCounts,
      activityCounts,
      ...queueStats
    ] = await Promise.all([
      db.select({
        total: sql<number>`count(*)::int`,
        active1h: sql<number>`count(*) filter (where ${users.lastLoginAt} > ${h1})::int`,
        active24h: sql<number>`count(*) filter (where ${users.lastLoginAt} > ${h24})::int`,
        active7d: sql<number>`count(*) filter (where ${users.lastLoginAt} > ${d7})::int`,
        banned: sql<number>`count(*) filter (where ${users.bannedAt} is not null)::int`,
      }).from(users),

      db.select({
        planets: sql<number>`(select count(*)::int from ${planets})`,
        alliances: sql<number>`(select count(*)::int from ${alliances})`,
        activeFleets: sql<number>`(select count(*)::int from ${fleetEvents} where status = 'active')`,
        activeBuilds: sql<number>`(select count(*)::int from ${buildQueue} where status in ('active','queued'))`,
      }).from(sql`(values (1)) as _(x)`),

      db.select({
        fleetsSent: sql<number>`(select count(*)::int from ${fleetEvents} where ${fleetEvents.departureTime} > ${h24})`,
        buildsCompleted: sql<number>`(select count(*)::int from ${gameEvents} where ${gameEvents.type} in ('building-done','shipyard-done','research-done') and ${gameEvents.createdAt} > ${h24})`,
        loginsSuccess: sql<number>`(select count(*)::int from ${loginEvents} where success = true and ${loginEvents.createdAt} > ${h24})`,
        loginsFailed: sql<number>`(select count(*)::int from ${loginEvents} where success = false and ${loginEvents.createdAt} > ${h24})`,
      }).from(sql`(values (1)) as _(x)`),

      ...Object.entries(queues).map(async ([name, q]) => {
        const counts = await q.getJobCounts('active', 'waiting', 'delayed', 'failed', 'completed');
        return {
          name,
          active: counts.active ?? 0,
          waiting: counts.waiting ?? 0,
          delayed: counts.delayed ?? 0,
          failed: counts.failed ?? 0,
          completed: counts.completed ?? 0,
        };
      }),
    ]);

    // The aggregate selects return one row each — defensive fallback on empty.
    const u = userCounts[0] ?? { total: 0, active1h: 0, active24h: 0, active7d: 0, banned: 0 };
    const w = worldCounts[0] ?? { planets: 0, alliances: 0, activeFleets: 0, activeBuilds: 0 };
    const a = activityCounts[0] ?? { fleetsSent: 0, buildsCompleted: 0, loginsSuccess: 0, loginsFailed: 0 };

    return {
      users: u,
      world: w,
      activity24h: a,
      queues: queueStats,
      timestamp: now.toISOString(),
    };
  }

  async function getRecentErrors(limit = 20) {
    // Failed logins in the last 24h, grouped by email — cheap abuse signal
    // without depending on a full error tracking setup.
    const h24 = new Date(Date.now() - 24 * 60 * 60_000);
    const rows = await db
      .select({
        email: loginEvents.email,
        reason: loginEvents.reason,
        ipAddress: loginEvents.ipAddress,
        createdAt: loginEvents.createdAt,
      })
      .from(loginEvents)
      .where(and(gte(loginEvents.createdAt, h24), sql`success = false`))
      .orderBy(sql`${loginEvents.createdAt} desc`)
      .limit(limit);
    return rows;
  }

  return { getStats, getRecentErrors };
}

export type DashboardService = ReturnType<typeof createDashboardService>;
