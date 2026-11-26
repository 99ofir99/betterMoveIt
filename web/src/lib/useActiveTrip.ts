/**
 * Hook managing the full lifecycle of an active trip navigation session.
 *
 * Logic:          resolveActiveLeg / buildNextAction (tripGuidance.ts)
 * GPS:            shared userLocation from useAppState (single watchPosition)
 * Screen on:      useWakeLock
 * Visuals:        TripProgressSheet / TripStartBar
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Journey, LatLon, RouteInfo } from '../types';
import type { TripPhase, NextAction, ActiveTripState } from '../components/trip/types';
import { findCorridorMember, journeyHasCorridorRoute } from './corridorLine';
import { useWakeLock } from './useWakeLock';
import { resolveActiveLeg, computeLegProgress, buildNextAction } from './tripGuidance';
import {
  clearTripSession,
  loadTripSession,
  saveTripSession,
  type TripSessionSnapshot,
} from './tripSession';

const ALERTS_STORAGE_KEY = 'bmi_trip_alerts_enabled';

function loadAlertsEnabled(): boolean {
  try {
    const v = localStorage.getItem(ALERTS_STORAGE_KEY);
    return v === null ? true : v !== 'false';
  } catch {
    return true;
  }
}

function saveAlertsEnabled(value: boolean): void {
  try { localStorage.setItem(ALERTS_STORAGE_KEY, String(value)); } catch { /* noop */ }
}

function nowInSeconds(): number {
  const d = new Date();
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
}

export interface ActiveTripHook {
  /** Non-null when a trip is in progress (phase !== 'idle'). */
  activeTrip: ActiveTripState | null;
  /** True as long as a trip is running (convenience alias). */
  tripActive: boolean;
  /**
   * When a session was restored from storage, whether it was minimized.
   * Null once the app has consumed / overridden the flag.
   */
  restoredMinimized: boolean | null;
  startTrip: (
    journey: Journey,
    transitAlternatives?: RouteInfo[][],
    corridorMembers?: Journey[],
  ) => void;
  /**
   * Swap the active itinerary to the corridor member that matches the line the
   * rider boarded (Moovit Switch). No-op when already on that line.
   */
  selectCorridorLine: (transitOrdinal: number, route: RouteInfo) => void;
  endTrip: () => void;
  /** Persist minimized flag for session restore after app close. */
  setMinimized: (minimized: boolean) => void;
  /** Toggle get-off alerts on/off (persisted to localStorage). */
  setAlertsEnabled: (enabled: boolean) => void;
}

/**
 * @param userLocation Shared live GPS from useAppState (continuous watch).
 * @param gpsAllowed   Whether geolocation permission is granted.
 */
