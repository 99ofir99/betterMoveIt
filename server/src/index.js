import './env.js'; // must stay first: loads .env before other modules read process.env
import express from 'express';
import compression from 'compression';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getStore, haversine } from './store.js';
import { JourneyPlanner } from './raptor.js';
import { departuresAtStop, nextDepartureAtStop, nextForRouteAtStop } from './departures.js';
import { fetchActiveVehicles, fetchStopMonitoring, siriConfigured } from './siri.js';
import { applyVehicleEtas } from './vehicleEta.js';
import { isLightRailOperator } from './lightRailBrand.js';
import {
  buildAccuracyFields,
  distanceToPolyline,
  GPS_MEDIUM_SEC,
  OFF_ROUTE_M,
  signalAgeSec,
} from './arrivalAccuracy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8787;

const store = getStore();
const planner = new JourneyPlanner(store);

console.log(
  `[transit] loaded ${store.counts.stops} stops, ${store.counts.routes} routes, ` +
    `${store.counts.stopTimes.toLocaleString()} departures in ${store.loadMs}ms ` +
    `(index ${store.buildMs}ms, transfers ${store.transferBuildMs ?? 0}ms)`
);

const app = express();
app.use(compression());
app.use(express.json());
// Allow the Vite dev origin when someone hits the API host directly.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const jerusalemClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jerusalem',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** Seconds since midnight in Asia/Jerusalem for an instant. */
function feedClockSeconds(date) {
  const [h, m, sec] = jerusalemClock.format(date).split(':').map(Number);
  return h * 3600 + m * 60 + sec;
}

/** Feed-local now: the feed is Asia/Jerusalem. */
function feedClock(dateParam, timeParam) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hour12: false,
  }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  const dateInt = dateParam ? Number(dateParam) : Number(`${get('year')}${get('month')}${get('day')}`);
  const h = Number(get('hour')) % 24;
  const seconds = timeParam
    ? timeParam.split(':').reduce((acc, v, i) => acc + Number(v) * (i === 0 ? 3600 : i === 1 ? 60 : 1), 0)
    : h * 3600 + Number(get('minute')) * 60 + Number(get('second'));

  // YYYYMMDD → calendar day. `% 10000` would keep the month (e.g. 1126) and
  // compute the wrong weekday, so depart-at / calendars miss today's service.
  const y = Math.floor(dateInt / 10000);
  const m = Math.floor((dateInt % 10000) / 100);
  const d = dateInt % 100;
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { dateInt, seconds, dow };
}

{
  // Prebuild today's active-trip index so the first /api/plan is not cold.
  const warm = feedClock();
  const tDay = Date.now();
  const day = store.ensureDayIndex(warm.dateInt, warm.dow);
  console.log(
    `[transit] day index ${warm.dateInt}: ${day.total.toLocaleString()} active stop-visits ` +
      `in ${Date.now() - tDay}ms`
  );
}

// ------------------------------------------------------------------ health

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    counts: store.counts,
    loadMs: store.loadMs,
    indexMs: store.buildMs,
    generatedAt: store.meta.generatedAt,
    bbox: store.meta.bbox,
    agencies: store.meta.agencies?.slice(0, 200),
    siri: siriConfigured(),
  });
});

// ------------------------------------------------------------------ places

app.get('/api/search', (req, res) => {
  const q = String(req.query.q || '');
  if (q.trim().length < 1) return res.json({ results: [] });
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const bias = Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
  const stops =
    q.trim().length >= 2
      ? store.searchStops(q, 18, bias).map((s) => ({ kind: 'stop', ...s }))
      : [];
  const lines = store.searchRoutes(q, 12).map((r) => ({ kind: 'line', ...r }));
  res.json({ results: [...lines, ...stops] });
});

