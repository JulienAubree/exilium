import { trpc } from '@/trpc';
import { Breadcrumb } from '@/components/common/Breadcrumb';
import { PageHeader } from '@/components/common/PageHeader';
import { CardGridSkeleton } from '@/components/common/PageSkeleton';
import { TalentTree } from '@/components/flagship/TalentTree';

const BREADCRUMB = [
  { label: 'Flotte', path: '/fleet' },
  { label: 'Vaisseau amiral', path: '/flagship/talents' },
];

export default function FlagshipTalents() {
  const { isLoading } = trpc.talent.list.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 lg:p-6">
        <Breadcrumb segments={BREADCRUMB} />
        <PageHeader title="Arbre de talents" />
        <CardGridSkeleton count={3} />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <Breadcrumb segments={BREADCRUMB} />
      <PageHeader title="Arbre de talents" />
      <TalentTree />
    </div>
  );
}
