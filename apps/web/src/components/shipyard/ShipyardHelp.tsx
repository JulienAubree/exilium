import { FacilityHelp, FacilityHelpSection } from '@/components/common/FacilityHelp';

interface ShipyardHelpProps {
  level: number;
}

export function ShipyardHelp({ level }: ShipyardHelpProps) {
  return (
    <FacilityHelp buildingId="shipyard" level={level}>
      <FacilityHelpSection
        icon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-400">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          </svg>
        }
        title="Rôles de mission"
      >
        Les vaisseaux sont regroupés par rôle&nbsp;: <span className="text-foreground font-medium">transport</span>,
        <span className="text-foreground font-medium"> minier</span>, <span className="text-foreground font-medium">recyclage</span>,
        <span className="text-foreground font-medium"> colonisation</span>, <span className="text-foreground font-medium">exploration</span>,
        <span className="text-foreground font-medium"> espionnage</span> et <span className="text-foreground font-medium">énergie</span>.
        Les vaisseaux de combat sont construits au Centre de commandement.
      </FacilityHelpSection>

      <FacilityHelpSection
        icon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
            <path d="M12 2v6M12 16v6M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h6M16 12h6" />
          </svg>
        }
        title="Slots parallèles"
      >
        Par défaut, vous disposez d'un seul slot de production. Les <span className="text-foreground font-medium">talents industriels</span> (<span className="text-foreground font-medium">Production parallèle</span>) débloquent des slots supplémentaires, permettant d'assembler plusieurs vaisseaux simultanément.
      </FacilityHelpSection>

      <FacilityHelpSection
        icon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        }
        title="File d'attente"
      >
        Les vaisseaux en surplus des slots actifs sont <span className="text-foreground font-medium">mis en file</span> et démarrent dès qu'un slot se libère.
        Utilisez <span className="text-foreground font-medium">-1</span> pour retirer une unité d'un lot, ou <span className="text-foreground font-medium">Annuler</span> pour tout arrêter.
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
        Annuler un lot rembourse les ressources au <span className="text-foreground font-medium">prorata du temps restant</span>, plafonné à <span className="text-foreground font-medium">70&nbsp;%</span>.
        Les vaisseaux déjà produits sont conservés dans votre hangar.
      </FacilityHelpSection>
    </FacilityHelp>
  );
}
