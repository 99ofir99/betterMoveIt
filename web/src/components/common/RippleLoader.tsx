/**
 * In-page loading state matching the startup splash ("location ripples" in index.html):
 * the logo character with soft orange ripples. Use it wherever a list or panel is waiting
 * on the API instead of leaving an empty black area.
 */
export function RippleLoader({ label, compact = false }: { label?: string; compact?: boolean }) {
  return (
    <div className={`ripple-loader${compact ? ' ripple-loader--compact' : ''}`} role="status" aria-live="polite">
      <svg className="ripple-loader__art" viewBox="0 0 240 240" aria-hidden="true">
        <defs>
          <linearGradient id="ripple-loader-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffb27a" />
            <stop offset="1" stopColor="#ff8a5c" />
          </linearGradient>
        </defs>
        <circle className="ripple-loader__rip" cx="120" cy="120" r="112" fill="none" stroke="#ffb27a" strokeWidth="3" />
        <circle className="ripple-loader__rip ripple-loader__rip--d1" cx="120" cy="120" r="112" fill="none" stroke="#ff9a68" strokeWidth="3" />
        <circle className="ripple-loader__rip ripple-loader__rip--d2" cx="120" cy="120" r="112" fill="rgba(255,138,92,.10)" stroke="#ff8a5c" strokeWidth="3" />
        <circle cx="120" cy="120" r="46" fill="url(#ripple-loader-g)" opacity=".9" />
        <g className="ripple-loader__float">
          <g transform="translate(120 120) scale(.3)">
            <circle r="120" fill="#fff" />
            <circle cx="-66" cy="28" r="13" fill="#ff8a7a" opacity=".55" />
            <circle cx="66" cy="28" r="13" fill="#ff8a7a" opacity=".55" />
            <g className="ripple-loader__blink">
              <ellipse cx="-38" cy="-14" rx="15" ry="19" fill="#2b2f3a" />
              <ellipse cx="38" cy="-14" rx="15" ry="19" fill="#2b2f3a" />
              <circle cx="-33" cy="-21" r="5" fill="#fff" />
              <circle cx="43" cy="-21" r="5" fill="#fff" />
            </g>
            <path d="M-36 26 Q0 58 36 26" fill="none" stroke="#2b2f3a" strokeWidth="13" strokeLinecap="round" />
          </g>
        </g>
      </svg>
      {label && <p className="ripple-loader__label">{label}</p>}
    </div>
  );
}
