import { X } from 'lucide-react';
import { Modal } from '@/components/ui/modal';

interface Props {
  module: {
    id: string;
    name: string;
    description: string;
    rarity: string;
    hullId: string;
    image: string;
    effect: unknown;
    count?: number;
  } | null;
  onClose: () => void;
}

const RARITY_LABEL: Record<string, string> = { common: 'Commun', rare: 'Rare', epic: 'Épique' };

export function ModuleDetailModal({ module, onClose }: Props) {
  if (!module) return null;
  return (
    <Modal
      open
      onClose={onClose}
      backdropClassName="bg-black/70 backdrop-blur-sm"
      className="glass-card max-w-md lg:max-w-md p-5 space-y-3"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-violet-300">
            {RARITY_LABEL[module.rarity]} · {module.hullId}
          </div>
          <h3 className="text-base font-bold text-foreground/95">{module.name}</h3>
        </div>
        <button onClick={onClose}>
          <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
        </button>
      </div>
      {module.image && (
        <img
          src={`${module.image}.webp`}
          alt={module.name}
          className="rounded-md w-full h-40 object-cover"
        />
      )}
      <p className="text-sm text-foreground/80 italic">{module.description}</p>
      <div className="rounded border border-border/30 bg-card/20 p-2 text-[11px] font-mono text-muted-foreground">
        <pre className="whitespace-pre-wrap">{JSON.stringify(module.effect, null, 2)}</pre>
      </div>
      {module.count && module.count > 1 && (
        <div className="text-xs text-muted-foreground">Tu en possèdes {module.count}.</div>
      )}
    </Modal>
  );
}
