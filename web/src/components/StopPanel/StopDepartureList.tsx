/** Moovit departure board — reuses the shared ld-option row. */

import { DepartureOptionRow } from '../trip/DepartureOptionRow';
import type { StopDepartureListProps } from './types';
import { t } from '../../lib/i18n';
import { formatClock } from '../../lib/format';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function nextDepartureWhen(dayOffset: number, departure: number, dow?: number): string {
  const time = formatClock(departure);
  if (dayOffset <= 0) return t('Today at {time}', { time });
  if (dayOffset === 1) return t('Tomorrow at {time}', { time });
  if (dow == null) return t('In {n} days at {time}', { n: dayOffset, time });
  return t('{day} at {time}', { day: t(WEEKDAYS[(dow + dayOffset) % 7]), time });
}

export function StopDepartureList({ departures, nextDeparture, dow, onOpenLine }: StopDepartureListProps) {
  if (departures.length === 0) {
    const line = nextDeparture?.route.shortName || nextDeparture?.route.displayName;
    return (
      <div className="stp-empty">
        <p className="stp-empty__title">
          {!nextDeparture
            ? t('No departures from this stop in the coming week.')
            : nextDeparture.dayOffset <= 0
              ? t('No departures in the next two hours.')
              : t('No more departures today from this stop.')}
        </p>
        {nextDeparture ? (
          <p className="stp-empty__next">
            {t('Next departure: {when}', {
              when: nextDepartureWhen(nextDeparture.dayOffset, nextDeparture.departure, dow),
            })}
            {line ? (
              <span className="stp-empty__line">
                {' · '}
                {t('Line {line} to {headsign}', { line, headsign: nextDeparture.headsign })}
              </span>
            ) : null}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="stp-list" role="list">
      {departures.map((group, i) => (
        <div
          key={`${group.route.index}-${group.headsign}-${group.next[0]?.tripId ?? i}`}
          role="listitem"
        >
          <DepartureOptionRow
            group={group}
            highlighted={i === 0}
            onSelect={
              onOpenLine ? (route) => onOpenLine(String(route.index)) : undefined
            }
          />
        </div>
      ))}
    </div>
  );
}
