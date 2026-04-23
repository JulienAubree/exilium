import { FacilityHelp, FacilityHelpSection } from '@/components/common/FacilityHelp';

interface CommandCenterHelpProps {
  level: number;
}

export function CommandCenterHelp({ level }: CommandCenterHelpProps) {
  return (
    <FacilityHelp buildingId="commandCenter" level={level}>
      <FacilityHelpSection
        icon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-400">
            <polygon points="12 2 3 7 12 12 21 7 12 2" />
            <polyline points="3 12 12 17 21 12" />
            <polyline points="3 17 12 22 21 17" />
          </svg>
        }
        title="Rôle"
      >
        Le Centre de commandement assemble les <span className="text-foreground font-medium">vaisseaux militaires</span> de votre empire&nbsp;: intercepteurs, frégates, croiseurs et cuirassés. Les vaisseaux industriels (transport, prospecteurs, sondes…) sont produits au <span className="text-foreground font-medium">Chantier spatial</span>.
      </FacilityHelpSection>

      <FacilityHelpSection
        icon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-400">
            <path d="M14.5 4.5L20 10l-7 7-5.5-5.5L14.5 4.5z" />
            <path d="M3 21l5-2" />
            <path d="M6 18l-3 3" />
          </svg>
        }
        title="Classes de combat"
      >
        Chaque niveau du Centre débloque ou améliore des unités&nbsp;: <span className="text-foreground font-medium">légères</span> (intercepteur), <span className="text-foreground font-medium">moyennes</span> (frégate) et <span className="text-foreground font-medium">lourdes</span> (croiseur, cuirassé). Les classes plus lourdes exigent une recherche en propulsion avancée.
      </FacilityHelpSection>

      <FacilityHelpSection
        icon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
            <path d="M12 2v6M12 16v6M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h6M16 12h6" />
          </svg>
        }
        title="Slots parallèles"
      >
        Par défaut, un seul slot de production est actif. Les <span className="text-foreground font-medium">talents militaires</span> (<span className="text-foreground font-medium">Production parallèle militaire</span>) débloquent des slots supplémentaires.
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
        Les vaisseaux en surplus des slots actifs sont <span className="text-foreground font-medium">mis en file</span> et démarrent dès qu'un slot se libère. Utilisez <span className="text-foreground font-medium">-1</span> pour retirer une unité d'un lot, ou <span className="text-foreground font-medium">Annuler</span> pour tout arrêter.
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
        Annuler un lot rembourse les ressources au <span className="text-foreground font-medium">prorata du temps restant</span>, plafonné à <span className="text-foreground font-medium">70&nbsp;%</span>. Les vaisseaux déjà produits sont conservés dans votre hangar.
      </FacilityHelpSection>
    </FacilityHelp>
  );
}
