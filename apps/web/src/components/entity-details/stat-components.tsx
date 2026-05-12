import type { ReactNode } from 'react';

import { fmt } from '@/lib/format';

// ── SVG Icons ──

interface IconProps { size?: number; className?: string }

export function ShieldIcon({ size = 18, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

export function ArmorIcon({ size = 18, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x={3} y={3} width={18} height={18} rx={3} />
      <rect x={7} y={7} width={10} height={10} rx={2} />
    </svg>
  );
}

export function HullIcon({ size = 18, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

export function WeaponsIcon({ size = 18, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx={12} cy={12} r={10} />
      <circle cx={12} cy={12} r={3} />
      <line x1={12} y1={2} x2={12} y2={6} />
      <line x1={12} y1={18} x2={12} y2={22} />
      <line x1={2} y1={12} x2={6} y2={12} />
      <line x1={18} y1={12} x2={22} y2={12} />
    </svg>
  );
}

export function ShotsIcon({ size = 18, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
      <path d="M7 8l4 4-4 4" />
    </svg>
  );
}

export function SpeedIcon({ size = 14, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

export function PropulsionIcon({ size = 14, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

export function FuelIcon({ size = 14, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
    </svg>
  );
}

export function CargoIcon({ size = 14, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x={1} y={3} width={15} height={13} rx={2} />
      <path d="M16 8h4a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-4" />
      <polyline points="9,18 9,21" />
      <polyline points="5,18 5,21" />
    </svg>
  );
}

// ── Variant styles ──

const VARIANTS: Record<string, { iconBg: string; valueColor: string; iconColor: string }> = {
  shield:  { iconBg: 'bg-sky-400/10',    valueColor: 'text-sky-400',    iconColor: 'text-sky-400' },
  armor:   { iconBg: 'bg-amber-400/10',  valueColor: 'text-amber-400',  iconColor: 'text-amber-400' },
  hull:    { iconBg: 'bg-slate-400/10',   valueColor: 'text-slate-200',  iconColor: 'text-slate-400' },
  weapons: { iconBg: 'bg-red-400/10',     valueColor: 'text-red-400',    iconColor: 'text-red-400' },
  shots:   { iconBg: 'bg-purple-400/10',  valueColor: 'text-purple-400', iconColor: 'text-purple-400' },
};

// ── Components ──

export function SectionHeader({ icon, label, color }: { icon: ReactNode; label: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      {icon}
      <span className={`text-[9px] uppercase tracking-[1.5px] font-bold ${color}`}>{label}</span>
    </div>
  );
}

export function StatCell({ icon, label, value, variant, wide }: {
  icon: ReactNode;
  label: string;
  value: number;
  variant: string;
  wide?: boolean;
}) {
  const v = VARIANTS[variant] ?? VARIANTS.hull;
  return (
    <div className={`flex items-center gap-2.5 bg-[#0f172a] rounded-lg p-2.5 border border-transparent hover:border-[#334155] transition-colors ${wide ? 'col-span-2' : ''}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${v.iconBg}`}>
        <span className={v.iconColor}>{icon}</span>
      </div>
      <div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</div>
        <div className={`text-base font-bold font-mono leading-tight ${v.valueColor}`}>{fmt(value)}</div>
      </div>
    </div>
  );
}

export function EffectiveStatCell({ icon, label, base, effective, multiplier, variant, wide }: {
  icon: ReactNode;
  label: string;
  base: number;
  effective: number;
  multiplier: number;
  variant: string;
  wide?: boolean;
}) {
  const v = VARIANTS[variant] ?? VARIANTS.hull;
  const bonusPercent = Math.round((multiplier - 1) * 100);
  const hasBonus = bonusPercent > 0;
  return (
    <div className={`flex items-center gap-2.5 bg-[#0f172a] rounded-lg p-2.5 border border-transparent hover:border-[#334155] transition-colors ${wide ? 'col-span-2' : ''}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${v.iconBg}`}>
        <span className={v.iconColor}>{icon}</span>
      </div>
      <div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</div>
        <div className={`text-base font-bold font-mono leading-tight ${v.valueColor}`}>{fmt(effective)}</div>
        {hasBonus && (
          <div className="text-[9px] text-emerald-500">base {fmt(base)} · +{bonusPercent}%</div>
        )}
      </div>
    </div>
  );
}

export function CostPills({ cost }: { cost: { minerai: number; silicium: number; hydrogene: number } }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {cost.minerai > 0 && (
        <span className="text-[11px] font-semibold font-mono px-2.5 py-1 rounded-md bg-minerai/[0.08] text-minerai border border-minerai/15 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-minerai" />
          {fmt(cost.minerai)}
        </span>
      )}
      {cost.silicium > 0 && (
        <span className="text-[11px] font-semibold font-mono px-2.5 py-1 rounded-md bg-silicium/[0.08] text-silicium border border-silicium/15 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-silicium" />
          {fmt(cost.silicium)}
        </span>
      )}
      {cost.hydrogene > 0 && (
        <span className="text-[11px] font-semibold font-mono px-2.5 py-1 rounded-md bg-hydrogene/[0.08] text-hydrogene border border-hydrogene/15 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-hydrogene" />
          {fmt(cost.hydrogene)}
        </span>
      )}
    </div>
  );
}
