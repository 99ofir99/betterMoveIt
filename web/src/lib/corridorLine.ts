/**
 * Corridor line helpers — match / swap among Moovit-clamped alternatives
 * that share a journey structure but differ by which bus the rider boarded.
 */

import type { Journey, RouteInfo } from '../types';

export function corridorRouteKey(route: {
  index: number;
  shortName?: string;
  displayName?: string;
  agency?: string;
  typeName?: string;
}): string {
  // Prefer Moovit display label (R1) and agency so bus "1" ≠ תבל R1.
  const name = (route.displayName || route.shortName || '').trim().toLowerCase();
  const agency = (route.agency || '').trim().toLowerCase();
  const mode = (route.typeName || '').trim().toLowerCase();
  if (name) return `${mode}|${agency}|${name}`;
  return `idx:${route.index}`;
}

export function sameCorridorRoute(a: RouteInfo, b: RouteInfo): boolean {
  return (
    corridorRouteKey(a) === corridorRouteKey(b) ||
    (a.index > 0 && b.index > 0 && a.index === b.index)
  );
}

/** Transit leg at the given transit-only ordinal, or undefined. */
export function transitLegAt(journey: Journey, transitOrdinal: number) {
  let ordinal = -1;
  for (const leg of journey.legs) {
    if (leg.mode !== 'transit') continue;
    ordinal++;
    if (ordinal === transitOrdinal) return leg;
  }
  return undefined;
}

/** Member whose transit slot matches the chosen corridor line. */
export function findCorridorMember(
  members: readonly Journey[],
  transitOrdinal: number,
  route: RouteInfo,
): Journey | undefined {
  for (const member of members) {
    const leg = transitLegAt(member, transitOrdinal);
    if (leg && sameCorridorRoute(leg.route, route)) return member;
  }
  return undefined;
}

export function journeyHasCorridorRoute(
  journey: Journey,
  transitOrdinal: number,
  route: RouteInfo,
): boolean {
  const leg = transitLegAt(journey, transitOrdinal);
  return !!leg && sameCorridorRoute(leg.route, route);
}
