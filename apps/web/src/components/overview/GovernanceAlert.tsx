import { useNavigate } from 'react-router';
import { trpc } from '@/trpc';
import { AlertBanner } from '@/components/ui/alert-banner';

interface GovernanceAlertProps {
  /** planetClassId of the currently viewed planet — homeworld is exempt */
  planetClassId?: string | null;
}

export function GovernanceAlert({ planetClassId }: GovernanceAlertProps) {
  const navigate = useNavigate();
  const { data: governance } = trpc.colonization.governance.useQuery();

  // Don't render on homeworld or if no overextend
  if (!governance || governance.overextend <= 0) return null;
  if (planetClassId === 'homeworld') return null;

  const { colonyCount, capacity, overextend, harvestMalus, constructionMalus } = governance;

  return (
    <AlertBanner
      tone="warning"
      title="Surextension impériale"
      meta={`${colonyCount}/${capacity} colonies (+${overextend})`}
      onClick={() => navigate('/empire')}
    >
      <span className="text-destructive font-medium">−{Math.round(harvestMalus * 100)} % récolte</span>
      {' · '}
      <span className="text-destructive font-medium">+{Math.round(constructionMalus * 100)} % temps de construction</span>
      {" — gagnez des niveaux d'empire pour lever ces pénalités."}
    </AlertBanner>
  );
}
