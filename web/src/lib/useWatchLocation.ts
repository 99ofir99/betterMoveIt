/**
 * Thin React wrapper around navigator.geolocation.watchPosition.
 * Cleans up the watch automatically when `active` turns false or the
 * component unmounts.
 */

import { useEffect, useRef, useState } from 'react';
import type { LatLon } from '../types';
import { t } from './i18n';

export interface WatchLocationResult {
  location: LatLon | null;
  error: string | null;
  /** False only after a PERMISSION_DENIED error; true otherwise. */
  allowed: boolean;
}

/** A quick cached fix is used only when at least this precise (metres). */
const QUICK_FIX_MAX_ACCURACY_M = 150;

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
      setError(t('Geolocation not supported on this device.'));
      setAllowed(false);
      return;
    }

    // A high-accuracy watch can take several seconds for its first fix. A recent
    // fix the phone already has (Wi-Fi / last GPS) is usually instant: use it if
    // it is precise enough to pick the right stop, until the watch reports.
    let watchReported = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (watchReported || pos.coords.accuracy > QUICK_FIX_MAX_ACCURACY_M) return;
        setLocation((prev) => prev ?? { lat: pos.coords.latitude, lon: pos.coords.longitude });
        setAllowed(true);
      },
      () => undefined,
      { enableHighAccuracy: false, maximumAge: 120_000, timeout: 4000 }
    );

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        watchReported = true;
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
