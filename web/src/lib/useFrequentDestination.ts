/**
 * Logic hook — determines the user's most-likely frequent destination
 * (top saved place, then most recent trip history), plans a quick route
 * from their current location, and derives display-ready values.
 *
 * Visual rendering lives in FrequentDestinationCard.tsx.
 */

import { useEffect, useRef, useState } from 'react';
import { loadFavorites } from './favorites';
import { loadHistory } from './history';
import { api } from './api';
import { normalizeJourneyTiming } from './journeyTiming';
import { sortJourneys } from './sort';
import { bestBoardingMinutes } from './boardingEta';
import { minutesUntilDepart, secondsSinceLocalMidnight } from './format';
import { dayOffsetOf, journeyHasDeparted, markNextDay, plannedRideMinMinutes, tagServiceDate } from './journeyStale';
import type { Journey, LatLon, Place, TransitLeg } from '../types';
import type { FrequentDestResult } from '../components/home/types';
import { getLocale } from './i18n';
import { isAtDestination, pickFrequentDestination } from './atDestination';

/** How long the card waits for a GPS fix before falling back to the first saved place. */
const LOCATION_WAIT_MS = 8000;

/** ~50m — ignore GPS jitter so we don't abort / re-plan on every watch tick. */
const REPLAN_DELTA = 0.00045;

/** Seconds from midnight, Israel time (feed clock). */
function nowSeconds(): number {
  return secondsSinceLocalMidnight();
}

