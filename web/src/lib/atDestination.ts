/**
 * "Already there" check for the home frequent-destination card.
 * A trip to where you are standing ("0 min, leaves now", one walk icon)
 * is noise, so the card is hidden instead.
 */

import type { Journey, LatLon } from '../types';
import { haversine } from './tripGuidance';

/** Within this straight-line distance the user counts as being at the destination. */
export const AT_DESTINATION_M = 250;
/** A walk-only plan this short also counts as being there (e.g. across the block). */
export const AT_DESTINATION_WALK_SEC = 5 * 60;

export function isNearDestination(origin: LatLon, dest: LatLon): boolean {
  return haversine(origin, dest) <= AT_DESTINATION_M;
}

export function isAtDestination(origin: LatLon, dest: LatLon, journey: Journey | null): boolean {
  if (isNearDestination(origin, dest)) return true;
  if (!journey) return false;
  const walkOnly = journey.legs.every((l) => l.mode === 'walk');
  return walkOnly && journey.durationSec <= AT_DESTINATION_WALK_SEC;
}
