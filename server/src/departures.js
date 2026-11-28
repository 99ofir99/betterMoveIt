/** Shared departure-board helpers over the GTFS store. */
import { addDaysDateInt, DAY_SEC } from './store.js';

/** Yesterday's trips with GTFS times past 24:00 still run until ~05:00. */
const NIGHT_OVERFLOW_SEC = 6 * 3600;

function collectDepartures(store, stopIdx, dateInt, dow, seconds, horizon, dayOffsetSec, out, dayIndex, perKey) {
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
    if (perKey) {
      // Long horizons (rest of the day) would list every trip of a busy stop; the board only
      // shows a few per line+destination, so stop counting a group once it has enough.
      const k = `${routeIdx}|${store.tripHeadsign[trip]}`;
      const n = perKey.get(k) || 0;
      if (n >= PER_GROUP) continue;
      perKey.set(k, n + 1);
    }
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
    if (!perKey && out.length > 500) break;
  }
}

/** Departures kept per line+destination on a board. */
const PER_GROUP = 3;

export function departuresAtStop(store, stopIdx, { dateInt, seconds, dow }, horizon = 7200, maxGroups = 40) {
  const out = [];
  const perKey = new Map();
  // After midnight: yesterday's late trips (24:xx, 25:xx…) are still running.
  if (seconds < NIGHT_OVERFLOW_SEC) {
    const prevDate = addDaysDateInt(dateInt, -1);
    const prevDow = (dow + 6) % 7;
    const night = store.ensureOverflowIndex(prevDate, prevDow);
    collectDepartures(store, stopIdx, prevDate, prevDow, seconds, horizon, -DAY_SEC, out, night, perKey);
  }
  // Today from "now" through the end of today's service (incl. 24:xx/25:xx trips). A short
  // horizon hid tonight's buses behind tomorrow morning's peek: on Shabbat afternoon the
  // board said "tomorrow 05:05" though the line runs again at 19:30 after Shabbat ends.
  const restOfServiceDay = Math.max(horizon, DAY_SEC + NIGHT_OVERFLOW_SEC - seconds);
  collectDepartures(store, stopIdx, dateInt, dow, seconds, restOfServiceDay, 0, out, undefined, perKey);
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
    out,
    undefined,
    perKey
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
    if (g.next.length < PER_GROUP) g.next.push({ minutes: d.minutes, departure: d.departure, tripId: d.tripId });
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
    // `minutes` is measured from today's `seconds`, so tomorrow's clock is offset a full day
    // (offsetting by the time left today gave tomorrow's buses 0 minutes, i.e. "now").
    collect(nextDate, nextDow, 0, DAY_SEC);
  }
  out.sort((a, b) => a.minutes - b.minutes);
  return out.slice(0, limit);
}

/**
 * First scheduled departure at a stop from "now", up to `maxDays` ahead — used when the
 * board is empty (late night, Shabbat) so the UI can say when service resumes.
 * Scans the stop's own trip slice (sorted by departure) instead of building day indexes,
 * so it never evicts the planner's cached days.
 */
export function nextDepartureAtStop(store, stopIdx, { dateInt, seconds, dow }, maxDays = 7) {
  const a = store.stopTripStart[stopIdx];
  const b = store.stopTripStart[stopIdx + 1];
  if (!(b > a)) return null;
  for (let d = 0; d <= maxDays; d++) {
    const date = addDaysDateInt(dateInt, d);
    const dDow = (dow + d) % 7;
    const fromSec = d === 0 ? seconds : 0;
    const active = new Map();
    for (let idx = a; idx < b; idx++) {
      const dep = store.stDeparture[store.stopTripRow[idx]];
      if (dep < fromSec) continue;
      const trip = store.stopTripTrip[idx];
      const svc = store.tripService[trip];
      let on = active.get(svc);
      if (on === undefined) {
        on = Boolean(store.serviceActive(svc, date, dDow));
        active.set(svc, on);
      }
      if (!on) continue;
      return {
        // A 25:10 trip of today's service runs tomorrow at 01:10.
        dayOffset: d + Math.floor(dep / DAY_SEC),
        departure: dep % DAY_SEC,
        minutes: Math.round((d * DAY_SEC + dep - seconds) / 60),
        headsign: store.tripHeadsign[trip],
        route: store.routeObject(store.tripRoute[trip]),
      };
    }
  }
  return null;
}

/**
 * A line's whole-day timetable at one stop (Moovit "Timetable" screen).
 * `dayOffset` 0 = today from now on, 1 = tomorrow, … (whole day).
 * Scans only this stop's trip slice, so it never builds or evicts day indexes.
 * A 25:10 trip of the service day is listed as 01:10 with `nextDay`.
 */
export function routeTimetableAtStop(store, stopIdx, routeIdx, { dateInt, seconds, dow }, dayOffset = 0, direction) {
  const a = store.stopTripStart[stopIdx];
  const b = store.stopTripStart[stopIdx + 1];
  const date = addDaysDateInt(dateInt, dayOffset);
  const dDow = (((dow + dayOffset) % 7) + 7) % 7;
  const fromSec = dayOffset === 0 ? seconds : 0;
  const dirFilter = direction !== undefined && Number.isFinite(Number(direction)) ? Number(direction) : null;
  const active = new Map();
  const isOn = (svc, dInt, dw) => {
    const key = svc * 100000000 + dInt * 10 + dw;
    let on = active.get(key);
    if (on === undefined) {
      on = Boolean(store.serviceActive(svc, dInt, dw));
      active.set(key, on);
    }
    return on;
  };
  const out = [];
  const push = (dep, trip, shownDep, nextDay) => {
    out.push({ departure: shownDep, sort: dep, headsign: store.tripHeadsign[trip], tripId: trip, nextDay });
  };
  for (let idx = a; idx < b; idx++) {
    const trip = store.stopTripTrip[idx];
    if (store.tripRoute[trip] !== routeIdx) continue;
    if (dirFilter !== null && store.tripDirection[trip] !== dirFilter) continue;
    const dep = store.stDeparture[store.stopTripRow[idx]];
    // Today: yesterday's after-midnight trips (24:xx+) that are still ahead.
    if (dayOffset === 0 && dep >= DAY_SEC && dep - DAY_SEC >= fromSec && dep - DAY_SEC < 6 * 3600) {
      if (isOn(store.tripService[trip], addDaysDateInt(dateInt, -1), (dow + 6) % 7)) {
        push(dep - DAY_SEC, trip, dep - DAY_SEC, false);
      }
    }
    if (dep < fromSec) continue;
    if (!isOn(store.tripService[trip], date, dDow)) continue;
    push(dep, trip, dep % DAY_SEC, dep >= DAY_SEC);
  }
  out.sort((x, y) => x.sort - y.sort);
  return out.map(({ sort: _s, ...rest }) => rest);
}
