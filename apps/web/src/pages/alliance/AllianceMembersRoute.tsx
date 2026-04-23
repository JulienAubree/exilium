import { useAllianceContext, type Alliance } from './AlliancePage';
import { AllianceMembersPage } from './AllianceMembersPage';

export default function AllianceMembersRoute() {
  const { alliance } = useAllianceContext() as { alliance: Alliance };
  return <AllianceMembersPage alliance={alliance} />;
}
