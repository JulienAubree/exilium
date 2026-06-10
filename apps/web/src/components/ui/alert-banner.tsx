import type { ReactNode } from 'react';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AlertBannerProps {
  /** danger = menace active (attaque…) — le SEUL état autorisé à pulser ;
   *  warning = situation à corriger (surextension, déficit). */
  tone: 'danger' | 'warning';
  title: string;
  /** Détail compact à droite du titre (ex. « 7/8 colonies »). */
  meta?: string;
  children?: ReactNode;
  /** Pulse continu — réservé aux menaces actives (tone danger). */
  pulse?: boolean;
  onClick?: () => void;
  className?: string;
}

const TONE = {
  danger: {
    container: 'border-destructive/40 bg-destructive/10',
    title: 'text-destructive',
    icon: AlertCircle,
  },
  warning: {
    container: 'border-amber-500/40 bg-amber-500/10',
    title: 'text-amber-400',
    icon: AlertTriangle,
  },
} as const;

/**
 * Bannière d'alerte canonique du design system. Dans une UI muette, c'est
 * elle qui a le droit de parler fort — et seul `danger + pulse` a le droit
 * de pulser en continu (réf : docs/reference/design-system.md).
 */
export function AlertBanner({ tone, title, meta, children, pulse = false, onClick, className }: AlertBannerProps) {
  const t = TONE[tone];
  const IconComponent = t.icon;
  const Wrapper = onClick ? 'button' : 'section';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'block w-full rounded-lg border px-4 py-3 text-left',
        t.container,
        onClick && 'cursor-pointer transition-colors duration-fast ease-standard hover:brightness-110',
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        <IconComponent
          className={cn('h-4 w-4 shrink-0', t.title, pulse && tone === 'danger' && 'animate-pulse-glow')}
          aria-hidden
        />
        <span className={cn('text-sm font-semibold', t.title)}>{title}</span>
        {meta && <span className={cn('ml-auto text-xs tabular-nums', t.title, 'opacity-70')}>{meta}</span>}
      </div>
      {children && <div className="mt-1.5 pl-[26px] text-xs text-muted-foreground">{children}</div>}
    </Wrapper>
  );
}
