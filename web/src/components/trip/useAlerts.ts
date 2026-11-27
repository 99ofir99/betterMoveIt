/**
 * Fires browser Notification + haptic vibrate when the rider is approaching
 * or should alight.
 *
 * Rules:
 * - "Approaching" fires once when stopsLeft ≤ 1 and phase === 'onboard'.
 * - "Get off now" fires once when phase becomes 'alight'.
 * - Both are keyed to `legIndex` so they reset automatically on the next leg.
 * - Deduplication via a ref — never fires twice for the same event.
 * - Requests Notification permission on the first enable.
 */
import { useEffect, useRef } from 'react';
import type { ActiveTripState } from './types';
import { t } from '../../lib/i18n';

const APPROACHING_STOPS_THRESHOLD = 1;

type AlertKey = string;

/** Request notification permission; returns true when granted. */
async function requestPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function sendAlert(title: string, body: string): void {
  // Haptic feedback (best-effort).
  if ('vibrate' in navigator) {
    try { navigator.vibrate([200, 100, 200]); } catch { /* noop */ }
  }
  // Browser notification (only after permission already confirmed).
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification(title, { body, silent: false }); } catch { /* noop */ }
  }
}

export function useAlerts(
  state: ActiveTripState | null,
  alertsEnabled: boolean
): void {
  const firedRef = useRef<Set<AlertKey>>(new Set());

  // Clear history when the trip ends.
  useEffect(() => {
    if (!state) firedRef.current.clear();
  }, [state]);

  useEffect(() => {
    if (!alertsEnabled || !state) return;

    const { phase, legIndex, nextAction } = state;
    const stopsLeft = nextAction.stopsToAlight ?? Infinity;

    // ── Approaching (1 stop left, still onboard) ────────────────────────────
    if (phase === 'onboard' && stopsLeft <= APPROACHING_STOPS_THRESHOLD) {
      const key: AlertKey = `${legIndex}-approaching`;
      if (!firedRef.current.has(key)) {
        firedRef.current.add(key);
        void requestPermission().then((granted) => {
          if (granted || 'vibrate' in navigator) {
            sendAlert(t('Approaching your stop'), t('Get ready to get off soon'));
          }
        });
      }
    }

    // ── Alight ──────────────────────────────────────────────────────────────
    if (phase === 'alight') {
      const key: AlertKey = `${legIndex}-alight`;
      if (!firedRef.current.has(key)) {
        firedRef.current.add(key);
        void requestPermission().then((granted) => {
          if (granted || 'vibrate' in navigator) {
            sendAlert(t('Get off now! 🚨'), nextAction.title || t('Get off at this stop'));
          }
        });
      }
    }
    // Deps: watch the fields that gate each alert type.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertsEnabled, state?.phase, state?.legIndex, state?.nextAction.stopsToAlight]);
}
