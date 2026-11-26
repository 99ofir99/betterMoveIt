/** Moovit "Find the best time to leave" card — presentational; bars come from lib/bestTime. */

import { useMemo } from 'react';
import { computeBestTimeBars } from '../../lib/bestTime';
import { Icon } from '../icons/Icon';
import type { BestTimeCardProps } from './types';

export function BestTimeCard({ journeys, onDismiss }: BestTimeCardProps) {
  const bars = useMemo(() => computeBestTimeBars(journeys), [journeys]);
  if (bars.length < 2) return null;

  return (
    <section className="best-time-card" aria-label="Best time to leave">
      <header className="best-time-card__head">
        <h2 className="best-time-card__title">Find the best time to leave</h2>
        <button
          type="button"
          className="best-time-card__dismiss"
          onClick={onDismiss}
          aria-label="Dismiss best time to leave"
        >
          <Icon name="close" size={18} />
        </button>
      </header>
      <p className="best-time-card__caption">Shorter trips are taller. Leave around the highlighted bar.</p>
      <ul className="best-time-card__chart">
        {bars.map((bar) => (
          <li
            key={bar.id}
            className={`best-time-card__col ${bar.isBest ? 'is-best' : ''}`}
            title={`Leave ${bar.label} · ${bar.durationMin} min`}
          >
            <span className="best-time-card__value">{bar.isBest ? `${bar.durationMin}m` : ''}</span>
            <span className="best-time-card__track">
              <span className="best-time-card__bar" style={{ height: `${Math.round(bar.height * 100)}%` }} />
            </span>
            <span className="best-time-card__label">{bar.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
