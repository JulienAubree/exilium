import { initTRPC, TRPCError } from '@trpc/server';
import { jwtVerify } from 'jose';
import { eq } from 'drizzle-orm';
import type { Context } from './context.js';
import { env } from '../config/env.js';
import { users } from '@exilium/db';
import type { Database } from '@exilium/db';

const JWT_SECRET = new TextEncoder().encode(env.JWT_SECRET);

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  const authHeader = ctx.req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  try {
    const token = authHeader.slice(7);
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return next({
      ctx: { ...ctx, userId: payload.userId as string },
    });
  } catch {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  // Ban revocation strategy (SEC-01):
  //   1. refresh() rejects a banned account → no new access tokens issued.
  //   2. banPlayer() wipes refresh_tokens → existing refreshes also fail.
  //   3. access tokens always expire within JWT_EXPIRES_IN (2h default), even
  //      with rememberMe (rememberMe extends the *refresh* token, not the
  //      access token).
  // Worst-case propagation delay after ban: JWT_EXPIRES_IN.
  // We deliberately don't hit the DB here per-request to keep latency tight.
});

export function createAdminProcedure(db: Database) {
  return protectedProcedure.use(async ({ ctx, next, path, type, input }) => {
    const [user] = await db
      .select({ isAdmin: users.isAdmin, bannedAt: users.bannedAt })
      .from(users)
      .where(eq(users.id, ctx.userId!))
      .limit(1);
    // Belt-and-suspenders ban check for admin actions: if a banned admin
    // somehow still has a valid access token (during the JWT_EXPIRES_IN
    // grace window after ban), reject every admin call immediately.
    if (!user || user.bannedAt) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }
    if (!user.isAdmin) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
    }

    // Audit trail : on log toutes les actions admin via le logger Fastify.
    // Niveau `warn` pour qu'elles sortent en prod (logger configuré en `warn`).
    // Les `query` sont également loggées (utile pour tracer les regards admin
    // sur les comptes joueurs). Le filtrage se fait côté outil d'analyse via
    // le tag `audit: 'admin'`.
    ctx.req.log.warn(
      {
        audit: 'admin',
        adminId: ctx.userId,
        action: path,
        opType: type,
        input,
      },
      'admin action',
    );

    return next({ ctx });
  });
}
