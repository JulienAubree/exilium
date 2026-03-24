import { useMemo } from 'react';

interface Rock {
  x: number;
  y: number;
  size: number;
  rot: number;
  shade: number;
  driftDur: number;
  driftDelay: number;
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

function generateRocks(count: number, layer: number, maxSize: number): Rock[] {
  const rng = seededRandom(42 + layer * 137);
  const rocks: Rock[] = [];
  for (let i = 0; i < count; i++) {
    rocks.push({
      x: rng() * 200,
      y: 6 + rng() * 18,
      size: 0.6 + rng() * maxSize,
      rot: rng() * 360,
      shade: 0.2 + rng() * 0.8,
      driftDur: 20 + rng() * 30,
      driftDelay: -(rng() * 30),
      seed: Math.floor(rng() * 1000),
      hue: 20 + rng() * 30,
    });
  }
  return rocks;
}

function rockPath(size: number, seed: number, vertices = 7): string {
  const pts: string[] = [];
  const rng = seededRandom(seed);
  for (let i = 0; i < vertices; i++) {
    const angle = (Math.PI * 2 * i) / vertices;
    const jitter = 0.55 + rng() * 0.5;
    pts.push(
      `${(Math.cos(angle) * size * jitter).toFixed(2)},${(Math.sin(angle) * size * jitter).toFixed(2)}`,
    );
  }
  return `M${pts.join('L')}Z`;
}

function craterPath(size: number, seed: number): string {
  const rng = seededRandom(seed + 500);
  const cx = (rng() - 0.5) * size * 0.4;
  const cy = (rng() - 0.5) * size * 0.4;
  const r = size * (0.12 + rng() * 0.15);
  return `M${(cx - r).toFixed(2)},${cy.toFixed(2)} A${r.toFixed(2)},${r.toFixed(2)} 0 1,1 ${(cx + r).toFixed(2)},${cy.toFixed(2)} A${r.toFixed(2)},${r.toFixed(2)} 0 1,1 ${(cx - r).toFixed(2)},${cy.toFixed(2)}Z`;
}

// 3 layers — pre-computed at module level
const FRONT_ROCKS = generateRocks(10, 0, 3.2);
const MID_ROCKS = generateRocks(14, 1, 2.0);
const BACK_ROCKS = generateRocks(18, 2, 1.2);
const ALL_ROCKS = [...FRONT_ROCKS, ...MID_ROCKS, ...BACK_ROCKS];

// Pre-compute all paths (body, shadow, highlight, rim, craters)
interface RockPaths {
  body: string;
  shadow: string;
  highlight: string;
  rim: string;
  craters: string[];
}
const ROCK_PATHS = new Map<string, RockPaths>();
for (const rock of ALL_ROCKS) {
  const key = `${rock.seed}-${rock.size.toFixed(2)}`;
  if (!ROCK_PATHS.has(key)) {
    const isLarge = rock.size > 2.0;
    ROCK_PATHS.set(key, {
      body: rockPath(rock.size, rock.seed),
      shadow: rockPath(rock.size * 1.1, rock.seed),
      highlight: rockPath(rock.size * 0.4, rock.seed + 1, 5),
      rim: rockPath(rock.size * 1.01, rock.seed),
      craters: isLarge
        ? [craterPath(rock.size, rock.seed), craterPath(rock.size * 0.7, rock.seed + 200)]
        : [],
    });
  }
}

// Pre-compute dust
const DUST_RNG = seededRandom(7);
const DUST = Array.from({ length: 25 }, () => {
  const driftDur = 8 + DUST_RNG() * 12;
  return {
    cx: DUST_RNG() * 200,
    cy: 6 + DUST_RNG() * 18,
    r: 0.2 + DUST_RNG() * 0.6,
    opacity: 0.15 + DUST_RNG() * 0.3,
    animated: DUST_RNG() > 0.5,
    driftDur,
    driftDelay: -(DUST_RNG() * driftDur),
  };
});

// Pre-compute sparkles
const SPARK_RNG = seededRandom(11);
const SPARKLES = Array.from({ length: 8 }, () => ({
  cx: 8 + SPARK_RNG() * 184,
  cy: 6 + SPARK_RNG() * 18,
  size: 0.15 + SPARK_RNG() * 0.2,
  dur: 2 + SPARK_RNG() * 3,
  delay: SPARK_RNG() * 5,
}));

// Pre-compute trailing debris
const TRAIL_RNG = seededRandom(99);
const TRAILS = Array.from({ length: 5 }, () => {
  const x = TRAIL_RNG() * 180;
  const y = 8 + TRAIL_RNG() * 14;
  const len = 6 + TRAIL_RNG() * 10;
  const dur = 3 + TRAIL_RNG() * 4;
  return {
    x1: x, y1: y,
    x2: x + len, y2: y - 0.4 + TRAIL_RNG() * 0.8,
    dur,
    delay: TRAIL_RNG() * 6,
  };
});

function RockGroup({ rocks, opacity }: { rocks: Rock[]; opacity: number }) {
  return (
    <g opacity={opacity}>
      {rocks.map((rock, i) => {
        const key = `${rock.seed}-${rock.size.toFixed(2)}`;
        const paths = ROCK_PATHS.get(key)!;
        const lum = 25 + rock.shade * 20;
        const sat = 20 + rock.shade * 30;
        const isLarge = rock.size > 2.0;

        return (
          <g
            key={i}
            transform={`translate(${rock.x},${rock.y}) rotate(${rock.rot})`}
            style={{
              animation: `asteroid-drift ${rock.driftDur}s ease-in-out ${rock.driftDelay}s infinite`,
            }}
          >
            {/* Drop shadow */}
            <path
              d={paths.shadow}
              fill="black"
              opacity={isLarge ? 0.3 : 0.2}
              transform="translate(0.35,0.45)"
            />
            {/* Body */}
            <path
              d={paths.body}
              fill={`hsl(${rock.hue}, ${sat}%, ${lum}%)`}
              stroke={`hsl(${rock.hue - 5}, ${sat + 5}%, ${lum * 0.6}%)`}
              strokeWidth="0.15"
            />
            {/* Craters */}
            {paths.craters.map((c, ci) => (
              <path
                key={ci}
                d={c}
                fill={`hsla(${rock.hue - 5}, ${sat}%, ${lum * 0.65}%, 0.5)`}
              />
            ))}
            {/* Highlight */}
            <path
              d={paths.highlight}
              fill={`hsla(${rock.hue + 10}, 50%, ${55 + rock.shade * 20}%, 0.3)`}
              transform={`translate(${-rock.size * 0.22},${-rock.size * 0.25})`}
            />
            {/* Rim light */}
            <path
              d={paths.rim}
              fill="none"
              stroke={`hsla(40, 60%, 80%, ${0.06 + rock.shade * 0.06})`}
              strokeWidth="0.12"
            />
          </g>
        );
      })}
    </g>
  );
}

export function AsteroidBelt({ className }: { className?: string }) {
  const uid = useMemo(() => Math.random().toString(36).slice(2, 8), []);

  return (
    <svg
      viewBox="0 0 200 30"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0" />
          <stop offset="35%" stopColor="#b45309" stopOpacity="0.04" />
          <stop offset="50%" stopColor="#fb923c" stopOpacity="0.1" />
          <stop offset="65%" stopColor="#b45309" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`fe-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="5%" stopColor="white" stopOpacity="1" />
          <stop offset="95%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <mask id={`fm-${uid}`}>
          <rect width="200" height="30" fill={`url(#fe-${uid})`} />
        </mask>
      </defs>

      {/* Ambient glow */}
      <rect
        x="0" y="0" width="200" height="30"
        fill={`url(#bg-${uid})`}
        className="asteroid-glow"
      />

      {/* Rocks — back to front */}
      <g mask={`url(#fm-${uid})`}>
        <RockGroup rocks={BACK_ROCKS} opacity={0.25} />
        <RockGroup rocks={MID_ROCKS} opacity={0.55} />
        <RockGroup rocks={FRONT_ROCKS} opacity={1} />
      </g>

      {/* Dust particles — half animated, half static */}
      <g mask={`url(#fm-${uid})`} opacity="0.35">
        {DUST.map((d, i) => (
          <circle
            key={i}
            cx={d.cx}
            cy={d.cy}
            r={d.r}
            fill="#fdba74"
            opacity={d.opacity}
            style={d.animated ? {
              animation: `asteroid-dust ${d.driftDur}s ease-in-out ${d.driftDelay}s infinite`,
            } : undefined}
          />
        ))}
      </g>

      {/* Cross sparkles */}
      {SPARKLES.map((s, i) => (
        <g
          key={i}
          className="asteroid-sparkle"
          style={{
            animationDuration: `${s.dur}s`,
            animationDelay: `${s.delay}s`,
          }}
        >
          <line
            x1={s.cx - s.size * 2.5} y1={s.cy}
            x2={s.cx + s.size * 2.5} y2={s.cy}
            stroke="#fef3c7" strokeWidth="0.12"
          />
          <line
            x1={s.cx} y1={s.cy - s.size * 2.5}
            x2={s.cx} y2={s.cy + s.size * 2.5}
            stroke="#fef3c7" strokeWidth="0.12"
          />
          <circle cx={s.cx} cy={s.cy} r={s.size} fill="#fef3c7" />
        </g>
      ))}

      {/* Trailing debris streaks */}
      <g mask={`url(#fm-${uid})`}>
        {TRAILS.map((t, i) => (
          <g key={i}>
            <line
              x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
              stroke="hsla(35, 60%, 65%, 0.25)"
              strokeWidth="0.1"
              strokeLinecap="round"
              className="asteroid-trail"
              style={{
                animationDuration: `${t.dur}s`,
                animationDelay: `${t.delay}s`,
              }}
            />
            <circle
              cx={t.x2} cy={t.y2} r="0.25"
              fill="#d97706"
              className="asteroid-trail"
              style={{
                animationDuration: `${t.dur}s`,
                animationDelay: `${t.delay}s`,
              }}
            />
          </g>
        ))}
      </g>
    </svg>
  );
}
