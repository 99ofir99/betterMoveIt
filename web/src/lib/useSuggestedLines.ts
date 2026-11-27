/**
 * Lines-tab suggestions: lines toward the user's frequent destination, lines
 * from their own trips / stars, and lines leaving from stops near them.
 * Nearby departures are cached per ~200 m cell so tab switches are instant.
 */

import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { loadFavorites } from './favorites';
import { loadHistory } from './history';
import { journeyLines, rankPersonalLines, routeToLine } from './suggestedLines';
import type { Journey, LatLon, Line } from '../types';

const nearbyCache = new Map<string, { at: number; lines: Line[] }>();
/** The timetable rarely changes; refetch a cell after a while anyway. */
const NEARBY_TTL_MS = 30 * 60_000;

function cellKey(p: LatLon): string {
  return `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`;
}

export interface SuggestedLines {
  toward: Line[];
  personal: Line[];
  nearby: Line[];
  nearbyLoading: boolean;
}

export function useSuggestedLines(
  near: LatLon | null,
  destinationJourney: Journey | null | undefined,
  tick: number,
): SuggestedLines {
  const key = near ? cellKey(near) : null;
  const cached = key ? nearbyCache.get(key) : undefined;
  const [nearby, setNearby] = useState<Line[]>(cached?.lines ?? []);
  const [nearbyLoading, setNearbyLoading] = useState(Boolean(near) && !cached);

  useEffect(() => {
    if (!near || !key) {
      setNearby([]);
      setNearbyLoading(false);
      return;
    }
    const hit = nearbyCache.get(key);
    if (hit) setNearby(hit.lines);
    if (hit && Date.now() - hit.at < NEARBY_TTL_MS) {
      setNearbyLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setNearbyLoading(!hit);
    api
      .nearbyLines(near.lat, near.lon, 600, ctrl.signal)
      .then((res) => {
        if (ctrl.signal.aborted) return;
        const lines = (res.lines ?? []).map(routeToLine);
        nearbyCache.set(key, { at: Date.now(), lines });
        setNearby(lines);
      })
      .catch(() => {})
      .finally(() => {
        if (!ctrl.signal.aborted) setNearbyLoading(false);
      });
    return () => ctrl.abort();
    // `near` changes on every GPS tick; the ~100 m cell key is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const personal = useMemo(
    () => rankPersonalLines(loadHistory(), loadFavorites().lines.map((f) => f.line)),
    [tick],
  );
  const toward = useMemo(() => journeyLines(destinationJourney), [destinationJourney]);

  return { toward, personal, nearby, nearbyLoading };
}
