/**
 * "Depart now" results go stale when the screen stays open: the planned bus leaves
 * and the card would keep saying "Leaves now" for a trip that is gone.
 */
import type { Journey, TransitLeg } from '../types';
import { secondsSinceLocalMidnight } from './format';

/** Within this window a past time is "already left"; beyond it, it is tomorrow's bus. */
const LEFT_WINDOW_SEC = 6 * 3600;
/** A walking-only option is stale once it is this old. */
const WALK_STALE_SEC = 5 * 60;
/** A live bus up to this early still counts as the planned one. */
const PLANNED_SLACK_MIN = 2;

/** True when a departure clock time (GTFS seconds, may be ≥ 24:00) is already past. */
export function departureHasPassed(depSec: number, nowSec = secondsSinceLocalMidnight()): boolean {
  const behind = (((nowSec - depSec) % 86400) + 86400) % 86400;
  return behind > 30 && behind < LEFT_WINDOW_SEC;
}

/** Minutes floor for live board ETAs of a planned ride: never a bus before it. */
export function plannedRideMinMinutes(depSec: number, nowSec = secondsSinceLocalMidnight()): number {
  if (departureHasPassed(depSec, nowSec)) return 0;
  const ahead = (((depSec - nowSec) % 86400) + 86400) % 86400;
  return Math.max(0, Math.round(ahead / 60) - PLANNED_SLACK_MIN);
}

/** True when the journey's first ride (or a walk-only start) is already in the past. */
export function journeyHasDeparted(journey: Journey, nowSec = secondsSinceLocalMidnight()): boolean {
  const ride = journey.legs.find((l): l is TransitLeg => l.mode === 'transit');
  const at = ride ? ride.departure : journey.departSeconds + WALK_STALE_SEC;
  return departureHasPassed(at, nowSec);
}
