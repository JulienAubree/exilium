import { FacilityHelp, FacilityHelpSection } from '@/components/common/FacilityHelp';

interface ArsenalHelpProps {
  level: number;
}

export function ArsenalHelp({ level }: ArsenalHelpProps) {
  return (
    <FacilityHelp buildingId="arsenal" level={level}>
      <FacilityHelpSection
        icon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-400">
            <path d="M12 2L3 6v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V6l-9-4z" />
          </svg>
        }
        title="Rôle"
      >
        L'Arsenal produit les <span className="text-foreground font-medium">défenses planétaires</span> qui protègent votre colonie contre les flottes hostiles. Chaque niveau débloque ou améliore certaines défenses.
      </FacilityHelpSection>

      <FacilityHelpSection
        icon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
            <circle cx="12" cy="12" r="10" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        }
        title="Défenses stationnaires"
      >
        Les défenses ne peuvent pas être envoyées en mission. En cas d'attaque, elles combattent automatiquement aux côtés de la flotte présente sur la planète.
      </FacilityHelpSection>

      <FacilityHelpSection
        icon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
            <path d="M12 2L3 6v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V6l-9-4z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        }
        title="Bouclier planétaire"
      >
        S'il est construit, le Bouclier planétaire forme un <span className="text-foreground font-medium">champ de force indestructible</span> qui se régénère à chaque round de combat. Tant qu'il tient, vos défenses restent intouchables. Sa puissance est réglable depuis les paramètres d'énergie.
      </FacilityHelpSection>

      <FacilityHelpSection
        icon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
            <path d="M12 8v4M12 16h.01" />
            <circle cx="12" cy="12" r="10" />
          </svg>
        }
        title="Maximum par planète"
      >
        Certaines défenses sont plafonnées en nombre sur chaque planète. Le compteur <span className="text-foreground font-medium">x{'{n}'} / {'{max}'}</span> indique la quantité déjà construite et le plafond. Les unités en file comptent dans le plafond.
      </FacilityHelpSection>

      <FacilityHelpSection
        icon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-destructive">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        }
        title="Annulation"
      >
        Annuler un lot rembourse les ressources au <span className="text-foreground font-medium">prorata du temps restant</span>, plafonné à <span className="text-foreground font-medium">70&nbsp;%</span>. Les unités déjà produites sont conservées.
      </FacilityHelpSection>
    </FacilityHelp>
  );
}
