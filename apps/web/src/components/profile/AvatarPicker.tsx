import { trpc } from '@/trpc';

interface AvatarPickerProps {
  currentAvatarId: string | null;
  onSelect: (avatarId: string) => void;
  onClose: () => void;
}

export function AvatarPicker({ currentAvatarId, onSelect, onClose }: AvatarPickerProps) {
  const { data: avatars, isLoading } = trpc.user.listAvatars.useQuery();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-card max-w-lg w-full mx-4 p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">Choisir un avatar</h3>
        {isLoading ? (
          <div className="text-muted-foreground text-sm">Chargement...</div>
        ) : !avatars?.length ? (
          <div className="text-muted-foreground text-sm">Aucun avatar disponible</div>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 max-h-80 overflow-y-auto">
            {avatars.map(id => (
              <button
                key={id}
                onClick={() => { onSelect(id); onClose(); }}
                className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${
                  id === currentAvatarId ? 'border-primary ring-2 ring-primary/50' : 'border-white/10 hover:border-white/30'
                }`}
              >
                <img src={`/assets/avatars/${id}.webp`} alt={id} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">Fermer</button>
        </div>
      </div>
    </div>
  );
}
