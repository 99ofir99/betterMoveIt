/**
 * Global search logic — query, results fetch, favourite toggles.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { dedupePlaces, dedupeSearchResults } from '../../lib/dedupeSearch';
import {
  FAVORITES_CHANGED_EVENT,
  isFavoriteLine,
  isFavoritePlace,
  isFavoriteStop,
  loadFavorites,
  toggleFavoriteLine,
  toggleFavoritePlace,
  toggleFavoriteStop,
} from '../../lib/favorites';
import { loadHistory } from '../../lib/history';
import { useStableLatLon } from '../../lib/useStableLatLon';
import type { LatLon, Line, Place, SearchResult, Stop } from '../../types';
import type { SearchTarget } from './types';

function isLocationFavored(place: Place): boolean {
  if (place.stopId && isFavoriteStop(place.stopId)) return true;
  return isFavoritePlace(place);
}

function toggleLocationFavorite(place: Place): void {
  if (place.stopId) {
    toggleFavoriteStop({
      id: place.stopId,
      name: place.label,
      lat: place.lat,
      lon: place.lon,
    });
    return;
  }
  toggleFavoritePlace(place);
}

export function useGlobalSearch(bias: LatLon | null, target: SearchTarget) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favTick, setFavTick] = useState(0);
  // Live GPS updates every ~1s; keep bias stable so ranked stops don't jump.
  const stableBias = useStableLatLon(bias);

  useEffect(() => {
    const onChanged = () => setFavTick((x) => x + 1);
    window.addEventListener(FAVORITES_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(FAVORITES_CHANGED_EVENT, onChanged);
  }, []);

  const favs = useMemo(() => loadFavorites(), [favTick]);

  /** Unique places only — one row per location, newest first. */
  const recentPlaces = useMemo(() => {
    const collected: Place[] = [];
    for (const h of loadHistory()) {
      if (target === 'from') collected.push(h.from);
      else if (target === 'to') collected.push(h.to);
      else {
        collected.push(h.to, h.from);
      }
    }
    return dedupePlaces(collected).slice(0, 8);
  }, [target, favTick]);

  const placeholder =
    target === 'from'
      ? 'Choose starting point'
      : target === 'to'
        ? 'Where to?'
        : 'Search stops, lines, places…';

  useEffect(() => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const [main, places] = await Promise.all([
          api.search(trimmed, stableBias, ctrl.signal),
          trimmed.length >= 2
            ? api.geocodeSearch(trimmed, stableBias, ctrl.signal)
            : Promise.resolve<SearchResult[]>([]),
        ]);
        if (ctrl.signal.aborted) return;
        const existing = new Set(main.map((r) => `${r.lat?.toFixed(4)},${r.lon?.toFixed(4)}`));
        const uniquePlaces = places.filter(
          (p) =>
            p.lat != null &&
            p.lon != null &&
            !existing.has(`${p.lat.toFixed(4)},${p.lon.toFixed(4)}`)
        );
        const merged =
          target === 'any'
            ? [...main, ...uniquePlaces]
            : [...main.filter((r) => r.kind !== 'line'), ...uniquePlaces];
        setResults(dedupeSearchResults(merged));
      } catch (e) {
        if (ctrl.signal.aborted || (e as Error).name === 'AbortError') return;
        setError('Search failed. Try again.');
        setResults([]);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 160);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, stableBias?.lat, stableBias?.lon, target]);

  const placeIsFavored = useCallback(
    (place: Place) => isLocationFavored(place),
    [favTick]
  );

  const stopIsFavored = useCallback(
    (stopId: string) => isFavoriteStop(stopId),
    [favTick]
  );

  const lineIsFavored = useCallback(
    (lineId: string) => isFavoriteLine(lineId),
    [favTick]
  );

  const togglePlace = useCallback((place: Place) => {
    toggleLocationFavorite(place);
  }, []);

  const toggleStop = useCallback((stop: Stop) => {
    toggleFavoriteStop(stop);
  }, []);

  const toggleLine = useCallback((line: Line) => {
    toggleFavoriteLine(line);
  }, []);

  return {
    q,
    setQ,
    results,
    loading,
    error,
    favs,
    recentPlaces,
    placeholder,
    placeIsFavored,
    stopIsFavored,
    lineIsFavored,
    togglePlace,
    toggleStop,
    toggleLine,
  };
}
