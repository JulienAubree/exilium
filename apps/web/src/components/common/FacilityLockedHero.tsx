import type { ReactNode } from 'react';
import { getAssetUrl } from '@/lib/assets';

interface FacilityLockedHeroProps {
  buildingId: string;
  title: string;
  description: ReactNode;
  children?: ReactNode;
}

export function FacilityLockedHero({
  buildingId,
  title,
  description,
  children,
}: FacilityLockedHeroProps) {
  return (
    <div className="relative overflow-hidden min-h-[calc(100dvh-3.5rem)]">
      <div className="absolute inset-0">
        <img
          src={getAssetUrl('buildings', buildingId, 'full')}
          alt=""
          className="h-full w-full object-cover opacity-40 blur-sm scale-110"
          decoding="async"
          fetchPriority="low"
          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-950/50 via-slate-950/70 to-purple-950/50" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />

      <div className="relative flex flex-col items-center px-5 py-12 lg:py-16 text-center">
        <img
          src={getAssetUrl('buildings', buildingId, 'thumb')}
          alt={title}
          className="h-24 w-24 lg:h-28 lg:w-28 rounded-full border-2 border-primary/30 object-cover shadow-lg shadow-cyan-500/10 mb-5"
          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
        />
        <h1 className="text-xl lg:text-2xl font-bold text-foreground mb-2">{title}</h1>
        <p className="text-sm text-muted-foreground mb-6 max-w-md">{description}</p>
        {children}
      </div>
    </div>
  );
}
