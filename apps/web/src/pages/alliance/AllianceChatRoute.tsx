import { useAllianceContext, type Alliance } from './AlliancePage';
import { AllianceChatPage } from './AllianceChatPage';

export default function AllianceChatRoute() {
  const { alliance } = useAllianceContext() as { alliance: Alliance };
  return <AllianceChatPage alliance={alliance} />;
}
