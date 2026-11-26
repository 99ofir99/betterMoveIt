/**
 * Onboard / transit-leg card — Moovit "Ride N stops to" + green stop rail.
 */

import { formatDuration } from '../../lib/format';
import { countStopsToAlight, resolveStopCursor } from '../../lib/tripGuidance';
import { ShowingStopsForBar } from './ShowingStopsForBar';
import { StopProgressList } from './StopProgressList';
import type { TransitLeg } from '../../types';
import type { TransitRideCardProps } from './types';

function secondsNow(): number {
  const d = new Date();
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
}

export function TransitRideCard({
  state,
  leg: legProp,
  live = true,
  alternatives,
  selectedRoute,
  onChangeRoute,
}: TransitRideCardProps) {
  const { journey, legIndex, progress, nextAction, phase, position } = state;
  const active = journey.legs[legIndex];
  const candidate = legProp ?? active;
  const leg = candidate && candidate.mode !== 'walk' ? (candidate as TransitLeg) : null;
  if (!leg) return null;

  const displayRoute = selectedRoute ?? leg.route;
  const nowSec = secondsNow();
  const pos = live ? position : null;
  const cursor = resolveStopCursor(leg, nowSec, live ? progress : 0, pos);
  const stopsLeft = live
    ? (nextAction.stopsToAlight ?? countStopsToAlight(leg, nowSec, progress, pos))
    : Math.max(0, leg.intermediateStops.length - 1);

  const isAlighting = live && phase === 'alight';
  const isWaiting = live && phase === 'waiting';
  const isOnboard = live && (phase === 'onboard' || phase === 'alight');

  const rideLabel = isWaiting
    ? 'Waiting to board'
    : isAlighting && stopsLeft <= 0
      ? 'Get off now'
      : stopsLeft <= 1
        ? 'Ride 1 stop to'
        : `Ride ${stopsLeft} stops to`;

  // Will-board focuses the boarding stop; onboard focuses the alight stop.
  const heroName = isWaiting ? leg.fromName : leg.toName;
  const heroStopId = isWaiting ? leg.from.stopId : leg.to.stopId;
  const timeLabel = live
    ? formatDuration(nextAction.countdownSec ?? leg.durationSec)
    : formatDuration(leg.durationSec);

  // Corridor: Switch so the rider can pick the line they're on / will board.
  const hasClaimedLines = alternatives != null && alternatives.length > 1;
  const changeClickable = hasClaimedLines && onChangeRoute != null;

  return (
    <div className="ld-ride">
      <div
        className={[
          'ld-ride__strip',
          isAlighting ? 'ld-ride__strip--urgent' : '',
          isWaiting ? 'ld-ride__strip--wait' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        data-sheet-drag
      >
        <span>{rideLabel}</span>
        <span className="ld-ride__strip-time">{timeLabel}</span>
      </div>

      <div className="ld-ride__body">
        <div className="ld-ride__chrome" data-sheet-drag>
          <div className="ld-ride__hero">
            <div className="ld-ride__hero-main">
              <div className="ld-ride__stop-name">{heroName}</div>
              {heroStopId && <div className="ld-ride__stop-id">ID {heroStopId}</div>}
            </div>
          </div>

          {changeClickable && isOnboard && (
            <p className="ld-ride__hint">
              To make sure you receive the correct get-off alerts, choose the line
              you&apos;re on.
            </p>
          )}

          <ShowingStopsForBar
            route={displayRoute}
            headsign={leg.headsign}
            onSwitch={changeClickable ? onChangeRoute : undefined}
          />
        </div>

        {leg.intermediateStops.length > 0 && (
          <StopProgressList
            stops={leg.intermediateStops}
            cursor={isWaiting ? 0 : cursor}
          />
        )}
      </div>
    </div>
  );
}
