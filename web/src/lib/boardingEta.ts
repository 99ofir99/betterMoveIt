/**
 * Shared boarding ETA helpers — prefer live board minutes (SIRI / vehicle),
 * fall back to scheduled clock. Moovit-style: green live countdown, not "Now" for 1–2 min.
 */

import type {
  ArrivalConfidence,
  ArrivalSource,
  DepartureGroup,
  RouteInfo,
  TransitLeg,
} from '../types';

export interface LeaveEtaEntry {
  minutes: number;
  departure: number;
  live: boolean;
  confidence?: ArrivalConfidence;
  source?: ArrivalSource;
  nextDay?: boolean;
}

/** Match a departure group to planned / alternative routes. */
export function groupMatchesRoutes(group: DepartureGroup, routes: RouteInfo[]): boolean {
  const names = new Set(routes.flatMap((r) => [r.shortName, r.displayName].filter(Boolean)));
  const indices = new Set(routes.map((r) => r.index).filter((i) => i != null));
  return (
    names.has(group.route.shortName) ||
    names.has(group.route.displayName ?? '') ||
    (group.route.index != null && indices.has(group.route.index))
  );
}

/** Collect soonest leave ETAs for matching lines from a stop board. */
export function leaveEtasFromBoard(
  groups: DepartureGroup[],
  routes: RouteInfo[],
  limit = 3,
  /**
   * Skip buses leaving before this many minutes from now. A journey card planned on
   * a later trip (e.g. 24 at 18:06) must not say "Leaves 2 min" for the bus before it.
   */
  minMinutes = 0
): LeaveEtaEntry[] {
  const matched = groups.filter((g) => groupMatchesRoutes(g, routes));
  const entries: LeaveEtaEntry[] = [];
  for (const g of matched) {
    for (const n of g.next) {
      if (n.minutes < minMinutes) continue;
      // Live (colored) only when GPS-backed confidence is present (Moovit).
      entries.push({
        minutes: n.minutes,
        departure: n.departure,
        live: Boolean(n.live),
        confidence: n.confidence,
        source: n.source,
      });
    }
  }
  entries.sort((a, b) => a.minutes - b.minutes || a.departure - b.departure);
  return entries.slice(0, limit);
}

/** Best boarding minutes for a transit leg from board, or null if board empty. */
export function bestBoardingMinutes(
  groups: DepartureGroup[],
  leg: TransitLeg,
  altRoutes?: RouteInfo[]
): LeaveEtaEntry | null {
  const routes = altRoutes?.length ? altRoutes : [leg.route];
  const etas = leaveEtasFromBoard(groups, routes, 1);
  return etas[0] ?? null;
}

/** Minutes before a planned boarding that a live bus may still count as "this" trip. */
export const PLANNED_TRIP_SLACK_MIN = 2;
