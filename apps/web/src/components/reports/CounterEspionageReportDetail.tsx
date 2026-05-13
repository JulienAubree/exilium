import { ShieldAlert, AlertTriangle } from 'lucide-react';
import { CoordsLink } from '@/components/common/CoordsLink';
import { cn } from '@/lib/utils';

interface OriginCoordinates {
  galaxy: number;
  system: number;
  position: number;
  planetName?: string;
}

interface CounterEspionageReportDetailProps {
  result: Record<string, unknown>;
  origin?: OriginCoordinates | null;
}

/**
 * Rendu défensif d'une tentative d'espionnage détectée chez le joueur.
 * Contraint à respecter l'anonymat de l'attaquant : pas de probeCount, pas
 * de tech, pas de nom/planète d'origine — seulement les coordonnées brutes
 * d'où sont parties les sondes (si récupérables).
 *
 * Pas de quick-actions "Relancer / Attaquer" non plus : la cible des sondes
 * étant la planète du joueur lui-même, ces boutons pointaient sur ses
 * propres coordonnées.
 */
export function CounterEspionageReportDetail({ result, origin }: CounterEspionageReportDetailProps) {
  const detectionChance = typeof result.detectionChance === 'number' ? result.detectionChance : null;
  const undefended = result.undefended === true;

  return (
    <div className="space-y-4">
      <div className="glass-card flex items-start gap-3 px-4 py-3 border border-amber-500/40 bg-amber-950/20">
        <ShieldAlert className="h-5 w-5 shrink-0 text-amber-300 mt-0.5" />
        <div className="space-y-1">
          <div className="text-sm font-semibold text-amber-200">
            Tentative d'espionnage détectée
          </div>
          <p className="text-xs text-amber-100/80">
            Vos systèmes ont repéré des sondes ennemies en approche. Aucune identification de l'agresseur n'a pu être confirmée.
          </p>
        </div>
      </div>

      <div className="glass-card p-4 space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Renseignements
        </h3>
        <dl className="grid grid-cols-1 gap-y-2 text-xs sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Origine des sondes</dt>
            <dd className="mt-0.5 font-mono">
              {origin ? (
                <CoordsLink galaxy={origin.galaxy} system={origin.system} position={origin.position} />
              ) : (
                <span className="text-muted-foreground italic">inconnue</span>
              )}
            </dd>
          </div>
          {detectionChance !== null && (
            <div>
              <dt className="text-muted-foreground">Chance de détection</dt>
              <dd
                className={cn(
                  'mt-0.5 font-medium',
                  detectionChance > 50 ? 'text-emerald-400' : 'text-amber-300',
                )}
              >
                {Math.round(detectionChance)}%
              </dd>
            </div>
          )}
        </dl>
      </div>

      {undefended && (
        <div className="glass-card flex items-start gap-3 p-4 border border-red-500/40 bg-red-950/20">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-300 mt-0.5" />
          <div className="text-xs text-red-100/90 space-y-1">
            <div className="font-semibold text-red-200">Planète non défendue</div>
            <p>
              Les sondes sont passées sans rencontrer de résistance. Construis des défenses
              ou stationne une flotte ici pour intercepter les futures tentatives — un
              espionnage non perturbé fournit des renseignements complets à l'attaquant.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
