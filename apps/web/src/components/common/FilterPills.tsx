import { useId } from 'react';
import { cn } from '@/lib/utils';

interface FilterOption<T extends string | number> {
  /** Stable value identifying the option (used as React key and `value`). */
  value: T;
  /** Human-readable label rendered in the pill. */
  label: string;
}

interface FilterPillsProps<T extends string | number> {
  options: FilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible label for the group (e.g. "Filtrer les rapports par type"). */
  ariaLabel: string;
  className?: string;
}

/**
 * Pill-shaped filter group exposed as an ARIA tablist so screen readers
 * announce active/inactive states. Visual styling matches the existing pill
 * filters in Reports/Anomaly/Missions — but with proper roles, focus management
 * delegated to native tab order (no roving tabindex yet, kept simple).
 */
export function FilterPills<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: FilterPillsProps<T>) {
  const groupId = useId();
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('flex flex-wrap gap-2', className)}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={String(option.value)}
            id={`${groupId}-${String(option.value)}`}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'shrink-0 rounded-full px-4 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
