/**
 * "Already there" check for the home frequent-destination card.
 * A trip to where you are standing ("0 min, leaves now", one walk icon)
 * is noise, so the card moves on to the next saved place instead.
 */

import type { Journey, LatLon, Place } from '../types';
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

/**
 * First candidate the user is not already at (e.g. at home → work).
 * Without a location the first candidate wins. Null when every candidate is here.
 */
export function pickFrequentDestination(candidates: Place[], origin: LatLon | null): Place | null {
  if (!origin) return candidates[0] ?? null;
  return candidates.find((c) => !isNearDestination(origin, c)) ?? null;
}
