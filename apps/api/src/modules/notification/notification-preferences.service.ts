import { byUser } from '../../lib/db-helpers.js';
import { notificationPreferences } from '@exilium/db';
import type { Database } from '@exilium/db';

export interface NotificationPrefs {
  toastDisabled: string[];
  pushDisabled: string[];
  bellDisabled: string[];
}

const DEFAULTS: NotificationPrefs = { toastDisabled: [], pushDisabled: [], bellDisabled: [] };

export function createNotificationPreferencesService(db: Database) {
  return {
    async getPreferences(userId: string): Promise<NotificationPrefs> {
      const [row] = await db
        .select({
          toastDisabled: notificationPreferences.toastDisabled,
          pushDisabled: notificationPreferences.pushDisabled,
          bellDisabled: notificationPreferences.bellDisabled,
        })
        .from(notificationPreferences)
        .where(byUser(notificationPreferences.userId, userId))
        .limit(1);
      return row ?? DEFAULTS;
    },

    async updatePreferences(userId: string, prefs: NotificationPrefs): Promise<NotificationPrefs> {
      const [row] = await db
        .insert(notificationPreferences)
        .values({
          userId,
          toastDisabled: prefs.toastDisabled,
          pushDisabled: prefs.pushDisabled,
          bellDisabled: prefs.bellDisabled,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: notificationPreferences.userId,
          set: {
            toastDisabled: prefs.toastDisabled,
            pushDisabled: prefs.pushDisabled,
            bellDisabled: prefs.bellDisabled,
            updatedAt: new Date(),
          },
        })
        .returning({
          toastDisabled: notificationPreferences.toastDisabled,
          pushDisabled: notificationPreferences.pushDisabled,
          bellDisabled: notificationPreferences.bellDisabled,
        });
      return row;
    },
  };
}
