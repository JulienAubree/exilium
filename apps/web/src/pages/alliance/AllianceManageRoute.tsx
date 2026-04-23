import { useAllianceContext, type Alliance } from './AlliancePage';
import { AllianceManagePage } from './AllianceManagePage';

export default function AllianceManageRoute() {
  const { alliance } = useAllianceContext() as { alliance: Alliance };
  return <AllianceManagePage alliance={alliance} />;
}
