/**
 * Moovit stop row: compact name on the rail, or an elevated schedule card
 * when focused.
 */

import { formatClock12h } from '../../lib/format';
import type { LineStopRowProps } from './types';

export function LineStopRow({
  stop,
  focused,
  isBoard,
  isLast,
  pickingDestination,
  disabled,
  onSelect,
  index,
}: LineStopRowProps) {
  const times = stop.next.slice(0, 3);
  const primary = times[0];
  const rest = times.slice(1);

  return (
    <li
      className={[
        'lnd-stop',
        focused ? 'is-focused' : '',
        isBoard ? 'is-board' : '',
        isLast ? 'is-last' : '',
        disabled ? 'is-disabled' : '',
        pickingDestination && !disabled && !isBoard ? 'is-dest-candidate' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        className="lnd-stop__hit"
        disabled={disabled}
        onClick={() => onSelect(index)}
        aria-label={
          isBoard
            ? `${stop.name}, boarding stop`
            : pickingDestination
              ? `Get off at ${stop.name}`
              : `Select ${stop.name}`
        }
      >
        <span className="lnd-stop__rail" aria-hidden>
          <span className="lnd-stop__dot" />
        </span>

        {focused ? (
          <span className="lnd-stop__card">
            <span className="lnd-stop__card-top">
              <span className="lnd-stop__card-main">
                <span className="lnd-stop__name" dir="auto">
                  {stop.name}
                </span>
                <span className="lnd-stop__meta">
                  {stop.code ? <span>ID {stop.code}</span> : null}
                  {isBoard ? <span className="lnd-stop__pill">Starting here</span> : null}
                </span>
              </span>
              {primary && (
                <span className="lnd-stop__clock">
                  <span className="lnd-stop__clock-main">{formatClock12h(primary.departure)}</span>
                  {rest.length > 0 && (
                    <span className="lnd-stop__clock-more">
                      {rest.map((n) => formatClock12h(n.departure)).join(', ')}
                    </span>
                  )}
                </span>
              )}
            </span>
            <span className="lnd-stop__card-actions" aria-hidden>
              <span className="lnd-stop__live">Live location</span>
            </span>
          </span>
        ) : (
          <span className="lnd-stop__plain">
            <span className="lnd-stop__name" dir="auto">
              {stop.name}
            </span>
            {isBoard && <span className="lnd-stop__pill">Starting here</span>}
          </span>
        )}
      </button>
    </li>
  );
}
