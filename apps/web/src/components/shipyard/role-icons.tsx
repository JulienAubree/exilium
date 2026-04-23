interface IconProps {
  width?: number;
  height?: number;
  className?: string;
}

const defaults = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export function RoleAllIcon({ width = 14, height = 14, className }: IconProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" {...defaults} className={className}>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

export function RoleTransportIcon({ width = 14, height = 14, className }: IconProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" {...defaults} className={className}>
      <path d="M3 7h13v10H3z" />
      <path d="M16 10h4l1 3v4h-5z" />
      <circle cx="7" cy="18" r="1.5" />
      <circle cx="17" cy="18" r="1.5" />
    </svg>
  );
}

export function RoleUtilityIcon({ width = 14, height = 14, className }: IconProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" {...defaults} className={className}>
      <path d="M14 3c2 0 4 1 5 3-1 0-2 1-2 2s1 2 2 2c-1 2-3 3-5 3" />
      <path d="M14 13L4 21" />
      <path d="M4 21l-1-3 3 1" />
    </svg>
  );
}
