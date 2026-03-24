const ASTEROIDS = [
  { x: 8, y: 11, r: 2.8, rot: 15, shade: 0.9 },
  { x: 22, y: 7, r: 1.6, rot: 45, shade: 0.7 },
  { x: 35, y: 14, r: 3.2, rot: -20, shade: 1.0 },
  { x: 48, y: 6, r: 2.0, rot: 70, shade: 0.6 },
  { x: 58, y: 13, r: 2.5, rot: 30, shade: 0.85 },
  { x: 70, y: 9, r: 1.4, rot: -40, shade: 0.5 },
  { x: 80, y: 15, r: 3.0, rot: 55, shade: 0.95 },
  { x: 90, y: 8, r: 1.8, rot: -10, shade: 0.65 },
  { x: 100, y: 12, r: 2.2, rot: 25, shade: 0.75 },
  { x: 112, y: 6, r: 1.2, rot: 80, shade: 0.4 },
  { x: 120, y: 14, r: 2.6, rot: -55, shade: 0.88 },
  { x: 132, y: 10, r: 1.5, rot: 35, shade: 0.55 },
  { x: 15, y: 16, r: 1.0, rot: 60, shade: 0.35 },
  { x: 42, y: 17, r: 0.9, rot: -70, shade: 0.3 },
  { x: 65, y: 4, r: 1.1, rot: 50, shade: 0.4 },
  { x: 95, y: 17, r: 0.8, rot: 20, shade: 0.3 },
  { x: 108, y: 16, r: 1.3, rot: -30, shade: 0.45 },
  { x: 125, y: 5, r: 1.0, rot: 40, shade: 0.35 },
];

function asteroidPath(r: number): string {
  const n = 6;
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i) / n;
    const jitter = 0.7 + ((i * 7 + 3) % 5) / 10;
    const px = Math.cos(angle) * r * jitter;
    const py = Math.sin(angle) * r * jitter;
    pts.push(`${px.toFixed(2)},${py.toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
}

export function AsteroidBelt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 140 20"
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="belt-fade-l" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="black" />
          <stop offset="8%" stopColor="white" />
        </linearGradient>
        <linearGradient id="belt-fade-r" x1="0" y1="0" x2="1" y2="0">
          <stop offset="92%" stopColor="white" />
          <stop offset="100%" stopColor="black" />
        </linearGradient>
        <mask id="belt-mask">
          <rect width="140" height="20" fill="url(#belt-fade-l)" />
          <rect width="140" height="20" fill="url(#belt-fade-r)" />
        </mask>
        <radialGradient id="belt-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect x="0" y="6" width="140" height="8" fill="url(#belt-glow)" />

      <g mask="url(#belt-mask)">
        {ASTEROIDS.map((a, i) => {
          const base = Math.round(160 + a.shade * 80);
          const fill = `rgb(${base}, ${Math.round(base * 0.75)}, ${Math.round(base * 0.55)})`;
          const highlight = `rgba(255, 200, 140, ${0.15 + a.shade * 0.15})`;
          return (
            <g key={i} transform={`translate(${a.x},${a.y}) rotate(${a.rot})`}>
              <path d={asteroidPath(a.r)} fill={fill} />
              <path
                d={asteroidPath(a.r * 0.6)}
                fill={highlight}
                transform={`translate(${-a.r * 0.2},${-a.r * 0.2})`}
              />
            </g>
          );
        })}
      </g>

      <line x1="0" y1="10" x2="140" y2="10" stroke="#f9731620" strokeWidth="0.3" strokeDasharray="2 3" />
    </svg>
  );
}
