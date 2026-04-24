import { lt } from 'drizzle-orm';
import type { Database } from '@exilium/db';
import { refreshTokens, passwordResetTokens, emailVerificationTokens } from '@exilium/db';
import { createGameEventService } from '../modules/game-event/game-event.service.js';

export async function eventCleanup(db: Database) {
  const service = createGameEventService(db);
  const count = await service.cleanup();
  if (count > 0) {
    console.log(`[event-cleanup] Deleted ${count} events older than 30 days`);
  }

  const now = new Date();

  // Purge expired auth tokens. They're already rejected at verification time,
  // but keeping them in hot tables bloats indexes — refresh_tokens accumulates
  // ~1 row per login × sessions-kept, and was at 240/300 expired before this ran.
  const refreshDeleted = await db
    .delete(refreshTokens)
    .where(lt(refreshTokens.expiresAt, now))
    .returning({ id: refreshTokens.id });
  const passwordResetDeleted = await db
    .delete(passwordResetTokens)
    .where(lt(passwordResetTokens.expiresAt, now))
    .returning({ id: passwordResetTokens.id });
  const emailVerifyDeleted = await db
    .delete(emailVerificationTokens)
    .where(lt(emailVerificationTokens.expiresAt, now))
    .returning({ id: emailVerificationTokens.id });

  const totalTokens = refreshDeleted.length + passwordResetDeleted.length + emailVerifyDeleted.length;
  if (totalTokens > 0) {
    console.log(
      `[event-cleanup] Purged expired tokens: refresh=${refreshDeleted.length} reset=${passwordResetDeleted.length} emailVerify=${emailVerifyDeleted.length}`,
    );
  }
}
