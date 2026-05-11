import { getFlagshipImageUrl } from '@/lib/assets';
import { Modal } from '@/components/ui/modal';

interface FlagshipImagePickerProps {
  open: boolean;
  hullId: string;
  currentImageIndex: number | null;
  images: number[];
  onSelect: (imageIndex: number) => void;
  onClose: () => void;
}

export function FlagshipImagePicker({
  open,
  hullId,
  currentImageIndex,
  images,
  onSelect,
  onClose,
}: FlagshipImagePickerProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      backdropClassName="bg-black/60 backdrop-blur-sm"
      className="glass-card max-w-lg lg:max-w-lg p-4 sm:p-6"
    >
      <h3 className="text-lg font-semibold mb-4">Choisir une image</h3>
      {images.length === 0 ? (
        <div className="text-muted-foreground text-sm">Aucune image disponible</div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3 max-h-[60vh] sm:max-h-80 overflow-y-auto">
          {images.map((idx) => (
            <button
              key={idx}
              onClick={() => onSelect(idx)}
              className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${
                idx === currentImageIndex
                  ? 'border-primary ring-2 ring-primary/50'
                  : 'border-white/10 hover:border-white/30'
              }`}
            >
              <img
                src={getFlagshipImageUrl(hullId, idx, 'thumb')}
                alt={`Flagship ${idx}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <button
          onClick={onClose}
          className="min-h-9 px-3 text-sm text-muted-foreground hover:text-foreground"
        >
          Fermer
        </button>
      </div>
    </Modal>
  );
}