export function useActiveTrip(
  userLocation: LatLon | null = null,
  gpsAllowed = true
): ActiveTripHook {
  const restored = useRef<TripSessionSnapshot | null | undefined>(undefined);
  if (restored.current === undefined) {
    restored.current = loadTripSession();
  }
  const initial = restored.current;

  const [journey, setJourney] = useState<Journey | null>(() => initial?.journey ?? null);
  const [legIndex, setLegIndex] = useState(0);
  const [phase, setPhase] = useState<TripPhase>(initial ? 'walking' : 'idle');
  const [progress, setProgress] = useState(0);
  const [nextAction, setNextAction] = useState<NextAction>({ title: 'Locating…', subtitle: '' });
  const [alertsEnabled, setAlertsEnabledState] = useState<boolean>(
    () => initial?.alertsEnabled ?? loadAlertsEnabled()
  );
  const [transitAlternatives, setTransitAlternatives] = useState<RouteInfo[][] | undefined>(
    () => initial?.transitAlternatives
  );
  const [corridorMembers, setCorridorMembers] = useState<Journey[]>(
    () => initial?.corridorMembers ?? (initial?.journey ? [initial.journey] : [])
  );
  const [minimized, setMinimizedState] = useState(() => initial?.minimized ?? false);
  const [restoredMinimized] = useState<boolean | null>(() =>
    initial ? Boolean(initial.minimized) : null
  );
  const startedAtRef = useRef<number>(initial?.startedAt ?? Date.now());

  // Keep screen awake while navigating.
  useWakeLock(journey !== null);

  // Mutable refs let the interval callback read the latest values without
  // stale closures while keeping the effect deps list minimal.
  const locationRef = useRef<LatLon | null>(null);
  locationRef.current = userLocation;

  const legIndexRef = useRef(legIndex);
  legIndexRef.current = legIndex;

  const journeyRef = useRef<Journey | null>(journey);
  journeyRef.current = journey;

  // 1-second tick: update phase, progress, and next action.
  useEffect(() => {
    if (!journey) return;

    const tick = () => {
      const j = journeyRef.current;
      if (!j) return;
      const nowSec = nowInSeconds();
      const pos = locationRef.current;
      const { legIndex: newLegIdx, phase: newPhase } = resolveActiveLeg(
        j,
        legIndexRef.current,
        pos,
        nowSec
      );
      setLegIndex(newLegIdx);
      setPhase(newPhase);
      const prog = computeLegProgress(j, newLegIdx, pos, nowSec);
      setProgress(prog);
      setNextAction(buildNextAction(j, newLegIdx, newPhase, nowSec, prog, pos));
    };

    tick(); // immediate first tick
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [journey]); // restart only when a new journey starts or trip ends

  const persist = useCallback(
    (
      j: Journey | null,
      alts: RouteInfo[][] | undefined,
      members: Journey[],
      isMinimized: boolean,
      alerts: boolean
    ) => {
      if (!j) {
        clearTripSession();
        return;
      }
      saveTripSession({
        journey: j,
        transitAlternatives: alts,
        corridorMembers: members.length > 0 ? members : [j],
        minimized: isMinimized,
        startedAt: startedAtRef.current,
        alertsEnabled: alerts,
      });
    },
    []
  );

  const startTrip = useCallback((
    j: Journey,
    alts?: RouteInfo[][],
    members?: Journey[],
  ) => {
    const nowSec = nowInSeconds();
    const pos = locationRef.current;
    const { legIndex: startLeg, phase: startPhase } = resolveActiveLeg(j, 0, pos, nowSec);
    const prog = computeLegProgress(j, startLeg, pos, nowSec);
    const memberList = members && members.length > 0 ? members : [j];
    startedAtRef.current = Date.now();
    setJourney(j);
    setLegIndex(startLeg);
    setPhase(startPhase);
    setProgress(prog);
    setNextAction(buildNextAction(j, startLeg, startPhase, nowSec, prog, pos));
    setTransitAlternatives(alts);
    setCorridorMembers(memberList);
    setMinimizedState(false);
    persist(j, alts, memberList, false, alertsEnabled);
  }, [alertsEnabled, persist]);

  const selectCorridorLine = useCallback((transitOrdinal: number, route: RouteInfo) => {
    const current = journeyRef.current;
    if (!current) return;
    if (journeyHasCorridorRoute(current, transitOrdinal, route)) return;
    const match = findCorridorMember(corridorMembers, transitOrdinal, route);
    if (!match) return;
    setJourney(match);
    persist(match, transitAlternatives, corridorMembers, minimized, alertsEnabled);
  }, [alertsEnabled, corridorMembers, minimized, persist, transitAlternatives]);

  const endTrip = useCallback(() => {
    // Clear the ref immediately so a same-tick setMinimized / persist
    // (e.g. App handleEndTrip) cannot re-save the session after clearTripSession.
    journeyRef.current = null;
    setJourney(null);
    setPhase('idle');
    setLegIndex(0);
    setProgress(0);
    setNextAction({ title: 'Locating…', subtitle: '' });
    setTransitAlternatives(undefined);
    setCorridorMembers([]);
    setMinimizedState(false);
    clearTripSession();
  }, []);

  const setMinimized = useCallback((value: boolean) => {
    setMinimizedState(value);
    const j = journeyRef.current;
    if (!j) return;
    persist(j, transitAlternatives, corridorMembers, value, alertsEnabled);
  }, [alertsEnabled, corridorMembers, persist, transitAlternatives]);

  const setAlertsEnabled = useCallback((enabled: boolean) => {
    setAlertsEnabledState(enabled);
    saveAlertsEnabled(enabled);
    const j = journeyRef.current;
    if (j) persist(j, transitAlternatives, corridorMembers, minimized, enabled);
  }, [corridorMembers, minimized, persist, transitAlternatives]);

  // Keep session snapshot fresh when the active journey changes (corridor swap).
  useEffect(() => {
    if (!journey) return;
    persist(journey, transitAlternatives, corridorMembers, minimized, alertsEnabled);
  }, [journey, transitAlternatives, corridorMembers, minimized, alertsEnabled, persist]);

  const tripActive = journey !== null && phase !== 'idle';

  const activeTrip: ActiveTripState | null =
    tripActive && journey
      ? {
          journey,
          phase,
          legIndex,
          progress,
          nextAction,
          gpsAllowed,
          position: userLocation,
          alertsEnabled,
          transitAlternatives,
        }
      : null;

  return {
    activeTrip,
    tripActive,
    restoredMinimized,
    startTrip,
    selectCorridorLine,
    endTrip,
    setMinimized,
    setAlertsEnabled,
  };
}
