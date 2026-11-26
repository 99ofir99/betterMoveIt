/**
 * Moovit-style arrival accuracy (v5.125).
 *
 * Green  — strong, frequent GPS → "Arrival time is accurate"
 * Yellow — less frequent GPS → "Arrival time is fairly accurate"
 * Red    — sparse GPS → "Arrival time may not be accurate"
 * Red+!  — vehicle off route → uncertain if/when it arrives
 * Black  — no live GPS → schedule (or historical, when available)
 *
 * Definitive clock when ETA > 60 minutes (Moovit docs).
 */

import { haversine } from './store.js';

/** GPS age thresholds (seconds) — frequent / less frequent / sparse. */
export const GPS_HIGH_SEC = 45;
export const GPS_MEDIUM_SEC = 120;
export const GPS_LOW_SEC = 240;

/** Metres from GTFS shape before we treat the vehicle as off-route. */
export const OFF_ROUTE_M = 350;

/** Moovit: show a definitive clock beyond one hour. */
export const DEFINITIVE_ETA_MIN = 60;

/**
 * @param {number | null | undefined} ageSec
 * @param {boolean} [offRoute]
 * @returns {'high' | 'medium' | 'low' | 'off_route' | 'none'}
 */
export function confidenceFromSignal(ageSec, offRoute = false) {
  if (offRoute) return 'off_route';
  if (ageSec == null || !Number.isFinite(ageSec) || ageSec < 0) return 'none';
  if (ageSec <= GPS_HIGH_SEC) return 'high';
  if (ageSec <= GPS_MEDIUM_SEC) return 'medium';
  if (ageSec <= GPS_LOW_SEC) return 'low';
  return 'none';
}

/**
 * Shortest distance from a point to a polyline ([[lat,lon], ...]).
 * @param {number} lat
 * @param {number} lon
 * @param {Array<[number, number]>} geometry
 * @returns {number} metres (Infinity if geometry empty)
 */
export function distanceToPolyline(lat, lon, geometry) {
  if (!geometry?.length) return Infinity;
  let best = Infinity;
  for (let i = 0; i < geometry.length; i++) {
    const [plat, plon] = geometry[i];
    const d = haversine(lat, lon, plat, plon);
    if (d < best) best = d;
  }
  // Also sample midpoints of segments for denser shapes.
  for (let i = 0; i < geometry.length - 1; i++) {
    const [aLat, aLon] = geometry[i];
    const [bLat, bLon] = geometry[i + 1];
    const mLat = (aLat + bLat) / 2;
    const mLon = (aLon + bLon) / 2;
    const d = haversine(lat, lon, mLat, mLon);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Build Moovit accuracy fields for a departure prediction.
 * @param {object} opts
 * @param {number | null | undefined} opts.signalAgeSec
 * @param {boolean} [opts.offRoute]
 * @param {number} [opts.delayMin]
 * @param {string} [opts.vehicleId]
 * @param {number} [opts.lastUpdated]
 * @param {'live' | 'schedule' | 'historical'} [opts.source]
 */
export function buildAccuracyFields({
  signalAgeSec = null,
  offRoute = false,
  delayMin,
  vehicleId,
  lastUpdated,
  source,
} = {}) {
  const confidence = confidenceFromSignal(signalAgeSec, offRoute);
  const live = confidence !== 'none';
  return {
    live,
    confidence,
    source: source ?? (live ? 'live' : 'schedule'),
    ...(signalAgeSec != null && Number.isFinite(signalAgeSec)
      ? { signalAgeSec: Math.round(signalAgeSec) }
      : {}),
    ...(lastUpdated != null ? { lastUpdated } : {}),
    ...(vehicleId ? { vehicleId: String(vehicleId) } : {}),
    ...(offRoute ? { offRoute: true } : {}),
    ...(delayMin != null && Number.isFinite(delayMin) ? { delayMin } : {}),
  };
}

/**
 * Seconds since a vehicle timestamp (ms). Null when unknown/stale feed.
 * @param {number | undefined} timestampMs
 * @param {number} [nowMs]
 */
export function signalAgeSec(timestampMs, nowMs = Date.now()) {
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) return null;
  return Math.max(0, (nowMs - timestampMs) / 1000);
}
