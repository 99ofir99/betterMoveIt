/**
 * "Depart now" results go stale when the screen stays open: the planned bus leaves
 * and the card would keep saying "Leaves now" for a trip that is gone.
 */
import type { Journey, TransitLeg } from '../types';
import { israelClock, secondsSinceLocalMidnight } from './format';
import { t } from './i18n';

/** Within this window a past time is "already left"; beyond it, it is tomorrow's bus. */
const LEFT_WINDOW_SEC = 6 * 3600;
/** A walking-only option is stale once it is this old. */
const WALK_STALE_SEC = 5 * 60;
/** A live bus up to this early still counts as the planned one. */
const PLANNED_SLACK_MIN = 2;

/**
 * When the trip's day is known, `day` is its offset from today in Israel (0 today,
 * 1 tomorrow): times compare absolutely, so 18:39 planned at 00:35 is 18 hours
 * ahead, not 6 hours ago. A boolean is the older "tomorrow" flag; false/null means
 * unknown and falls back to the clock-wrap guess.
 */
export type DayHint = boolean | number | null | undefined;

/** Seconds from now to `depSec` when its day is known, else null. */
function absoluteAhead(depSec: number, nowSec: number, day: DayHint): number | null {
  if (typeof day === 'number') return depSec + day * 86400 - nowSec;
  if (day === true) return depSec + 86400 - nowSec;
  return null;
}

/** True when a departure clock time (GTFS seconds, may be ≥ 24:00) is already past. */
export function departureHasPassed(
  depSec: number,
  nowSec = secondsSinceLocalMidnight(),
  tomorrow: DayHint = false
): boolean {
  const ahead = absoluteAhead(depSec, nowSec, tomorrow);
  if (ahead != null) return ahead < -30 && ahead > -LEFT_WINDOW_SEC;
  const behind = (((nowSec - depSec) % 86400) + 86400) % 86400;
  return behind > 30 && behind < LEFT_WINDOW_SEC;
}

/** Minutes floor for live board ETAs of a planned ride: never a bus before it. */
export function plannedRideMinMinutes(
  depSec: number,
  nowSec = secondsSinceLocalMidnight(),
  tomorrow: DayHint = false
): number {
  if (departureHasPassed(depSec, nowSec, tomorrow)) return 0;
  const ahead =
    absoluteAhead(depSec, nowSec, tomorrow) ?? (((depSec - nowSec) % 86400) + 86400) % 86400;
  return Math.max(0, Math.round(ahead / 60) - PLANNED_SLACK_MIN);
}

function isoToUtcMs(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** YYYYMMDD → YYYY-MM-DD. */
export function isoFromDateInt(dateInt: number): string {
  const s = String(dateInt);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

/**
 * Day offset of a journey or leg from today in Israel: from its service date when
 * the planner reported one, else 1 for the old "tomorrow" flag, else null (unknown).
 */
export function dayOffsetOf(
  x: { serviceDate?: string; nextDay?: boolean },
  today = israelClock().isoDate
): number | null {
  if (x.serviceDate) return Math.round((isoToUtcMs(x.serviceDate) - isoToUtcMs(today)) / 86400000);
  return x.nextDay ? 1 : null;
}

/** Stamp the planner's service date on journeys and their rides (and nextDay when after today). */
export function tagServiceDate(
  journeys: Journey[],
  dateInt: number,
  today = israelClock().isoDate
): Journey[] {
  const serviceDate = isoFromDateInt(dateInt);
  const nextDay = serviceDate > today;
  return journeys.map((j) => ({
    ...j,
    serviceDate,
    nextDay: j.nextDay || nextDay,
    legs: j.legs.map((l) =>
      l.mode === 'transit' ? { ...l, serviceDate, nextDay: l.nextDay || nextDay } : l
    ),
  }));
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** A same-day trip this far ahead (e.g. Saturday 18:39 planned at 00:35) gets its day named. */
const NAME_DAY_AHEAD_SEC = 6 * 3600;

/**
 * Which day a departure falls on, for labels next to its clock: "Tomorrow", a
 * weekday name for later days or a same-day trip many hours away, or '' for soon.
 */
export function departureDayLabel(
  depSec: number,
  day: DayHint,
  now = israelClock()
): string {
  const base = typeof day === 'number' ? day : day ? 1 : 0;
  const calendarDay = base + Math.floor(depSec / 86400);
  if (calendarDay === 1) return t('Tomorrow');
  const ahead = depSec + base * 86400 - now.seconds;
  if (calendarDay >= 2 || (calendarDay === 0 && ahead > NAME_DAY_AHEAD_SEC)) {
    const dow = new Date(isoToUtcMs(now.isoDate) + calendarDay * 86400000).getUTCDay();
    return t(WEEKDAYS[dow]);
  }
  return '';
}

/** Day label for a journey's departure (see {@link departureDayLabel}). */
export function journeyDayLabel(journey: Journey, now = israelClock()): string {
  return departureDayLabel(journey.departSeconds, dayOffsetOf(journey, now.isoDate), now);
}

/** True when the journey's first ride (or a walk-only start) is already in the past. */
export function journeyHasDeparted(journey: Journey, nowSec = secondsSinceLocalMidnight()): boolean {
  const day = dayOffsetOf(journey);
  if (day == null && journey.nextDay) return false;
  const ride = journey.legs.find((l): l is TransitLeg => l.mode === 'transit');
  const at = ride ? ride.departure : journey.departSeconds + WALK_STALE_SEC;
  return departureHasPassed(at, nowSec, day);
}

/**
 * Mark journeys the server (or the client fallback) planned for tomorrow. Their
 * clock times look like the past today ("18:39" at 20:14), so without the mark
 * they read as "Leaves now" instead of tomorrow.
 */
export function markNextDay(journeys: Journey[]): Journey[] {
  return journeys.map((j) => ({
    ...j,
    nextDay: true,
    legs: j.legs.map((l) => (l.mode === 'transit' ? { ...l, nextDay: true } : l)),
  }));
}
