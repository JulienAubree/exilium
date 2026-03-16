import { initTRPC, TRPCError } from '@trpc/server';
import { jwtVerify } from 'jose';
import { eq } from 'drizzle-orm';
import type { Context } from './context.js';
import { env } from '../config/env.js';
import { users } from '@ogame-clone/db';
import type { Database } from '@ogame-clone/db';

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
});

export function createAdminProcedure(db: Database) {
  return protectedProcedure.use(async ({ ctx, next }) => {
    const [user] = await db
      .select({ isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.id, ctx.userId!))
      .limit(1);
    if (!user?.isAdmin) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
    }
    return next({ ctx });
  });
}
