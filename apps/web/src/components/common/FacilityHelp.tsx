import type { ReactNode } from 'react';
import { getBuildingIllustrationUrl } from '@/lib/assets';
import { useGameConfig } from '@/hooks/useGameConfig';

interface FacilityHelpProps {
  buildingId: string;
  level: number;
  planetClassId?: string | null;
  /** Organized sections, typically via <FacilityHelpSection />. */
  children: ReactNode;
}

export function FacilityHelp({ buildingId, level, planetClassId, children }: FacilityHelpProps) {
  const { data: gameConfig } = useGameConfig();
  return (
    <>
      <div className="relative -mx-5 -mt-5 overflow-hidden rounded-t-lg">
        <img
          src={getBuildingIllustrationUrl(gameConfig, buildingId, planetClassId)}
          alt=""
          className="w-full h-40 object-cover"
          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-transparent" />
        <div className="absolute bottom-3 left-5">
          <p className="text-sm font-semibold text-foreground">Niveau {level}</p>
        </div>
      </div>

      {children}
    </>
  );
}

interface FacilityHelpSectionProps {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}

/** Icon + heading + paragraph, matching the shipyard help layout. */
export function FacilityHelpSection({ icon, title, children }: FacilityHelpSectionProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        {icon}
        {title}
      </h3>
      <p className="text-xs text-muted-foreground leading-relaxed">{children}</p>
    </div>
  );
}
