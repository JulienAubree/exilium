import { useState, useRef } from 'react';
import { fetchWithAuth } from '@/trpc';
import { Loader2 } from 'lucide-react';
import { toKebab } from '@exilium/shared';

interface PlanetTypeVariantSlotProps {
  category: 'buildings' | 'defenses';
  entityId: string;
  planetTypeId: string;
  planetTypeName: string;
  hasVariant: boolean;
  onChange: () => void;
}

export function PlanetTypeVariantSlot({
  category,
  entityId,
  planetTypeId,
  planetTypeName,
  hasVariant,
  onChange,
}: PlanetTypeVariantSlotProps) {
  const [uploading, setUploading] = useState(false);
  const [cacheBust, setCacheBust] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const iconUrl = hasVariant
    ? `/assets/${category}/${toKebab(entityId)}/${planetTypeId}-icon.webp${cacheBust ? `?t=${cacheBust}` : ''}`
    : null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('category', category);
    fd.append('entityId', entityId);
    fd.append('planetType', planetTypeId);
    fd.append('file', file);
    const res = await fetchWithAuth('/admin/upload-asset', { method: 'POST', body: fd });
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Upload failed');
      return;
    }
    setCacheBust(String(Date.now()));
    onChange();
  };

  const handleDelete = async () => {
    if (!confirm(`Supprimer la variante ${planetTypeName} ?`)) return;
    const res = await fetchWithAuth(
      `/admin/asset-variant/${category}/${entityId}/${planetTypeId}`,
      { method: 'DELETE' },
    );
    if (!res.ok) {
      alert('Delete failed');
      return;
    }
    onChange();
  };

  return (
    <div className="flex items-center gap-3 py-2">
      <span className="w-28 text-sm">{planetTypeName}</span>
      {hasVariant && iconUrl ? (
        <>
          <img src={iconUrl} alt={planetTypeName} className="w-12 h-12 rounded object-cover" />
          <button
            type="button"
            onClick={handleDelete}
            className="text-red-500 text-xs hover:underline"
          >
            Supprimer
          </button>
        </>
      ) : (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="text-xs px-2 py-1 border rounded hover:bg-accent"
          >
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Uploader'}
          </button>
        </>
      )}
    </div>
  );
}
