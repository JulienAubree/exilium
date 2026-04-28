import { FacilityHelp, FacilityHelpSection } from '@/components/common/FacilityHelp';
import { FlaskConical, LayoutGrid, Activity, Zap, Home, XCircle } from 'lucide-react';

interface ResearchHelpProps {
  level: number;
  planetClassId?: string | null;
}

export function ResearchHelp({ level, planetClassId }: ResearchHelpProps) {
  return (
    <FacilityHelp buildingId="researchLab" level={level} planetClassId={planetClassId}>
      <FacilityHelpSection
        icon={
          <FlaskConical className="h-3.5 w-3.5 text-violet-400" />
        }
        title="Rôle"
      >
        Le Laboratoire de recherche pilote tout le <span className="text-foreground font-medium">programme scientifique</span> de votre empire. Il se construit sur la <span className="text-foreground font-medium">planète-mère</span> uniquement et débloque les niveaux de recherche par paliers.
      </FacilityHelpSection>

      <FacilityHelpSection
        icon={
          <LayoutGrid className="h-3.5 w-3.5 text-cyan-400" />
        }
        title="Domaines"
      >
        Les technologies sont regroupées par domaine&nbsp;: <span className="text-foreground font-medium">sciences</span>, <span className="text-foreground font-medium">propulsion</span>, <span className="text-foreground font-medium">combat</span> et <span className="text-foreground font-medium">défense</span>. Chaque domaine a ses prérequis de niveau et de bâtiments annexes.
      </FacilityHelpSection>

      <FacilityHelpSection
        icon={
          <Activity className="h-3.5 w-3.5 text-amber-400" />
        }
        title="Une recherche à la fois"
      >
        Votre empire ne peut mener qu'<span className="text-foreground font-medium">une recherche</span> simultanément. Démarrer une nouvelle technologie est bloqué tant qu'une recherche est en cours&nbsp;: annulez-la (remboursement proportionnel, plafonné à 70&nbsp;%) ou attendez la fin.
      </FacilityHelpSection>

      <FacilityHelpSection
        icon={
          <Zap className="h-3.5 w-3.5 text-emerald-400" />
        }
        title="Vitesse de recherche"
      >
        La durée des recherches est réduite par plusieurs sources, cumulatives multiplicativement&nbsp;: le <span className="text-foreground font-medium">niveau du Laboratoire</span>, les <span className="text-foreground font-medium">laboratoires annexes</span> (Forge Volcanique, Bio-Laboratoire…), les <span className="text-foreground font-medium">biomes</span> découverts, certains <span className="text-foreground font-medium">talents</span> et la coque de votre <span className="text-foreground font-medium">vaisseau amiral</span>. Le total est affiché en haut&nbsp;; dépliez la carte pour voir le détail.
      </FacilityHelpSection>

      <FacilityHelpSection
        icon={
          <Home className="h-3.5 w-3.5 text-primary" />
        }
        title="Laboratoires annexes"
      >
        Certains types de planètes (volcanique, tempérée, aride, glaciaire, gazeuse) permettent de construire un <span className="text-foreground font-medium">laboratoire annexe</span> spécialisé. Chaque niveau d'annexe augmente votre vitesse globale et débloque des recherches exclusives à ce biome.
      </FacilityHelpSection>

      <FacilityHelpSection
        icon={
          <XCircle className="h-3.5 w-3.5 text-destructive" />
        }
        title="Annulation"
      >
        Annuler une recherche rembourse les ressources au <span className="text-foreground font-medium">prorata du temps restant</span>, plafonné à <span className="text-foreground font-medium">70&nbsp;%</span>. Le niveau en cours n'est pas acquis tant que la recherche n'est pas terminée.
      </FacilityHelpSection>
    </FacilityHelp>
  );
}
