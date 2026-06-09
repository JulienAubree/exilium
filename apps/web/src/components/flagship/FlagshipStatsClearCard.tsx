import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { resolveBonus } from '@exilium/game-engine';
import { trpc } from '@/trpc';
import { useGameConfig } from '@/hooks/useGameConfig';
import { cn } from '@/lib/utils';
import {
  ShieldIcon, ArmorIcon, HullIcon, WeaponsIcon, ShotsIcon,
  SectionHeader,
} from '@/components/entity-details/stat-components';
import { getHullCardStyles } from './hullCardStyles';
import { fmt } from '@/lib/format';

interface FlagshipBaseStats {
  shield: number;
  baseArmor: number;
  hull: number;
  weapons: number;
  shotCount: number;
  hullId: string | null;
  status?: string;
}

interface FlagshipStatsClearCardProps {
  flagship: FlagshipBaseStats;
}

/**
 * Carte de stats de combat du vaisseau amiral : stats de base (coque, bouclier,
 * blindage, armement) avec les multiplicateurs de recherche appliqués, comme
 * partout ailleurs dans le jeu.
 */
export function FlagshipStatsClearCard({ flagship }: FlagshipStatsClearCardProps) {
  const styles = getHullCardStyles(flagship.hullId);

  const { data: researchData, isLoading: researchLoading } = trpc.research.list.useQuery();
  const { data: gameConfig, isLoading: configLoading } = useGameConfig();
  const isLoading = researchLoading || configLoading;

  const computed = useMemo(() => {
    if (!gameConfig) return null;

    const researchLevels: Record<string, number> = {};
    for (const r of researchData?.items ?? []) {
      researchLevels[r.id] = r.currentLevel;
    }
    const bonusDefs = gameConfig.bonuses ?? [];
    const weaponsMult = resolveBonus('weapons', null, researchLevels, bonusDefs);
    const shieldingMult = resolveBonus('shielding', null, researchLevels, bonusDefs);
    const armorMult = resolveBonus('armor', null, researchLevels, bonusDefs);

    const damage = Math.round(flagship.weapons * weaponsMult);
    const shots = flagship.shotCount ?? 1;
    return {
      hull: Math.round(flagship.hull * armorMult),
      shield: Math.round(flagship.shield * shieldingMult),
      armor: Math.round(flagship.baseArmor * armorMult),
      damage,
      shots,
      damagePerRound: damage * shots,
    };
  }, [flagship, gameConfig, researchData]);

  if (isLoading || !computed) {
    return (
      <div className={cn('glass-card p-4 lg:p-5 border space-y-3', styles.border)}>
        <div className="h-4 w-32 bg-muted/30 rounded animate-pulse" />
        <div className="grid grid-cols-2 gap-2">
          <div className="h-16 bg-muted/20 rounded animate-pulse" />
          <div className="h-16 bg-muted/20 rounded animate-pulse" />
          <div className="h-16 bg-muted/20 rounded animate-pulse" />
          <div className="h-16 bg-muted/20 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('glass-card p-3 sm:p-4 lg:p-5 space-y-4 border', styles.border)}>
      <div>
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5 min-w-0">
          <Sparkles className={cn('h-3.5 w-3.5 shrink-0', styles.badgeText)} />
          <span className="truncate">Stats de combat</span>
        </h3>
        <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
          Stats appliquées en combat (multiplicateurs de recherche inclus).
        </p>
      </div>

      {/* Defense grid */}
      <div className="grid grid-cols-2 gap-2">
        <StatTile icon={<HullIcon size={14} />} label="Coque" value={computed.hull} tone="text-slate-200" iconTone="text-slate-400" />
        <StatTile icon={<ShieldIcon size={14} />} label="Bouclier" value={computed.shield} tone="text-sky-300" iconTone="text-sky-400" />
        <StatTile icon={<ArmorIcon size={14} />} label="Blindage" value={computed.armor} tone="text-amber-300" iconTone="text-amber-400" />
        <StatTile icon={<ShotsIcon size={14} />} label="Tirs / round" value={computed.shots} tone="text-purple-300" iconTone="text-purple-400" />
      </div>

      <div className="h-px bg-panel-border/50" />

      {/* Attack summary */}
      <div>
        <SectionHeader
          icon={<WeaponsIcon size={13} className="text-red-400" />}
          label="Armement"
          color="text-red-400"
        />
        <div className="grid grid-cols-2 gap-2 mt-2">
          <StatTile icon={<WeaponsIcon size={14} />} label="Dégâts / tir" value={computed.damage} tone="text-red-300" iconTone="text-red-400" />
          <StatTile icon={<WeaponsIcon size={14} />} label="Dégâts / round" value={computed.damagePerRound} tone="text-red-300" iconTone="text-red-400" />
        </div>
      </div>
    </div>
  );
}

// ─── Stat tile ───────────────────────────────────────────────────────────────

function StatTile({
  icon, label, value, tone, iconTone, suffix,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: string;
  iconTone: string;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-[#0f172a]/60 border border-panel-border/50 px-2 py-2 sm:px-2.5">
      <span className={cn('shrink-0', iconTone)}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[9px] uppercase tracking-wide text-slate-500 truncate">{label}</div>
        <div className={cn('text-sm font-bold font-mono tabular-nums leading-tight truncate', tone)}>
          {fmt(value)}
          {suffix && <span className="ml-1 text-[9px] text-muted-foreground-soft font-normal">{suffix}</span>}
        </div>
      </div>
    </div>
  );
}
