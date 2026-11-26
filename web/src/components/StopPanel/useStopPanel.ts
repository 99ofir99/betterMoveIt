/**
 * Logic hook — loads stop departures + serving lines, polls every 30s,
 * and toggles favorite. Visuals live in sibling components.
 */

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { isFavoriteStop, toggleFavoriteStop } from '../../lib/favorites';
import type { Stop, StopDeparturesResponse } from '../../types';

export function useStopPanel(stopId: string, stop: Stop) {
  const [data, setData] = useState<StopDeparturesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [favored, setFavored] = useState(() => isFavoriteStop(stop.id));

  useEffect(() => {
    setFavored(isFavoriteStop(stop.id));
  }, [stop.id]);

  useEffect(() => {
    const ctrl = new AbortController();
    setError(null);
    api
      .stopDepartures(stopId, ctrl.signal)
      .then((d) => {
        if (!ctrl.signal.aborted) setData(d);
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(String((e as Error).message ?? e));
      });
    return () => ctrl.abort();
  }, [stopId, tick]);

  // Refresh the board every 30s so ETAs stay honest without hammering the API.
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const toggleFavourite = useCallback(() => {
    toggleFavoriteStop(stop);
    setFavored(isFavoriteStop(stop.id));
  }, [stop]);

  return {
    data,
    error,
    favored,
    toggleFavourite,
    loading: !data && !error,
  };
}
