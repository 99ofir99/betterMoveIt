/** Derive "best time to leave" bars from the journeys already planned. */

import type { Journey } from '../types';
import type { BestTimeBar } from '../components/results/types';
import { formatClock } from './format';

const MAX_BARS = 6;
const MIN_BAR_HEIGHT = 0.35;

/**
 * One bar per distinct departure (chronological). A shorter trip gives a taller bar,
 * scaled relative to the shortest option so the chart reads as "leave around here".
 */
export function computeBestTimeBars(journeys: readonly Journey[]): BestTimeBar[] {
  const byDepart = new Map<number, Journey>();
  for (const j of journeys) {
    const existing = byDepart.get(j.departSeconds);
    if (!existing || j.durationSec < existing.durationSec) byDepart.set(j.departSeconds, j);
  }

  const unique = [...byDepart.values()].sort((a, b) => a.departSeconds - b.departSeconds);
  if (unique.length === 0) return [];

  const shortest = Math.min(...unique.map((j) => j.durationSec));
  const bestDepart = unique.find((j) => j.durationSec === shortest)!.departSeconds;

  let visible = unique;
  if (unique.length > MAX_BARS) {
    // Keep the best bar in view, then take the window of MAX_BARS around it.
    const bestIdx = unique.findIndex((j) => j.departSeconds === bestDepart);
    const start = Math.min(Math.max(0, bestIdx - Math.floor(MAX_BARS / 2)), unique.length - MAX_BARS);
    visible = unique.slice(start, start + MAX_BARS);
  }

  return visible.map((j) => ({
    id: j.departSeconds,
    label: formatClock(j.departSeconds),
    durationMin: Math.round(j.durationSec / 60),
    height: MIN_BAR_HEIGHT + (1 - MIN_BAR_HEIGHT) * (shortest / Math.max(j.durationSec, 1)),
    isBest: j.departSeconds === bestDepart,
  }));
}
