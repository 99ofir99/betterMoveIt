/** Shared departure-board helpers over the GTFS store. */

function addDaysDateInt(dateInt, days) {
  const y = Math.floor(dateInt / 10000);
  const m = Math.floor((dateInt % 10000) / 100);
  const d = dateInt % 100;
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return Number(`${yy}${mm}${dd}`);
}

function collectDepartures(store, stopIdx, dateInt, dow, seconds, horizon, dayOffsetSec, out) {
  const start = store.stopTripStart[stopIdx];
  const end = store.stopTripStart[stopIdx + 1];
  for (let idx = start; idx < end; idx++) {
    const dep = store.stopTripDepAt(idx);
    const absDep = dep + dayOffsetSec;
    const absNow = seconds;
    if (absDep < absNow || absDep > absNow + horizon) continue;
    const trip = store.stopTripTrip[idx];
    const svc = store.tripService[trip];
    if (!store.serviceActive(svc, dateInt, dow)) continue;
    const routeIdx = store.tripRoute[trip];
    out.push({
      tripId: trip,
      departure: dep, // clock-of-day for display
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

  const collect = (dInt, dDow, fromSec, dayOffsetSec) => {
    const start = store.stopTripStart[stopIdx];
    const end = store.stopTripStart[stopIdx + 1];
    for (let idx = start; idx < end; idx++) {
      const trip = store.stopTripTrip[idx];
      if (store.tripRoute[trip] !== routeIdx) continue;
      if (dirFilter !== null && store.tripDirection[trip] !== dirFilter) continue;
      const dep = store.stopTripDepAt(idx);
      if (dep < fromSec) continue;
      const svc = store.tripService[trip];
      if (!store.serviceActive(svc, dInt, dDow)) continue;
      out.push({
        departure: dep,
        minutes: Math.max(0, Math.round((dep + dayOffsetSec - seconds) / 60)),
        headsign: store.tripHeadsign[trip],
        tripId: trip,
        nextDay: dayOffsetSec > 0,
      });
      if (out.length >= limit) break;
    }
  };

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
