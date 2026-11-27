/**
 * Nearby / Stations board data — GPS-stable fetch + coverage check.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { friendlyError } from '../../lib/friendlyError';
import { api } from '../../lib/api';
import type { LatLon, NearbyStopBoard } from '../../types';

/** ~100m — ignore GPS jitter so watchPosition doesn't refetch every tick. */
const FETCH_DELTA = 0.0009;

function outsideCoverage(
  point: LatLon,
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number } | undefined,
): boolean {
  if (!bbox) return false;
  return (
    point.lat < bbox.minLat ||
    point.lat > bbox.maxLat ||
    point.lon < bbox.minLon ||
    point.lon > bbox.maxLon
  );
}

export function useNearbyTab(center: LatLon, locating: boolean) {
  const [stops, setStops] = useState<NearbyStopBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [outOfCoverage, setOutOfCoverage] = useState(false);
  /** Stable origin for board fetch — advances on ~100m move or explicit Locate. */
  const [fetchCenter, setFetchCenter] = useState<LatLon>(center);
  const [locateTick, setLocateTick] = useState(0);
  const wasLocatingRef = useRef(false);

  const load = useCallback(async (lat: number, lon: number, signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.nearbyBoard(lat, lon, 1200, signal);
      setStops(r.stops);
      if (r.stops.length === 0) {
        try {
          const health = await api.health(signal);
          const bbox = health.bbox && !Array.isArray(health.bbox) ? health.bbox : undefined;
          setOutOfCoverage(outsideCoverage({ lat, lon }, bbox));
        } catch {
          setOutOfCoverage(false);
        }
      } else {
        setOutOfCoverage(false);
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setError(friendlyError("Couldn't load nearby stops. Try again in a moment."));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setFetchCenter((prev) => {
      if (
        Math.abs(prev.lat - center.lat) >= FETCH_DELTA ||
        Math.abs(prev.lon - center.lon) >= FETCH_DELTA
      ) {
        return { lat: center.lat, lon: center.lon };
      }
      return prev;
    });
  }, [center.lat, center.lon]);

  useEffect(() => {
    if (wasLocatingRef.current && !locating) {
      setFetchCenter({ lat: center.lat, lon: center.lon });
      setLocateTick((n) => n + 1);
    }
    wasLocatingRef.current = locating;
  }, [locating, center.lat, center.lon]);

  // Back online after a failed load: fetch again instead of leaving the error up.
  useEffect(() => {
    const retry = () => setLocateTick((n) => n + 1);
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void load(fetchCenter.lat, fetchCenter.lon, ctrl.signal);
    return () => ctrl.abort();
  }, [fetchCenter.lat, fetchCenter.lon, locateTick, load]);

  return { stops, loading, error, outOfCoverage };
}
