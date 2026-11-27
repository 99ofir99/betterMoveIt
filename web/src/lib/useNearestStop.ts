/**
 * Logic hook for the home "Nearest station" card (Moovit): the closest stop to the
 * user and the next departures of its lines. Refreshes every minute, when the app
 * comes back to the foreground, and when the user moves ~50 m.
 */

import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import type { DepartureGroup, LatLon, Stop, StopDeparturesResponse } from '../types';

export interface NearestStopResult {
  stop: Stop;
  /** Metres from the user, as the server measured it. */
  distanceM: number | null;
  /** Lines with a departure coming up, soonest first. */
  groups: DepartureGroup[];
  /** When nothing is coming soon: the first departure later on (e.g. after Shabbat). */
  nextDeparture?: StopDeparturesResponse['nextDeparture'];
  /** Feed day of week, for naming the day of nextDeparture. */
  dow?: number;
  loading: boolean;
}

const REFRESH_MS = 60_000;
/** ~50 m in degrees: smaller GPS jitter doesn't refetch. */
const MOVE_DELTA = 0.0005;
const SEARCH_RADIUS_M = 800;

/** Soonest first; lines with nothing coming are dropped. */
export function sortGroupsBySoonest(groups: DepartureGroup[]): DepartureGroup[] {
  return groups
    .filter((g) => g.next.length > 0)
    .slice()
    .sort((a, b) => a.next[0].minutes - b.next[0].minutes);
}

/** @param active Only refresh while the home screen shows (coming back refreshes). */
export function useNearestStop(userLocation: LatLon | null, active = true): NearestStopResult | null {
  const [origin, setOrigin] = useState<LatLon | null>(null);
  const [result, setResult] = useState<NearestStopResult | null>(null);
  const [tick, setTick] = useState(0);
  const stopRef = useRef<{ stop: Stop; distanceM: number | null } | null>(null);

  useEffect(() => {
    if (!userLocation) return;
    setOrigin((prev) =>
      !prev ||
      Math.abs(prev.lat - userLocation.lat) >= MOVE_DELTA ||
      Math.abs(prev.lon - userLocation.lon) >= MOVE_DELTA
        ? { lat: userLocation.lat, lon: userLocation.lon }
        : prev,
    );
  }, [userLocation?.lat, userLocation?.lon]);

  // Minute refresh + on return to the foreground, only while shown.
  useEffect(() => {
    if (!active) return;
    setTick((n) => n + 1);
    const bump = () => {
      if (document.visibilityState === 'visible') setTick((n) => n + 1);
    };
    const id = window.setInterval(bump, REFRESH_MS);
    document.addEventListener('visibilitychange', bump);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', bump);
    };
  }, [active]);

  // A new origin looks the nearest stop up again.
  useEffect(() => {
    if (!origin) return;
    const ctrl = new AbortController();
    api
      .nearby(origin.lat, origin.lon, SEARCH_RADIUS_M, ctrl.signal)
      .then(({ stops }) => {
        const first = stops[0];
        if (!first) {
          stopRef.current = null;
          setResult(null);
          return;
        }
        stopRef.current = { stop: first, distanceM: first.distance ?? null };
        setResult((prev) =>
          prev?.stop.id === first.id
            ? prev
            : { stop: first, distanceM: first.distance ?? null, groups: [], loading: true },
        );
        setTick((n) => n + 1);
      })
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [origin]);

  // Departures for the current stop.
  useEffect(() => {
    const current = stopRef.current;
    if (!current) return;
    const ctrl = new AbortController();
    api
      .stopDepartures(current.stop.id, ctrl.signal)
      .then((res) => {
        if (stopRef.current?.stop.id !== current.stop.id) return;
        setResult({
          stop: current.stop,
          distanceM: current.distanceM,
          groups: sortGroupsBySoonest(res.departures),
          nextDeparture: res.nextDeparture ?? null,
          dow: res.time?.dow,
          loading: false,
        });
      })
      .catch(() => {
        if (ctrl.signal.aborted) return;
        setResult((prev) => (prev ? { ...prev, loading: false } : prev));
      });
    return () => ctrl.abort();
  }, [tick]);

  return result;
}
