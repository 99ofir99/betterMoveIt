/**
 * Types for the active-trip navigation feature.
 * Used by tripGuidance.ts, useActiveTrip.ts, TripStartBar, and TripProgressSheet (+ children).
 */

import type { DepartureGroup, Journey, Leg, RouteInfo } from '../../types';

/** Phases of an active trip navigation session. */
export type TripPhase = 'idle' | 'walking' | 'waiting' | 'onboard' | 'alight' | 'done';

/** User-facing description of what to do next. */
export interface NextAction {
  title: string;
  subtitle: string;
  /** Seconds until key event (departure or arrival). */
  countdownSec?: number;
  /** Remaining stops before alighting (transit legs only). */
  stopsToAlight?: number;
  /** Route color (may include leading #). */
  routeColor?: string | null;
  /** Short display name of the route/line. */
  routeLabel?: string;
  /** Transit mode type name used for icon selection. */
  typeName?: string;
}

/** Full in-flight state of an active trip. */
export interface ActiveTripState {
  /** The journey being navigated. */
  journey: Journey;
  phase: TripPhase;
  legIndex: number;
  /** 0–1 progress within the current leg. */
  progress: number;
  nextAction: NextAction;
  /** Whether GPS watch permission is granted. */
  gpsAllowed: boolean;
  /** Latest GPS position, or null while waiting / permission denied. */
  position: { lat: number; lon: number } | null;
  /** Whether get-off alerts (notification + vibrate) are enabled. Default true. */
  alertsEnabled: boolean;
  /**
   * Moovit-clamped alternatives per transit-leg index.
   * Populated when the trip was started from a clamped journey card.
   * Used by the wait card to lead with all acceptable lines.
   */
  transitAlternatives?: RouteInfo[][];
}

// ── TripProgressSheet (Live Directions) ──────────────────────────────────────

export interface TripProgressSheetProps {
  state: ActiveTripState;
  /** Stop the trip entirely (Stop pill). */
  onEnd: () => void;
  /**
   * Back chevron — Moovit minimizes Live Directions into the floating PiP
   * instead of ending the trip. Falls back to onEnd when omitted.
   */
  onBack?: () => void;
  /** Toggle live-vehicle overlay on the map. */
  onToggleLiveBuses?: () => void;
  /** Whether the live-vehicle overlay is currently on. */
  liveBusesActive?: boolean;
  /** Live buses of this trip's lines now on the map (badge on the pill). */
  liveBusCount?: number;
  /** Fired when the user pages to another leg (informational — the active leg is unaffected). */
  onSelectLeg?: (legIndex: number) => void;
  /** Fired when user toggles the bell button. */
  onToggleAlerts?: () => void;
  /**
   * Apply a corridor line choice (assumed soonest arrival or Switch pick)
   * so the stop rail / alerts follow that member itinerary.
   */
  onSelectCorridorLine?: (transitOrdinal: number, route: import('../../types').RouteInfo) => void;
}

/** Moovit floating PiP chip while an active trip is minimized. */
export interface ActiveTripPipProps {
  state: ActiveTripState;
  /** Expand control — restore full Live Directions. */
  onExpand: () => void;
  /** Close (X) — dismiss the floating window and end the trip. */
  onClose: () => void;
}

export interface LiveDirectionsHeaderProps {
  subtitle: string;
  onBack: () => void;
  /** Whether get-off alerts are currently active. */
  alertsEnabled: boolean;
  /** Called when the user taps the bell icon. */
  onToggleAlerts: () => void;
}

export interface LegPagerProps {
  /**
   * Moovit pager stages (walk / wait / ride). Prefer this over `legs` —
   * transit expands to wait then ride as separate dots.
   */
  stages?: import('./journeyStages').JourneyStage[];
  /** @deprecated Prefer `stages` — kept for callers that still pass raw legs. */
  legs?: Leg[];
  /** Stage currently being viewed. */
  viewIndex: number;
  /** Stage the traveller is actually on. */
  activeIndex: number;
  done: boolean;
  onSelect: (index: number) => void;
  onPrev: () => void;
  onNext: () => void;
}

