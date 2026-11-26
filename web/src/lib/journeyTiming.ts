/**
 * Normalize journey depart / duration so travel time is leave→arrive,
 * never query-now→arrive (which inflates overnight waits).
 */

import type { Journey, TransitLeg } from '../types';

/** When the rider should leave for this itinerary (first boarding − access walks). */
export function journeyLeaveSeconds(journey: Journey): number {
  const firstTransit = journey.legs.find((l): l is TransitLeg => l.mode === 'transit');
  if (!firstTransit || firstTransit.departure == null) return journey.departSeconds;

  let walkBefore = 0;
  for (const leg of journey.legs) {
    if (leg.mode === 'transit') break;
    walkBefore += leg.durationSec || 0;
  }
  return firstTransit.departure - walkBefore;
}

/** In-trip duration: leave for this trip → arrival. */
export function journeyTravelDurationSec(journey: Journey): number {
  const leave = journeyLeaveSeconds(journey);
  let duration = journey.arrivalSeconds - leave;
  if (duration < 0) duration += 86400;
  if (duration < 0 || duration > 16 * 3600) {
    const walk = journey.walkSec ?? 0;
    const transit = journey.transitSec ?? 0;
    if (walk + transit > 0) return walk + transit;
    return Math.max(0, journey.durationSec);
  }
  return duration;
}

export function normalizeJourneyTiming(journey: Journey): Journey {
  const departSeconds = journeyLeaveSeconds(journey);
  const durationSec = journeyTravelDurationSec(journey);
  if (departSeconds === journey.departSeconds && durationSec === journey.durationSec) {
    return journey;
  }
  return { ...journey, departSeconds, durationSec };
}

export function normalizeJourneys(journeys: Journey[]): Journey[] {
  return journeys.map(normalizeJourneyTiming);
}
