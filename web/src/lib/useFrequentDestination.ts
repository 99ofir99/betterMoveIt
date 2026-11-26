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
import type { Journey, LatLon, Place, TransitLeg } from '../types';
import type { FrequentDestResult } from '../components/home/types';

/** ~50m — ignore GPS jitter so we don't abort / re-plan on every watch tick. */
const REPLAN_DELTA = 0.00045;

/** Seconds from midnight for the current local time. */
function nowSeconds(): number {
  const d = new Date();
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
}

/** Format seconds-from-midnight as "h:mm AM/PM". */
function fmtArrival(secs: number): string {
  const h = Math.floor(secs / 3600) % 24;
  const m = Math.floor((secs % 3600) / 60);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

/** Derive display values from a planned journey (schedule fallback). */
function deriveDisplay(
  journey: Journey,
  liveMinutes: number | null = null
): Pick<FrequentDestResult, 'leavesInMin' | 'arriveLabel' | 'durationMin' | 'boardingStop'> {
  const now = nowSeconds();
  let waitSec = journey.departSeconds - now;
  if (waitSec < -12 * 3600) waitSec += 86400;
  const rawMin = Math.round(waitSec / 60);
  const scheduleMin = rawMin >= 0 ? rawMin : null;
  // Prefer live board / vehicle ETA when available (Moovit).
  const leavesInMin = liveMinutes != null && liveMinutes >= 0 ? liveMinutes : scheduleMin;
  const arriveLabel = fmtArrival(journey.arrivalSeconds);
  const durationMin = Math.round(journey.durationSec / 60);

  const firstTransit = journey.legs.find((l): l is TransitLeg => l.mode === 'transit');
  const boardingStop = firstTransit?.fromName ?? null;

  return { leavesInMin, arriveLabel, durationMin, boardingStop };
}

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
    // Pick the best destination from saved places or recent history.
    const favs = loadFavorites();
    let dest: Place | null = null;

    if (favs.places.length > 0) {
      const f = favs.places[0];
      dest = { label: f.label, lat: f.place.lat, lon: f.place.lon };
    } else {
      const hist = loadHistory();
      if (hist.length > 0) dest = hist[0].to;
    }

    if (!dest) {
      setResult(null);
      journeyRef.current = null;
      return;
    }

    const destSnap = dest; // capture for closure

    if (!planOrigin) {
      // Show destination name without journey detail.
      setResult({
        place: destSnap,
        journey: null,
        loading: false,
        leavesInMin: null,
        arriveLabel: null,
        durationMin: null,
        boardingStop: null,
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
            leavesInMin: null,
            arriveLabel: null,
            durationMin: null,
            boardingStop: null,
          };
    });

    api
      .plan(planOrigin, destSnap, {}, ctrl.signal)
      .then(async (res) => {
        if (ctrl.signal.aborted) return;
        // Fastest = shortest duration (same default as results).
        const ranked = sortJourneys(res.journeys.map(normalizeJourneyTiming), 'fastest');
        const journey: Journey | null = ranked[0] ?? null;
        journeyRef.current = journey;

        let liveMinutes: number | null = null;
        const firstTransit = journey?.legs.find((l): l is TransitLeg => l.mode === 'transit');
        if (firstTransit?.from.stopId) {
          try {
            const board = await api.stopDepartures(firstTransit.from.stopId, ctrl.signal);
            if (!ctrl.signal.aborted) {
              const best = bestBoardingMinutes(board.departures, firstTransit);
              if (best) liveMinutes = best.minutes;
            }
          } catch {
            /* schedule fallback */
          }
        }

        if (ctrl.signal.aborted) return;
        const derived = journey
          ? deriveDisplay(journey, liveMinutes)
          : {
              leavesInMin: null,
              arriveLabel: null,
              durationMin: null,
              boardingStop: null,
            };
        setResult({ place: destSnap, journey, loading: false, ...derived });
      })
      .catch(() => {
        if (!ctrl.signal.aborted) {
          setResult((prev) => (prev ? { ...prev, loading: false } : null));
        }
      });

    // Refresh live boarding ETA every 25s without re-planning the whole trip.
    const refreshId = window.setInterval(() => {
      const j = journeyRef.current;
      const firstTransit = j?.legs.find((l): l is TransitLeg => l.mode === 'transit');
      if (!j || !firstTransit?.from.stopId) return;
      void api
        .stopDepartures(firstTransit.from.stopId)
        .then((board) => {
          const best = bestBoardingMinutes(board.departures, firstTransit);
          if (best == null) return;
          setResult((prev) =>
            prev && prev.journey
              ? { ...prev, ...deriveDisplay(prev.journey, best.minutes) }
              : prev
          );
        })
        .catch(() => {});
    }, 25_000);

    return () => {
      ctrl.abort();
      window.clearInterval(refreshId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planOrigin?.lat, planOrigin?.lon, tick]);

  return result;
}
