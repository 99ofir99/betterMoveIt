/**
 * Estimate minutes until a live vehicle reaches a stop from GPS position.
 * Used when SIRI Stop Monitoring is unavailable (Hasadna positions only).
 */

import { haversine } from './store.js';

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
 * @param {Array<{ lat: number, lon: number, lineName?: string, routeId?: string, speed?: number, stopCode?: string }>} vehicles
 * @param {{ shortName?: string, displayName?: string }} route
 * @param {(lineRef: string) => string} shortNameForLineRef
 * @returns {{ minutes: number, distanceM: number } | null}
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
      const candidate = { minutes: 0, distanceM };
      if (!best || candidate.minutes < best.minutes) best = candidate;
      continue;
    }

    const speedMs = speedMsFromFeed(v.speed);
    // Round up partial minutes so a bus 30s away never shows "now" as 0 incorrectly.
    const minutes = Math.max(0, Math.ceil(distanceM / speedMs / 60));
    if (minutes > MAX_ETA_MIN) continue;
    if (!best || minutes < best.minutes || (minutes === best.minutes && distanceM < best.distanceM)) {
      best = { minutes, distanceM };
    }
  }
  return best;
}

/**
 * Overlay vehicle-derived minutes onto a departures board when SIRI SM is missing.
 * Live vehicle ETA becomes the source of truth for matching lines (Moovit behaviour).
 */
export function applyVehicleEtas(board, stop, vehicles, shortNameForLineRef) {
  if (!board?.departures?.length || !vehicles?.length) return board;

  for (const g of board.departures) {
    if (g.next?.[0]?.live) continue; // SIRI SM already set
    const eta = etaFromVehicles(stop, vehicles, g.route, shortNameForLineRef);
    if (!eta || !g.next?.[0]) continue;

    const scheduled = g.next[0].minutes;
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

    g.next[0] = {
      ...g.next[0],
      minutes: eta.minutes,
      live: true,
    };
    g.live = true;
    g.siri = true;
  }
  return board;
}
