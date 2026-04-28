import { Wrench, FlaskConical, Compass, Coins, Crown, Shield } from 'lucide-react';
import { FacilityHelpSection } from '@/components/common/FacilityHelp';
import { getBuildingIllustrationUrl } from '@/lib/assets';
import { useGameConfig } from '@/hooks/useGameConfig';

/**
 * Aide pédagogique de la page Infrastructures : présente les 6 piliers
 * d'une planète (industrie, recherche, exploration, commerce, gouvernance,
 * défense) et leur rôle.
 */
export function InfrastructuresHelp({ planetClassId }: { planetClassId?: string | null } = {}) {
  const { data: gameConfig } = useGameConfig();
  return (
    <>
      <div className="relative -mx-5 -mt-5 overflow-hidden rounded-t-lg">
        <img
          src={getBuildingIllustrationUrl(gameConfig, 'imperialPowerCenter', planetClassId)}
          alt=""
          className="w-full h-40 object-cover"
          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-transparent" />
        <div className="absolute bottom-3 left-5">
          <p className="text-sm font-semibold text-foreground">Les 6 piliers de votre planète</p>
        </div>
      </div>

      <FacilityHelpSection
        icon={<Wrench className="h-3.5 w-3.5 text-amber-400" />}
        title="Industrie"
      >
        L'<span className="text-foreground font-medium">Usine de robots</span> réduit le temps de construction de tous les bâtiments. C'est l'un des premiers à monter pour accélérer toute la suite.
      </FacilityHelpSection>

      <FacilityHelpSection
        icon={<FlaskConical className="h-3.5 w-3.5 text-violet-400" />}
        title="Recherche"
      >
        Le <span className="text-foreground font-medium">Laboratoire</span> vit sur la planète-mère et pilote tout le programme scientifique. Sur les colonies, vous construisez une <span className="text-foreground font-medium">annexe spécialisée</span> selon le biome qui boost l'ensemble.
      </FacilityHelpSection>

      <FacilityHelpSection
        icon={<Compass className="h-3.5 w-3.5 text-cyan-400" />}
        title="Exploration"
      >
        Le <span className="text-foreground font-medium">Centre de missions</span> (planète-mère) découvre les gisements et détecte les pirates. Les <span className="text-foreground font-medium">Relais</span> sur les colonies augmentent les récompenses PvE selon le biome local, avec un bonus de diversité par biome distinct couvert.
      </FacilityHelpSection>

      <FacilityHelpSection
        icon={<Coins className="h-3.5 w-3.5 text-emerald-400" />}
        title="Commerce"
      >
        Le <span className="text-foreground font-medium">Marché galactique</span> permet d'échanger des ressources et des rapports d'exploration avec les autres joueurs. Chaque planète peut héberger son propre marché.
      </FacilityHelpSection>

      <FacilityHelpSection
        icon={<Crown className="h-3.5 w-3.5 text-amber-300" />}
        title="Gouvernance"
      >
        Le <span className="text-foreground font-medium">Centre de pouvoir impérial</span> (planète-mère uniquement) augmente votre capacité à gérer plusieurs colonies sans malus. Au-delà de cette capacité, vos colonies souffrent d'<span className="text-foreground font-medium">overextend</span>.
      </FacilityHelpSection>

      <FacilityHelpSection
        icon={<Shield className="h-3.5 w-3.5 text-sky-400" />}
        title="Défense"
      >
        Le <span className="text-foreground font-medium">Bouclier planétaire</span> absorbe les premiers dégâts en cas d'attaque. Sa puissance peut être réglée pour économiser l'énergie. La recherche <span className="text-foreground font-medium">Blindage</span> améliore sa capacité.
      </FacilityHelpSection>
    </>
  );
}
