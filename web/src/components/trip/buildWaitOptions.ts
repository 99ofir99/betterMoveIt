/**
 * Build the "Wait for one of these options" board: next vehicles at the stop,
 * clamped corridor lines preferred when present, always sorted by soonest pickup.
 */

import type { DepartureGroup, RouteInfo, TransitLeg } from '../../types';
import { sortDeparturesByArrival } from './sortDeparturesByArrival';

function routeKey(route: { index: number; shortName: string }, headsign: string): string {
  return `${route.index}|${route.shortName}|${headsign}`;
}

function matchesRoute(group: DepartureGroup, route: RouteInfo): boolean {
  return (
    group.route.shortName === route.shortName ||
    group.route.displayName === route.displayName ||
    group.route.index === route.index
  );
}

export function buildWaitOptions(args: {
  plannedLeg: TransitLeg;
  preferredRoutes: readonly RouteInfo[];
  stopDepartures: readonly DepartureGroup[];
  countdownSec?: number;
  /** Extra non-preferred board rows to keep for the modal. */
  extraBoardLimit?: number;
}): DepartureGroup[] {
  const {
    plannedLeg,
    preferredRoutes,
    stopDepartures,
    countdownSec,
    extraBoardLimit = 12,
  } = args;
  const countdownMin = countdownSec != null ? Math.max(0, Math.round(countdownSec / 60)) : 0;

  const synthetic = (route: RouteInfo): DepartureGroup => ({
    route,
    headsign: plannedLeg.headsign,
    direction: 0,
    next: [{ minutes: countdownMin, departure: plannedLeg.departure, tripId: 0, live: false }],
    siri: false,
  });

  if (preferredRoutes.length > 1) {
    const preferredGroups = preferredRoutes.map((pref) => {
      const found = stopDepartures.find((d) => matchesRoute(d, pref));
      return found ?? synthetic(pref);
    });
    const preferredKeys = new Set(
      preferredGroups.map((g) => routeKey(g.route, g.headsign)),
    );
    const others = stopDepartures
      .filter((d) => !preferredKeys.has(routeKey(d.route, d.headsign)))
      .slice(0, extraBoardLimit);
    // Soonest pickup first across corridor lines + other board arrivals.
    return sortDeparturesByArrival([...preferredGroups, ...others]);
  }

  const matched = stopDepartures.find((d) => matchesRoute(d, plannedLeg.route));
  const lead = matched ?? synthetic(plannedLeg.route);
  const others = stopDepartures
    .filter((d) => d !== matched)
    .slice(0, extraBoardLimit);
  return sortDeparturesByArrival([lead, ...others]);
}
