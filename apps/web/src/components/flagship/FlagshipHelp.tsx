import { Sparkles, Wrench, Layers, FlaskConical } from 'lucide-react';
import { EntityDetailOverlay } from '@/components/common/EntityDetailOverlay';
import { FacilityHelpSection } from '@/components/common/FacilityHelp';

interface FlagshipHelpProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Aide modale ouverte au clic sur le rond image du FlagshipHero.
 * Pattern aligné sur ResearchHelp / ShipyardHelp / etc.
 */
export function FlagshipHelp({ open, onClose }: FlagshipHelpProps) {
  return (
    <EntityDetailOverlay open={open} onClose={onClose} title="Vaisseau amiral">
      <FacilityHelpSection
        icon={<Sparkles className="h-3.5 w-3.5 text-violet-400" />}
        title="Rôle"
      >
        Votre vaisseau amiral est l'<span className="text-foreground font-medium">avatar de combat</span> de votre empire. Il combat à la tête de vos flottes et débloque des <span className="text-foreground font-medium">capacités spécialisées</span> selon sa coque (scan, minage, exploration).
      </FacilityHelpSection>

      <FacilityHelpSection
        icon={<Layers className="h-3.5 w-3.5 text-cyan-400" />}
        title="Coques"
      >
        Trois familles, chacune avec son rôle&nbsp;:
        <span className="block mt-1.5 space-y-0.5">
          <span className="block"><span className="text-red-400 font-medium">Combat</span> — armement et blindage renforcés.</span>
          <span className="block"><span className="text-amber-400 font-medium">Industrielle</span> — coque robuste, capacités de minage et de recyclage de débris.</span>
          <span className="block"><span className="text-cyan-400 font-medium">Scientifique</span> — vitesse accrue, capacités de scan et d'exploration.</span>
        </span>
        Chaque coque apporte aussi des <span className="text-foreground font-medium">bonus passifs</span> à votre empire. Le bouton <span className="text-foreground font-medium">Coque</span> en haut permet d'en changer (cooldown + coût d'Exilium selon config).
      </FacilityHelpSection>

      <FacilityHelpSection
        icon={<FlaskConical className="h-3.5 w-3.5 text-emerald-400" />}
        title="Recherche"
      >
        Les recherches <span className="text-foreground font-medium">armement</span>, <span className="text-foreground font-medium">bouclier</span> et <span className="text-foreground font-medium">blindage</span> s'appliquent sur les stats de combat. Le bloc «&nbsp;Stats de combat&nbsp;» affiche les chiffres exacts (stats de base × bonus de coque × recherches).
      </FacilityHelpSection>

      <FacilityHelpSection
        icon={<Wrench className="h-3.5 w-3.5 text-amber-400" />}
        title="Statuts"
      >
        <span className="text-emerald-400 font-medium">Opérationnel</span> = prêt au combat. <span className="text-blue-400 font-medium">En mission</span> = parti avec une flotte. <span className="text-red-400 font-medium">Incapacité</span> = vaisseau détruit au combat, immobilisé jusqu'à réparation (instantanée via Exilium ou attente). <span className="text-amber-400 font-medium">Refit</span> = changement de coque en cours.
      </FacilityHelpSection>
    </EntityDetailOverlay>
  );
}
