/**
 * Pure collapse helpers for the wait-options board (Moovit "Show N more options").
 */

import type { DepartureGroup } from '../../types';

/** Moovit collapsed wait card shows two soonest options. */
export const WAIT_OPTIONS_COLLAPSED_COUNT = 2;

export function waitOptionsHiddenCount(total: number): number {
  return Math.max(0, total - WAIT_OPTIONS_COLLAPSED_COUNT);
}

export function visibleWaitOptions(
  options: readonly DepartureGroup[],
  expanded: boolean,
): DepartureGroup[] {
  const hidden = waitOptionsHiddenCount(options.length);
  if (expanded || hidden === 0) return [...options];
  return options.slice(0, WAIT_OPTIONS_COLLAPSED_COUNT);
}