app.get('/api/nearby', (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const radius = Number(req.query.radius || 700);
  const withDepartures = req.query.withDepartures === '1' || req.query.withDepartures === 'true';
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ error: 'lat/lon required' });
  }
  const clock = feedClock(req.query.date, req.query.time);
  const near = store.nearby(lat, lon, radius, withDepartures ? 18 : 30);
  const stops = near.map((n) => {
    const stop = { ...store.stopObject(n.stop), distance: Math.round(n.distance) };
    if (!withDepartures) return stop;
    const board = departuresAtStop(store, n.stop, clock, 5400, 4);
    return {
      ...stop,
      departures: board.departures.slice(0, 4).map((d) => ({
        route: d.route,
        headsign: d.headsign,
        minutes: d.next[0]?.minutes ?? null,
        next: d.next.slice(0, 2),
      })),
    };
  });
  // withLines=1: the lines that serve these stops, frequent + close first. Uses
  // the whole timetable, so it still answers at night or on Shabbat.
  let lines;
  if (req.query.withLines === '1' || req.query.withLines === 'true') {
    const score = new Map();
    for (const n of near.slice(0, 12)) {
      const weight = 1 / (1 + n.distance / 200);
      const perRoute = new Map();
      for (let i = store.stopTripStart[n.stop]; i < store.stopTripStart[n.stop + 1]; i++) {
        const r = store.tripRoute[store.stopTripTrip[i]];
        perRoute.set(r, (perRoute.get(r) || 0) + 1);
      }
      for (const [r, trips] of perRoute) {
        const prev = score.get(r) || { score: 0, distance: n.distance };
        prev.score += trips * weight;
        prev.distance = Math.min(prev.distance, n.distance);
        score.set(r, prev);
      }
    }
    lines = [...score.entries()]
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, Math.min(Number(req.query.limit) || 20, 50))
      .map(([r, s]) => ({ ...store.routeObject(r), distance: Math.round(s.distance) }));
  }
  res.json(lines ? { stops, lines, time: clock } : { stops, time: clock });
});

/** Live departures at a stop for the next N minutes (the "arrivals board"). */
app.get('/api/stop/:id/departures', async (req, res) => {
  const stopIdx = store.stopIndexByGtfsId.get(req.params.id);
  if (stopIdx === undefined) return res.status(404).json({ error: 'unknown stop' });
  const clock = feedClock(req.query.date, req.query.time);
  const horizon = Number(req.query.horizon || 7200);
  const board = departuresAtStop(store, stopIdx, clock, horizon, 40);

  // Overlay SIRI expected times when a key is configured; else estimate from live vehicles.
  // Moovit accuracy: green/yellow/red from GPS freshness; black = schedule.
  let live = null;
  const stop = store.stopObject(stopIdx);
  const nowMs = Date.now();

  // Default every prediction to schedule (black) until a GPS-backed signal lands.
  for (const g of board.departures) {
    if (!g.next?.length) continue;
    g.next = g.next.map((n) =>
      n.confidence
        ? n
        : { ...n, ...buildAccuracyFields({ source: 'schedule' }) }
    );
  }

  if (siriConfigured() && stop.code) {
    live = await fetchStopMonitoring(stop.code);
    if (live.visits?.length) {
      for (const g of board.departures) {
        const routeShort = store.shortNameForLineRef;
        const match = live.visits.find((v) => {
          const fromRef = v.routeId ? routeShort(v.routeId) : '';
          return (
            v.lineName === g.route.shortName ||
            v.lineName === g.route.displayName ||
            (fromRef && (fromRef === g.route.shortName || fromRef === g.route.displayName)) ||
            v.routeId === String(g.route.id ?? '')
          );
        });
        if (match?.expected) {
          const exp = Date.parse(match.expected);
          if (Number.isFinite(exp)) {
            const minutes = Math.max(0, Math.round((exp - nowMs) / 60_000));
            // Clock-of-day in Israel; getHours() would use the server's zone (UTC on Render).
            const departureSec = feedClockSeconds(new Date(exp));
            const aimedMs = match.aimed ? Date.parse(match.aimed) : NaN;
            const delayMin = Number.isFinite(aimedMs)
              ? Math.round((exp - aimedMs) / 60_000)
              : undefined;

            let offRoute = false;
            if (match.hasVehicleLocation && match.lat != null && match.lon != null) {
              try {
                const detail = store.routeDetail(g.route.index, g.direction);
                if (detail?.geometry?.length) {
                  const dist = distanceToPolyline(match.lat, match.lon, detail.geometry);
                  offRoute = Number.isFinite(dist) && dist > OFF_ROUTE_M;
                }
              } catch {
                /* shape optional */
              }
            }

            const age = match.hasVehicleLocation
              ? signalAgeSec(match.recordedAt, nowMs)
              : null;
            // Without GPS, keep the agency ETA minutes but stay black (schedule-style).
            // Location without a timestamp → treat as "less frequent" (yellow), not green.
            const accuracy = match.hasVehicleLocation
              ? buildAccuracyFields({
                  signalAgeSec: age ?? GPS_MEDIUM_SEC,
                  offRoute,
                  delayMin,
                  vehicleId: match.vehicleId,
                  lastUpdated: match.recordedAt ?? nowMs,
                  source: 'live',
                })
              : buildAccuracyFields({
                  delayMin,
                  source: 'schedule',
                });

            g.next[0] = {
              ...g.next[0],
              minutes,
              departure: departureSec,
              ...accuracy,
            };
            g.live = accuracy.live;
            g.siri = accuracy.live;
          }
        }
      }
    }
  }

  // Hasadna / MOT vehicle positions → ETA + confidence when SM didn't GPS-confirm.
  try {
    const d = 0.08; // ~9 km bbox around the stop
    const vehiclesRes = await Promise.race([
      fetchActiveVehicles({
        bbox: [stop.lat - d, stop.lon - d, stop.lat + d, stop.lon + d],
      }),
      new Promise((resolve) => setTimeout(() => resolve(null), 3500)),
    ]);
    if (vehiclesRes?.vehicles?.length) {
      applyVehicleEtas(
        board,
        stop,
        vehiclesRes.vehicles,
        (ref) => store.shortNameForLineRef(ref),
        store,
        nowMs
      );
    }
  } catch {
    /* vehicle overlay is best-effort */
  }

  // Moovit-like: soonest live/scheduled first within each group's next[] already sorted;
  // re-sort groups by soonest minutes so the board reads correctly.
  board.departures.sort((a, b) => {
    const am = a.next?.[0]?.minutes ?? 9999;
    const bm = b.next?.[0]?.minutes ?? 9999;
    return am - bm;
  });

  res.json({
    stop,
    time: clock,
    departures: board.departures,
    rawCount: board.rawCount,
    // Empty board (night / Shabbat): when does this stop see its next bus?
    nextDeparture: board.departures.length ? null : nextDepartureAtStop(store, stopIdx, clock),
    live: live
      ? { configured: live.configured, error: live.error, visitCount: live.visits?.length ?? 0 }
      : { configured: siriConfigured(), error: null, visitCount: 0 },
  });
});

