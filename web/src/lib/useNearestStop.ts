/**
 * Logic hook for the home "Nearest station" card (Moovit): the closest stop to the
 * user and the next departures of its lines. Refreshes every minute, when the app
 * comes back to the foreground, and when the user moves ~50 m.
 */

import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import type { DepartureGroup, LatLon, Stop, StopDeparturesResponse } from '../types';
import { readNearestStop, saveNearestStop, usableNearestStop, type NearestStopSnapshot } from './nearestStopCache';

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

function fromSnapshot(snap: NearestStopSnapshot): NearestStopResult {
  return {
    stop: snap.stop,
    distanceM: snap.distanceM,
    groups: snap.groups,
    // Saved departures are shown, but fresh ones are still on their way.
    loading: true,
  };
}

/** @param active Only refresh while the home screen shows (coming back refreshes). */
/**
 * `null` while still locating / loading (the card shows a placeholder), `false`
 * when there is no stop within reach (the card is left out).
 */
export function useNearestStop(
  userLocation: LatLon | null,
  active = true,
): NearestStopResult | null | false {
  const [origin, setOrigin] = useState<LatLon | null>(null);
  // Reopening the app: the card saved a few minutes ago shows at once.
  const [initial] = useState(() => usableNearestStop(readNearestStop(), null));
  const [result, setResult] = useState<NearestStopResult | null | false>(() =>
    initial ? fromSnapshot(initial) : null,
  );
  const [tick, setTick] = useState(0);
  const stopRef = useRef<{ stop: Stop; distanceM: number | null } | null>(
    initial ? { stop: initial.stop, distanceM: initial.distanceM } : null,
  );
  const originRef = useRef<LatLon | null>(null);
  originRef.current = origin;

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
    // Same spot as last time: show that stop now and ask for its departures right
    // away, alongside the nearby lookup instead of after it.
    const saved = usableNearestStop(readNearestStop(), origin);
    if (saved && stopRef.current?.stop.id !== saved.stop.id) {
      stopRef.current = { stop: saved.stop, distanceM: saved.distanceM };
      setResult(fromSnapshot(saved));
      setTick((n) => n + 1);
    }
    const ctrl = new AbortController();
    api
      .nearby(origin.lat, origin.lon, SEARCH_RADIUS_M, ctrl.signal)
      .then(({ stops }) => {
        const first = stops[0];
        if (!first) {
          stopRef.current = null;
          setResult(false);
          return;
        }
        const sameStop = stopRef.current?.stop.id === first.id;
        stopRef.current = { stop: first, distanceM: first.distance ?? null };
        setResult((prev) =>
          prev && prev.stop.id === first.id
            ? { ...prev, distanceM: first.distance ?? null }
            : { stop: first, distanceM: first.distance ?? null, groups: [], loading: true },
        );
        // Departures for this stop are already on their way when it was the saved one.
        if (!sameStop || !saved) setTick((n) => n + 1);
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
        const groups = sortGroupsBySoonest(res.departures);
        setResult({
          stop: current.stop,
          distanceM: stopRef.current.distanceM,
          groups,
          nextDeparture: res.nextDeparture ?? null,
          dow: res.time?.dow,
          loading: false,
        });
        const at = originRef.current;
        if (at) {
          saveNearestStop({
            origin: at,
            stop: current.stop,
            distanceM: stopRef.current.distanceM,
            groups: groups.slice(0, 6),
            savedAt: Date.now(),
          });
        }
      })
      .catch(() => {
        if (ctrl.signal.aborted) return;
        setResult((prev) => (prev ? { ...prev, loading: false } : prev));
      });
    return () => ctrl.abort();
  }, [tick]);

  return result;
}
