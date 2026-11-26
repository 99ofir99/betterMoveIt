/** Moovit departure board — reuses the shared ld-option row. */

import { DepartureOptionRow } from '../trip/DepartureOptionRow';
import type { StopDepartureListProps } from './types';

export function StopDepartureList({ departures, onOpenLine }: StopDepartureListProps) {
  if (departures.length === 0) {
    return <p className="stp-empty muted">No more departures today from this stop.</p>;
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
