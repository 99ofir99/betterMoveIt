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

/** True when the journey's first ride (or a walk-only start) is already in the past. */
export function journeyHasDeparted(journey: Journey, nowSec = secondsSinceLocalMidnight()): boolean {
  const ride = journey.legs.find((l): l is TransitLeg => l.mode === 'transit');
  const at = ride ? ride.departure : journey.departSeconds + WALK_STALE_SEC;
  // Normalise GTFS times past midnight (24:30) onto the wall clock.
  const behind = (((nowSec - at) % 86400) + 86400) % 86400;
  return behind > 30 && behind < LEFT_WINDOW_SEC;
}
