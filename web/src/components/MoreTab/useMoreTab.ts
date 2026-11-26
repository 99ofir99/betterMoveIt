/**
 * More tab logic — settings, alerts, history, panel navigation.
 */

import { useEffect, useState } from 'react';
import { loadSettings, saveSettings, type AppSettings } from '../../lib/settings';
import { loadHistory, removeHistoryEntry } from '../../lib/history';
import { api } from '../../lib/api';
import type { ServiceAlert } from '../../types';
import type { MorePanel } from './types';

export function useMoreTab() {
  const [panel, setPanel] = useState<MorePanel>('menu');
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [history, setHistory] = useState(() => loadHistory());
  const [alerts, setAlerts] = useState<ServiceAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    api
      .alerts(ctrl.signal)
      .then((r) => setAlerts(r.alerts))
      .catch(() => {
        /* best-effort */
      })
      .finally(() => setAlertsLoading(false));
    return () => ctrl.abort();
  }, []);

  const patch = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(saveSettings({ [key]: value }));
  };

  const removeHistory = (id: string) => {
    setHistory(removeHistoryEntry(id));
  };

  return {
    panel,
    setPanel,
    settings,
    patch,
    history,
    removeHistory,
    alerts,
    alertsLoading,
  };
}