/** Line search — Moovit-style "Lines" tab. */
app.get('/api/lines/search', (req, res) => {
  const q = String(req.query.q || '');
  if (q.trim().length < 1) return res.json({ results: [] });
  const results = store.searchRoutes(q, Number(req.query.limit) || 40);
  res.json({ results });
});

/** Line detail: stops along a representative trip + shape geometry. */
app.get('/api/lines/:id', (req, res) => {
  const routeIdx = Number(req.params.id);
  if (!Number.isInteger(routeIdx)) return res.status(400).json({ error: 'invalid line id' });
  const direction = req.query.direction !== undefined ? Number(req.query.direction) : undefined;
  const detail = store.routeDetail(routeIdx, direction);
  if (!detail) return res.status(404).json({ error: 'unknown line' });
  res.json(detail);
});

/** Per-stop schedule for a line (next departures along the pattern). */
app.get('/api/lines/:id/schedule', (req, res) => {
  const routeIdx = Number(req.params.id);
  if (!Number.isInteger(routeIdx)) return res.status(400).json({ error: 'invalid line id' });
  const direction = req.query.direction !== undefined ? Number(req.query.direction) : undefined;
  const detail = store.routeDetail(routeIdx, direction);
  if (!detail) return res.status(404).json({ error: 'unknown line' });
  const clock = feedClock(req.query.date, req.query.time);
  const stops = detail.stops.map((s) => {
    const stopIdx = store.stopIndexByGtfsId.get(s.id);
    const next =
      stopIdx === undefined
        ? []
        : nextForRouteAtStop(store, stopIdx, routeIdx, clock, 4, detail.direction);
    return { ...s, next };
  });
  res.json({
    line: detail.line,
    headsign: detail.headsign,
    direction: detail.direction,
    directions: detail.directions,
    oppositeLineId: detail.oppositeLineId ?? null,
    stops,
    time: clock,
  });
});

