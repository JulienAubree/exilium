import { PageHeader } from '@/components/common/PageHeader';
import { NotificationPreferences } from '@/components/profile/NotificationPreferences';

export default function SettingsNotifications() {
  return (
    <div className="space-y-4 p-4 lg:space-y-6 lg:p-6">
      <PageHeader title="Préférences de notification" />
      <div className="max-w-2xl">
        <div className="glass-card p-4 lg:p-6">
          <NotificationPreferences />
        </div>
      </div>
    </div>
  );
}
