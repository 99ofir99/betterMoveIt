/**
 * Hasadna Open Bus Stride — public SIRI vehicle locations (no API key).
 * LineRef is GTFS route_id; short names come from the transit store sidecar.
 */

import { getStore } from './store.js';

const HASADNA_LIST_URL =
  process.env.HASADNA_VEHICLE_URL ||
  'https://open-bus-stride-api.hasadna.org.il/siri_vehicle_locations/list';

const FRESH_MS = Number(process.env.HASADNA_FRESH_MINUTES || 10) * 60_000;
const FETCH_LIMIT = Number(process.env.HASADNA_VEHICLE_LIMIT || 2000);

let cache = { at: 0, vehicles: [], error: null };

export function hasadnaConfigured() {
  return true;
}

function resolveLineName(lineRef) {
  const ref = String(lineRef ?? '');
  if (!ref) return undefined;
  try {
    const short = getStore().shortNameForLineRef(ref);
    if (short) return short;
  } catch {
    /* store may be unavailable during early boot */
  }
  return ref;
}

function parseSnapshotTime(snapshotId) {
  if (!snapshotId) return NaN;
  const m = String(snapshotId).match(/^(\d{4})\/(\d{2})\/(\d{2})\/(\d{2})\/(\d{2})$/);
  if (!m) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
}

function vehicleTimestamp(row, now) {
  let t = Date.parse(row.recorded_at_time);
  if (!Number.isFinite(t) || t > now + 86_400_000) {
    t = parseSnapshotTime(row.siri_snapshot__snapshot_id);
  }
  return Number.isFinite(t) ? t : now;
}

function mapRow(row, now) {
  const lat = Number(row.lat);
  const lon = Number(row.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const timestamp = vehicleTimestamp(row, now);
  const routeId = String(row.siri_route__line_ref ?? '');
  return {
    vehicleId: String(row.siri_ride__vehicle_ref ?? row.id),
    routeId,
    lineName: resolveLineName(routeId),
    lat,
    lon,
    bearing: row.bearing != null ? Number(row.bearing) : undefined,
    speed: row.velocity != null ? Number(row.velocity) : undefined,
    timestamp,
  };
}

function filterVehicles(vehicles, bbox, routeId) {
  let out = vehicles;
  if (routeId) out = out.filter((v) => v.routeId === String(routeId));
  if (bbox && bbox.length === 4) {
    const [south, west, north, east] = bbox.map(Number);
    out = out.filter((v) => v.lat >= south && v.lat <= north && v.lon >= west && v.lon <= east);
  }
  return out;
}

/**
 * Recent vehicle positions from Hasadna (cached ~15s).
 */
export async function fetchHasadnaVehicles({ bbox, routeId } = {}) {
  const now = Date.now();
  if (now - cache.at < 14_000 && !routeId && !(bbox && bbox.length === 4)) {
    return {
      configured: true,
      vehicles: filterVehicles(cache.vehicles, bbox, routeId),
      updatedAt: cache.at,
      error: cache.error,
      source: 'hasadna',
    };
  }

  const url = new URL(HASADNA_LIST_URL);
  url.searchParams.set('limit', String(FETCH_LIMIT));
  url.searchParams.set('order_by', 'siri_snapshot_id desc');
  if (bbox && bbox.length === 4) {
    const [south, west, north, east] = bbox.map(Number);
    // OpenAPI param names: lat__greater_or_equal / lat__lower_or_equal, etc.
    url.searchParams.set('lat__greater_or_equal', String(south));
    url.searchParams.set('lat__lower_or_equal', String(north));
    url.searchParams.set('lon__greater_or_equal', String(west));
    url.searchParams.set('lon__lower_or_equal', String(east));
  }
  if (routeId) url.searchParams.set('siri_routes__line_ref', String(routeId));

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'BetterMoovit/1.0' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Hasadna HTTP ${res.status}`);
    const rows = await res.json();
    if (!Array.isArray(rows)) throw new Error('Hasadna: unexpected response');

    const seen = new Map();
    for (const row of rows) {
      const v = mapRow(row, now);
      if (!v) continue;
      const age = now - v.timestamp;
      if (age > FRESH_MS || age < -60_000) continue;
      const prev = seen.get(v.vehicleId);
      if (!prev || v.timestamp > prev.timestamp) seen.set(v.vehicleId, v);
    }
    const vehicles = [...seen.values()];
    cache = { at: now, vehicles, error: null };
    return {
      configured: true,
      vehicles: filterVehicles(vehicles, bbox, routeId),
      updatedAt: now,
      error: null,
      source: 'hasadna',
    };
  } catch (e) {
    cache = { ...cache, error: String(e.message ?? e) };
    return {
      configured: true,
      vehicles: filterVehicles(cache.vehicles, bbox, routeId),
      updatedAt: cache.at || null,
      error: String(e.message ?? e),
      source: 'hasadna',
    };
  }
}