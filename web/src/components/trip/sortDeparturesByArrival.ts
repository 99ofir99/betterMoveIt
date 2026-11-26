/**
 * Sort stop departures by the next vehicle that can pick you up (soonest first).
 */

import type { DepartureGroup } from '../../types';

export function departureSortKey(group: DepartureGroup): number {
  const next = group.next[0];
  if (!next) return Number.POSITIVE_INFINITY;
  // Prefer live minutes when present — they track the approaching bus.
  if (Number.isFinite(next.minutes)) return next.minutes;
  return next.departure;
}

export function sortDeparturesByArrival(
  groups: readonly DepartureGroup[],
): DepartureGroup[] {
  return [...groups].sort((a, b) => {
    const diff = departureSortKey(a) - departureSortKey(b);
    if (diff !== 0) return diff;
    const aDep = a.next[0]?.departure ?? Number.POSITIVE_INFINITY;
    const bDep = b.next[0]?.departure ?? Number.POSITIVE_INFINITY;
    return aDep - bDep;
  });
}
