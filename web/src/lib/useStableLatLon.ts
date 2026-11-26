/**
 * Holds a LatLon that only advances after meaningful movement.
 * Stops continuous watchPosition jitter from thrashing search / fetch effects.
 */

import { useEffect, useState } from 'react';
import type { LatLon } from '../types';

/** ~100m — ignore typical GPS noise between watch ticks. */
export const STABLE_LOCATION_DELTA = 0.0009;

export function useStableLatLon(
  location: LatLon | null | undefined,
  delta = STABLE_LOCATION_DELTA,
): LatLon | null {
  const [stable, setStable] = useState<LatLon | null>(() =>
    location ? { lat: location.lat, lon: location.lon } : null,
  );

  useEffect(() => {
    if (!location) {
      setStable(null);
      return;
    }
    setStable((prev) => {
      if (
        !prev ||
        Math.abs(prev.lat - location.lat) >= delta ||
        Math.abs(prev.lon - location.lon) >= delta
      ) {
        return { lat: location.lat, lon: location.lon };
      }
      return prev;
    });
  }, [location?.lat, location?.lon, delta]);

  return stable;
}
