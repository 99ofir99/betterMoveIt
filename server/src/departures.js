/** Shared departure-board helpers over the GTFS store. */
import { addDaysDateInt, DAY_SEC } from './store.js';

/** Yesterday's trips with GTFS times past 24:00 still run until ~05:00. */
const NIGHT_OVERFLOW_SEC = 6 * 3600;

function collectDepartures(store, stopIdx, dateInt, dow, seconds, horizon, dayOffsetSec, out, dayIndex) {
  const day = dayIndex ?? store.ensureDayIndex(dateInt, dow);
  const absNow = seconds;
  const fromSec = Math.max(0, absNow - dayOffsetSec);
  const start = store.lowerBoundDayStopTrip(day, stopIdx, fromSec);
  const end = day.start[stopIdx + 1];
  for (let idx = start; idx < end; idx++) {
    const dep = store.dayStopTripDepAt(day, idx);
    const absDep = dep + dayOffsetSec;
    if (absDep < absNow) continue;
    if (absDep > absNow + horizon) break;
    const trip = day.trips[idx];
    const routeIdx = store.tripRoute[trip];
    out.push({
      tripId: trip,
      // Clock-of-day for display; yesterday's 24:30 is today's 00:30.
      departure: dayOffsetSec < 0 ? absDep : dep,
      minutes: Math.max(0, Math.round((absDep - absNow) / 60)),
      headsign: store.tripHeadsign[trip],
      route: store.routeObject(routeIdx),
      direction: store.tripDirection[trip],
      live: false,
      nextDay: dayOffsetSec > 0,
    });
    if (out.length > 500) break;
  }
}

export function departuresAtStop(store, stopIdx, { dateInt, seconds, dow }, horizon = 7200, maxGroups = 40) {
  const out = [];
  // After midnight: yesterday's late trips (24:xx, 25:xx…) are still running.
  if (seconds < NIGHT_OVERFLOW_SEC) {
    const prevDate = addDaysDateInt(dateInt, -1);
    const prevDow = (dow + 6) % 7;
    const night = store.ensureOverflowIndex(prevDate, prevDow);
    collectDepartures(store, stopIdx, prevDate, prevDow, seconds, horizon, -DAY_SEC, out, night);
  }
  // Today from "now".
  collectDepartures(store, stopIdx, dateInt, dow, seconds, horizon, 0, out);
  // Always peek tomorrow morning so late-night UIs still show the next bus.
  const nextDate = addDaysDateInt(dateInt, 1);
  const nextDow = (dow + 1) % 7;
  const remainToday = Math.max(0, 86400 - seconds);
  // Search tomorrow from midnight with enough horizon to cover a typical morning peak.
  collectDepartures(
    store,
    stopIdx,
    nextDate,
    nextDow,
    0,
    Math.max(horizon, 14 * 3600),
    remainToday, // minutes = remainToday + dep
    out
  );
  out.sort((a, b) => a.minutes - b.minutes);

  const grouped = [];
  const byKey = new Map();
  for (const d of out) {
    const k = `${d.route.index}|${d.headsign}`;
    let g = byKey.get(k);
    if (!g) {
      g = { route: d.route, headsign: d.headsign, direction: d.direction, next: [] };
      byKey.set(k, g);
      grouped.push(g);
    }
    if (g.next.length < 3) g.next.push({ minutes: d.minutes, departure: d.departure, tripId: d.tripId });
  }
  grouped.sort((a, b) => (a.next[0]?.minutes ?? 1e9) - (b.next[0]?.minutes ?? 1e9));
  return { departures: grouped.slice(0, maxGroups), rawCount: out.length };
}

/** Next few departures of a specific route at a stop (rolls into tomorrow if needed). */
export function nextForRouteAtStop(store, stopIdx, routeIdx, clock, limit = 5, direction) {
  const { dateInt, seconds, dow } = clock;
  const out = [];
  const dirFilter = direction !== undefined && Number.isFinite(Number(direction)) ? Number(direction) : null;

  const collect = (dInt, dDow, fromSec, dayOffsetSec, dayIndex) => {
    const day = dayIndex ?? store.ensureDayIndex(dInt, dDow);
    const start = store.lowerBoundDayStopTrip(day, stopIdx, fromSec);
    const end = day.start[stopIdx + 1];
    let found = 0;
    for (let idx = start; idx < end; idx++) {
      const trip = day.trips[idx];
      if (store.tripRoute[trip] !== routeIdx) continue;
      if (dirFilter !== null && store.tripDirection[trip] !== dirFilter) continue;
      const dep = store.dayStopTripDepAt(day, idx);
      if (dep < fromSec) continue;
      out.push({
        departure: dayOffsetSec < 0 ? dep + dayOffsetSec : dep,
        minutes: Math.max(0, Math.round((dep + dayOffsetSec - seconds) / 60)),
        headsign: store.tripHeadsign[trip],
        tripId: trip,
        nextDay: dayOffsetSec > 0,
      });
      if (++found >= limit) break;
    }
  };

  if (seconds < NIGHT_OVERFLOW_SEC) {
    const prevDate = addDaysDateInt(dateInt, -1);
    const prevDow = (dow + 6) % 7;
    collect(prevDate, prevDow, seconds + DAY_SEC, -DAY_SEC, store.ensureOverflowIndex(prevDate, prevDow));
  }
  collect(dateInt, dow, seconds, 0);
  if (out.length < limit) {
    const nextDate = addDaysDateInt(dateInt, 1);
    const nextDow = (dow + 1) % 7;
    const remainToday = Math.max(0, 86400 - seconds);
    collect(nextDate, nextDow, 0, remainToday);
  }
  out.sort((a, b) => a.minutes - b.minutes);
  return out.slice(0, limit);
}
