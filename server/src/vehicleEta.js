/**
 * Estimate minutes until a live vehicle reaches a stop from GPS position.
 * Used when SIRI Stop Monitoring is unavailable (Hasadna positions only).
 */

import { haversine } from './store.js';
import {
  buildAccuracyFields,
  distanceToPolyline,
  OFF_ROUTE_M,
  signalAgeSec,
} from './arrivalAccuracy.js';

/** Urban bus default when vehicle speed is missing (~25 km/h). */
const DEFAULT_SPEED_KMH = 25;
const MIN_SPEED_KMH = 8;
const MAX_SPEED_KMH = 80;
const MAX_ETA_MIN = 45;
/** Ignore vehicles farther than this from the stop (metres). */
const MAX_DISTANCE_M = 12_000;

/**
 * SIRI / Hasadna `velocity` is km/h. Convert to m/s with sane clamps.
 * @param {number | undefined} raw
 */
function speedMsFromFeed(raw) {
  const kmh = Number(raw);
  if (!Number.isFinite(kmh) || kmh <= 0) {
    return DEFAULT_SPEED_KMH / 3.6;
  }
  const clamped = Math.max(MIN_SPEED_KMH, Math.min(kmh, MAX_SPEED_KMH));
  return clamped / 3.6;
}

/**
 * @param {{ lat: number, lon: number, code?: string }} stop
 * @param {Array<{ lat: number, lon: number, lineName?: string, routeId?: string, speed?: number, stopCode?: string, timestamp?: number, vehicleId?: string }>} vehicles
 * @param {{ shortName?: string, displayName?: string, index?: number }} route
 * @param {(lineRef: string) => string} shortNameForLineRef
 * @returns {{ minutes: number, distanceM: number, vehicle: object } | null}
 */
export function etaFromVehicles(stop, vehicles, route, shortNameForLineRef) {
  if (!stop || !vehicles?.length || !route) return null;

  const names = new Set(
    [route.shortName, route.displayName].filter(Boolean).map((n) => String(n).trim())
  );
  if (names.size === 0) return null;

  let best = null;
  for (const v of vehicles) {
    const line =
      (v.lineName && String(v.lineName).trim()) ||
      (v.routeId ? shortNameForLineRef(v.routeId) : '') ||
      '';
    if (!line || !names.has(line)) continue;

    const distanceM = haversine(v.lat, v.lon, stop.lat, stop.lon);
    if (!Number.isFinite(distanceM) || distanceM > MAX_DISTANCE_M) continue;

    // Already at this stop call — treat as imminent only when truly adjacent.
    if (v.stopCode && stop.code && String(v.stopCode) === String(stop.code) && distanceM < 80) {
      const candidate = { minutes: 0, distanceM, vehicle: v };
      if (!best || candidate.minutes < best.minutes) best = candidate;
      continue;
    }

    const speedMs = speedMsFromFeed(v.speed);
    // Round up partial minutes so a bus 30s away never shows "now" as 0 incorrectly.
    const minutes = Math.max(0, Math.ceil(distanceM / speedMs / 60));
    if (minutes > MAX_ETA_MIN) continue;
    if (!best || minutes < best.minutes || (minutes === best.minutes && distanceM < best.distanceM)) {
      best = { minutes, distanceM, vehicle: v };
    }
  }
  return best;
}

/**
 * @param {object} store
 * @param {{ index?: number }} route
 * @param {number} [direction]
 * @param {{ lat: number, lon: number }} vehicle
 */
function isOffRoute(store, route, direction, vehicle) {
  if (!store || route?.index == null || !vehicle) return false;
  try {
    const detail = store.routeDetail(route.index, direction);
    const geometry = detail?.geometry;
    if (!geometry?.length) return false;
    const dist = distanceToPolyline(vehicle.lat, vehicle.lon, geometry);
    return Number.isFinite(dist) && dist > OFF_ROUTE_M;
  } catch {
    return false;
  }
}

/**
 * Overlay vehicle GPS onto a departures board with Moovit confidence tiers.
 * - If the row already has live confidence, only refresh GPS age / off-route.
 * - Otherwise estimate minutes from the nearest matching vehicle.
 *
 * @param {object} board
 * @param {object} stop
 * @param {object[]} vehicles
 * @param {(lineRef: string) => string} shortNameForLineRef
 * @param {object} [store] GTFS store for off-route shape checks
 * @param {number} [nowMs]
 */
export function applyVehicleEtas(
  board,
  stop,
  vehicles,
  shortNameForLineRef,
  store = null,
  nowMs = Date.now()
) {
  if (!board?.departures?.length || !vehicles?.length) return board;

  for (const g of board.departures) {
    const first = g.next?.[0];
    if (!first) continue;

    // Already has a strong live prediction — still attach freshest matching vehicle signal.
    if (first.live && first.confidence && first.confidence !== 'none') {
      const eta = etaFromVehicles(stop, vehicles, g.route, shortNameForLineRef);
      if (!eta?.vehicle) continue;
      const age = signalAgeSec(eta.vehicle.timestamp, nowMs);
      const offRoute = isOffRoute(store, g.route, g.direction, eta.vehicle);
      const accuracy = buildAccuracyFields({
        signalAgeSec: age,
        offRoute,
        delayMin: first.delayMin,
        vehicleId: eta.vehicle.vehicleId,
        lastUpdated: eta.vehicle.timestamp,
        source: 'live',
      });
      // Prefer stronger existing confidence unless vehicle is clearly fresher/off-route.
      if (offRoute || !first.signalAgeSec || (age != null && age < first.signalAgeSec)) {
        g.next[0] = { ...first, ...accuracy };
        g.live = accuracy.live;
        g.siri = accuracy.live;
      }
      continue;
    }

    const eta = etaFromVehicles(stop, vehicles, g.route, shortNameForLineRef);
    if (!eta) continue;

    const scheduled = first.minutes;
    // Skip vehicle if it's wildly earlier than a far schedule AND far away (>3km)
    // — likely opposite direction on the same line number.
    if (
      scheduled != null &&
      scheduled > 20 &&
      eta.minutes < scheduled - 15 &&
      eta.distanceM > 3000
    ) {
      continue;
    }

    const arrive = new Date(nowMs + eta.minutes * 60_000);
    const departureSec =
      arrive.getHours() * 3600 + arrive.getMinutes() * 60 + arrive.getSeconds();
    const age = signalAgeSec(eta.vehicle?.timestamp, nowMs);
    const offRoute = isOffRoute(store, g.route, g.direction, eta.vehicle);
    const accuracy = buildAccuracyFields({
      signalAgeSec: age,
      offRoute,
      vehicleId: eta.vehicle?.vehicleId,
      lastUpdated: eta.vehicle?.timestamp,
      source: 'live',
    });

    g.next[0] = {
      ...first,
      minutes: eta.minutes,
      departure: departureSec,
      ...accuracy,
    };
    g.live = accuracy.live;
    g.siri = accuracy.live;
  }
  return board;
}