/** SIRI vehicle positions (bbox optional: south,west,north,east). */
app.get('/api/vehicles', async (req, res) => {
  const bbox = req.query.bbox
    ? String(req.query.bbox)
        .split(',')
        .map(Number)
    : null;
  const routeId = req.query.routeId ? String(req.query.routeId) : undefined;
  const result = await fetchActiveVehicles({ bbox, routeId });
  // Light rail runs on its own timetable and isn't shown as Live location (R1 ≠ bus 1).
  res.json({
    ...result,
    vehicles: (result.vehicles ?? []).filter((v) => !isLightRailOperator(v.operatorRef)),
  });
});

/** Lightweight service-status banner (SIRI configured / feed age). */
app.get('/api/alerts', async (_req, res) => {
  const alerts = [];
  if (!siriConfigured()) {
    alerts.push({
      id: 'siri-missing',
      title: 'Scheduled times only',
      description: 'Live bus positions need a Ministry of Transport SIRI key (MOT_KEY).',
      severity: 'info',
      affectedRoutes: [],
    });
  }
  res.json({ alerts, siri: siriConfigured() });
});

/** All lines serving a stop (for the stop screen header). */
app.get('/api/stop/:id', (req, res) => {
  const stopIdx = store.stopIndexByGtfsId.get(req.params.id);
  if (stopIdx === undefined) return res.status(404).json({ error: 'unknown stop' });
  const routes = new Map();
  const start = store.stopTripStart[stopIdx];
  const end = store.stopTripStart[stopIdx + 1];
  for (let idx = start; idx < end; idx++) {
    const trip = store.stopTripTrip[idx];
    const routeIdx = store.tripRoute[trip];
    routes.set(routeIdx, (routes.get(routeIdx) || 0) + 1);
  }
  res.json({
    stop: store.stopObject(stopIdx),
    routes: [...routes.keys()].map((r) => ({ ...store.routeObject(r), trips: routes.get(r) })).sort((a, b) => b.trips - a.trips),
  });
});

// ------------------------------------------------------------------ plan

app.post('/api/plan', (req, res) => {
  const { from, to, date, time } = req.body || {};
  // Same range as the Settings slider; an unbounded value makes every search crawl.
  const maxWalk = Math.min(3000, Math.max(300, Number(req.body?.maxWalk) || 1200));
  if (!from || !to) return res.status(400).json({ error: 'from/to required' });
  const { dateInt, seconds, dow } = feedClock(date, time);

  const resolve = (p) => {
    // Door-to-door: address / map-pick places keep their lat/lon so RAPTOR
    // walks to the nearest stop. Stop picks (stopId set) snap to GTFS coords.
    if (!p.stopId && Number.isFinite(p.lat) && Number.isFinite(p.lon)) {
      return { lat: p.lat, lon: p.lon, name: p.name || p.label || 'Point' };
    }
    if (p.stopId) {
      const i = store.stopIndexByGtfsId.get(p.stopId);
      if (i === undefined) return null;
      return { lat: store.stopLat[i], lon: store.stopLon[i], name: store.stopName[i] };
    }
    if (Number.isFinite(p.lat) && Number.isFinite(p.lon)) {
      return { lat: p.lat, lon: p.lon, name: p.name || p.label || 'Point' };
    }
    return null;
  };
  const a = resolve(from);
  const b = resolve(to);
  if (!a || !b) return res.status(400).json({ error: 'unresolvable endpoints' });

  const t0 = Date.now();
  let result = planner.plan({
    from: a,
    to: b,
    dateInt,
    dow,
    secondsSinceMidnight: seconds,
    maxWalkM: Number(maxWalk) || 1200,
  });

  // Depart-now only: if nothing left tonight, roll to tomorrow morning so the
  // UI can still show a nearest bus. Explicit depart-at / arrive-by must keep
  // the requested clock (Moovit) — never silently jump to 4:00.
  let usedNextDay = false;
  /** Feed date the returned clock times belong to (YYYYMMDD). */
  let serviceDateInt = dateInt;
  const explicitTime = Boolean(time);
  if (!result.journeys?.length && !explicitTime) {
    const y = Math.floor(dateInt / 10000);
    const m = Math.floor((dateInt % 10000) / 100);
    const d = dateInt % 100;
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    const nextDateInt = Number(
      `${next.getUTCFullYear()}${String(next.getUTCMonth() + 1).padStart(2, '0')}${String(next.getUTCDate()).padStart(2, '0')}`
    );
    const nextDow = next.getUTCDay();
    result = planner.plan({
      from: a,
      to: b,
      dateInt: nextDateInt,
      dow: nextDow,
      secondsSinceMidnight: 4 * 3600,
      maxWalkM: Number(maxWalk) || 1200,
    });
    usedNextDay = Boolean(result.journeys?.length);
    if (usedNextDay) serviceDateInt = nextDateInt;
  }

  res.json({
    ...result,
    nextDay: usedNextDay,
    serviceDate: serviceDateInt,
    query: { from: a, to: b, dateInt, seconds, dow, maxWalk: Number(maxWalk) || 1200 },
    elapsedMs: Date.now() - t0,
  });
});

