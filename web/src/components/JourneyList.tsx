/** Presentational journey list and detail. */

import { useEffect, useState } from 'react';
import type { Journey, RouteInfo, TransitLeg } from '../types';
import {
  formatClock,
  formatClock12h,
  formatDistance,
  formatDuration,
  formatDurationMins,
  formatLeaveEntries,
  minutesUntilDepart,
  routeColor,
} from '../lib/format';
import {
  leaveEtasFromBoard,
  PLANNED_TRIP_SLACK_MIN,
  type LeaveEtaEntry,
} from '../lib/boardingEta';
import { isHeavyRailRoute, transitDestinationLabel } from '../lib/railLabel';
import { api } from '../lib/api';
import { BundledLineBadge } from './common/BundledLineBadge';
import { SwipeRail } from './common/SwipeRail';
import { WalkIcon } from './icons';
import { TripStartBar } from './trip/TripStartBar';
import { TripTips } from './results/TripTips';
import type { JourneyDetailProps, JourneyListProps } from './types';
import { t, tn } from '../lib/i18n';

export function JourneyList({ journeys, selected, onSelect, departNow, insights }: JourneyListProps) {
  return (
    <ul className="journey-list" role="listbox" aria-label={t("Journey options")}>
      {journeys.map((card, i) => {
        const j = card.journey;
        return (
          <li key={`${j.departSeconds}-${i}`}>
            <button
              type="button"
              role="option"
              aria-selected={i === selected}
              className={`journey-card ${i === selected ? 'is-selected' : ''}`}
              onClick={() => onSelect(i)}
            >
              <div className="journey-card__layout">
                <div className="journey-card__left">
                  <div className="journey-card__duration-big">{formatDurationMins(j.durationSec)}</div>
                  <div className="journey-card__times">
                    <span className="journey-card__clock">{formatClock12h(j.departSeconds)}</span>
                    <span className="journey-card__times-rail" aria-hidden="true" />
                    <span className="journey-card__clock">{formatClock12h(j.arrivalSeconds)}</span>
                  </div>
                </div>

                <div className="journey-card__main">
                  <ClampedRouteSequence journey={j} transitAlternatives={card.transitAlternatives} />
                  <JourneyCardFooter
                    journey={j}
                    departNow={departNow}
                    firstTransitAlts={card.transitAlternatives[0]}
                  />
                  <TripTips labels={insights?.get(i) ?? []} />
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Walk + transit chips; clamps alternative lines onto the same leg slot (Moovit). */
function ClampedRouteSequence({
  journey,
  transitAlternatives,
}: {
  journey: Journey;
  transitAlternatives: RouteInfo[][];
}) {
  let transitIdx = 0;
  return (
    <SwipeRail className="journey-card__legs" aria-label={t("Route legs")}>
      {journey.legs.map((leg, li) => {
        const sep =
          li > 0 ? (
            <span className="journey-card__leg-sep" aria-hidden="true">
              ›
            </span>
          ) : null;

        if (leg.mode === 'walk') {
          return (
            <span key={li} className="journey-card__leg-wrap">
              {sep}
              <WalkChip distanceM={leg.distanceM} />
            </span>
          );
        }

        const alts = transitAlternatives[transitIdx] ?? [leg.route];
        transitIdx += 1;
        const railDest =
          isHeavyRailRoute(leg.route) ? transitDestinationLabel(leg.route, leg.headsign) : '';
        return (
          <span key={li} className="journey-card__leg-wrap">
            {sep}
            <BundledLineBadge routes={alts} />
            {railDest ? (
              <span className="journey-card__rail-dest" dir="auto">
                {railDest}
              </span>
            ) : null}
          </span>
        );
      })}
    </SwipeRail>
  );
}

function WalkChip({ distanceM }: { distanceM: number }) {
  return (
    <span
      className="leg-chip leg-chip--moovit-walk"
      title={t('Walk {dist}', { dist: formatDistance(distanceM) })}
      role="img"
      aria-label={t('Walk {dist}', { dist: formatDistance(distanceM) })}
    >
      <WalkIcon size={20} />
    </span>
  );
}

function JourneyCardFooter({
  journey,
  departNow,
  firstTransitAlts,
}: {
  journey: Journey;
  departNow?: boolean;
  /** All clamped alternatives for the first transit leg — used to widen live leave-time lookup. */
  firstTransitAlts?: RouteInfo[];
}) {
  const firstTransit = journey.legs.find((l): l is TransitLeg => l.mode === 'transit');
  const [etas, setEtas] = useState<LeaveEtaEntry[]>([]);

  // Stable key: sorted alt names so the effect only re-runs when alternatives actually change.
  const altNamesKey = firstTransitAlts?.map((r) => r.shortName || r.displayName).sort().join(',');

  useEffect(() => {
    // Live leave-times only when planning "Depart now" (board rolls into tomorrow).
    if (!departNow || !firstTransit?.from.stopId) {
      setEtas([]);
      return;
    }
    const stopId = firstTransit.from.stopId;
    const altRoutes = firstTransitAlts ?? [firstTransit.route];

    const ctrl = new AbortController();
    const poll = () => {
      void api
        .stopDepartures(stopId, ctrl.signal)
        .then((board) => {
          if (ctrl.signal.aborted) return;
          // Only buses from the planned trip on: earlier ones belong to another card.
          const planned = minutesUntilDepart(firstTransit.departure);
          const minMinutes = planned.nextDay
            ? 0
            : Math.max(0, planned.minutes - PLANNED_TRIP_SLACK_MIN);
          const fromBoard = leaveEtasFromBoard(board.departures, altRoutes, 3, minMinutes);
          if (fromBoard.length > 0) {
            setEtas(fromBoard);
            return;
          }
          // Schedule fallback from plan clock.
          const { minutes, nextDay } = minutesUntilDepart(journey.departSeconds);
          setEtas([
            {
              minutes,
              departure: journey.departSeconds,
              live: false,
              confidence: 'none',
              source: 'schedule',
              nextDay,
            },
          ]);
        })
        .catch(() => {
          if (ctrl.signal.aborted) return;
          const { minutes, nextDay } = minutesUntilDepart(journey.departSeconds);
          setEtas([
            {
              minutes,
              departure: journey.departSeconds,
              live: false,
              confidence: 'none',
              source: 'schedule',
              nextDay,
            },
          ]);
        });
    };
    poll();
    // Refresh board every 20s so ETAs track the bus (Moovit cadence).
    const id = window.setInterval(poll, 20_000);
    return () => {
      ctrl.abort();
      window.clearInterval(id);
    };
  }, [
    departNow,
    firstTransit?.from.stopId,
    altNamesKey,
    journey.departSeconds,
  ]);

  if (!firstTransit) return null;

  const stop = firstTransit.fromName || 'stop';

  // Leave-at / arrive-by: fixed planned clock, not live board vs wall-clock.
  if (!departNow) {
    return (
      <p className="journey-card__footer">
        {t('Departs {time} from {stop}', { time: formatClock12h(journey.departSeconds), stop })}
      </p>
    );
  }

  const entries =
    etas.length > 0
      ? etas
      : [
          (() => {
            const { minutes, nextDay } = minutesUntilDepart(journey.departSeconds);
            return {
              minutes,
              departure: journey.departSeconds,
              live: false,
              confidence: 'none' as const,
              source: 'schedule' as const,
              nextDay,
            };
          })(),
        ];
  const leaveLabel = formatLeaveEntries(entries);
  const nextDay = Boolean(entries[0]?.nextDay);
  const best = entries.find((e) => e.live) ?? entries[0];
  const confidence = best?.confidence ?? (best?.live ? 'high' : 'none');
  const isLive = Boolean(best?.live);

  return (
    <p className="journey-card__footer">
      {t("Leaves")}{' '}
      <strong
        className={`journey-card__footer-live is-acc-${confidence}${isLive ? ' is-live' : ''}`}
      >
        {leaveLabel}
        {isLive && confidence !== 'off_route' && (
          <span className="journey-card__live-icon" aria-hidden="true">
            ◉
          </span>
        )}
        {confidence === 'off_route' && (
          <span className="journey-card__off-route" aria-label={t("Off route")}>
            !
          </span>
        )}
      </strong>
      {nextDay ? t(' (next day)') : ''} {t('from {stop}', { stop })}
    </p>
  );
}

/**
 * @deprecated Not rendered anywhere in the current app.
 * The active Moovit-style detail panel is `DirectionsSheet` (via DraggableSheet in App.tsx).
 * Kept here for reference; remove once confirmed safe.
 */
export function JourneyDetail({
  journey,
  transitAlternatives,
  onClose,
  onStopClick,
  onStartTrip,
}: JourneyDetailProps) {
  let transitIdx = 0;

  return (
    <div className="journey-detail">
      <div className="journey-detail__header">
        <div>
          <div className="journey-detail__time">
            {formatClock(journey.departSeconds)} → {formatClock(journey.arrivalSeconds)}
          </div>
          <div className="journey-detail__summary">
            {formatDuration(journey.durationSec)} ·{' '}
            {journey.transfers === 0
              ? t('direct')
              : tn(journey.transfers, '1 change', '{n} changes')}
          </div>
        </div>
        <button className="icon-button" onClick={onClose} aria-label={t("Back to journey list")} type="button">
          ×
        </button>
      </div>

      <ol className="leg-list">
        {journey.legs.map((leg, i) => {
          if (leg.mode === 'walk') {
            return (
              <li key={i} className="leg leg--walk">
                <div className="leg__row">
                  <span className="leg__rail leg__rail--walk" aria-hidden="true" />
                  <div>
                    <div className="leg__title">{t('Walk {dist}', { dist: formatDistance(leg.distanceM) })}</div>
                    <div className="leg__sub">
                      {leg.fromName ?? t('Start')} → {leg.toName}
                      <span className="leg__aside"> · {t('{n} min', { n: Math.round(leg.durationSec / 60) })}</span>
                    </div>
                  </div>
                </div>
              </li>
            );
          }

          const alts = transitAlternatives?.[transitIdx] ?? [leg.route];
          transitIdx += 1;
          const railDest = transitDestinationLabel(leg.route, leg.headsign);

          return (
            <li key={i} className="leg leg--transit">
              <div className="leg__row">
                <span
                  className="leg__rail"
                  aria-hidden="true"
                  style={{ background: routeColor(leg.route.color, leg.route.typeName) }}
                />
                <div className="leg__body">
                  <div className="leg__line">
                    <BundledLineBadge routes={alts} />
                    {railDest ? <span className="leg__headsign">→ {railDest}</span> : null}
                  </div>

                  <div className="leg__stops">
                    <button
                      type="button"
                      className="leg__stop"
                      onClick={() => leg.from.stopId && onStopClick(leg.from.stopId)}
                    >
                      <span className="leg__dot" />
                      <span className="leg__stop-name">{leg.fromName}</span>
                      <span className="leg__time">{formatClock(leg.departure)}</span>
                    </button>

                    <details className="leg__intermediate">
                      <summary>
                        {tn(Math.max(0, leg.intermediateStops.length - 2), '1 stop', '{n} stops')}
                      </summary>
                      <ol>
                        {leg.intermediateStops.slice(1, -1).map((s, si) => (
                          <li key={si}>
                            <button
                              type="button"
                              className="leg__stop leg__stop--small"
                              onClick={() => onStopClick(s.id)}
                            >
                              <span className="leg__dot leg__dot--small" />
                              <span className="leg__stop-name">{s.name}</span>
                              <span className="leg__time">{formatClock(s.arrival)}</span>
                            </button>
                          </li>
                        ))}
                      </ol>
                    </details>

                    <button
                      type="button"
                      className="leg__stop"
                      onClick={() => leg.to.stopId && onStopClick(leg.to.stopId)}
                    >
                      <span className="leg__dot leg__dot--end" />
                      <span className="leg__stop-name">{leg.toName}</span>
                      <span className="leg__time">{formatClock(leg.arrival)}</span>
                    </button>
                  </div>

                  <div className="leg__footnote">
                    {leg.route.agency} · {t('{n} min ride', { n: Math.round(leg.durationSec / 60) })}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {onStartTrip && (
        <div className="journey-detail__start-wrap">
          <TripStartBar onStart={onStartTrip} />
        </div>
      )}
    </div>
  );
}
