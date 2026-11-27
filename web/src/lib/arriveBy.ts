/** Arrive-by helpers: the planner only knows depart-at, so we search earlier and re-rank. */

/** "HH:MM" → seconds since midnight. */
export function clockToSeconds(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 3600 + (m || 0) * 60;
}

/**
 * Depart-at time to search from: two hours before the wanted arrival, but never
 * before midnight (wrapping to 23:00 would search the wrong evening of the same date).
 */
export function arriveBySearchStart(arriveBy: string): string {
  const leaveSec = Math.max(0, clockToSeconds(arriveBy) - 2 * 3600);
  const hh = String(Math.floor(leaveSec / 3600)).padStart(2, '0');
  const mm = String(Math.floor((leaveSec % 3600) / 60)).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Journeys that arrive on time come first, latest arrival first (least waiting at the
 * destination). Late journeys follow, least late first, so the list is never empty.
 */
export function rankForArriveBy<T extends { arrivalSeconds: number }>(
  journeys: T[],
  arriveBy: string
): T[] {
  const target = clockToSeconds(arriveBy);
  const onTime = journeys
    .filter((j) => j.arrivalSeconds <= target)
    .sort((a, b) => b.arrivalSeconds - a.arrivalSeconds);
  const late = journeys
    .filter((j) => j.arrivalSeconds > target)
    .sort((a, b) => a.arrivalSeconds - b.arrivalSeconds);
  return [...onTime, ...late];
}
