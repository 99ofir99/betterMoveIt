/** Shared Moovit-style departure row for the wait card and arrivals modal. */

import { formatClock12h } from '../../lib/format';
import { RouteBadge } from '../common/RouteBadge';
import { LiveSignalIcon } from '../icons';
import type { OptionRowProps } from './types';

export function DepartureOptionRow({ group, highlighted, onSelect }: OptionRowProps) {
  const first = group.next[0];
  const second = group.next[1];
  const isLive = group.siri === true || first?.live === true;
  const minutes = first != null ? Math.max(0, first.minutes) : null;
  const selectable = onSelect != null;
  const className = [
    'ld-option',
    highlighted ? 'ld-option--highlight' : '',
    selectable ? 'ld-option--selectable' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const body = (
    <>
      <RouteBadge
        label={group.route.displayName}
        typeName={group.route.typeName}
        color={group.route.color}
      />

      <div className="ld-option__info">
        <div className="ld-option__headline">
          {group.platform && <span>Platform: {group.platform}</span>}
          {group.platform && (
            <span className="ld-option__dot" aria-hidden="true">
              •
            </span>
          )}
          <span className="ld-option__headsign" dir="auto">
            {group.headsign}
          </span>
        </div>
        {isLive && <div className="ld-option__live-label">Arrival time is accurate</div>}
      </div>

      <div className="ld-option__eta">
        <div className={`ld-option__pill${isLive ? ' ld-option__pill--live' : ''}`}>
          {isLive && <LiveSignalIcon size={12} className="ld-signal-icon" />}
          {minutes != null && minutes <= 0 ? (
            <span className="ld-option__minutes">now</span>
          ) : (
            <>
              <span className="ld-option__minutes">{minutes ?? '—'}</span>
              {minutes != null && <span className="ld-option__unit">min</span>}
            </>
          )}
        </div>
        {first != null && (
          <div className="ld-option__times">
            {formatClock12h(first.departure)}
            {second != null && `, ${formatClock12h(second.departure)}`}
          </div>
        )}
      </div>
    </>
  );

  if (selectable) {
    return (
      <button
        type="button"
        className={className}
        onClick={() => onSelect(group.route)}
        aria-pressed={highlighted === true}
        aria-label={`Select line ${group.route.displayName}`}
      >
        {body}
      </button>
    );
  }

  return <div className={className}>{body}</div>;
}
