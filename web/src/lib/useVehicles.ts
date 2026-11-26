/** Poll live vehicle positions when the map wants them. */

import { useEffect, useState } from 'react';
import { api } from './api';
import type { VehiclePosition } from '../types';

export function useVehicles(enabled: boolean, bbox?: [number, number, number, number] | null, routeId?: string | null) {
  const [vehicles, setVehicles] = useState<VehiclePosition[]>([]);
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setVehicles([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const r = await api.vehicles({ bbox: bbox ?? undefined, routeId: routeId ?? undefined });
        if (cancelled) return;
        setConfigured(r.configured);
        setVehicles(r.vehicles);
        setUpdatedAt(r.updatedAt);
        setError(r.error);
      } catch (e) {
        if (!cancelled) setError(String((e as Error).message ?? e));
      }
    };
    void load();
    const t = setInterval(() => void load(), 15_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [enabled, bbox?.[0], bbox?.[1], bbox?.[2], bbox?.[3], routeId]);

  return { vehicles, configured, error, updatedAt };
}
