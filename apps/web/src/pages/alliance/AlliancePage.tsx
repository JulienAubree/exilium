import { Outlet, useOutletContext } from 'react-router';
import { trpc } from '@/trpc';
import { CardGridSkeleton } from '@/components/common/PageSkeleton';
import { PageHeader } from '@/components/common/PageHeader';
import { NoAllianceView } from './NoAllianceView';

export type Alliance = {
  id: string;
  createdAt: string;
  name: string;
  description: string | null;
  tag: string;
  founderId: string;
  blasonShape: string;
  blasonIcon: string;
  blasonColor1: string;
  blasonColor2: string;
  motto: string | null;
  myRole: 'founder' | 'officer' | 'member';
  members: {
    userId: string;
    username: string;
    role: 'founder' | 'officer' | 'member';
    joinedAt: string;
    totalPoints: number;
  }[];
  totalPoints: number;
  rank: number;
  recentMilitary: {
    wins: number;
    losses: number;
    windowDays: number;
  };
};

export default function AlliancePage() {
  const { data: myAlliance, isLoading } = trpc.alliance.myAlliance.useQuery();
  const { data: invitations } = trpc.alliance.myInvitations.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 lg:space-y-6 lg:p-6">
        <PageHeader title="Alliance" />
        <CardGridSkeleton count={2} />
      </div>
    );
  }

  if (!myAlliance) return <NoAllianceView invitations={invitations ?? []} />;

  return <Outlet context={{ alliance: myAlliance } satisfies { alliance: Alliance }} />;
}

export function useAllianceContext(): { alliance: Alliance } {
  return useOutletContext() as { alliance: Alliance };
}
