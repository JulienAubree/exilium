import { PageHeader } from '@/components/common/PageHeader';
import { AllianceHero } from '@/components/alliance/AllianceHero';
import { ActivityPreviewCard } from '@/components/alliance/ActivityPreviewCard';
import { ChatPreviewCard } from '@/components/alliance/ChatPreviewCard';
import { MembersPreviewCard } from '@/components/alliance/MembersPreviewCard';
import { ManageShortcutCard } from '@/components/alliance/ManageShortcutCard';

interface AllianceHubProps {
  alliance: {
    id: string;
    name: string;
    tag: string;
    motto: string | null;
    blasonShape: string;
    blasonIcon: string;
    blasonColor1: string;
    blasonColor2: string;
    myRole: string;
    createdAt: string;
    members: { userId: string; username: string; role: string; joinedAt: string; totalPoints?: number }[];
    totalPoints: number;
    rank: number;
    recentMilitary: { wins: number; losses: number; windowDays: number };
  };
}

export function AllianceHub({ alliance }: AllianceHubProps) {
  const isLeader = alliance.myRole === 'founder' || alliance.myRole === 'officer';

  return (
    <div className="space-y-4 p-4 lg:space-y-6 lg:p-6">
      <PageHeader title="Alliance" />

      <AllianceHero alliance={alliance} />

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr] lg:gap-6">
        <ActivityPreviewCard />
        <ChatPreviewCard />
        <MembersPreviewCard members={alliance.members} />
        {isLeader && <ManageShortcutCard />}
      </div>
    </div>
  );
}
