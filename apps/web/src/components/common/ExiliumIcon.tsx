export function ExiliumIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {/* Icone cristal/gemme stylise */}
      <path d="M12 2L3 9l9 13 9-13-9-7z" fill="currentColor" opacity={0.3} />
      <path d="M12 2L3 9l9 13 9-13-9-7z" stroke="currentColor" strokeWidth={1.5} fill="none" />
      <path d="M3 9h18M12 2v20" stroke="currentColor" strokeWidth={1} opacity={0.5} />
    </svg>
  );
}
