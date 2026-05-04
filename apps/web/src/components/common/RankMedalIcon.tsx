/**
 * SVG médaille pour les rangs leaderboard top 3.
 * rank 1 → médaille or, rank 2 → argent, rank 3 → bronze.
 * Pour rang ≥ 4, retourne null (le caller affiche `#N` à la place).
 */
interface Props {
  rank: number;
  size?: number;
  className?: string;
}

const MEDAL_COLORS: Record<number, { fill: string; stroke: string; ribbon: string }> = {
  1: { fill: '#FCD34D', stroke: '#F59E0B', ribbon: '#DC2626' }, // Or
  2: { fill: '#E5E7EB', stroke: '#9CA3AF', ribbon: '#3B82F6' }, // Argent
  3: { fill: '#FCA561', stroke: '#C2410C', ribbon: '#16A34A' }, // Bronze
};

export function RankMedalIcon({ rank, size = 20, className = '' }: Props) {
  const colors = MEDAL_COLORS[rank];
  if (!colors) return null;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-label={`Rang ${rank}`}
    >
      {/* Ribbon */}
      <path
        d="M8 2 L10 11 L12 9 L14 11 L16 2"
        stroke={colors.ribbon}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={colors.ribbon}
        opacity="0.9"
      />
      {/* Disque */}
      <circle
        cx="12"
        cy="16"
        r="6"
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth="1.5"
      />
      {/* Numéro du rang */}
      <text
        x="12"
        y="19"
        textAnchor="middle"
        fontSize="7"
        fontWeight="bold"
        fill={colors.stroke}
      >
        {rank}
      </text>
    </svg>
  );
}
