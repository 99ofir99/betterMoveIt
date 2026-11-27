/**
 * Moovit vertical stop rail — hollow circles along a teal spine, solid for
 * current / alight. Scrolls only inside the pager page (never the window).
 */

import { useEffect, useRef } from 'react';
import { formatClock12h } from '../../lib/format';
import type { IntermediateStop } from '../../types';
import type { StopProgressListProps } from './types';
import { t } from '../../lib/i18n';

export function StopProgressList({
  stops,
  cursor,
  showArrivalOnAlight = true,
}: StopProgressListProps) {
  const listRef = useRef<HTMLOListElement | null>(null);
  const currentRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    const row = currentRef.current;
    if (!row) return;
    // Scroll the pager page only — scrollIntoView was shifting ancestors and
    // blocking "pull down from body" sheet collapse.
    const scroller = row.closest('.ld-stage__page') as HTMLElement | null;
    if (!scroller) return;
    const sRect = scroller.getBoundingClientRect();
    const rRect = row.getBoundingClientRect();
    const pad = 12;
    if (rRect.top < sRect.top + pad) {
      scroller.scrollTop -= sRect.top + pad - rRect.top;
    } else if (rRect.bottom > sRect.bottom - pad) {
      scroller.scrollTop += rRect.bottom - (sRect.bottom - pad);
    }
  }, [cursor]);

  if (stops.length === 0) return null;
  const last = stops.length - 1;
  const progressPct =
    last <= 0 ? 0 : Math.max(0, Math.min(100, (cursor / last) * 100));

  return (
    <ol
      ref={listRef}
      className="ld-stops"
      aria-label={t("Stops on this ride")}
      style={{ ['--ld-stop-progress' as string]: `${progressPct}%` }}
    >
      {stops.map((stop: IntermediateStop, i) => {
        const isAlight = i === last;
        const isCurrent = i === cursor;
        const passed = i < cursor;

        // Moovit: hollow rings for upcoming / passed, solid for Now + alight.
        let mark = 'ld-stops__mark--hollow';
        if (isCurrent || isAlight) mark = 'ld-stops__mark--solid';
        else if (passed) mark = 'ld-stops__mark--hollow is-dim';

        return (
          <li
            key={`${stop.id}-${i}`}
            ref={isCurrent ? currentRef : undefined}
            className={[
              'ld-stops__row',
              isCurrent ? 'is-current' : '',
              passed ? 'is-passed' : '',
              isAlight ? 'is-alight' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <span className={`ld-stops__mark ${mark}`} aria-hidden="true" />
            <span className="ld-stops__name">
              {stop.name}
              {isCurrent && !isAlight ? (
                <span className="ld-stops__live-tag">{t("Now")}</span>
              ) : null}
            </span>
            {showArrivalOnAlight && isAlight ? (
              <span className="ld-stops__time">{formatClock12h(stop.arrival)}</span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
