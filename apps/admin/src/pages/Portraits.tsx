import { useState, useEffect, useRef } from 'react';
import { fetchWithAuth } from '@/trpc';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Trash2, Loader2, ImagePlus, Plus } from 'lucide-react';

interface AvatarImage {
  index: number;
  thumbUrl: string;
}

export default function Portraits() {
  const [images, setImages] = useState<AvatarImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadImages() {
    try {
      const res = await fetchWithAuth('/admin/avatar-images');
      if (res.ok) {
        const data = await res.json();
        setImages(data.images ?? []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { loadImages(); }, []);

  function handleUploadClick() {
    fileRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('category', 'avatars');
      formData.append('file', file);

      const res = await fetchWithAuth('/admin/upload-asset', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Upload failed');
        return;
      }

      await loadImages();
    } catch {
      alert('Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleDelete() {
    if (deleteTarget === null) return;
    setDeleting(true);
    try {
      const res = await fetchWithAuth(`/admin/avatar-images/${deleteTarget}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Delete failed');
        return;
      }
      await loadImages();
    } catch {
      alert('Delete failed');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-100">Portraits</h1>
        <div className="text-sm text-gray-500">
          {loading ? '...' : `${images.length} portrait${images.length !== 1 ? 's' : ''}`}
        </div>
      </div>

      <div className="admin-card p-4">
        {loading ? (
          <div className="text-gray-500 text-sm">Chargement...</div>
        ) : images.length === 0 && !uploading ? (
          <div className="flex flex-col items-center py-8 text-gray-500">
            <ImagePlus className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm mb-4">Aucun portrait disponible</p>
            <button onClick={handleUploadClick} className="admin-btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Ajouter un portrait
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 items-center">
            {images.map((img) => (
              <div key={img.index} className="group relative">
                <img
                  src={`${img.thumbUrl}?t=${Date.now()}`}
                  alt={`Portrait ${img.index}`}
                  className="w-16 h-16 rounded-lg border border-panel-border object-cover"
                />
                <button
                  onClick={() => setDeleteTarget(img.index)}
                  className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-black/80 text-gray-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Supprimer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}

            {/* Upload button — same style as AdminImageUpload */}
            <button
              type="button"
              onClick={handleUploadClick}
              className="relative w-16 h-16 rounded-lg border border-dashed border-panel-border hover:border-hull-400 transition-colors cursor-pointer overflow-hidden flex-shrink-0 flex items-center justify-center"
              title="Ajouter un portrait"
            >
              {uploading ? (
                <Loader2 className="w-5 h-5 text-hull-400 animate-spin" />
              ) : (
                <Plus className="w-5 h-5 text-gray-500" />
              )}
            </button>
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Supprimer ce portrait ?"
        message={`Le portrait #${deleteTarget} sera supprime. Les joueurs qui l'utilisent verront leurs initiales a la place.`}
        confirmLabel={deleting ? 'Suppression...' : 'Supprimer'}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        danger
      />
    </div>
  );
}
