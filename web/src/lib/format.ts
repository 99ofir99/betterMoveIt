/** Formatting and colour helpers shared by the UI. */

import { getLocale, t } from './i18n';

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
  // Hebrew UI uses the 24-hour clock (as Moovit does in Israel).
  if (getLocale() === 'he') return formatClock(seconds);
  const h24 = Math.floor(seconds / 3600) % 24;
  const m = Math.floor((seconds % 3600) / 60);
  const ampm = h24 >= 12 ? 'pm' : 'am';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${String(m).padStart(2, '0')} ${t(ampm)}`;
}

export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return t('{n} min', { n: mins });
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? t('{h} hr {m} min', { h, m }) : t('{h} hr', { h });
}

/** Short duration label for Moovit-style cards (`42 mins`). */
export function formatDurationMins(seconds: number): string {
  const mins = Math.round(seconds / 60);
  return mins === 1 ? t('1 min') : t('{n} mins', { n: mins });
}

const israelParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jerusalem',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** Wall clock in Israel, the timezone every GTFS time in the feed is written in. */
export function israelClock(d = new Date()): { isoDate: string; seconds: number } {
  const parts = israelParts.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  return {
    isoDate: `${get('year')}-${get('month')}-${get('day')}`,
    seconds: Number(get('hour')) * 3600 + Number(get('minute')) * 60 + Number(get('second')),
  };
}

/**
 * Seconds since midnight in Israel (feed time). Not the device zone: a phone set to
 * another timezone would otherwise put every countdown hours off.
 */
export function secondsSinceLocalMidnight(d = new Date()): number {
  return israelClock(d).seconds;
}

/** How far in the past a departure still reads as "just left" rather than tomorrow. */
const JUST_LEFT_WINDOW_SEC = 6 * 3600;

/**
 * Minutes until departure. If today's trip already passed, roll to the next day
 * so late-night UIs still show the morning bus (Moovit behaviour).
 */
export function minutesUntilDepart(
  departSeconds: number,
  nowSec = secondsSinceLocalMidnight(),
  /** The departure is known to be tomorrow (planner rolled over to the next day). */
  tomorrow = false
): { minutes: number; nextDay: boolean } {
  if (tomorrow) {
    return { minutes: Math.max(0, Math.round((departSeconds + 86400 - nowSec) / 60)), nextDay: true };
  }
  let diff = departSeconds - nowSec;
  let nextDay = false;
  // Only a time far in the past is tomorrow's bus. One that left a minute ago (stale
  // results, a late refresh) is "now", not 24 hours away.
  if (diff < -JUST_LEFT_WINDOW_SEC) {
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
  if (!opts?.nextDay && minutes <= 0) return t('now');
  if (!opts?.nextDay && minutes <= RELATIVE_ETA_MAX_MIN) return t('{n} min', { n: minutes });
  if (opts?.departureSec != null) return formatClock(opts.departureSec);
  return t('{n} min', { n: minutes });
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
  if (meters < 1000) return t('{n} m', { n: Math.round(meters) });
  return t('{n} km', { n: (meters / 1000).toFixed(1) });
}

export function relativeMinutes(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins <= 0) return t('now');
  if (mins === 1) return t('1 min');
  return t('{n} min', { n: mins });
}

/** Format board minutes already provided by the API (live or schedule). */
export function relativeBoardMinutes(
  minutes: number,
  opts?: { departureSec?: number; nextDay?: boolean }
): string {
  if (!opts?.nextDay && minutes <= 0) return t('now');
  if (shouldShowRelativeEta(minutes, opts?.nextDay)) {
    return minutes === 1 ? t('1 min') : t('{n} min', { n: minutes });
  }
  if (opts?.departureSec != null) return formatClock(opts.departureSec);
  return t('{n} min', { n: minutes });
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
