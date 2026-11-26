/**
 * Map-pick logic — reverse-geocode the map center as the user pans (Moovit).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import type { LatLon, Place } from '../../types';
import type { UseMapLocationPickerArgs } from './types';

export function useMapLocationPicker({ initialCenter, onConfirm }: UseMapLocationPickerArgs) {
  const [center, setCenter] = useState<LatLon>(initialCenter);
  const [label, setLabel] = useState('Choosing location…');
  const [resolving, setResolving] = useState(false);
  const geocodeSeq = useRef(0);

  useEffect(() => {
    const seq = ++geocodeSeq.current;
    const ctrl = new AbortController();
    setResolving(true);
    const timer = window.setTimeout(() => {
      void api.reverseGeocode(center.lat, center.lon, ctrl.signal).then((name) => {
        if (seq !== geocodeSeq.current || ctrl.signal.aborted) return;
        setLabel(name || `${center.lat.toFixed(5)}, ${center.lon.toFixed(5)}`);
        setResolving(false);
      });
    }, 280);
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [center.lat, center.lon]);

  const confirm = useCallback(() => {
    const place: Place = {
      label: label.trim() || `${center.lat.toFixed(5)}, ${center.lon.toFixed(5)}`,
      lat: center.lat,
      lon: center.lon,
      // Never attach a stopId — door-to-door egress walk uses this lat/lon.
    };
    onConfirm(place);
  }, [center.lat, center.lon, label, onConfirm]);

  return {
    center,
    setCenter,
    label,
    resolving,
    confirm,
  };
}
