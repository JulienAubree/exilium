import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { PlanetTypeVariantSlot } from './PlanetTypeVariantSlot';

interface PlanetTypeVariantsPanelProps {
  category: 'buildings' | 'defenses';
  entityId: string;
  variantPlanetTypes: string[];
  planetTypes: Array<{ id: string; name: string }>;
  onChange: () => void;
}

export function PlanetTypeVariantsPanel({
  category,
  entityId,
  variantPlanetTypes,
  planetTypes,
  onChange,
}: PlanetTypeVariantsPanelProps) {
  const [open, setOpen] = useState(false);
  const count = variantPlanetTypes.length;

  return (
    <div className="border rounded mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent/30"
      >
        <span>
          Variantes par type de planète ({count}/{planetTypes.length})
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <div className="px-3 pb-3 border-t">
          {planetTypes.map((pt) => (
            <PlanetTypeVariantSlot
              key={pt.id}
              category={category}
              entityId={entityId}
              planetTypeId={pt.id}
              planetTypeName={pt.name}
              hasVariant={variantPlanetTypes.includes(pt.id)}
              onChange={onChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
