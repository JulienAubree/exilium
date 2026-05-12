import { useState } from 'react';
import { ChevronDown, ChevronUp, Shield, Sparkles, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FlagshipModeIntroProps {
  onOpenHelp: () => void;
}

const STORAGE_KEY = 'flagship-mode-intro-collapsed-v1';

/**
 * Pedagogical intro that sits between the hero and the loadout. Splits the
 * two contexts in which the flagship operates ("normal" vs "anomalie") so
 * players stop conflating the equipment configuration (only anomalies) with
 * the stats that apply everywhere else.
 *
 * Collapsible and persisted in localStorage so power-users can dismiss it.
 */
export function FlagshipModeIntro({ onOpenHelp }: FlagshipModeIntroProps) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  });

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
    }
  }

  return (
    <section className="rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-950/30 via-card/50 to-card/80 backdrop-blur-sm overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Sparkles className="h-4 w-4 text-violet-400 shrink-0" />
          <h2 className="text-sm font-semibold text-foreground">
            Comment fonctionne votre vaisseau amiral ?
          </h2>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
          {collapsed ? 'Voir le résumé' : 'Réduire'}
          {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </span>
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 pt-1 grid gap-3 md:grid-cols-2">
          {/* Mode normal */}
          <div className="rounded-lg border border-sky-500/20 bg-sky-950/15 p-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-sky-400" />
              <h3 className="text-xs uppercase tracking-wider font-semibold text-sky-300">
                Mode normal
              </h3>
            </div>
            <p className="text-xs text-foreground/85 leading-relaxed">
              En PvP, raid pirate, défense planétaire et riposte d&apos;espionnage, le flagship
              combat avec ses <span className="text-foreground font-medium">stats brutes</span> :
              niveau pilote, bonus passifs de la <span className="text-foreground font-medium">coque</span> et
              <span className="text-foreground font-medium"> recherches</span>.
            </p>
            <p className="text-[11px] text-sky-400/80">
              ✓ Niveau pilote · ✓ Bonus coque · ✓ Recherches armes/bouclier/blindage
            </p>
            <p className="text-[11px] text-muted-foreground">
              ✗ Modules · ✗ Arsenal (aucun effet hors anomalie)
            </p>
          </div>

          {/* Mode anomalie */}
          <div className="rounded-lg border border-violet-500/20 bg-violet-950/15 p-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-violet-400" />
              <h3 className="text-xs uppercase tracking-wider font-semibold text-violet-300">
                Mode anomalie
              </h3>
            </div>
            <p className="text-xs text-foreground/85 leading-relaxed">
              En run d&apos;anomalie (rogue-lite, votre flagship part <span className="text-foreground font-medium">seul</span>),
              <span className="text-foreground font-medium"> tous</span> les bonus s&apos;additionnent : stats brutes
              + <span className="text-foreground font-medium">modules passifs</span> +
              <span className="text-foreground font-medium"> arsenal</span> +
              <span className="text-foreground font-medium"> charges épiques</span>.
            </p>
            <p className="text-[11px] text-violet-400/80">
              ✓ Stats brutes · ✓ 9 modules passifs · ✓ 3 batteries d&apos;armes · ✓ Capacités actives
            </p>
            <p className="text-[11px] text-muted-foreground">
              ⚠ Wipe = run perdu + 30 min d&apos;incapacité
            </p>
          </div>

          <div className="md:col-span-2 flex items-center justify-between rounded-lg border border-border/40 bg-card/40 px-3 py-2 text-[11px]">
            <span className="text-muted-foreground">
              Le <span className="text-foreground font-medium">loadout ci-dessous</span> ne sert
              que pour les anomalies. Sa configuration n&apos;impacte pas vos autres combats.
            </span>
            <button
              type="button"
              onClick={onOpenHelp}
              className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-1',
                'text-violet-300 font-medium hover:bg-violet-500/20 transition-colors',
              )}
            >
              <HelpCircle className="h-3 w-3" />
              Comprendre en détail
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