export interface StopProgressListProps {
  stops: import('../../types').IntermediateStop[];
  /** Index of the stop the rider is at / just left. */
  cursor: number;
  showArrivalOnAlight?: boolean;
}

export interface TransitRideCardProps {
  state: ActiveTripState;
  leg?: import('../../types').TransitLeg;
  live?: boolean;
  /**
   * Claimed / clamped alternative lines for this transit leg
   * (from transitAlternatives[transitIdx]). When length > 1, "Switch"
   * opens the line picker so the rider can pick the line they're on.
   */
  alternatives?: RouteInfo[];
  /** Override the displayed route (user-selected alternative). */
  selectedRoute?: RouteInfo;
  /** Called when user taps "Switch" (only when alternatives.length > 1). */
  onChangeRoute?: () => void;
}

export interface OptionRowProps {
  group: DepartureGroup;
  highlighted?: boolean;
  /**
   * When set, the row is tappable — Moovit boarding: pick the line you're
   * waiting for / boarded so stop alerts follow that itinerary.
   */
  onSelect?: (route: RouteInfo) => void;
}

export interface WaitOptionsCardProps {
  options: DepartureGroup[];
  /** Strip line: Moovit "Wait for {headsign/destination}". */
  waitForLabel: string;
  countdownSec?: number;
  /** Board / alight labels under the strip (fixes Hebrew arrow bidi). */
  fromName?: string;
  toName?: string;
  /** Switch among clamped corridor lines. */
  onSwitch?: () => void;
  /** Currently assumed / Switch-picked corridor line (highlights matching row). */
  selectedRoute?: RouteInfo;
  /** Called when the rider taps a departure option row. */
  onSelectRoute?: (route: RouteInfo) => void;
}

export interface ShowMoreOptionsLinkProps {
  hiddenCount: number;
  /** Opens the Upcoming Arrivals sheet (Moovit). */
  onOpen: () => void;
}

export interface UpcomingArrivalsModalProps {
  open: boolean;
  onClose: () => void;
  options: DepartureGroup[];
  /** Boarding stop title under "Details & Timetables". */
  stopName?: string;
  fromName?: string;
  toName?: string;
  /** Switch among clamped corridor lines. */
  onSwitch?: () => void;
  /** Currently assumed / Switch-picked corridor line. */
  selectedRoute?: RouteInfo;
  /** Called when the rider taps an arrival row to claim that line. */
  onSelectRoute?: (route: RouteInfo) => void;
}

/** Compact "Showing stops for {line} · Switch" chrome above a stop rail. */
export interface ShowingStopsForBarProps {
  route: RouteInfo;
  headsign?: string;
  /** When set, Switch is shown (corridor has multiple lines). */
  onSwitch?: () => void;
}

export interface LegEndpointsProps {
  from: string;
  to: string;
  /** Moovit "Switch" — change among clamped lines when provided. */
  onSwitch?: () => void;
}

export interface TransitPreviewCardProps {
  leg: import('../../types').TransitLeg;
  alternatives?: RouteInfo[];
  selectedRoute?: RouteInfo;
  onSwitch?: () => void;
}

export interface LegPreviewCardProps {
  leg: Leg;
  isPast: boolean;
}

export interface TripPhaseCardProps {
  state: ActiveTripState;
}

export interface TripActionPillsProps {
  onStop: () => void;
  onToggleLiveBuses?: () => void;
  liveBusesActive?: boolean;
  /** Live buses of this trip's lines now on the map (badge on the pill). */
  liveBusCount?: number;
  onShare: () => void;
}

/** Props for the "replace active trip?" confirm dialog. */
export interface ConfirmReplaceTripProps {
  /** User confirmed: end current trip and start the new one. */
  onConfirm: () => void;
  /** User cancelled: keep the active trip. */
  onCancel: () => void;
}
