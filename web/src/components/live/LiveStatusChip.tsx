/**
 * Floating live-bus bar over the map while Live location is on.
 * It says plainly what's tracked ("Live buses · line 500"), how many buses
 * are on the map and how fresh they are, and offers "find" / turn off.
 * State is debounced (lib/liveChipState) so it never flickers between polls.
 */

import { useEffect, useRef, useState } from 'react';
import { LiveBusIcon } from '../icons';
import { t } from '../../lib/i18n';
import { nextLiveChipState, type LiveChipMemory } from '../../lib/liveChipState';
import type { LiveStatusChipProps } from './types';

function formatUpdated(updatedAt: number | null, now: number): string {
  if (!updatedAt) return '';
  const sec = Math.max(0, Math.round((now - updatedAt) / 1000));
  if (sec < 5) return t('just now');
  if (sec < 60) return t('{n}s ago', { n: sec });
  return t('{n}m ago', { n: Math.floor(sec / 60) });
}

function linesText(lines: string[]): string {
  if (lines.length === 0) return '';
  const shown = lines.slice(0, 3).join(', ');
  const extra = lines.length > 3 ? ` +${lines.length - 3}` : '';
  return lines.length === 1
    ? t('line {lines}', { lines: shown })
    : t('lines {lines}', { lines: `${shown}${extra}` });
}

export function LiveStatusChip({
  lines,
  count,
  loading,
  updatedAt,
  requestedAt = null,
  onFind,
  onClose,
}: LiveStatusChipProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const memRef = useRef<LiveChipMemory>({ lastSeenAt: null, lastCount: 0 });
  const view = nextLiveChipState(memRef.current, { count, loading, now });
  memRef.current = view.mem;
  const { mode } = view;

  // No buses: stay out of the way. Only answer "none" right after a press.
  if (mode === 'empty' && !(requestedAt && now - requestedAt < 8000)) return null;

  const title = t('Live buses · {lines}', { lines: linesText(lines) });
  const detail =
    mode === 'searching'
      ? t('Looking for buses near you…')
      : mode === 'empty'
        ? t('No bus is sending GPS right now')
        : [t('{n} on the map', { n: view.count }), formatUpdated(updatedAt, now)].filter(Boolean).join(' · ');

  return (
    <div className={`live-chip live-chip--${mode}`} role="status" aria-live="polite">
      <button
        type="button"
        className="live-chip__main"
        onClick={onFind}
        disabled={mode !== 'live'}
        aria-label={mode === 'live' ? t('Show live buses on the map') : title}
      >
        <span className="live-chip__icon" aria-hidden="true">
          <LiveBusIcon size={20} />
          <span className="live-chip__pulse" />
        </span>
        <span className="live-chip__text">
          <span className="live-chip__title">{title}</span>
          <span className="live-chip__detail">{detail}</span>
        </span>
        {mode === 'live' && <span className="live-chip__cta">{t('Show')}</span>}
      </button>
      <button type="button" className="live-chip__close" onClick={onClose} aria-label={t('Hide live buses')}>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor">
          <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
        </svg>
      </button>
    </div>
  );
}
