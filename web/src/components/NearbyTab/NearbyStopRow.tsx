/** Single nearby stop row — name, distance, next departures (Moovit list style). */

import {
  confidenceClass,
  formatEtaLabel,
  isLiveConfidence,
  resolveConfidence,
} from '../../lib/arrivalAccuracy';
import { contrastText, routeColor } from '../../lib/format';
import { railTrainNumber, transitDestinationLabel } from '../../lib/railLabel';
import type { NearbyStopRowProps } from './types';

export function NearbyStopRow({ stop, onPress, showDivider = true }: NearbyStopRowProps) {
  const deps = stop.departures ?? [];
  const distanceLabel =
    stop.distance != null ? formatDistance(stop.distance) : null;

  return (
    <li className={`nearby-board__row${showDivider ? ' has-divider' : ''}`}>
      <button
        type="button"
        className="nearby-board__header"
        onClick={() => onPress(stop)}
        aria-label={`Open stop ${stop.name}`}
      >
        <span className="nearby-board__icon" aria-hidden="true">
          <BusStopSvg />
        </span>
        <div className="nearby-board__titles">
          <span className="nearby-board__name" dir="auto">
            {stop.name}
          </span>
          {stop.code ? (
            <span className="nearby-board__meta">Stop {stop.code}</span>
          ) : null}
        </div>
        {distanceLabel && (
          <span className="nearby-board__distance">{distanceLabel}</span>
        )}
        <ChevronSvg />
      </button>

      {deps.length > 0 && (
        <ul className="nearby-board__deps">
          {deps.slice(0, 4).map((dep, i) => {
            const bg = routeColor(dep.route.color, dep.route.typeName);
            const next = dep.next[0];
            const eta = next?.minutes;
            const confidence = resolveConfidence(next);
            const live = isLiveConfidence(confidence);
            const etaLabel =
              eta == null
                ? '—'
                : formatEtaLabel(eta, { departureSec: next?.departure });
            const badgeLabel = railTrainNumber(dep.route, dep.headsign);
            const destination = transitDestinationLabel(dep.route, dep.headsign);
            return (
              <li
                key={`${dep.route.index}-${dep.headsign}-${i}`}
                className="nearby-board__dep"
              >
                <span
                  className="line-chip"
                  style={{ background: bg, color: contrastText(bg), fontSize: 11 }}
                >
                  {badgeLabel}
                </span>
                {destination ? (
                  <span className="nearby-board__headsign" dir="auto">
                    {destination}
                  </span>
                ) : null}
                <span
                  className={`nearby-board__eta ${confidenceClass(confidence)}${
                    live ? ' is-live' : ''
                  }`}
                >
                  {etaLabel}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function BusStopSvg() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4 16c0 1.1.9 2 2 2h1v2c0 .55.45 1 1 1s1-.45 1-1v-2h6v2c0 .55.45 1 1 1s1-.45 1-1v-2h1c1.1 0 2-.9 2-2V6c0-3.5-3.58-4-8-4S4 2.5 4 6v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM12 4c2.84 0 5 .22 6 1H6c1-.78 3.16-1 6-1zM6 8h12v5H6V8z" />
    </svg>
  );
}

function ChevronSvg() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="nearby-board__chevron"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
