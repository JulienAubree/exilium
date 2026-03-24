import { useMemo } from 'react';

interface Rock {
  x: number;
  y: number;
  size: number;
  rot: number;
  shade: number;
  driftDur: number;
  driftDelay: number;
  spinDur: number;
  spinDir: number;
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
      y: 5 + rng() * 20,
      size: 0.6 + rng() * maxSize,
      rot: rng() * 360,
      shade: 0.15 + rng() * 0.85,
      driftDur: 18 + rng() * 28,
      driftDelay: -(rng() * 30),
      spinDur: 60 + rng() * 80,
      spinDir: rng() > 0.5 ? 1 : -1,
      seed: Math.floor(rng() * 1000),
      hue: 18 + rng() * 35,
    });
  }
  return rocks;
}

function rockPath(size: number, seed: number, vertices = 8): string {
  const pts: string[] = [];
  const rng = seededRandom(seed);
  for (let i = 0; i < vertices; i++) {
    const angle = (Math.PI * 2 * i) / vertices;
    const jitter = 0.5 + rng() * 0.55;
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

// ---------- Pre-compute everything at module level ----------

// 3 rock layers
const FRONT_ROCKS = generateRocks(12, 0, 3.5);
const MID_ROCKS = generateRocks(16, 1, 2.2);
const BACK_ROCKS = generateRocks(22, 2, 1.3);
const ALL_ROCKS = [...FRONT_ROCKS, ...MID_ROCKS, ...BACK_ROCKS];

// Fragments (small 4-vertex debris near large rocks)
interface Fragment {
  x: number;
  y: number;
  path: string;
  hue: number;
  shade: number;
  driftDur: number;
  driftDelay: number;
}
const FRAG_RNG = seededRandom(333);
const FRAGMENTS: Fragment[] = [];
for (const rock of FRONT_ROCKS) {
  if (rock.size > 2.2) {
    const count = 2 + Math.floor(FRAG_RNG() * 3);
    for (let j = 0; j < count; j++) {
      const angle = FRAG_RNG() * Math.PI * 2;
      const dist = rock.size * (1.3 + FRAG_RNG() * 1.2);
      FRAGMENTS.push({
        x: rock.x + Math.cos(angle) * dist,
        y: rock.y + Math.sin(angle) * dist,
        path: rockPath(0.3 + FRAG_RNG() * 0.5, Math.floor(FRAG_RNG() * 999), 4),
        hue: rock.hue + (FRAG_RNG() - 0.5) * 10,
        shade: rock.shade * (0.6 + FRAG_RNG() * 0.4),
        driftDur: 15 + FRAG_RNG() * 20,
        driftDelay: -(FRAG_RNG() * 20),
      });
    }
  }
}

// All rock paths
interface RockPaths {
  body: string;
  shadow: string;
  highlightTL: string;
  highlightBR: string;
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
      shadow: rockPath(rock.size * 1.12, rock.seed),
      highlightTL: rockPath(rock.size * 0.38, rock.seed + 1, 5),
      highlightBR: rockPath(rock.size * 0.25, rock.seed + 2, 4),
      rim: rockPath(rock.size * 1.02, rock.seed),
      craters: isLarge
        ? [craterPath(rock.size, rock.seed), craterPath(rock.size * 0.7, rock.seed + 200)]
        : [],
    });
  }
}

// Dust particles
const DUST_RNG = seededRandom(7);
const DUST = Array.from({ length: 35 }, () => {
  const driftDur = 7 + DUST_RNG() * 14;
  return {
    cx: DUST_RNG() * 200,
    cy: 4 + DUST_RNG() * 22,
    r: 0.15 + DUST_RNG() * 0.7,
    opacity: 0.1 + DUST_RNG() * 0.35,
    hue: 25 + DUST_RNG() * 25,
    animated: DUST_RNG() > 0.4,
    driftDur,
    driftDelay: -(DUST_RNG() * driftDur),
  };
});

// Sparkles
const SPARK_RNG = seededRandom(11);
const SPARKLES = Array.from({ length: 10 }, () => ({
  cx: 6 + SPARK_RNG() * 188,
  cy: 5 + SPARK_RNG() * 20,
  size: 0.15 + SPARK_RNG() * 0.25,
  dur: 1.8 + SPARK_RNG() * 3,
  delay: SPARK_RNG() * 6,
}));

