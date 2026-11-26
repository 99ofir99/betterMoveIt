/**
 * Requests the Screen Wake Lock API while `active` is true.
 * Automatically re-acquires after the tab becomes visible again (iOS Safari
 * releases locks on backgrounding).
 * No-ops gracefully when the API is unavailable.
 */
import { useEffect } from 'react';

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wl = (navigator as any).wakeLock as WakeLock | undefined;
    if (!wl) return;

    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = (): void => {
      if (cancelled) return;
      wl.request('screen')
        .then((l) => {
          if (cancelled) {
            l.release().catch(() => {});
          } else {
            lock = l;
          }
        })
        .catch(() => {/* permission / hardware denial — not critical */});
    };

    acquire();

    const onVisibility = (): void => {
      if (document.visibilityState === 'visible' && !lock) acquire();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      lock?.release().catch(() => {});
      lock = null;
    };
  }, [active]);
}
