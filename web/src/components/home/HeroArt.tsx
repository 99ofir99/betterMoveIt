/**
 * HeroArt — dusk skyline for the Directions home hero.
 * The buildings run to the bottom and fade out through a mask, so the
 * skyline melts into the page instead of ending on a flat ground line.
 */

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


      <g fill="#c9d8f0" opacity="0.28">
        <circle cx="42" cy="22" r="0.85" />
        <circle cx="108" cy="14" r="0.6" />
        <circle cx="176" cy="28" r="0.7" />
        <circle cx="248" cy="12" r="0.55" />
        <circle cx="310" cy="24" r="0.75" />
        <circle cx="358" cy="16" r="0.6" />
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
          <rect x="8" y="82" width="2" height="2.6" rx="0.35" />
          <rect x="14" y="92" width="2" height="2.6" rx="0.35" />
          <rect x="56" y="72" width="2" height="2.6" rx="0.35" />
          <rect x="62" y="84" width="2" height="2.6" rx="0.35" />
          <rect x="56" y="96" width="2" height="2.6" rx="0.35" />
          <rect x="100" y="80" width="2" height="2.6" rx="0.35" />
          <rect x="106" y="92" width="2" height="2.6" rx="0.35" />
          <rect x="132" y="62" width="2" height="2.6" rx="0.35" />
          <rect x="138" y="74" width="2" height="2.6" rx="0.35" />
          <rect x="132" y="88" width="2" height="2.6" rx="0.35" />
          <rect x="172" y="76" width="2" height="2.6" rx="0.35" />
          <rect x="178" y="88" width="2" height="2.6" rx="0.35" />
          <rect x="218" y="68" width="2" height="2.6" rx="0.35" />
          <rect x="224" y="80" width="2" height="2.6" rx="0.35" />
          <rect x="246" y="56" width="2" height="2.6" rx="0.35" />
          <rect x="252" y="70" width="2" height="2.6" rx="0.35" />
          <rect x="246" y="84" width="2" height="2.6" rx="0.35" />
          <rect x="286" y="74" width="2" height="2.6" rx="0.35" />
          <rect x="292" y="88" width="2" height="2.6" rx="0.35" />
          <rect x="318" y="66" width="2" height="2.6" rx="0.35" />
          <rect x="324" y="78" width="2" height="2.6" rx="0.35" />
          <rect x="358" y="78" width="2" height="2.6" rx="0.35" />
          <rect x="364" y="90" width="2" height="2.6" rx="0.35" />
          <rect x="370" y="102" width="2" height="2.6" rx="0.35" />
        </g>

        {/* Near masses — still above the pill, warmer windows */}
        <g fill="url(#hero-near)">
          <path d="M22 200V88h28v-6h12v6h18V200z" />
          <path d="M140 200V84h20v-8h14v8h24V200z" />
          <path d="M250 200V90h22v-6h12v6h20V200z" />
          <path d="M330 200V86h18v-6h12v6h26V200z" />
        </g>

        <g fill="url(#hero-win)">
          <rect x="30" y="96" width="2.3" height="3" rx="0.4" />
          <rect x="36" y="96" width="2.3" height="3" rx="0.4" />
          <rect x="42" y="96" width="2.3" height="3" rx="0.4" />
          <rect x="30" y="106" width="2.3" height="3" rx="0.4" />
          <rect x="42" y="106" width="2.3" height="3" rx="0.4" />
          <rect x="148" y="94" width="2.3" height="3" rx="0.4" />
          <rect x="154" y="94" width="2.3" height="3" rx="0.4" />
          <rect x="168" y="94" width="2.3" height="3" rx="0.4" />
          <rect x="148" y="104" width="2.3" height="3" rx="0.4" />
          <rect x="168" y="104" width="2.3" height="3" rx="0.4" />
          <rect x="258" y="98" width="2.3" height="3" rx="0.4" />
          <rect x="264" y="98" width="2.3" height="3" rx="0.4" />
          <rect x="276" y="98" width="2.3" height="3" rx="0.4" />
          <rect x="258" y="108" width="2.3" height="3" rx="0.4" />
          <rect x="338" y="96" width="2.3" height="3" rx="0.4" />
          <rect x="344" y="96" width="2.3" height="3" rx="0.4" />
          <rect x="356" y="96" width="2.3" height="3" rx="0.4" />
          <rect x="338" y="106" width="2.3" height="3" rx="0.4" />
          <rect x="356" y="106" width="2.3" height="3" rx="0.4" />
        </g>
      </g>
    </svg>
  );
}
