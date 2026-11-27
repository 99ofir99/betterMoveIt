/**
 * HeroArt — dusk skyline for the Directions home hero.
 * The buildings run to the bottom and fade out through a mask, so the
 * skyline melts into the page instead of ending on a flat ground line.
 *
 * Ambient motion (CSS, see `.home-hero__art-svg` in styles.css):
 * windows breathe and now and then switch off and on again, stars twinkle,
 * and a rare shooting star crosses the sky. All of it stops under
 * prefers-reduced-motion.
 */
import type { CSSProperties } from 'react';

type Pt = readonly [number, number];

const STARS: readonly (readonly [number, number, number])[] = [
  [42, 22, 0.85], [108, 14, 0.6], [176, 28, 0.7], [248, 12, 0.55], [310, 24, 0.75], [358, 16, 0.6],
  [20, 40, 0.5], [78, 34, 0.45], [142, 8, 0.5], [210, 36, 0.45], [282, 40, 0.5], [336, 34, 0.45],
  [380, 8, 0.5], [66, 6, 0.4],
];

const COOL_WINDOWS: readonly Pt[] = [
  [8, 82], [14, 92], [56, 72], [62, 84], [56, 96], [100, 80], [106, 92], [132, 62], [138, 74],
  [132, 88], [172, 76], [178, 88], [218, 68], [224, 80], [246, 56], [252, 70], [246, 84], [286, 74],
  [292, 88], [318, 66], [324, 78], [358, 78], [364, 90], [370, 102],
];

const WARM_WINDOWS: readonly Pt[] = [
  [30, 96], [36, 96], [42, 96], [30, 106], [42, 106], [148, 94], [154, 94], [168, 94], [148, 104],
  [168, 104], [258, 98], [264, 98], [276, 98], [258, 108], [338, 96], [344, 96], [356, 96],
  [338, 106], [356, 106],
];

/** Small deterministic PRNG so timings are varied but stable between renders. */
function prng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

type Timed = { x: number; y: number; r?: number; off: boolean; style: CSSProperties };

function timings<T extends readonly number[]>(pts: readonly T[], seed: number, offShare: number): Timed[] {
  const rnd = prng(seed);
  return pts.map(([x, y, r]) => {
    const off = rnd() < offShare;
    // Breathing windows: 3–6 s. Switching windows: 6–12 s cycle (dark for ~a third of it).
    const d = off ? 6 + rnd() * 6 : 3 + rnd() * 3;
    return {
      x,
      y,
      r,
      off,
      style: { '--d': `${d.toFixed(1)}s`, '--dl': `-${(rnd() * d).toFixed(1)}s` } as CSSProperties,
    };
  });
}

const STAR_T = timings(STARS, 11, 0).map((s, i) => ({
  ...s,
  // Stars twinkle slower than windows: 4–8 s.
  style: { '--d': `${(4 + ((i * 7) % 5)).toFixed(1)}s`, '--dl': `-${((i * 1.7) % 6).toFixed(1)}s` } as CSSProperties,
}));
const COOL_T = timings(COOL_WINDOWS, 7, 0.35);
const WARM_T = timings(WARM_WINDOWS, 29, 0.4);

export function HeroArt() {
  return (
    <svg
      className="home-hero__art-svg"
      viewBox="0 0 390 200"
      preserveAspectRatio="xMidYMax slice"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="hero-ridge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#15263d" />
          <stop offset="1" stopColor="#0c1624" />
        </linearGradient>
        <linearGradient id="hero-near" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#101c2e" />
          <stop offset="1" stopColor="#080e16" />
        </linearGradient>
        <radialGradient id="hero-win" cx="50%" cy="40%" r="65%">
          <stop offset="0" stopColor="#ffe6b0" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ffc56a" stopOpacity="0.2" />
        </radialGradient>
        <linearGradient id="hero-trail" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        {/* Buildings dissolve downward — no hard ground line or slab. */}
        <linearGradient id="hero-ground-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.38" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.62" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="0.86" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="hero-city-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="390" height="200">
          <rect x="0" y="0" width="390" height="200" fill="url(#hero-ground-fade)" />
        </mask>
      </defs>

      <g className="hero-stars" fill="#c9d8f0" opacity="0.5">
        {STAR_T.map((s) => (
          <circle key={`${s.x},${s.y}`} cx={s.x} cy={s.y} r={s.r} style={s.style} />
        ))}
      </g>

      {/* Rare shooting star, top right towards the left */}
      <g className="hero-shooting-star">
        <line x1="300" y1="10" x2="318" y2="4" stroke="url(#hero-trail)" strokeWidth="1" strokeLinecap="round" />
      </g>

      <g mask="url(#hero-city-mask)">
        {/* Far skyline — tops only, above the pill */}
        <g fill="url(#hero-ridge)">
          <path d="M0 200V72h16v-16h9v16h18V200z" />
          <path d="M48 200V58h11v-12h5v12h20V200z" />
          <path d="M90 200V68h30V200z" />
          <path d="M126 200V46h13v-14h3.5v14h15V200z" />
          <path d="M164 200V62h14v-8h8v8h18V200z" />
          <path d="M210 200V52h24V200z" />
          <path d="M240 200V40h12v-16h3v16h14V200z" />
          <path d="M276 200V60h30V200z" />
          <path d="M312 200V50h10v-12h4v12h16V200z" />
          <path d="M348 200V64h42V200z" />
        </g>

        {/* Sparse cool windows on far ridge */}
        <g fill="rgba(170,200,255,0.22)">
          {COOL_T.map((w) => (
            <rect
              key={`${w.x},${w.y}`}
              className={w.off ? 'hero-win hero-win--off' : 'hero-win'}
              style={w.style}
              x={w.x}
              y={w.y}
              width="2"
              height="2.6"
              rx="0.35"
            />
          ))}
        </g>

        {/* Near masses — still above the pill, warmer windows */}
        <g fill="url(#hero-near)">
          <path d="M22 200V88h28v-6h12v6h18V200z" />
          <path d="M140 200V84h20v-8h14v8h24V200z" />
          <path d="M250 200V90h22v-6h12v6h20V200z" />
          <path d="M330 200V86h18v-6h12v6h26V200z" />
        </g>

        <g fill="url(#hero-win)">
          {WARM_T.map((w) => (
            <rect
              key={`${w.x},${w.y}`}
              className={w.off ? 'hero-win hero-win--off' : 'hero-win'}
              style={w.style}
              x={w.x}
              y={w.y}
              width="2.3"
              height="3"
              rx="0.4"
            />
          ))}
        </g>
      </g>
    </svg>
  );
}
