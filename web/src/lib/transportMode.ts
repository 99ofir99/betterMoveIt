/** Map transit routes onto the user-facing transport preference keys. */

import type { RouteInfo } from '../types';
import type { TransportPrefs } from './settings';

type TransportKey = keyof TransportPrefs;

/** Coarse family for corridor clamping — bus chips must not absorb R1/R3. */
export type ModeFamily = 'bus' | 'tram' | 'rail' | 'other';

export function modeFamilyForRoute(route: Pick<RouteInfo, 'type' | 'typeName'>): ModeFamily {
  const name = route.typeName.toLowerCase();
  const t = route.type;
  if (name === 'tram' || name === 'light_rail' || name === 'light rail' || name === 'subway' || t === 0 || t === 1) {
    return 'tram';
  }
  if (name === 'rail' || t === 2 || (t >= 100 && t < 200)) return 'rail';
  if (name === 'bus' || name === 'trolleybus' || t === 3 || t === 11 || (t >= 700 && t < 800)) {
    return 'bus';
  }
  return 'other';
}

export function isLightRailRoute(route: Pick<RouteInfo, 'type' | 'typeName'>): boolean {
  return modeFamilyForRoute(route) === 'tram';
}

/** Classify a route; returns null when we cannot tell (never penalised). */
export function transportKeyForRoute(route: RouteInfo): TransportKey | null {
  const name = route.typeName.toLowerCase();
  const t = route.type;

  if (name.includes('shuttle')) return 'shuttle';
  if (name === 'bus' || name === 'trolleybus' || t === 3 || t === 11 || (t >= 700 && t < 800)) {
    return 'bus';
  }
  if (name === 'tram' || name === 'light_rail' || name === 'light rail' || name === 'subway' || t === 0 || t === 1) {
    return 'lightRail';
  }
  if (name === 'rail' || t === 2 || (t >= 100 && t < 200)) return 'rail';
  if (name === 'funicular' || name === 'cable' || name === 'gondola' || [5, 6, 7].includes(t)) {
    return 'cable';
  }
  return null;
}

/** Number of transport types the user turned off. */
export function countDisabledTransport(prefs: TransportPrefs | undefined): number {
  if (!prefs) return 0;
  return Object.values(prefs).filter((on) => !on).length;
}
