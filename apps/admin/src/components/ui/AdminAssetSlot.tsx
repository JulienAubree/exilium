import { useState, useRef } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { fetchWithAuth } from '@/trpc';
import type { AssetCategory } from '@exilium/shared';

interface AdminAssetSlotProps {
  /**
   * Catégorie d'asset (voir AssetCategory dans @exilium/shared) :
   * 'anomaly', 'expedition', 'landing', 'module', 'avatars', etc.
   * Détermine le sous-dossier `/assets/<category>/` côté serveur.
   */
  category: AssetCategory;
  /** Slot key — alphanum + `-` / `_` only (ex: `depth-1`, `sector-theta-7`). */
  slot: string;
  /** Chemin public courant (typiquement `/assets/<category>/<slot>.webp`). */
  value: string;
  /** Ratio d'aspect suggéré pour la vignette de preview. */
  aspect?: string;
  label: string;
  hint?: string;
  onChange: (path: string) => void;
}

/**
 * Composant générique d'upload d'asset pour l'admin. Factorise les
 * patterns dupliqués (AnomalyImageSlot, HomepageImageSlot, etc.).
 *
 * Flow :
 *   1. User clique "Uploader" → file picker
 *   2. POST /admin/upload-asset avec category + entityId=slot + file
 *   3. Backend resize en webp + écrit /assets/<category>/<slot>{,-thumb}.webp
 *   4. onChange(path) renseigne le path public dans le content blob
 *   5. Cache-bust pour forcer le navigateur à recharger la preview
 *
 * Nécessite que la catégorie soit autorisée côté backend
 * (image-processing.ts) et servie par Caddy.
 */
export function AdminAssetSlot({
  category,
  slot,
  value,
  aspect = '16/9',
  label,
  hint,
  onChange,
}: AdminAssetSlotProps) {
  const [uploading, setUploading] = useState(false);
  const [errored, setErrored] = useState(false);
  const [cacheBust, setCacheBust] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const previewUrl = value
    ? `${value}${cacheBust ? `?t=${cacheBust}` : ''}`
    : null;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setErrored(false);
    const fd = new FormData();
    fd.append('category', category);
    fd.append('entityId', slot);
    fd.append('file', file);

    try {
      const res = await fetchWithAuth('/admin/upload-asset', { method: 'POST', body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error ?? 'Upload échoué');
        return;
      }
      const path = `/assets/${category}/${slot}.webp`;
      onChange(path);
      setCacheBust(String(Date.now()));
    } catch {
      alert('Upload échoué');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-mono uppercase tracking-wider text-gray-400">
          {label}
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-400"
          >
            <X className="h-3 w-3" /> Vider
          </button>
        )}
      </div>

      <div
        className="relative overflow-hidden rounded-md border border-dashed border-panel-border bg-panel/50"
        style={{ aspectRatio: aspect }}
      >
        {previewUrl && !errored ? (
          <img
            src={previewUrl}
            alt={label}
            className="h-full w-full object-cover"
            onError={() => setErrored(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs font-mono text-gray-600">
            {value ? 'Image manquante' : 'Aucune image'}
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Loader2 className="h-5 w-5 animate-spin text-hull-400" />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded border border-hull-700/40 bg-hull-900/30 px-2 py-1 text-xs text-hull-300 transition-colors hover:bg-hull-900/60"
          disabled={uploading}
        >
          <Upload className="h-3 w-3" /> {value ? 'Remplacer' : 'Uploader'}
        </button>
        {hint && <span className="text-[10px] text-gray-600">{hint}</span>}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={onFile}
        className="hidden"
      />
    </div>
  );
}
