/** Formatting and colour helpers shared by the UI. */

/**
 * Moovit Arrival Time Accuracy Guide: definitive clock when ETA > 1 hour.
 * (Kept here and re-exported from arrivalAccuracy.ts for shared use.)
 */
export const RELATIVE_ETA_MAX_MIN = 60;

export function formatClock(seconds: number): string {
  const h = Math.floor(seconds / 3600) % 24;
  const m = Math.floor((seconds % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** 12-hour clock for journey result cards (e.g. `11:09 pm`). */
export function formatClock12h(seconds: number): string {
  const h24 = Math.floor(seconds / 3600) % 24;
  const m = Math.floor((seconds % 3600) / 60);
  const ampm = h24 >= 12 ? 'pm' : 'am';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

/** Short duration label for Moovit-style cards (`42 mins`). */
export function formatDurationMins(seconds: number): string {
  const mins = Math.round(seconds / 60);
  return `${mins} min${mins === 1 ? '' : 's'}`;
}

export function secondsSinceLocalMidnight(d = new Date()): number {
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
}

/**
 * Minutes until departure. If today's trip already passed, roll to the next day
 * so late-night UIs still show the morning bus (Moovit behaviour).
 */
export function minutesUntilDepart(
  departSeconds: number,
  nowSec = secondsSinceLocalMidnight()
): { minutes: number; nextDay: boolean } {
  let diff = departSeconds - nowSec;
  let nextDay = false;
  if (diff < 0) {
    diff += 86400;
    nextDay = true;
  }
  return { minutes: Math.max(0, Math.round(diff / 60)), nextDay };
}

/** Format a list of upcoming clock times for journey cards (schedule-only fallback). */
export function formatLeaveTimes(
  departuresSec: number[],
  nowSec = secondsSinceLocalMidnight()
): string {
  if (departuresSec.length === 0) return '';
  return departuresSec
    .map((sec) => {
      const { minutes, nextDay } = minutesUntilDepart(sec, nowSec);
      return formatLeaveMinutes(minutes, { nextDay, departureSec: sec });
    })
    .join(', ');
}

/**
 * Moovit-style leave label from board minutes (prefer live SIRI / vehicle ETA).
 * Only "now" when the bus is at/past 0 minutes — not for 1–2 min waits.
 * Beyond {@link RELATIVE_ETA_MAX_MIN}, show a definitive clock (e.g. `15:33`).
 */
export function formatLeaveMinutes(
  minutes: number,
  opts?: { nextDay?: boolean; departureSec?: number; live?: boolean }
): string {
  if (!opts?.nextDay && minutes <= 0) return 'now';
  if (!opts?.nextDay && minutes <= RELATIVE_ETA_MAX_MIN) return `${minutes} min`;
  if (opts?.departureSec != null) return formatClock(opts.departureSec);
  return `${minutes} min`;
}

/** Whether an ETA should render as relative minutes vs a clock time. */
export function shouldShowRelativeEta(minutes: number, nextDay = false): boolean {
  return !nextDay && minutes <= RELATIVE_ETA_MAX_MIN;
}

/** Clock label for a board ETA when only minutes-until are known. */
export function formatArrivalClock(
  minutes: number,
  departureSec?: number,
  nowSec = secondsSinceLocalMidnight()
): string {
  if (departureSec != null) return formatClock(departureSec);
  return formatClock((nowSec + Math.max(0, minutes) * 60) % 86400);
}

/** Format several board ETAs (e.g. "2 min, 12 min, 28 min"). */
export function formatLeaveEntries(
  entries: Array<{ minutes: number; departure?: number; live?: boolean; nextDay?: boolean }>
): string {
  if (entries.length === 0) return '';
  return entries
    .map((e) =>
      formatLeaveMinutes(e.minutes, {
        nextDay: e.nextDay,
        departureSec: e.departure,
        live: e.live,
      })
    )
    .join(', ');
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function relativeMinutes(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins <= 0) return 'now';
  if (mins === 1) return '1 min';
  return `${mins} min`;
}

/** Format board minutes already provided by the API (live or schedule). */
export function relativeBoardMinutes(
  minutes: number,
  opts?: { departureSec?: number; nextDay?: boolean }
): string {
  if (!opts?.nextDay && minutes <= 0) return 'now';
  if (shouldShowRelativeEta(minutes, opts?.nextDay)) {
    return minutes === 1 ? '1 min' : `${minutes} min`;
  }
  if (opts?.departureSec != null) return formatClock(opts.departureSec);
  return `${minutes} min`;
}

/**
 * Route colours come from the feed and are not guaranteed to be legible on a
 * light surface, so we fall back to a per-transit-mode palette.
 */
export function routeColor(color: string | null | undefined, typeName: string): string {
  if (color && /^#[0-9a-f]{6}$/i.test(color)) return color;
  switch (typeName) {
    case 'rail':
      return '#1f6f4a';
    case 'subway':
      return '#1b5e9e';
    case 'tram':
      return '#E53935';
    case 'ferry':
      return '#0f6f8c';
    case 'funicular':
    case 'cable':
    case 'gondola':
      return '#7a4a9a';
    default:
      return '#2f6feb';
  }
}

/** Pick black or white text for a given background. */
export function contrastText(hex: string): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#111' : '#fff';
}

export function modeIcon(typeName: string): string {
  switch (typeName) {
    case 'rail':
      return '🚆';
    case 'subway':
      return '🚇';
    case 'tram':
      return '🚊';
    case 'ferry':
      return '⛴';
    case 'funicular':
    case 'cable':
    case 'gondola':
      return '🚡';
    case 'trolleybus':
      return '🚎';
    default:
      return '🚌';
  }
}
