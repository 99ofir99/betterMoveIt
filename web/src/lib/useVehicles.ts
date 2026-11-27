/** Poll live vehicle positions when the map wants them. */

import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import type { VehiclePosition } from '../types';

/** Client poll — server cache is ~8s; keep UI a bit faster than that. */
const POLL_MS = 5_000;
/** Snap the bbox to a ~5 km grid so GPS jitter doesn't restart the poll. */
const BBOX_GRID = 0.05;

function snap(v: number | undefined): number | undefined {
  return v == null ? v : Math.round(v / BBOX_GRID) * BBOX_GRID;
}

export function useVehicles(enabled: boolean, bbox?: [number, number, number, number] | null, routeId?: string | null) {
  const [vehicles, setVehicles] = useState<VehiclePosition[]>([]);
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  /**
   * True only until the first response after enabling. Later restarts (bbox
   * moved) keep showing the last answer, so the UI never flips back to
   * "Finding buses…" between polls.
   */
  const [loading, setLoading] = useState(false);
  const hasAnswerRef = useRef(false);
  const b0 = snap(bbox?.[0]);
  const b1 = snap(bbox?.[1]);
  const b2 = snap(bbox?.[2]);
  const b3 = snap(bbox?.[3]);

  useEffect(() => {
    if (!enabled) {
      setVehicles([]);
      setLoading(false);
      hasAnswerRef.current = false;
      return;
    }
    let cancelled = false;
    if (!hasAnswerRef.current) setLoading(true);
    const snapped: [number, number, number, number] | undefined =
      b0 != null && b1 != null && b2 != null && b3 != null ? [b0, b1, b2, b3] : undefined;
    const load = async () => {
      try {
        const r = await api.vehicles({ bbox: snapped, routeId: routeId ?? undefined });
        if (cancelled) return;
        setConfigured(r.configured);
        setVehicles(r.vehicles);
        setUpdatedAt(r.updatedAt);
        setError(r.error);
      } catch (e) {
        if (!cancelled) setError(String((e as Error).message ?? e));
      } finally {
        if (!cancelled) {
          hasAnswerRef.current = true;
          setLoading(false);
        }
      }
    };
    void load();
    const t = setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [enabled, b0, b1, b2, b3, routeId]);

  return { vehicles, configured, error, updatedAt, loading };
}
