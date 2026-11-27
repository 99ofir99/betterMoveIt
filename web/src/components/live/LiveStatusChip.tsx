/**
 * Floating "LIVE" status over the map while Live location is on: which lines
 * are tracked, how many buses report, how fresh the data is, plus quick
 * actions to re-find the buses or turn tracking off.
 */

import { useEffect, useState } from 'react';
import { LiveBusIcon } from '../icons';
import type { LiveStatusChipProps } from './types';

function formatUpdated(updatedAt: number | null, now: number): string {
  if (!updatedAt) return '';
  const sec = Math.max(0, Math.round((now - updatedAt) / 1000));
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  return `${Math.floor(sec / 60)}m ago`;
}

export function LiveStatusChip({
  lines,
  count,
  loading,
  updatedAt,
  onFind,
  onClose,
}: LiveStatusChipProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const shown = lines.slice(0, 3);
  const extra = lines.length - shown.length;
  const searching = loading && count === 0;
  const empty = !loading && count === 0;
  const state = searching ? 'searching' : empty ? 'empty' : 'live';

  const detail = searching
    ? 'Finding buses…'
    : empty
      ? 'No buses reporting right now'
      : [`${count} ${count === 1 ? 'bus' : 'buses'}`, formatUpdated(updatedAt, now)]
          .filter(Boolean)
          .join(' · ');

  return (
    <div className={`live-chip live-chip--${state}`} role="status" aria-live="polite">
      <button type="button" className="live-chip__main" onClick={onFind} aria-label="Show live buses on the map">
        <span className="live-chip__badge" aria-hidden="true">
          <span className="live-chip__pulse" />
          LIVE
        </span>
        <span className="live-chip__text">
          <span className="live-chip__lines">
            {shown.map((l) => (
              <span key={l} className="live-chip__line">
                {l}
              </span>
            ))}
            {extra > 0 && <span className="live-chip__more">+{extra}</span>}
          </span>
          <span className="live-chip__detail">{detail}</span>
        </span>
        <span className="live-chip__find" aria-hidden="true">
          <LiveBusIcon size={20} />
        </span>
      </button>
      <button type="button" className="live-chip__close" onClick={onClose} aria-label="Turn off live location">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor">
          <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
        </svg>
      </button>
    </div>
  );
}
