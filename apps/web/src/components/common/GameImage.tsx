import { useState } from 'react';
import { getAssetUrl, type AssetCategory, type AssetSize } from '@/lib/assets';

interface GameImageProps {
  category: AssetCategory;
  id: string;
  size?: AssetSize;
  alt: string;
  className?: string;
}

export function GameImage({ category, id, size = 'full', alt, className }: GameImageProps) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-muted text-muted-foreground text-xs ${className ?? ''}`}
      >
        {alt}
      </div>
    );
  }

  return (
    <img
      src={getAssetUrl(category, id, size)}
      alt={alt}
      className={className}
      onError={() => setError(true)}
      loading="lazy"
    />
  );
}