// Trailing debris
const TRAIL_RNG = seededRandom(99);
const TRAILS = Array.from({ length: 7 }, () => {
  const x = TRAIL_RNG() * 185;
  const y = 7 + TRAIL_RNG() * 16;
  const len = 5 + TRAIL_RNG() * 12;
  const dur = 2.5 + TRAIL_RNG() * 4;
  return {
    x1: x, y1: y,
    x2: x + len, y2: y - 0.5 + TRAIL_RNG() * 1,
    dur,
    delay: TRAIL_RNG() * 7,
  };
});

// ---------- Components ----------

function RockGroup({ rocks, opacity, uid }: { rocks: Rock[]; opacity: number; uid: string }) {
  return (
    <g opacity={opacity}>
      {rocks.map((rock, i) => {
        const key = `${rock.seed}-${rock.size.toFixed(2)}`;
        const paths = ROCK_PATHS.get(key)!;
        const lum = 22 + rock.shade * 22;
        const sat = 18 + rock.shade * 35;
        const isLarge = rock.size > 2.0;

        return (
          <g
            key={i}
            style={{
              animation: `asteroid-drift ${rock.driftDur}s ease-in-out ${rock.driftDelay}s infinite`,
            }}
          >
            <g
              transform={`translate(${rock.x},${rock.y})`}
              style={{
                animation: `asteroid-spin ${rock.spinDur}s linear infinite`,
                animationDirection: rock.spinDir > 0 ? 'normal' : 'reverse',
                transformOrigin: '0 0',
              }}
            >
              <g transform={`rotate(${rock.rot})`}>
                {/* Drop shadow */}
                <path
                  d={paths.shadow}
                  fill="black"
                  opacity={isLarge ? 0.35 : 0.2}
                  transform="translate(0.4,0.5)"
                />
                {/* Body with gradient */}
                <path
                  d={paths.body}
                  fill={`url(#rg-${uid})`}
                  stroke={`hsl(${rock.hue - 5}, ${sat + 5}%, ${lum * 0.5}%)`}
                  strokeWidth="0.18"
                  style={{
                    // Override gradient with per-rock color via CSS custom props
                    fill: `hsl(${rock.hue}, ${sat}%, ${lum}%)`,
                  }}
                />
                {/* Dark side overlay — bottom-right half darker */}
                <path
                  d={paths.body}
                  fill={`hsla(${rock.hue - 10}, ${sat}%, 8%, 0.25)`}
                  clipPath={`inset(0 0 0 ${rock.size * 0.15}px)`}
                />
                {/* Craters */}
                {paths.craters.map((c, ci) => (
                  <g key={ci}>
                    <path d={c} fill={`hsla(${rock.hue - 5}, ${sat}%, ${lum * 0.55}%, 0.5)`} />
                    <path
                      d={c}
                      fill="none"
                      stroke={`hsla(${rock.hue + 5}, 30%, ${lum + 15}%, 0.2)`}
                      strokeWidth="0.1"
                    />
                  </g>
                ))}
                {/* Top-left highlight */}
                <path
                  d={paths.highlightTL}
                  fill={`hsla(${rock.hue + 10}, 50%, ${58 + rock.shade * 20}%, 0.35)`}
                  transform={`translate(${-rock.size * 0.22},${-rock.size * 0.25})`}
                />
                {/* Bottom-right secondary highlight */}
                {isLarge && (
                  <path
                    d={paths.highlightBR}
                    fill={`hsla(${rock.hue + 15}, 40%, 65%, 0.15)`}
                    transform={`translate(${rock.size * 0.2},${rock.size * 0.18})`}
                  />
                )}
                {/* Rim light */}
                <path
                  d={paths.rim}
                  fill="none"
                  stroke={`hsla(40, 55%, 78%, ${0.07 + rock.shade * 0.08})`}
                  strokeWidth="0.12"
                  strokeDasharray={isLarge ? undefined : `${rock.size * 0.8} ${rock.size * 1.5}`}
                />
              </g>
            </g>
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
        {/* Vertical ambient glow */}
        <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0" />
          <stop offset="25%" stopColor="#92400e" stopOpacity="0.03" />
          <stop offset="50%" stopColor="#fb923c" stopOpacity="0.1" />
          <stop offset="75%" stopColor="#92400e" stopOpacity="0.03" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
        </linearGradient>
        {/* Center radial glow */}
        <radialGradient id={`cg-${uid}`} cx="50%" cy="50%" r="45%">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
        </radialGradient>
        {/* Edge fade mask */}
        <linearGradient id={`fe-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="4%" stopColor="white" stopOpacity="1" />
          <stop offset="96%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <mask id={`fm-${uid}`}>
          <rect width="200" height="30" fill={`url(#fe-${uid})`} />
        </mask>
        {/* Sparkle glow */}
        <radialGradient id={`sg-${uid}`}>
          <stop offset="0%" stopColor="#fef3c7" stopOpacity="1" />
          <stop offset="40%" stopColor="#fde68a" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#fde68a" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Ambient glow layers */}
      <rect x="0" y="0" width="200" height="30" fill={`url(#bg-${uid})`} className="asteroid-glow" />
      <rect x="0" y="0" width="200" height="30" fill={`url(#cg-${uid})`} className="asteroid-glow" />

      {/* Faint orbital path */}
      <ellipse
        cx="100" cy="15" rx="95" ry="6"
        fill="none"
        stroke="hsla(30, 50%, 50%, 0.06)"
        strokeWidth="0.3"
        strokeDasharray="3 5"
        mask={`url(#fm-${uid})`}
      />

      {/* Dust particles */}
      <g mask={`url(#fm-${uid})`} opacity="0.4">
        {DUST.map((d, i) => (
          <circle
            key={i}
            cx={d.cx}
            cy={d.cy}
            r={d.r}
            fill={`hsl(${d.hue}, 65%, 68%)`}
            opacity={d.opacity}
            style={d.animated ? {
              animation: `asteroid-dust ${d.driftDur}s ease-in-out ${d.driftDelay}s infinite`,
            } : undefined}
          />
        ))}
      </g>

      {/* Rocks — back to front */}
      <g mask={`url(#fm-${uid})`}>
        <RockGroup rocks={BACK_ROCKS} opacity={0.2} uid={uid} />
        <RockGroup rocks={MID_ROCKS} opacity={0.5} uid={uid} />
        <RockGroup rocks={FRONT_ROCKS} opacity={1} uid={uid} />
      </g>

      {/* Fragments near large rocks */}
      <g mask={`url(#fm-${uid})`} opacity="0.7">
        {FRAGMENTS.map((f, i) => {
          const lum = 25 + f.shade * 18;
          return (
            <g
              key={i}
              transform={`translate(${f.x},${f.y})`}
              style={{
                animation: `asteroid-drift ${f.driftDur}s ease-in-out ${f.driftDelay}s infinite`,
              }}
            >
              <path d={f.path} fill={`hsl(${f.hue}, 30%, ${lum}%)`} />
            </g>
          );
        })}
      </g>

      {/* Cross sparkles with soft glow */}
      {SPARKLES.map((s, i) => (
        <g
          key={i}
          className="asteroid-sparkle"
          style={{
            animationDuration: `${s.dur}s`,
            animationDelay: `${s.delay}s`,
          }}
        >
          {/* Soft glow halo */}
          <circle cx={s.cx} cy={s.cy} r={s.size * 4} fill={`url(#sg-${uid})`} />
          {/* Cross */}
          <line
            x1={s.cx - s.size * 3} y1={s.cy}
            x2={s.cx + s.size * 3} y2={s.cy}
            stroke="#fef3c7" strokeWidth="0.1"
          />
          <line
            x1={s.cx} y1={s.cy - s.size * 3}
            x2={s.cx} y2={s.cy + s.size * 3}
            stroke="#fef3c7" strokeWidth="0.1"
          />
          {/* Center dot */}
          <circle cx={s.cx} cy={s.cy} r={s.size * 0.8} fill="#fef3c7" />
        </g>
      ))}

      {/* Trailing debris streaks */}
      <g mask={`url(#fm-${uid})`}>
        {TRAILS.map((t, i) => (
          <g key={i}>
            <line
              x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
              stroke="hsla(35, 60%, 60%, 0.2)"
              strokeWidth="0.12"
              strokeLinecap="round"
              className="asteroid-trail"
              style={{ animationDuration: `${t.dur}s`, animationDelay: `${t.delay}s` }}
            />
            <circle
              cx={t.x2} cy={t.y2} r="0.3"
              fill="#d97706"
              className="asteroid-trail"
              style={{ animationDuration: `${t.dur}s`, animationDelay: `${t.delay}s` }}
            />
          </g>
        ))}
      </g>
    </svg>
  );
}
