/**
 * Thin React wrapper around navigator.geolocation.watchPosition.
 * Cleans up the watch automatically when `active` turns false or the
 * component unmounts.
 */

import { useEffect, useRef, useState } from 'react';
import type { LatLon } from '../types';

export interface WatchLocationResult {
  location: LatLon | null;
  error: string | null;
  /** False only after a PERMISSION_DENIED error; true otherwise. */
  allowed: boolean;
}

export function useWatchLocation(active: boolean): WatchLocationResult {
  const [location, setLocation] = useState<LatLon | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [allowed, setAllowed] = useState(true);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!('geolocation' in navigator)) {
      setError('Geolocation not supported on this device.');
      setAllowed(false);
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setAllowed(true);
        setError(null);
      },
      (err) => {
        setError(err.message);
        if (err.code === 1 /* PERMISSION_DENIED */) {
          setAllowed(false);
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [active]);

  return { location, error, allowed };
}
