/** Favourite state for planner place suggestions. */

import { useEffect, useState } from 'react';
import type { Place, SearchResult } from '../../types';
import {
  FAVORITES_CHANGED_EVENT,
  isFavoritePlace,
  isFavoriteStop,
  toggleFavoritePlace,
  toggleFavoriteStop,
} from '../../lib/favorites';

export function usePlaceFavorites() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onChanged = () => setTick((x) => x + 1);
    window.addEventListener(FAVORITES_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(FAVORITES_CHANGED_EVENT, onChanged);
  }, []);

  const isFavored = (r: SearchResult): boolean => {
    void tick;
    if (r.lat == null || r.lon == null) return false;
    if (r.kind === 'stop' && r.id) return isFavoriteStop(r.id);
    return isFavoritePlace({ label: r.name, lat: r.lat, lon: r.lon });
  };

  const toggle = (r: SearchResult) => {
    if (r.lat == null || r.lon == null) return;
    if (r.kind === 'stop' && r.id) {
      toggleFavoriteStop({
        id: r.id,
        name: r.name,
        lat: r.lat,
        lon: r.lon,
        code: r.code,
      });
      return;
    }
    const place: Place = { label: r.name, lat: r.lat, lon: r.lon };
    toggleFavoritePlace(place);
  };

  return { isFavored, toggle };
}
