import { useMemo } from 'react';

interface Rock {
  x: number;
  y: number;
  size: number;
  rot: number;
  shade: number;
  speed: number;
  seed: number;
  hue: number;
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

function generateRocks(count: number, layer: number): Rock[] {
  const rng = seededRandom(42 + layer * 137);
  const rocks: Rock[] = [];
  for (let i = 0; i < count; i++) {
    rocks.push({
      x: rng() * 200,
      y: 6 + rng() * 18,
      size: 0.8 + rng() * (layer === 0 ? 3.5 : layer === 1 ? 2 : 1.2),
      rot: rng() * 360,
      shade: 0.2 + rng() * 0.8,
      speed: 16 + rng() * 30,
      seed: Math.floor(rng() * 1000),
      hue: 20 + rng() * 30,
    });
  }
  return rocks;
}

function rockPath(size: number, seed: number, vertices = 8): string {
  const pts: string[] = [];
  const rng = seededRandom(seed);
  for (let i = 0; i < vertices; i++) {
    const angle = (Math.PI * 2 * i) / vertices;
    const jitter = 0.55 + rng() * 0.5;
    const px = Math.cos(angle) * size * jitter;
    const py = Math.sin(angle) * size * jitter;
    pts.push(`${px.toFixed(2)},${py.toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
}

function craterPath(size: number, seed: number): string {
  const rng = seededRandom(seed + 500);
  const cx = (rng() - 0.5) * size * 0.5;
  const cy = (rng() - 0.5) * size * 0.5;
  const r = size * (0.15 + rng() * 0.2);
  return `M${(cx - r).toFixed(2)},${cy.toFixed(2)} A${r.toFixed(2)},${r.toFixed(2)} 0 1,1 ${(cx + r).toFixed(2)},${cy.toFixed(2)} A${r.toFixed(2)},${r.toFixed(2)} 0 1,1 ${(cx - r).toFixed(2)},${cy.toFixed(2)}Z`;
}

const LAYERS = [
  { rocks: generateRocks(10, 0), opacity: 1.0 },
  { rocks: generateRocks(16, 1), opacity: 0.6 },
  { rocks: generateRocks(24, 2), opacity: 0.3 },
];

export function AsteroidBelt({ className }: { className?: string }) {
  const uid = useMemo(
    () => Math.random().toString(36).slice(2, 8),
    [],
  );

  return (
    <svg
      viewBox="0 0 200 30"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
    >
      <defs>
        {/* Vertical glow gradient */}
        <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0" />
          <stop offset="30%" stopColor="#b45309" stopOpacity="0.04" />
          <stop offset="50%" stopColor="#fb923c" stopOpacity="0.1" />
          <stop offset="70%" stopColor="#b45309" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
        </linearGradient>

        {/* Horizontal edge fade mask */}
        <linearGradient id={`fe-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="5%" stopColor="white" stopOpacity="1" />
          <stop offset="95%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <mask id={`fm-${uid}`}>
          <rect width="200" height="30" fill={`url(#fe-${uid})`} />
        </mask>

        {/* Dust blur */}
        <filter id={`db-${uid}`}>
          <feGaussianBlur stdDeviation="0.6" />
        </filter>

        {/* Rock texture filter — subtle noise + lighting */}
        <filter id={`rt-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="3" seed="5" result="noise" />
          <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise" />
          <feBlend in="SourceGraphic" in2="grayNoise" mode="overlay" result="textured" />
          <feComposite in="textured" in2="SourceGraphic" operator="in" />
        </filter>

        {/* Glow filter for larger rocks */}
        <filter id={`rg-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feFlood floodColor="#f97316" floodOpacity="0.15" result="color" />
          <feComposite in="color" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Ambient glow band */}
      <rect x="0" y="0" width="200" height="30" fill={`url(#bg-${uid})`}>
        <animate attributeName="opacity" values="0.8;1;0.8" dur="6s" repeatCount="indefinite" />
      </rect>

      {/* Dust lane — blurred particles drifting */}
      <g mask={`url(#fm-${uid})`} filter={`url(#db-${uid})`} opacity="0.4">
        {Array.from({ length: 40 }, (_, i) => {
          const rng = seededRandom(i * 31 + 7);
          const cx = rng() * 200;
          const cy = 6 + rng() * 18;
          const r = 0.2 + rng() * 0.7;
          const hue = 25 + rng() * 20;
          return (
            <circle
              key={`d${i}`}
              cx={cx}
              cy={cy}
              r={r}
              fill={`hsl(${hue}, 70%, 70%)`}
              opacity={0.2 + rng() * 0.5}
            >
              <animateTransform
                attributeName="transform"
                type="translate"
                values={`0,0; ${2 + rng() * 4},${-0.8 + rng() * 1.6}; ${-1 + rng() * 2},${0.5 - rng()}; 0,0`}
                dur={`${5 + rng() * 10}s`}
                repeatCount="indefinite"
              />
            </circle>
          );
        })}
      </g>

      {/* Rock layers — back to front */}
      <g mask={`url(#fm-${uid})`}>
        {LAYERS.slice().reverse().map((layer, li) =>
          layer.rocks.map((rock, ri) => {
            const lum = 25 + rock.shade * 20;
            const sat = 20 + rock.shade * 30;
            const fill = `hsl(${rock.hue}, ${sat}%, ${lum}%)`;
            const darkEdge = `hsl(${rock.hue - 5}, ${sat + 5}%, ${lum * 0.6}%)`;
            const highlight = `hsla(${rock.hue + 10}, 50%, ${55 + rock.shade * 20}%, ${0.25 + rock.shade * 0.15})`;
            const craterFill = `hsla(${rock.hue - 5}, ${sat}%, ${lum * 0.7}%, 0.5)`;
            const isLarge = rock.size > 2.2;
            const driftAmplitude = 1 + rock.size * 0.4;

            return (
              <g key={`${li}-${ri}`} opacity={layer.opacity}>
                <g>
                  {/* Drift animation */}
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    values={`${rock.x},${rock.y}; ${rock.x + driftAmplitude},${rock.y - driftAmplitude * 0.4}; ${rock.x - driftAmplitude * 0.3},${rock.y + driftAmplitude * 0.3}; ${rock.x},${rock.y}`}
                    dur={`${rock.speed}s`}
                    repeatCount="indefinite"
                  />
                  <g
                    transform={`rotate(${rock.rot})`}
                    filter={isLarge ? `url(#rg-${uid})` : undefined}
                  >
                    {/* Slow tumble */}
                    <animateTransform
                      attributeName="transform"
                      type="rotate"
                      from={`${rock.rot}`}
                      to={`${rock.rot + (ri % 2 === 0 ? 360 : -360)}`}
                      dur={`${50 + rock.speed * 2}s`}
                      repeatCount="indefinite"
                    />

                    {/* Drop shadow */}
                    <path
                      d={rockPath(rock.size * 1.12, rock.seed)}
                      fill="black"
                      opacity={0.25 + (isLarge ? 0.1 : 0)}
                      transform="translate(0.4,0.5)"
                    />

                    {/* Body with texture */}
                    <g filter={isLarge ? `url(#rt-${uid})` : undefined}>
                      <path
                        d={rockPath(rock.size, rock.seed)}
                        fill={fill}
                        stroke={darkEdge}
                        strokeWidth="0.15"
                      />
                    </g>

                    {/* Crater on larger rocks */}
                    {isLarge && (
                      <>
                        <path d={craterPath(rock.size, rock.seed)} fill={craterFill} />
                        <path d={craterPath(rock.size * 0.7, rock.seed + 200)} fill={craterFill} />
                      </>
                    )}

                    {/* Light highlight — top-left */}
                    <path
                      d={rockPath(rock.size * 0.45, rock.seed + 1, 6)}
                      fill={highlight}
                      transform={`translate(${-rock.size * 0.22},${-rock.size * 0.25})`}
                    />

                    {/* Rim light — subtle edge reflection */}
                    <path
                      d={rockPath(rock.size * 1.02, rock.seed)}
                      fill="none"
                      stroke={`hsla(40, 60%, 80%, ${0.08 + rock.shade * 0.07})`}
                      strokeWidth="0.15"
                    />
                  </g>
                </g>
              </g>
            );
          }),
        )}
      </g>

      {/* Sparkles — twinkling mineral reflections */}
      {Array.from({ length: 12 }, (_, i) => {
        const rng = seededRandom(i * 53 + 11);
        const cx = 8 + rng() * 184;
        const cy = 6 + rng() * 18;
        const size = 0.15 + rng() * 0.2;
        return (
          <g key={`s${i}`}>
            {/* Cross-shaped sparkle */}
            <line
              x1={cx - size * 2} y1={cy} x2={cx + size * 2} y2={cy}
              stroke="#fef3c7" strokeWidth="0.15" opacity="0"
            >
              <animate
                attributeName="opacity"
                values="0;0.9;0"
                dur={`${1.5 + rng() * 2.5}s`}
                begin={`${rng() * 5}s`}
                repeatCount="indefinite"
              />
            </line>
            <line
              x1={cx} y1={cy - size * 2} x2={cx} y2={cy + size * 2}
              stroke="#fef3c7" strokeWidth="0.15" opacity="0"
            >
              <animate
                attributeName="opacity"
                values="0;0.7;0"
                dur={`${1.5 + rng() * 2.5}s`}
                begin={`${rng() * 5}s`}
                repeatCount="indefinite"
              />
            </line>
            <circle cx={cx} cy={cy} r={size} fill="#fef3c7" opacity="0">
              <animate
                attributeName="opacity"
                values="0;1;0"
                dur={`${1.5 + rng() * 2.5}s`}
                begin={`${rng() * 5}s`}
                repeatCount="indefinite"
              />
            </circle>
          </g>
        );
      })}

      {/* Trailing debris — tiny fragments with linear motion */}
      <g mask={`url(#fm-${uid})`} opacity="0.5">
        {Array.from({ length: 6 }, (_, i) => {
          const rng = seededRandom(i * 71 + 99);
          const startX = rng() * 180;
          const y = 8 + rng() * 14;
          const trail = 8 + rng() * 12;
          return (
            <g key={`t${i}`}>
              <line
                x1={startX} y1={y} x2={startX + trail} y2={y - 0.5 + rng()}
                stroke={`hsla(35, 60%, 65%, 0.3)`}
                strokeWidth="0.12"
                strokeLinecap="round"
              >
                <animate
                  attributeName="opacity"
                  values="0;0.4;0"
                  dur={`${3 + rng() * 4}s`}
                  begin={`${rng() * 6}s`}
                  repeatCount="indefinite"
                />
              </line>
              <circle cx={startX + trail} cy={y - 0.5 + rng()} r="0.3" fill="#d97706" opacity="0">
                <animate
                  attributeName="opacity"
                  values="0;0.6;0"
                  dur={`${3 + rng() * 4}s`}
                  begin={`${rng() * 6}s`}
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
