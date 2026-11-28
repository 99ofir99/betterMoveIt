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
import { t } from '../../lib/i18n';

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

/** Debounce for our own stop/line search. */
const MAIN_SEARCH_DELAY_MS = 160;
/** Debounce for the place geocoder; stops show first, places join right after. */
const PLACE_SEARCH_DELAY_MS = 350;

export function useGlobalSearch(bias: LatLon | null, target: SearchTarget) {
  const [q, setQ] = useState('');
  const [main, setMain] = useState<SearchResult[]>([]);
  const [places, setPlaces] = useState<SearchResult[]>([]);
  const [mainLoading, setMainLoading] = useState(false);
  const [placesLoading, setPlacesLoading] = useState(false);
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
      ? t('Choose starting point')
      : target === 'to'
        ? t('Where to?')
        : t('Search stops, lines, places…');

  const trimmed = q.trim();

  // Stops / lines: our own index, near-instant.
  useEffect(() => {
    if (!trimmed) {
      setMain([]);
      setMainLoading(false);
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    setMainLoading(true);
    const timer = setTimeout(async () => {
      setError(null);
      try {
        const next = await api.search(trimmed, stableBias, ctrl.signal);
        if (!ctrl.signal.aborted) setMain(next);
      } catch (e) {
        if (ctrl.signal.aborted || (e as Error).name === 'AbortError') return;
        setError(t('Search failed. Try again.'));
        setMain([]);
      } finally {
        if (!ctrl.signal.aborted) setMainLoading(false);
      }
    }, MAIN_SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [trimmed, stableBias?.lat, stableBias?.lon]);

  // Places: external geocoder (Nominatim allows ~1 request/second), so wait for
  // a short pause in typing. Old places are cleared so they never sit under a
  // newer query.
  useEffect(() => {
    setPlaces([]);
    if (trimmed.length < 2) {
      setPlacesLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setPlacesLoading(true);
    const timer = setTimeout(async () => {
      try {
        const next = await api.geocodeSearch(trimmed, stableBias, ctrl.signal);
        if (!ctrl.signal.aborted) setPlaces(next);
      } finally {
        if (!ctrl.signal.aborted) setPlacesLoading(false);
      }
    }, PLACE_SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [trimmed, stableBias?.lat, stableBias?.lon]);

  const results = useMemo(() => {
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
    return dedupeSearchResults(merged);
  }, [main, places, target]);

  // "Searching…" only while there is nothing to show yet; places then join quietly.
  const loading = mainLoading || (placesLoading && results.length === 0);

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
