import { Pickaxe, Zap, Database, Hammer, XCircle } from 'lucide-react';
import { FacilityHelpSection } from '@/components/common/FacilityHelp';
import { getAssetUrl } from '@/lib/assets';

/**
 * Aide pédagogique de la page Ressources : explique la production, le stockage,
 * l'énergie et la file de construction.
 *
 * Note : on n'utilise pas <FacilityHelp /> car cette page agrège plusieurs
 * bâtiments (mines, centrale solaire, entrepôts) — pas de "niveau" unique
 * à afficher dans le header.
 */
export function ResourcesHelp() {
  return (
    <>
      <div className="relative -mx-5 -mt-5 overflow-hidden rounded-t-lg">
        <img
          src={getAssetUrl('buildings', 'mineraiMine')}
          alt=""
          className="w-full h-40 object-cover"
          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-transparent" />
        <div className="absolute bottom-3 left-5">
          <p className="text-sm font-semibold text-foreground">Production · Stockage · Énergie</p>
        </div>
      </div>

      <FacilityHelpSection
        icon={<Pickaxe className="h-3.5 w-3.5 text-amber-400" />}
        title="Production"
      >
        Les <span className="text-foreground font-medium">trois mines</span> (minerai, silicium, hydrogène) génèrent des ressources en continu, même hors-ligne. Le <span className="text-foreground font-medium">type de planète</span> (volcanique, glaciale…) et les <span className="text-foreground font-medium">biomes</span> octroient des bonus de production. La <span className="text-foreground font-medium">température</span> influence la synthèse d'hydrogène.
      </FacilityHelpSection>

      <FacilityHelpSection
        icon={<Zap className="h-3.5 w-3.5 text-energy" />}
        title="Énergie"
      >
        Chaque mine consomme de l'énergie. La <span className="text-foreground font-medium">centrale solaire</span> et les <span className="text-foreground font-medium">satellites solaires</span> en produisent. Si l'énergie nette est <span className="text-destructive font-medium">négative</span>, vos mines tournent au ralenti — surveillez la KPI d'énergie au-dessus.
      </FacilityHelpSection>

      <FacilityHelpSection
        icon={<Database className="h-3.5 w-3.5 text-cyan-400" />}
        title="Stockage"
      >
        Chaque ressource a son <span className="text-foreground font-medium">entrepôt</span>. Une fois plein, la production correspondante <span className="text-foreground font-medium">s'arrête</span>. Améliorez les entrepôts pour absorber les pics, et pensez à utiliser le marché ou des envois entre planètes pour vider les surplus.
      </FacilityHelpSection>

      <FacilityHelpSection
        icon={<Hammer className="h-3.5 w-3.5 text-emerald-400" />}
        title="File de construction"
      >
        Un seul bâtiment de cette catégorie peut être amélioré à la fois sur la planète. La barre en haut de la page montre la <span className="text-foreground font-medium">progression en cours</span> et permet de l'annuler ou d'en voir le détail.
      </FacilityHelpSection>

      <FacilityHelpSection
        icon={<XCircle className="h-3.5 w-3.5 text-destructive" />}
        title="Annulation"
      >
        Annuler une amélioration rembourse les ressources au <span className="text-foreground font-medium">prorata du temps restant</span>, plafonné à <span className="text-foreground font-medium">70&nbsp;%</span>.
      </FacilityHelpSection>
    </>
  );
}
