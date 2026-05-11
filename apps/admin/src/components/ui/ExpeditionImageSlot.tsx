import { AdminAssetSlot } from './AdminAssetSlot';

interface ExpeditionImageSlotProps {
  slot: string;
  value: string;
  aspect?: string;
  label: string;
  hint?: string;
  onChange: (path: string) => void;
}

/**
 * Wrapper rétro-compatible — délègue à AdminAssetSlot avec
 * category='expedition'. Conservé pour ne pas casser les imports
 * existants. Préférer AdminAssetSlot dans le nouveau code.
 *
 * @deprecated Utiliser <AdminAssetSlot category="expedition" />.
 */
export function ExpeditionImageSlot(props: ExpeditionImageSlotProps) {
  return <AdminAssetSlot category="expedition" {...props} />;
}
