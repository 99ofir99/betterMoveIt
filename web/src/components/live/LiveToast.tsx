/**
 * Short answer after pressing "Live location": how many buses of the tracked
 * lines are now on the map, or that none is transmitting. Small, one line,
 * dismisses itself — the bus markers themselves are the live display.
 */

import { useEffect } from 'react';
import { t } from '../../lib/i18n';
import type { LiveToastProps } from './types';

const AUTO_HIDE_MS = 4000;

export function LiveToast({ toast, lines, onDismiss, onTurnOff }: LiveToastProps) {
  useEffect(() => {
    if (!toast || toast.count == null) return;
    const id = window.setTimeout(onDismiss, AUTO_HIDE_MS);
    return () => window.clearTimeout(id);
  }, [toast, onDismiss]);

  if (!toast) return null;
  const line = lines.slice(0, 3).join(', ');
  const text =
    toast.count == null
      ? t('Looking for buses…')
      : toast.count === 0
        ? t('No line {line} bus is sending its location right now', { line })
        : toast.count === 1
          ? t('1 bus of line {line} on the map', { line })
          : t('{n} buses of line {line} on the map', { n: toast.count, line });

  return (
    <div
      key={toast.key}
      className={`live-toast${toast.count === 0 ? ' live-toast--empty' : ''}`}
      role="status"
      aria-live="polite"
    >
      <span className="live-toast__dot" aria-hidden="true" />
      <span className="live-toast__text">{text}</span>
      <button type="button" className="live-toast__off" onClick={onTurnOff}>
        {t('Turn off')}
      </button>
    </div>
  );
}
