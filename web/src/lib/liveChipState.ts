/**
 * Stable state for the LIVE chip. Polls can briefly return no buses (GPS gap,
 * bbox restart), so "none reporting" only shows after buses have been missing
 * for a while; until then the last count stays on screen. This stops the chip
 * flickering between states.
 */

export type LiveChipMode = 'searching' | 'empty' | 'live';

export interface LiveChipMemory {
  /** Last time at least one bus was on the map (ms). */
  lastSeenAt: number | null;
  lastCount: number;
}

/** How long buses may vanish before the chip says none are reporting. */
export const EMPTY_GRACE_MS = 15_000;

export function nextLiveChipState(
  mem: LiveChipMemory,
  input: { count: number; loading: boolean; now: number },
): { mode: LiveChipMode; count: number; mem: LiveChipMemory } {
  const { count, loading, now } = input;
  if (count > 0) {
    return { mode: 'live', count, mem: { lastSeenAt: now, lastCount: count } };
  }
  if (mem.lastSeenAt != null && now - mem.lastSeenAt < EMPTY_GRACE_MS) {
    return { mode: 'live', count: mem.lastCount, mem };
  }
  // Never had an answer yet → still searching; otherwise a settled "none".
  return { mode: loading && mem.lastSeenAt == null ? 'searching' : 'empty', count: 0, mem };
}
