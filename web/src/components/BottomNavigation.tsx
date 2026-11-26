/**
 * BottomNavigation — Moovit-style equal-tab bar.
 * Order: Directions | Stations | Lines | Favourites | More
 * All tabs are equal height; no center FAB.
 */

import type { TabName } from "../types";

interface BottomNavigationProps {
  activeTab: TabName;
  onTabChange: (tab: TabName) => void;
}

export function BottomNavigation({ activeTab, onTabChange }: BottomNavigationProps) {
  return (
    <nav className="bottom-nav" role="navigation" aria-label="Main navigation">
      <NavTab
        id="directions"
        label="Directions"
        active={activeTab === "directions"}
        onPress={onTabChange}
      >
        <DirectionsIcon />
      </NavTab>
      <NavTab id="nearby" label="Stations" active={activeTab === "nearby"} onPress={onTabChange}>
        <StationsIcon />
      </NavTab>
      <NavTab id="lines" label="Lines" active={activeTab === "lines"} onPress={onTabChange}>
        <LinesIcon />
      </NavTab>
      <NavTab
        id="favorites"
        label="Favourites"
        active={activeTab === "favorites"}
        onPress={onTabChange}
      >
        <FavouritesIcon active={activeTab === "favorites"} />
      </NavTab>
      <NavTab id="more" label="More" active={activeTab === "more"} onPress={onTabChange}>
        <MoreIcon />
      </NavTab>
    </nav>
  );
}

// ── Tab button ────────────────────────────────────────────────────────────────

function NavTab({
  id,
  label,
  active,
  onPress,
  children,
}: {
  id: TabName;
  label: string;
  active: boolean;
  onPress: (tab: TabName) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`bottom-nav__tab${active ? " is-active" : ""}`}
      onClick={() => onPress(id)}
      aria-label={label}
      aria-current={active ? "page" : undefined}
    >
      <span className="bottom-nav__icon" aria-hidden="true">
        {children}
      </span>
      <span className="bottom-nav__label">{label}</span>
    </button>
  );
}

// ── Moovit-style thin SVG icons ───────────────────────────────────────────────

/** Diamond wayfinding sign with turn arrow — Directions */
function DirectionsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M21.71 11.29l-9-9a.996.996 0 0 0-1.41 0l-9 9a.996.996 0 0 0 0 1.41l9 9c.39.39 1.02.39 1.41 0l9-9a.996.996 0 0 0 0-1.41zM14 14.5V12h-4v3H8v-4c0-.55.45-1 1-1h5V7.5l3.5 3.5-3.5 3.5z" />
    </svg>
  );
}

/** Map pin — Stations / Nearby */
function StationsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
    </svg>
  );
}

/** Three circles connected by short lines — Lines / Routes */
function LinesIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="4" cy="12" r="2.5" fill="currentColor" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
      <circle cx="20" cy="12" r="2.5" fill="currentColor" />
      <line
        x1="6.5"
        y1="12"
        x2="9.5"
        y2="12"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <line
        x1="14.5"
        y1="12"
        x2="17.5"
        y2="12"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Star — Favourites (filled when active, outline when inactive) */
function FavouritesIcon({ active }: { active: boolean }) {
  return active ? (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
    </svg>
  ) : (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

/** 2×2 app grid — More (distinct from Lines / Directions) */
function MoreIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </svg>
  );
}
