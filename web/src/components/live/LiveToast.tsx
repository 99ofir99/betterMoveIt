/**
 * Short answer after pressing "Live location": how many buses of the tracked
 * lines are now on the map, or that none is transmitting. Two short lines (status + which lines),
 * never truncated, dismisses itself — the bus markers themselves are the live display.
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
  const shown = lines.slice(0, 3).join(', ');
  const many = lines.length > 1;
  const linesLabel = shown ? (many ? t('Lines {lines}', { lines: shown }) : t('Line {line}', { line: shown })) : '';
  let title: string;
  let detail = linesLabel;
  if (toast.count == null) {
    title = t('Looking for live buses…');
  } else if (toast.count === 0) {
    title = t('No live location right now');
    detail = shown
      ? many
        ? t('Lines {lines} are not sending their location', { lines: shown })
        : t('Line {line} is not sending its location', { line: shown })
      : '';
  } else if (toast.count === 1) {
    title = t('1 live bus on the map');
  } else {
    title = t('{n} live buses on the map', { n: toast.count });
  }

  return (
    <div
      key={toast.key}
      className={`live-toast${toast.count === 0 ? ' live-toast--empty' : ''}`}
      role="status"
      aria-live="polite"
    >
      <span className="live-toast__dot" aria-hidden="true" />
      <span className="live-toast__text">
        <span className="live-toast__title">{title}</span>
        {detail ? <span className="live-toast__detail">{detail}</span> : null}
      </span>
      <button type="button" className="live-toast__off" onClick={onTurnOff}>
        {t('Turn off')}
      </button>
    </div>
  );
}