/** Forward geocoding proxy — avoids browser CORS with Nominatim. */
app.get('/api/geocode', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ results: [] });
  const lat = req.query.lat ? Number(req.query.lat) : null;
  const lon = req.query.lon ? Number(req.query.lon) : null;
  try {
    // Bias to Israel; optionally add a viewbox around the user's position.
    let url =
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}` +
      `&format=jsonv2&limit=5&countrycodes=il&accept-language=he,en`;
    if (lat && lon && Number.isFinite(lat) && Number.isFinite(lon)) {
      const delta = 0.5;
      url += `&viewbox=${lon - delta},${lat - delta},${lon + delta},${lat + delta}&bounded=0`;
    }
    const r = await fetch(url, {
      headers: { 'User-Agent': 'BetterMoveIt/1.0 (open-source transit app)' },
    });
    const json = await r.json();
    const results = json.map((item) => ({
      kind: 'place',
      name: item.display_name?.split(',').slice(0, 3).join(', ') ?? item.name,
      lat: Number(item.lat),
      lon: Number(item.lon),
    }));
    res.json({ results });
  } catch (e) {
    res.status(502).json({ error: 'geocode failed', detail: String(e) });
  }
});

/** Plain walking route via OSRM (used for walking-only options and last mile). */
app.get('/api/walk', async (req, res) => {
  const { fromLat, fromLon, toLat, toLon } = req.query;
  if (!fromLat || !toLat) return res.status(400).json({ error: 'coords required' });
  try {
    const url =
      `https://routing.openstreetmap.de/routed-foot/route/v1/foot/` +
      `${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson`;
    const r = await fetch(url, { headers: { 'User-Agent': 'BetterMoveIt/1.0' } });
    const j = await r.json();
    const route = j.routes?.[0];
    if (!route) return res.json({ journey: null });
    res.json({
      journey: {
        distanceM: Math.round(route.distance),
        durationSec: Math.round(route.duration),
        geometry: route.geometry.coordinates, // Already in [lon, lat] format for GeoJSON
        straightLineM: Math.round(
          haversine(Number(fromLat), Number(fromLon), Number(toLat), Number(toLon))
        ),
      },
    });
  } catch (e) {
    res.status(502).json({ error: 'walk routing failed', detail: String(e) });
  }
});

// ------------------------------------------------------------------ static web

const webDist = path.resolve(__dirname, '../../web/dist');
if (fs.existsSync(webDist)) {
  // HTML must not be cached — phones on ngrok otherwise keep a stale SPA shell.
  app.use(express.static(webDist, {
    index: false,
    setHeaders(res, filePath) {
      // sw.js too: phones must see a new deploy's worker right away.
      if (filePath.endsWith('.html') || /[\\/](sw|registerSW)\.js$/.test(filePath)) {
        res.setHeader('Cache-Control', 'no-store');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=300');
      }
    },
  }));
  // SPA fallback for client routes only — never mask missing static assets
  // (Chrome rejects PWA install if /icon-*.png returns HTML).
  app.get(/^\/(?!api\/).*/, (req, res, next) => {
    if (path.extname(req.path)) return next();
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(webDist, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res
      .status(503)
      .type('text/plain')
      .send(
        'The web UI has not been built yet.\n\n' +
          'Run:  npm run build\n' +
          'then restart this server.\n\n' +
          'The JSON API is available under /api/* right now.'
      );
  });
}

app.listen(PORT, () => console.log(`[api] listening on http://localhost:${PORT}`));
