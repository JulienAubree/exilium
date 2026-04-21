import { useParams } from 'react-router';
import { ProfileView } from '@/components/profile/ProfileView';

export default function PlayerProfile() {
  const { userId } = useParams<{ userId: string }>();
  if (!userId) return null;
  return <ProfileView userId={userId} isOwn={false} />;
}
