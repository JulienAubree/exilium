import webpush from 'web-push';
import { eq } from 'drizzle-orm';
import { byUser } from '../../lib/db-helpers.js';
import type { Database } from '@exilium/db';
import { pushSubscriptions, notificationPreferences } from '@exilium/db';
import { env } from '../../config/env.js';

export type PushCategory = 'building' | 'research' | 'shipyard' | 'fleet' | 'combat' | 'message';

export function createPushService(db: Database) {
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  }

  return {
    getPublicKey() {
      return env.VAPID_PUBLIC_KEY;
    },

    async subscribe(userId: string, subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) {
      await db
        .insert(pushSubscriptions)
        .values({
          userId,
          endpoint: subscription.endpoint,
          keysP256dh: subscription.keys.p256dh,
          keysAuth: subscription.keys.auth,
        })
        .onConflictDoUpdate({
          target: pushSubscriptions.endpoint,
          set: {
            userId,
            keysP256dh: subscription.keys.p256dh,
            keysAuth: subscription.keys.auth,
          },
        });
    },

    async sendToUser(userId: string, category: PushCategory, payload: { title: string; body: string; url?: string }, eventType?: string) {
      if (!env.VAPID_PUBLIC_KEY) return;

      // Check user notification preferences
      const [prefs] = await db
        .select({ pushDisabled: notificationPreferences.pushDisabled })
        .from(notificationPreferences)
        .where(byUser(notificationPreferences.userId, userId))
        .limit(1);
      if (eventType && prefs?.pushDisabled?.includes(eventType)) return;
      if (!eventType && prefs?.pushDisabled?.includes(category)) return;

      const subs = await db
        .select()
        .from(pushSubscriptions)
        .where(byUser(pushSubscriptions.userId, userId));

      for (const sub of subs) {
        // Plus de filtrage par-abonnement ici : les préférences vivent dans
        // `notification_preferences`, filtrées plus haut. La colonne
        // `push_subscriptions.preferences` a été supprimée (migration 0109).
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.keysP256dh, auth: sub.keysAuth },
            },
            JSON.stringify(payload),
          );
        } catch (err: unknown) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
          }
        }
      }
    },
  };
}
