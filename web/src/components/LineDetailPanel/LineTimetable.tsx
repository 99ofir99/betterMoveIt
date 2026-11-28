/**
 * Timetable of one line at one stop (Moovit "Timetable" from a stop card):
 * the stop, Live location, a day picker and every departure of that day.
 */

import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatClock12h } from '../../lib/format';
import { t } from '../../lib/i18n';
import type { Line, LineTimetableResponse, Stop } from '../../types';
import { RippleLoader } from '../common/RippleLoader';
import { RouteBadge } from '../common/RouteBadge';
import { BusIcon, ClockIcon } from '../shared/icons';

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface LineTimetableProps {
  line: Line;
  badgeLabel: string;
  stop: Stop;
  direction?: number;
  /** Feed day of week today (0 = Sunday), for the day chips' names. */
  todayDow?: number;
  onLiveLocation?: (stop: Stop) => void;
}

export function dayChipLabel(offset: number, todayDow: number | undefined): string {
  if (offset === 0) return t('Today');
  if (offset === 1) return t('Tomorrow');
  if (todayDow == null) return t('In {n} days', { n: offset });
  return t(DAY_SHORT[(todayDow + offset) % 7]);
}

export function LineTimetable({
  line,
  badgeLabel,
  stop,
  direction,
  todayDow,
  onLiveLocation,
}: LineTimetableProps) {
  const [day, setDay] = useState(0);
  const [data, setData] = useState<LineTimetableResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setData(null);
    setError(null);
    api
      .lineTimetable(line.id, { stopId: stop.id, direction, day }, ctrl.signal)
      .then((d) => {
        if (!ctrl.signal.aborted) setData(d);
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(String(e?.message ?? e));
      });
    return () => ctrl.abort();
  }, [line.id, stop.id, direction, day]);

  const dow = todayDow ?? (data ? (data.dow - data.day + 7) % 7 : undefined);

  return (
    <div className="lnd-tt">
      <div className="lnd-tt__stop">
        <span className="lnd-tt__label">{t('Departure stop')}</span>
        <span className="lnd-tt__name" dir="auto">
          {stop.name}
        </span>
        {onLiveLocation && (
          <button type="button" className="lnd-stop__live" onClick={() => onLiveLocation(stop)}>
            <BusIcon size={14} />
            {t('Live location')}
          </button>
        )}
      </div>

      <div className="lnd-tt__days" role="tablist" aria-label={t('Day')}>
        {Array.from({ length: 7 }, (_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={day === i}
            className={`lnd-tt__day${day === i ? ' is-on' : ''}`}
            onClick={() => setDay(i)}
          >
            {dayChipLabel(i, dow)}
          </button>
        ))}
      </div>

      <div className="lnd-tt__list">
        {error && !data && <p className="error-text">{error}</p>}
        {!data && !error && <RippleLoader compact label={t('Loading timetable…')} />}
        {data && data.departures.length === 0 && (
          <p className="lnd-tt__empty muted">
            {day === 0 ? t('No more departures today.') : t('No departures on this day.')}
          </p>
        )}
        {data && data.departures.length > 0 && (
          <ul className="lnd-tt__rows">
            {data.departures.map((d, i) => (
              <li key={`${d.tripId}-${d.departure}-${i}`} className={`lnd-tt__row${day === 0 && i === 0 ? ' is-next' : ''}`}>
                <RouteBadge label={badgeLabel} typeName={line.typeName} color={line.color} />
                <span className="lnd-tt__main">
                  <span className="lnd-tt__headsign" dir="auto">
                    {d.headsign.replace(/_/g, ' ')}
                  </span>
                  <span className="lnd-tt__sub">
                    <ClockIcon size={12} />
                    {d.nextDay ? t('Scheduled time · after midnight') : t('Scheduled time')}
                  </span>
                </span>
                <span className="lnd-tt__time">{formatClock12h(d.departure)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
