/**
 * Data-driven Moovit "Smart Tips" badges for a set of journeys.
 * Pure: derives labels only from the journeys passed in (not AI).
 */

import type { Journey, TransitLeg } from '../types';
import type { TripInsightLabel, TripInsightMap } from './types';

/** At most this many badges per journey. */
export const MAX_INSIGHTS_PER_JOURNEY = 2;

/** Median gap (seconds) between same-line departures that counts as "high frequency". */
const HIGH_FREQUENCY_GAP_SEC = 12 * 60;
/** Need at least this many departures on the same line to judge frequency. */
const HIGH_FREQUENCY_MIN_DEPARTURES = 3;

/** Earlier = more distinctive = wins when the badge cap is hit. */
const PRIORITY: readonly TripInsightLabel[] = [
  'Direct',
  'Fewest transfers',
  'Least walking',
  'Earliest arrival',
  'Fastest',
  'High frequency',
];

export function computeTripInsights(journeys: readonly Journey[]): TripInsightMap {
  const result = new Map<number, TripInsightLabel[]>();
  if (journeys.length === 0) return result;

  const candidates = journeys.map(() => new Set<TripInsightLabel>());

  // A walk-only trip has no ride, so "Direct" / "Fewest transfers" would be nonsense on it.
  const rides = (j: Journey) => j.legs.some((l) => l.mode === 'transit');
  const allDirect = journeys.every((j) => j.transfers === 0);
  journeys.forEach((j, i) => {
    // A lone direct trip is still worth flagging; a list of all-direct trips is noise.
    if (rides(j) && j.transfers === 0 && (journeys.length === 1 || !allDirect)) {
      candidates[i]!.add('Direct');
    }
  });

  markMinimum(journeys, candidates, (j) => j.transfers, 'Fewest transfers');
  journeys.forEach((j, i) => {
    if (!rides(j)) candidates[i]!.delete('Fewest transfers');
  });
  markMinimum(journeys, candidates, (j) => j.walkMeters, 'Least walking');
  markMinimum(journeys, candidates, (j) => j.arrivalSeconds, 'Earliest arrival');
  markMinimum(journeys, candidates, (j) => j.durationSec, 'Fastest');
  markHighFrequency(journeys, candidates);

  candidates.forEach((set, i) => {
    // "Direct" already implies fewest transfers; avoid saying the same thing twice.
    if (set.has('Direct')) set.delete('Fewest transfers');
    const labels = PRIORITY.filter((label) => set.has(label)).slice(0, MAX_INSIGHTS_PER_JOURNEY);
    if (labels.length > 0) result.set(i, labels);
  });

  return result;
}

/** Tag every journey holding the minimum, unless all journeys tie (no signal). */
function markMinimum(
  journeys: readonly Journey[],
  candidates: Set<TripInsightLabel>[],
  metric: (j: Journey) => number,
  label: TripInsightLabel
): void {
  if (journeys.length < 2) return;
  const values = journeys.map(metric);
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return;
  values.forEach((v, i) => {
    if (v === min) candidates[i]!.add(label);
  });
}

function firstTransit(j: Journey): TransitLeg | undefined {
  return j.legs.find((l): l is TransitLeg => l.mode === 'transit');
}

/** Journeys whose first line departs often (by the departures present in this result set). */
function markHighFrequency(journeys: readonly Journey[], candidates: Set<TripInsightLabel>[]): void {
  const byRoute = new Map<number, number[]>();
  journeys.forEach((j, i) => {
    const leg = firstTransit(j);
    if (!leg) return;
    const group = byRoute.get(leg.route.index) ?? [];
    group.push(i);
    byRoute.set(leg.route.index, group);
  });

  byRoute.forEach((indexes) => {
    if (indexes.length < HIGH_FREQUENCY_MIN_DEPARTURES) return;
    const departures = indexes.map((i) => journeys[i]!.departSeconds).sort((a, b) => a - b);
    const gaps = departures.slice(1).map((t, k) => t - departures[k]!);
    if (gaps.length === 0 || median(gaps) > HIGH_FREQUENCY_GAP_SEC) return;
    indexes.forEach((i) => candidates[i]!.add('High frequency'));
  });
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}
