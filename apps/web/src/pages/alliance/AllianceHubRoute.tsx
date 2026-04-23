import { useAllianceContext, type Alliance } from './AlliancePage';
import { AllianceHub } from './AllianceHub';

export default function AllianceHubRoute() {
  const { alliance } = useAllianceContext() as { alliance: Alliance };
  return <AllianceHub alliance={alliance} />;
}
