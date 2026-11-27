/**
 * Hasadna Open Bus Stride — public SIRI vehicle locations (no API key).
 * LineRef is GTFS route_id; short names come from the transit store sidecar.
 *
 * Strategy: keep a warm in-memory snapshot and serve bbox filters from it.
 * Stale-while-revalidate so map clients never wait on Hasadna after the first fill.
 */

import { getStore } from './store.js';

const HASADNA_LIST_URL =
  process.env.HASADNA_VEHICLE_URL ||
  'https://open-bus-stride-api.hasadna.org.il/siri_vehicle_locations/list';

const FRESH_MS = Number(process.env.HASADNA_FRESH_MINUTES || 10) * 60_000;
const FETCH_LIMIT = Number(process.env.HASADNA_VEHICLE_LIMIT || 2000);
/** Serve cache without waiting on upstream when younger than this. */
const CACHE_TTL_MS = Number(process.env.HASADNA_CACHE_MS || 8_000);
/** Soft ceiling for a refresh; clients should not block this long. */
const FETCH_TIMEOUT_MS = Number(process.env.HASADNA_TIMEOUT_MS || 10_000);

let cache = { at: 0, vehicles: [], error: null };
/** @type {Promise<void> | null} */
let inflight = null;

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
    operatorRef:
      row.siri_route__operator_ref != null ? String(row.siri_route__operator_ref) : undefined,
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

function response(bbox, routeId) {
  return {
    configured: true,
    vehicles: filterVehicles(cache.vehicles, bbox, routeId),
    updatedAt: cache.at || null,
    error: cache.error,
    source: 'hasadna',
  };
}

/**
 * Pull a fresh national-ish snapshot into cache (no bbox — filter locally).
 */
async function refreshHasadna() {
  const now = Date.now();
  const url = new URL(HASADNA_LIST_URL);
  url.searchParams.set('limit', String(FETCH_LIMIT));
  url.searchParams.set('order_by', 'siri_snapshot_id desc');

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'BetterMoveIt/1.0' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
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
    cache = { at: Date.now(), vehicles: [...seen.values()], error: null };
  } catch (e) {
    cache = { ...cache, error: String(e.message ?? e) };
  }
}

function ensureRefresh() {
  if (inflight) return inflight;
  inflight = refreshHasadna().finally(() => {
    inflight = null;
  });
  return inflight;
}

/**
 * Recent vehicle positions from Hasadna.
 * Fast path: filter the warm cache. Refresh in the background when stale.
 */
export async function fetchHasadnaVehicles({ bbox, routeId } = {}) {
  const now = Date.now();
  const age = cache.at ? now - cache.at : Number.POSITIVE_INFINITY;
  const hasData = cache.vehicles.length > 0;

  if (hasData && age < CACHE_TTL_MS) {
    return response(bbox, routeId);
  }

  if (hasData) {
    // Stale-while-revalidate: paint immediately, refresh off-request.
    void ensureRefresh();
    return response(bbox, routeId);
  }

  // Cold start — must wait once.
  await ensureRefresh();
  return response(bbox, routeId);
}
