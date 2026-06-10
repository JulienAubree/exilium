import { forwardRef, type HTMLAttributes, type ElementType } from 'react';
import { cn } from '@/lib/utils';

export type TextRole = 'display' | 'page' | 'title' | 'body' | 'secondary' | 'caption';
export type TextTone = 'default' | 'secondary' | 'faint' | 'primary' | 'danger' | 'warning' | 'success';

const ROLE_CLASSES: Record<TextRole, string> = {
  display: 'text-[28px] leading-tight font-semibold',
  page: 'text-xl leading-tight font-semibold',
  title: 'text-base leading-snug font-semibold',
  body: 'text-sm leading-normal',
  secondary: 'text-[13px] leading-normal',
  caption: 'text-xs leading-normal',
};

const TONE_CLASSES: Record<TextTone, string> = {
  default: 'text-foreground',
  secondary: 'text-muted-foreground',
  faint: 'text-muted-foreground-soft',
  primary: 'text-primary',
  danger: 'text-destructive',
  warning: 'text-amber-400',
  success: 'text-emerald-400',
};

const DEFAULT_ELEMENT: Record<TextRole, ElementType> = {
  display: 'h1',
  page: 'h1',
  title: 'h2',
  body: 'p',
  secondary: 'p',
  caption: 'span',
};

export interface TextProps extends HTMLAttributes<HTMLElement> {
  role?: never; // évite la collision avec l'attribut ARIA — utiliser `variant`
  variant?: TextRole;
  tone?: TextTone;
  /** Chiffres tabulaires — obligatoire pour toute valeur qui change (ressources, timers). */
  nums?: boolean;
  as?: ElementType;
}

/**
 * Typographie du design system — 6 rôles, plancher 12px, pas d'uppercase.
 * Remplace les text-[10px]/text-[11px] et l'uppercase tracking-wider sauvages.
 */
export const Text = forwardRef<HTMLElement, TextProps>(
  ({ variant = 'body', tone = 'default', nums = false, as, className, ...props }, ref) => {
    const Component = (as ?? DEFAULT_ELEMENT[variant]) as ElementType;
    return (
      <Component
        ref={ref}
        className={cn(ROLE_CLASSES[variant], TONE_CLASSES[tone], nums && 'tabular-nums', className)}
        {...props}
      />
    );
  },
);
Text.displayName = 'Text';
