/** Poll live vehicle positions when the map wants them. */

import { useEffect, useState } from 'react';
import { api } from './api';
import type { VehiclePosition } from '../types';

/** Client poll — server cache is ~8s; keep UI a bit faster than that. */
const POLL_MS = 5_000;

export function useVehicles(enabled: boolean, bbox?: [number, number, number, number] | null, routeId?: string | null) {
  const [vehicles, setVehicles] = useState<VehiclePosition[]>([]);
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  /** True until the first response after enabling (UI shows "Finding buses…"). */
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setVehicles([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
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
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const t = setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [enabled, bbox?.[0], bbox?.[1], bbox?.[2], bbox?.[3], routeId]);

  return { vehicles, configured, error, updatedAt, loading };
}
