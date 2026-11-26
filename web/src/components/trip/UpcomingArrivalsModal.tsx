/**
 * Moovit "Details & Timetables" sheet — upcoming arrivals at the boarding stop,
 * sorted by soonest pickup. Slides up smoothly over Live Directions.
 */

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { sameCorridorRoute } from '../../lib/corridorLine';
import { Icon } from '../icons/Icon';
import { DepartureOptionRow } from './DepartureOptionRow';
import { LegEndpoints } from './LegEndpoints';
import type { UpcomingArrivalsModalProps } from './types';

export function UpcomingArrivalsModal({
  open,
  onClose,
  options,
  stopName,
  fromName,
  toName,
  onSwitch,
  selectedRoute,
  onSelectRoute,
}: UpcomingArrivalsModalProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const subtitle = stopName || fromName;

  return createPortal(
    <div
      className="ld-arrivals-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="ld-arrivals"
        role="dialog"
        aria-modal="true"
        aria-label="Details and timetables"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ld-arrivals__grabber" aria-hidden="true" />
        <header className="ld-arrivals__header">
          <div className="ld-arrivals__titles">
            <h2 className="ld-arrivals__title">Details &amp; Timetables</h2>
            {subtitle ? (
              <p className="ld-arrivals__subtitle" dir="auto">
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="ld-arrivals__close"
            aria-label="Close"
            onClick={onClose}
          >
            <Icon name="close" size={18} />
          </button>
        </header>

        {fromName && toName ? (
          <div className="ld-arrivals__endpoints">
            <LegEndpoints from={fromName} to={toName} onSwitch={onSwitch} />
          </div>
        ) : null}

        <div className="ld-arrivals__section-title">Upcoming Arrivals</div>
        <div className="ld-arrivals__list">
          {options.length === 0 ? (
            <div className="ld-arrivals__empty">No upcoming arrivals at this stop.</div>
          ) : (
            options.map((g, i) => {
              const highlighted = selectedRoute
                ? sameCorridorRoute(g.route, selectedRoute)
                : i === 0;
              return (
                <DepartureOptionRow
                  key={`${g.route.index}-${g.headsign}-${g.next[0]?.tripId ?? i}`}
                  group={g}
                  highlighted={highlighted}
                  onSelect={onSelectRoute}
                />
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
