/**
 * Hook that fetches service alerts and tracks per-session dismissals.
 */

import { useEffect, useState } from 'react';
import { api } from './api';
import type { ServiceAlert } from '../types';

export interface UseServiceAlertsResult {
  /** Alerts not yet dismissed by the user. */
  visible: ServiceAlert[];
  dismiss: (id: string) => void;
}

export function useServiceAlerts(enabled: boolean): UseServiceAlertsResult {
  const [alerts, setAlerts] = useState<ServiceAlert[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    api
      .alerts(ctrl.signal)
      .then((data) => {
        if (!ctrl.signal.aborted) setAlerts(data.alerts);
      })
      .catch(() => {/* offline / fetch error – silently ignore */});
    return () => ctrl.abort();
  }, [enabled]);

  const dismiss = (id: string) =>
    setDismissed((prev) => new Set([...prev, id]));

  const visible = alerts.filter((a) => !dismissed.has(a.id));

  return { visible, dismiss };
}
