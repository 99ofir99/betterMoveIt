import type { Leg } from '../types';

/** A walk shorter than this (rounds to 1 min or less) is left out of previews. */
const SHORT_WALK_SEC = 90;

/**
 * Legs to show in a one-line route preview (result cards, regular-destination
 * card). Walks of about a minute are noise there; the full itinerary still
 * shows them. Never returns an empty list.
 */
export function previewLegs<L extends Leg>(legs: L[]): L[] {
  const kept = legs.filter((leg) => !(leg.mode === 'walk' && (leg.durationSec ?? 0) < SHORT_WALK_SEC));
  return kept.length > 0 ? kept : legs;
}
