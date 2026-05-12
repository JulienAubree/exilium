import { Swords } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Timer } from '@/components/common/Timer';
import { useGameConfig } from '@/hooks/useGameConfig';
import { formatNumber } from '@/lib/format';

interface DepthContent {
  image?: string;
  title?: string;
  description?: string;
}

interface Props {
  /** 1-based number of the depth the player is about to engage. */
  depth: number;
  /** Admin-curated illustration + flavor text for that depth. May be missing. */
  depthContent?: DepthContent;
  /** Pre-generated enemy fleet (shipId → count). */
  enemyFleet?: Record<string, number> | null;
  /** Pre-computed total fleet power of the upcoming enemy. */
  enemyFp?: number | null;
  /** Has the cooldown elapsed? */
  ready: boolean;
  /** Disable while the parent flight in progress (advance / retreat). */
  disabled: boolean;
  /** Total ships still alive in the player's fleet (0 means no fight possible). */
  totalShips: number;
  /** When ready=false, used to display the countdown. */
  nextAt: Date | null;
  /** True while the advance mutation is pending. */
  advancePending: boolean;
  onAdvance: () => void;
}

/**
 * Hero card shown before each combat node. The previous design squashed the
 * admin-provided illustration into a 40px strip and clamped the narrative to
 * two lines — the immersive intent of those fields was lost. This version
 * uses the image as a full bandeau, exposes the full description as a log
 * fragment, and keeps the enemy preview + CTA as a tight footer block.
 */
export function AnomalyCombatPreview({
  depth,
  depthContent,
  enemyFleet,
  enemyFp,
  ready,
  disabled,
  totalShips,
  nextAt,
  advancePending,
  onAdvance,
}: Props) {
  const { data: gameConfig } = useGameConfig();
  const enemies = enemyFleet ? Object.entries(enemyFleet) : [];
  const hasEnemies = enemies.length > 0;
  const hasNarrative = Boolean(depthContent?.title || depthContent?.description);

  return (
    <div className="border-t border-border/30 pt-4 -mx-2">
      <div className="relative overflow-hidden rounded-xl border border-violet-500/25 bg-gradient-to-b from-violet-950/40 via-slate-950/60 to-slate-950">
        {/* Illustration bandeau — pleine largeur, ratio cinéma */}
        <DepthIllustration depth={depth} content={depthContent} />

        {/* Texte narratif (titre + description), si renseigné en admin */}
        {hasNarrative && (
          <div className="px-4 pt-4 pb-3 sm:px-5 space-y-2 border-b border-violet-500/15">
            {depthContent?.title && (
              <h3 className="text-base sm:text-lg font-bold text-violet-100 tracking-tight">
                {depthContent.title}
              </h3>
            )}
            {depthContent?.description && (
              <p className="text-sm text-foreground/75 italic leading-relaxed whitespace-pre-line">
                {depthContent.description}
              </p>
            )}
          </div>
        )}

        {/* Bloc menace */}
        <div className="px-4 sm:px-5 py-3 space-y-3">
          {hasEnemies ? (
            <div className="rounded-lg border border-rose-500/25 bg-rose-500/[0.06] p-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-rose-300/90 font-semibold">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />
                  Menace détectée
                </div>
                {enemyFp != null && (
                  <span className="text-rose-200 font-bold tabular-nums text-sm">
                    ~{formatNumber(enemyFp)} FP
                  </span>
                )}
              </div>
              <ul className="space-y-1 text-sm">
                {enemies.map(([shipId, count]) => {
                  const def = gameConfig?.ships?.[shipId];
                  return (
                    <li key={shipId} className="flex items-center justify-between">
                      <span className="text-foreground/85">{def?.name ?? shipId}</span>
                      <span className="text-rose-200/90 tabular-nums">×{count}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <div className="rounded-lg border border-border/30 bg-card/30 p-3 text-xs text-muted-foreground text-center">
              Composition ennemie non disponible — l'anomalie brouille vos capteurs.
            </div>
          )}

          {/* CTA combat */}
          {ready ? (
            <Button
              onClick={onAdvance}
              disabled={advancePending || disabled || totalShips === 0}
              className="w-full bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-500/20"
              size="lg"
            >
              <Swords className="h-4 w-4 mr-2" />
              {advancePending ? 'Combat en cours…' : 'Lancer le combat'}
            </Button>
          ) : (
            <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.06] p-3 flex items-center justify-center gap-2 text-sm">
              <span className="text-muted-foreground">Stabilisation en cours —</span>
              <Timer endTime={nextAt!} className="font-mono text-violet-200 tabular-nums font-semibold" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Image bandeau avec étiquette de profondeur incrustée.
 * Si pas d'image admin, on rend un gradient de secours qui garde le rythme
 * visuel du composant (pas un trou vide).
 */
function DepthIllustration({ depth, content }: { depth: number; content?: DepthContent }) {
  return (
    <div className="relative h-48 sm:h-56 lg:h-64 w-full overflow-hidden">
      {content?.image ? (
        <img
          src={content.image}
          alt={content.title || `Profondeur ${depth}`}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        // Fallback: dégradé violet animé qui reste lisible sans contenu admin.
        <div className="absolute inset-0 bg-gradient-to-br from-violet-900/70 via-slate-900 to-indigo-900/60" />
      )}

      {/* Vignette du bas pour ancrer l'étiquette */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

      {/* Étiquette de profondeur */}
      <div className="absolute left-4 top-4 sm:left-5 sm:top-5">
        <div className="inline-flex items-center gap-2 rounded-md border border-violet-300/30 bg-slate-950/70 backdrop-blur px-2.5 py-1">
          <span className="text-[10px] uppercase tracking-[0.18em] text-violet-300/80 font-semibold">
            Profondeur
          </span>
          <span className="text-base font-bold text-violet-50 tabular-nums leading-none">
            {String(depth).padStart(2, '0')}
          </span>
        </div>
      </div>
    </div>
  );
}