/** Format seconds-from-midnight as "h:mm AM/PM". */
function fmtArrival(secs: number): string {
  const h = Math.floor(secs / 3600) % 24;
  const m = Math.floor((secs % 3600) / 60);
  if (getLocale() === 'he') return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

type BoardLeave = {
  minutes: number;
  departure: number;
  live: boolean;
  confidence?: import('../types').ArrivalConfidence;
  source?: import('../types').ArrivalSource;
} | null;

/** Derive display values from a planned journey (schedule fallback). */
function deriveDisplay(
  journey: Journey,
  boardLeave: BoardLeave = null
): Pick<
  FrequentDestResult,
  | 'leavesInMin'
  | 'leavesTomorrow'
  | 'leavesDepartureSec'
  | 'leavesLive'
  | 'leavesConfidence'
  | 'leavesSource'
  | 'arriveLabel'
  | 'durationMin'
  | 'boardingStop'
> {
  const now = nowSeconds();
  const scheduled = minutesUntilDepart(journey.departSeconds, now, dayOffsetOf(journey));
  const scheduleMin = scheduled.minutes;
  // Prefer live board / vehicle ETA when available (Moovit).
  const leavesInMin =
    boardLeave != null && boardLeave.minutes >= 0 ? boardLeave.minutes : scheduleMin;
  const leavesDepartureSec = boardLeave?.departure ?? journey.departSeconds;
  const leavesLive = Boolean(boardLeave?.live);
  const leavesConfidence =
    boardLeave?.confidence ?? (leavesLive ? 'high' : 'none');
  const leavesSource = boardLeave?.source ?? (leavesLive ? 'live' : 'schedule');
  const arriveLabel = fmtArrival(journey.arrivalSeconds);
  const durationMin = Math.round(journey.durationSec / 60);

  const firstTransit = journey.legs.find((l): l is TransitLeg => l.mode === 'transit');
  const boardingStop = firstTransit?.fromName ?? null;

  return {
    leavesInMin,
    leavesTomorrow: Boolean(journey.nextDay),
    leavesDepartureSec,
    leavesLive,
    leavesConfidence,
    leavesSource,
    arriveLabel,
    durationMin,
    boardingStop,
  };
}

const emptyDerived = {
  leavesInMin: null,
  leavesDepartureSec: null,
  leavesLive: false,
  leavesConfidence: 'none' as const,
  leavesSource: 'schedule' as const,
  arriveLabel: null,
  durationMin: null,
  boardingStop: null,
};

function samePlace(a: Place, b: Place): boolean {
  return a.lat === b.lat && a.lon === b.lon && a.label === b.label;
}

/**
 * Returns the user's most likely frequent destination and a quick trip plan.
 * @param userLocation Current GPS position (null while still locating).
 * @param tick         Increment to force a refresh (e.g. after editing favorites).
 */
export function useFrequentDestination(
  userLocation: LatLon | null,
  tick = 0,
): FrequentDestResult | null {
  const [result, setResult] = useState<FrequentDestResult | null>(null);
  /** Origin used for planning — only advances when GPS moves ~50m+. */
  const [planOrigin, setPlanOrigin] = useState<LatLon | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const journeyRef = useRef<Journey | null>(null);
  /** Bumped when the planned bus has left, so the card plans again from now. */
  const [replan, setReplan] = useState(0);
  const lastReplanRef = useRef(0);
  /** At most one automatic re-plan a minute, so a skewed device clock can't loop. */
  const requestReplan = () => {
    if (Date.now() - lastReplanRef.current < 60_000) return;
    lastReplanRef.current = Date.now();
    setReplan((n) => n + 1);
  };

  // While there is no fix yet the card shows a skeleton, not a guessed
  // destination (the user may be standing at it). Give up after a while.
  const [locationWaitOver, setLocationWaitOver] = useState(false);
  useEffect(() => {
    if (userLocation) return;
    const id = window.setTimeout(() => setLocationWaitOver(true), LOCATION_WAIT_MS);
    return () => window.clearTimeout(id);
  }, [userLocation == null]);

  // Stabilize GPS so continuous watchPosition updates don't thrash planning.
  useEffect(() => {
    if (!userLocation) {
      setPlanOrigin(null);
      return;
    }
    setPlanOrigin((prev) => {
      if (
        !prev ||
        Math.abs(prev.lat - userLocation.lat) >= REPLAN_DELTA ||
        Math.abs(prev.lon - userLocation.lon) >= REPLAN_DELTA
      ) {
        return { lat: userLocation.lat, lon: userLocation.lon };
      }
      return prev;
    });
  }, [userLocation?.lat, userLocation?.lon]);

  useEffect(() => {
    // Candidates: saved places in order, then recent trips. Skip any place the
    // user is already at, so at home the card shows work (the next saved place).
    const favs = loadFavorites();
    const candidates: Place[] = [
      ...favs.places.map((f) => ({ label: f.label, lat: f.place.lat, lon: f.place.lon })),
      ...loadHistory().map((h) => h.to),
    ];
    const dest: Place | null = pickFrequentDestination(candidates, planOrigin);

    if (!dest) {
      setResult(null);
      journeyRef.current = null;
      return;
    }

    const destSnap = dest; // capture for closure

    if (!planOrigin) {
      // No fix yet: skeleton; no fix at all: destination name with "tap to plan".
      setResult({
        place: destSnap,
        journey: null,
        loading: !locationWaitOver,
        pending: !locationWaitOver,
        ...emptyDerived,
      });
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    // Soft refresh: keep showing the last journey instead of flipping to
    // "Planning route…" when we already have a plan for this destination.
    setResult((prev) => {
      if (prev && samePlace(prev.place, destSnap) && prev.journey) {
        return prev;
      }
      return prev
        ? { ...prev, place: destSnap, loading: true }
        : {
            place: destSnap,
            journey: null,
            loading: true,
            ...emptyDerived,
          };
    });

    api
      .plan(planOrigin, destSnap, {}, ctrl.signal)
      .then(async (res) => {
        if (ctrl.signal.aborted) return;
        // Fastest = shortest duration (same default as results).
        const planned = res.serviceDate
          ? tagServiceDate(res.journeys, res.serviceDate)
          : res.nextDay
            ? markNextDay(res.journeys)
            : res.journeys;
        const ranked = sortJourneys(planned.map(normalizeJourneyTiming), 'fastest');
        const journey: Journey | null = ranked[0] ?? null;
        if (isAtDestination(planOrigin, destSnap, journey)) {
          journeyRef.current = null;
          setResult(null);
          return;
        }
        journeyRef.current = journey;

        let boardLeave: BoardLeave = null;
        const firstTransit = journey?.legs.find((l): l is TransitLeg => l.mode === 'transit');
        if (firstTransit?.from.stopId) {
          try {
            const board = await api.stopDepartures(firstTransit.from.stopId, ctrl.signal);
            if (!ctrl.signal.aborted) {
              const best = bestBoardingMinutes(
                board.departures,
                firstTransit,
                undefined,
                plannedRideMinMinutes(firstTransit.departure, undefined, dayOffsetOf(firstTransit))
              );
              if (best) boardLeave = best;
            }
          } catch {
            /* schedule fallback */
          }
        }

        if (ctrl.signal.aborted) return;
        const derived = journey ? deriveDisplay(journey, boardLeave) : { ...emptyDerived };
        setResult({ place: destSnap, journey, loading: false, ...derived });
      })
      .catch(() => {
        if (!ctrl.signal.aborted) {
          setResult((prev) => (prev ? { ...prev, loading: false, pending: false } : null));
        }
      });

    // Refresh live boarding ETA every 25s; re-plan only once the planned bus has left.
    const onVisible = () => {
      const j = journeyRef.current;
      if (document.visibilityState !== 'hidden' && j && journeyHasDeparted(j)) {
        requestReplan();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    const refreshId = window.setInterval(() => {
      const j = journeyRef.current;
      if (j && journeyHasDeparted(j)) {
        requestReplan();
        return;
      }
      const firstTransit = j?.legs.find((l): l is TransitLeg => l.mode === 'transit');
      if (!j || !firstTransit?.from.stopId) return;
      void api
        .stopDepartures(firstTransit.from.stopId)
        .then((board) => {
          const best = bestBoardingMinutes(
                board.departures,
                firstTransit,
                undefined,
                plannedRideMinMinutes(firstTransit.departure, undefined, dayOffsetOf(firstTransit))
              );
          if (best == null) return;
          setResult((prev) =>
            prev && prev.journey
              ? { ...prev, ...deriveDisplay(prev.journey, best) }
              : prev
          );
        })
        .catch(() => {});
    }, 25_000);

    return () => {
      ctrl.abort();
      window.clearInterval(refreshId);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planOrigin?.lat, planOrigin?.lon, tick, replan, locationWaitOver]);

  return result;
}
