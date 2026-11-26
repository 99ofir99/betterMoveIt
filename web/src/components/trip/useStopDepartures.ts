/**
 * Poll live / scheduled departures for a boarding stop.
 */

import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { DepartureGroup } from '../../types';

const POLL_MS = 15_000;

export function useStopDepartures(stopId: string | null | undefined): DepartureGroup[] {
  const [departures, setDepartures] = useState<DepartureGroup[]>([]);

  useEffect(() => {
    if (!stopId) {
      setDepartures([]);
      return;
    }
    let cancelled = false;
    const poll = () => {
      const ctrl = new AbortController();
      api
        .stopDepartures(stopId, ctrl.signal)
        .then((r) => {
          if (!cancelled) setDepartures(r.departures);
        })
        .catch(() => {
          if (!cancelled) setDepartures([]);
        });
      return ctrl;
    };
    let active = poll();
    const id = window.setInterval(() => {
      active.abort();
      active = poll();
    }, POLL_MS);
    return () => {
      cancelled = true;
      active.abort();
      window.clearInterval(id);
    };
  }, [stopId]);

  return departures;
}
