import { useAuthStore } from '@/stores/auth.store';
import { ProfileView } from '@/components/profile/ProfileView';

export default function Profile() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;
  return <ProfileView userId={user.id} isOwn={true} />;
}
