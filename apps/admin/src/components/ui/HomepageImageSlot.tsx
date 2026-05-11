import { AdminAssetSlot } from './AdminAssetSlot';

interface HomepageImageSlotProps {
  slot: string;
  value: string;
  aspect?: string;
  label: string;
  hint?: string;
  onChange: (path: string) => void;
}

/**
 * Wrapper rétro-compatible — délègue à AdminAssetSlot avec
 * category='landing'. Conservé pour ne pas casser les imports
 * existants dans /admin/homepage. Préférer AdminAssetSlot dans le
 * nouveau code.
 *
 * @deprecated Utiliser <AdminAssetSlot category="landing" />.
 */
export function HomepageImageSlot(props: HomepageImageSlotProps) {
  return <AdminAssetSlot category="landing" {...props} />;
}
