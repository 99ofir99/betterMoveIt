/**
 * Israel Railways (heavy rail) display helpers.
 * GTFS: short_name empty, trip_headsign = train number, long_name = corridor.
 * UI: train icon + number, with final city beside it (not the corridor string).
 */

import { formatRailFinalCity } from './lineCategory';
import { modeFamilyForRoute } from './transportMode';
import type { RouteInfo } from '../types';

type RailRouteRef = Pick<RouteInfo, 'type' | 'typeName' | 'longName' | 'shortName' | 'displayName'>;

export function isHeavyRailRoute(route: Pick<RouteInfo, 'type' | 'typeName'>): boolean {
  return modeFamilyForRoute(route) === 'rail';
}

/** True when a headsign is just the Israel Railways train number. */
export function isRailTrainNumber(headsign: string | undefined | null): boolean {
  if (!headsign) return false;
  return /^\d{2,5}$/.test(headsign.trim());
}

/**
 * Badge label for a rail route: train number only.
 * Prefers shortName / displayName; falls back to numeric trip headsign when the
 * server still returns a corridor long_name as displayName.
 */
export function railTrainNumber(route: RailRouteRef, headsign?: string): string {
  const short = (route.shortName || '').trim();
  if (short) return short;

  const display = (route.displayName || '').trim();
  if (display && !looksLikeCorridor(display) && display.toLowerCase() !== 'train') {
    return display;
  }

  const hs = (headsign || '').trim();
  if (isRailTrainNumber(hs)) return hs;

  return display && !looksLikeCorridor(display) ? display : hs || 'Train';
}

function looksLikeCorridor(label: string): boolean {
  return /<->|↔/.test(label) || label.length > 16;
}

/** Destination text beside a rail badge — final city, never the raw train number. */
export function transitDestinationLabel(route: RailRouteRef, headsign?: string): string {
  if (isHeavyRailRoute(route)) {
    const city = formatRailFinalCity(route.longName);
    if (city) return city;
    // Avoid showing the train number twice when city parsing fails.
    if (isRailTrainNumber(headsign)) return '';
  }
  return (headsign || '').trim();
}
