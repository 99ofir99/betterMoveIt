/**
 * "For you" lines on the Lines tab: ranks lines from the user's own data
 * (trip history, favourite lines, the trip to their frequent destination)
 * Pure functions; the hook that also fetches
 * lines serving nearby stops lives in useSuggestedLines.ts.
 */

import type { Journey, Line, RouteInfo, TransitLeg } from '../types';
import type { TripHistoryEntry } from './history';

/** A planner / departures route as a Lines-tab line (id is the route index). */
export function routeToLine(route: RouteInfo | Line): Line {
  return {
    id: 'id' in route && route.id ? route.id : String(route.index),
    index: route.index,
    shortName: route.shortName,
    longName: route.longName,
    displayName: route.displayName,
    type: route.type,
    typeName: route.typeName,
    color: route.color ?? null,
    agency: route.agency,
    agencyId: route.agencyId,
  };
}

/** Transit lines a journey rides, in order. */
export function journeyLines(journey: Journey | null | undefined): Line[] {
  if (!journey) return [];
  return journey.legs
    .filter((l): l is TransitLeg => l.mode === 'transit')
    .map((l) => routeToLine(l.route));
}

/**
 * Score lines the user actually rides: each planned trip in history counts
 * (newer trips count more), and a starred line gets a fixed boost.
 */
export function rankPersonalLines(
  history: TripHistoryEntry[],
  favourites: Line[],
  limit = 10,
): Line[] {
  const score = new Map<string, { line: Line; score: number; order: number }>();
  let order = 0;
  const add = (line: Line, pts: number) => {
    const prev = score.get(line.id);
    if (prev) prev.score += pts;
    else score.set(line.id, { line, score: pts, order: order++ });
  };
  history.forEach((h, rank) => {
    const weight = 1 / (1 + rank * 0.1);
    for (const line of h.lines ?? []) add(line, 2 * weight);
  });
  for (const line of favourites) add(line, 1.5);
  return [...score.values()]
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, limit)
    .map((s) => s.line);
}

/** Drop lines whose id is in `exclude` (or was already used by an earlier section). */
export function withoutLines(lines: Line[], exclude: Set<string>): Line[] {
  return lines.filter((l) => !exclude.has(l.id));
}
