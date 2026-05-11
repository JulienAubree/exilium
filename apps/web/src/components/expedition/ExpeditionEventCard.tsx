import { useState } from 'react';
import { Sparkles, AlertTriangle, Lock, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ExiliumIcon } from '@/components/common/ExiliumIcon';

type ChoiceTone = 'positive' | 'negative' | 'risky' | 'neutral';

const TONE_BADGE: Record<ChoiceTone, { label: string; color: string }> = {
  positive: { label: 'Bénéfique', color: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' },
  negative: { label: 'Dangereux', color: 'text-rose-300 border-rose-500/30 bg-rose-500/10' },
  risky:    { label: 'Risqué',    color: 'text-amber-300 border-amber-500/30 bg-amber-500/10' },
  neutral:  { label: 'Neutre',    color: 'text-slate-300 border-slate-500/30 bg-slate-500/10' },
};

interface Requirement {
  kind: 'research' | 'shipRole' | 'shipId';
  researchId?: string;
  role?: string;
  shipId?: string;
  minLevel?: number;
  minCount?: number;
}

interface Outcome {
  minerai?: number;
  silicium?: number;
  hydrogene?: number;
  exilium?: number;
  hullDelta?: number;
  moduleDrop?: { rarity: 'common' | 'rare' | 'epic'; count: number };
  bonusBiomeReveal?: number;
  unlockAnomalyEngagement?: { tier: 1 | 2 | 3 };
}

interface Choice {
  label: string;
  description?: string;
  tone: ChoiceTone;
  hidden: boolean;
  requirements: Requirement[];
  outcome: Outcome;
  failureOutcome?: Outcome;
}

export interface ExpeditionEvent {
  id: string;
  tier: 'early' | 'mid' | 'deep';
  title: string;
  description: string;
  imageRef?: string;
  choices: Choice[];
}

interface Props {
  event: ExpeditionEvent;
  /** Recherche du joueur, pour les checks gate research. */
  userResearch: Record<string, number>;
  /** Ships actuels (vivants) de la flotte, pour les checks shipRole/shipId. */
  shipsAlive: Record<string, number>;
  /** Mapping shipId → role pour résoudre shipRole. */
  shipRoles: Record<string, string>;
  /** Labels affichables (ex: "Recycleur" pour 'recycler'). */
  shipNames: Record<string, string>;
  researchNames: Record<string, string>;
  loading: boolean;
  onChoose: (choiceIndex: number) => void;
}

function isRequirementMet(req: Requirement, ctx: { userResearch: Record<string, number>; shipsAlive: Record<string, number>; shipRoles: Record<string, string> }): boolean {
  if (req.kind === 'research') {
    return (ctx.userResearch[req.researchId!] ?? 0) >= (req.minLevel ?? 1);
  }
  if (req.kind === 'shipRole') {
    let count = 0;
    for (const [shipId, alive] of Object.entries(ctx.shipsAlive)) {
      if (alive > 0 && ctx.shipRoles[shipId] === req.role) count += alive;
    }
    return count >= (req.minCount ?? 1);
  }
  if (req.kind === 'shipId') {
    return (ctx.shipsAlive[req.shipId!] ?? 0) >= (req.minCount ?? 1);
  }
  return false;
}

function formatRequirement(req: Requirement, ctx: { userResearch: Record<string, number>; shipsAlive: Record<string, number>; shipRoles: Record<string, string> }, names: { shipNames: Record<string, string>; researchNames: Record<string, string> }): string {
  if (req.kind === 'research') {
    const current = ctx.userResearch[req.researchId!] ?? 0;
    const name = names.researchNames[req.researchId!] ?? req.researchId;
    return `Recherche ${name} niv. ${current}/${req.minLevel}`;
  }
  if (req.kind === 'shipRole') {
    let count = 0;
    for (const [shipId, alive] of Object.entries(ctx.shipsAlive)) {
      if (alive > 0 && ctx.shipRoles[shipId] === req.role) count += alive;
    }
    return `${req.minCount}× rôle ${req.role} (vous : ${count})`;
  }
  if (req.kind === 'shipId') {
    const current = ctx.shipsAlive[req.shipId!] ?? 0;
    const name = names.shipNames[req.shipId!] ?? req.shipId;
    return `${req.minCount}× ${name} (vous : ${current})`;
  }
  return '';
}

function renderOutcomePreview(outcome: Outcome): React.ReactNode {
  const parts: React.ReactNode[] = [];
  if (outcome.minerai) parts.push(<span key="min" className="text-minerai">{outcome.minerai > 0 ? '+' : ''}{outcome.minerai} M</span>);
  if (outcome.silicium) parts.push(<span key="sil" className="text-silicium">{outcome.silicium > 0 ? '+' : ''}{outcome.silicium} S</span>);
  if (outcome.hydrogene) parts.push(<span key="hyd" className="text-hydrogene">{outcome.hydrogene > 0 ? '+' : ''}{outcome.hydrogene} H</span>);
  if (outcome.exilium) parts.push(<span key="exi" className="flex items-center gap-0.5 text-purple-300">+{outcome.exilium} <ExiliumIcon className="h-3 w-3" /></span>);
  if (outcome.hullDelta) parts.push(<span key="hull" className={cn(outcome.hullDelta < 0 ? 'text-rose-300' : 'text-emerald-300')}>Coque {outcome.hullDelta > 0 ? '+' : ''}{Math.round(outcome.hullDelta * 100)}%</span>);
  if (outcome.moduleDrop) parts.push(<span key="mod" className="flex items-center gap-0.5 text-violet-300"><Package className="h-3 w-3" />{outcome.moduleDrop.count}× module {outcome.moduleDrop.rarity}</span>);
  if (outcome.bonusBiomeReveal) parts.push(<span key="bio" className="text-cyan-300">{outcome.bonusBiomeReveal} biome{outcome.bonusBiomeReveal > 1 ? 's' : ''} révélé{outcome.bonusBiomeReveal > 1 ? 's' : ''}</span>);
  if (outcome.unlockAnomalyEngagement) parts.push(<span key="ano" className="flex items-center gap-0.5 text-violet-300"><Sparkles className="h-3 w-3" />Engagement anomalie palier {outcome.unlockAnomalyEngagement.tier}</span>);
  if (parts.length === 0) return <span className="text-muted-foreground italic">Aucun effet</span>;
  return <div className="flex flex-wrap gap-2">{parts.map((p, i) => <span key={i}>{p}</span>)}</div>;
}

export function ExpeditionEventCard({
  event,
  userResearch,
  shipsAlive,
  shipRoles,
  shipNames,
  researchNames,
  loading,
  onChoose,
}: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const ctx = { userResearch, shipsAlive, shipRoles };

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Hero illustration (uploadée admin, fallback gradient violet) */}
      {event.imageRef ? (
        <div className="relative -mx-6 -mt-6 mb-2 overflow-hidden rounded-t-xl">
          <img
            src={event.imageRef}
            alt={event.title}
            className="w-full h-44 object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-transparent" />
        </div>
      ) : (
        <div className="relative -mx-6 -mt-6 mb-2 h-32 overflow-hidden rounded-t-xl bg-gradient-to-br from-violet-950/60 via-amber-950/30 to-rose-950/40">
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
        </div>
      )}

      <div className="space-y-2 text-center">
        <h2 className="text-xl font-bold text-foreground">{event.title}</h2>
        <p className="text-sm text-muted-foreground italic">{event.description}</p>
      </div>

      <div className="space-y-2.5">
        {event.choices.map((choice, idx) => {
          const requirementChecks = choice.requirements.map((req) => ({
            req,
            met: isRequirementMet(req, ctx),
          }));
          const allMet = requirementChecks.every((r) => r.met);
          const softFailable = !allMet && choice.failureOutcome !== undefined;
          const locked = !allMet && !softFailable;
          const isHovered = hovered === idx;

          return (
            <button
              key={idx}
              type="button"
              disabled={locked || loading}
              onClick={() => onChoose(idx)}
              onMouseEnter={() => setHovered(idx)}
              onMouseLeave={() => setHovered(null)}
              className={cn(
                'w-full text-left rounded-lg border p-3 transition-all',
                locked
                  ? 'border-border/20 bg-card/30 opacity-50 cursor-not-allowed'
                  : softFailable
                  ? 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10'
                  : 'border-border/40 bg-card/50 hover:bg-card/80 hover:border-primary/30',
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  {locked && <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  {softFailable && <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
                  <span className="font-medium text-sm">{choice.label}</span>
                </div>
                <span
                  className={cn(
                    'shrink-0 px-1.5 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wider',
                    TONE_BADGE[choice.tone].color,
                  )}
                >
                  {softFailable ? 'Tentative risquée' : TONE_BADGE[choice.tone].label}
                </span>
              </div>

              {choice.description && (
                <p className="text-xs text-muted-foreground mb-2">{choice.description}</p>
              )}

              {requirementChecks.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {requirementChecks.map((rc, ri) => (
                    <span
                      key={ri}
                      className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded border',
                        rc.met
                          ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/5'
                          : 'border-rose-500/30 text-rose-300 bg-rose-500/5',
                      )}
                    >
                      {formatRequirement(rc.req, ctx, { shipNames, researchNames })}
                    </span>
                  ))}
                </div>
              )}

              {!choice.hidden && (
                <div className="text-xs">
                  {renderOutcomePreview(softFailable ? choice.failureOutcome! : choice.outcome)}
                </div>
              )}
              {choice.hidden && !isHovered && (
                <div className="text-xs text-muted-foreground italic">??? — résultat caché</div>
              )}
              {choice.hidden && isHovered && (
                <div className="text-xs text-amber-300">
                  Choix risqué — vous découvrirez le résultat en cliquant
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
