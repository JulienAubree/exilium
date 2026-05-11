import { AdminAssetSlot } from './AdminAssetSlot';

interface AnomalyImageSlotProps {
  slot: string;
  value: string;
  aspect?: string;
  label: string;
  hint?: string;
  onChange: (path: string) => void;
}

/**
 * Wrapper rétro-compatible — délègue à AdminAssetSlot avec
 * category='anomaly'. Conservé pour ne pas casser les imports
 * existants dans /admin/anomalies. Préférer AdminAssetSlot dans le
 * nouveau code.
 *
 * @deprecated Utiliser <AdminAssetSlot category="anomaly" />.
 */
export function AnomalyImageSlot(props: AnomalyImageSlotProps) {
  return <AdminAssetSlot category="anomaly" {...props} />;
}
