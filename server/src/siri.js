/**
 * MOT SIRI-SM live feed client.
 * With MOT_KEY, uses Ministry of Transport SIRI-SM.
 * Without a key, falls back to Hasadna Open Bus Stride vehicle locations.
 */

import { fetchHasadnaVehicles, hasadnaConfigured } from './hasadna.js';

const MOT_KEY = process.env.MOT_KEY || process.env.MOT_SIRI_KEY || '';
const MOT_SIRI_URL =
  process.env.MOT_SIRI_URL ||
  'https://moran.mot.gov.il/Channels/HTTPChannel/SmQuery/2.8/json';

let cache = { at: 0, vehicles: [], error: null };

export function siriConfigured() {
  return Boolean(MOT_KEY) || hasadnaConfigured();
}

/**
 * AllActiveTripsFilter — vehicle positions for the whole country.
 * Cached ~15s to match MOT refresh cadence.
 */
export async function fetchActiveVehicles({ bbox, routeId } = {}) {
  if (!MOT_KEY) {
    return fetchHasadnaVehicles({ bbox, routeId });
  }

  const now = Date.now();
  if (now - cache.at < 14_000 && !routeId) {
    return { configured: true, vehicles: filterVehicles(cache.vehicles, bbox, routeId), updatedAt: cache.at, error: cache.error };
  }

  const url = new URL(MOT_SIRI_URL);
  url.searchParams.set('Key', MOT_KEY);
  url.searchParams.set('MonitoringRef', 'AllActiveTripsFilter');
  url.searchParams.set('StopVisitDetailLevel', 'normal');

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'BetterMoovit/1.0' },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) throw new Error(`SIRI HTTP ${res.status}`);
    const json = await res.json();
    const visits =
      json?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit ?? [];
    const vehicles = [];
    for (const v of visits) {
      const j = v.MonitoredVehicleJourney;
      if (!j?.VehicleLocation) continue;
      const lat = Number(j.VehicleLocation.Latitude);
      const lon = Number(j.VehicleLocation.Longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      vehicles.push({
        vehicleId: String(j.VehicleRef ?? `${j.LineRef}-${lat}-${lon}`),
        routeId: String(j.LineRef ?? ''),
        lineName: String(j.PublishedLineName ?? ''),
        lat,
        lon,
        bearing: j.Bearing != null ? Number(j.Bearing) : undefined,
        speed: j.Velocity != null ? Number(j.Velocity) : undefined,
        timestamp: Date.parse(v.RecordedAtTime || '') || now,
        stopCode: j.MonitoredCall?.StopPointRef ? String(j.MonitoredCall.StopPointRef) : undefined,
      });
    }
    cache = { at: now, vehicles, error: null };
    return {
      configured: true,
      vehicles: filterVehicles(vehicles, bbox, routeId),
      updatedAt: now,
      error: null,
    };
  } catch (e) {
    cache = { ...cache, error: String(e.message ?? e) };
    return {
      configured: true,
      vehicles: filterVehicles(cache.vehicles, bbox, routeId),
      updatedAt: cache.at || null,
      error: String(e.message ?? e),
    };
  }
}

/**
 * Stop monitoring for one or more stop codes (GTFS stop_code).
 */
export async function fetchStopMonitoring(stopCodes, previewMinutes = 90) {
  if (!MOT_KEY) {
    return { configured: false, visits: [], error: 'MOT_KEY not set' };
  }
  const codes = (Array.isArray(stopCodes) ? stopCodes : [stopCodes]).filter(Boolean).slice(0, 10);
  if (codes.length === 0) return { configured: true, visits: [], error: null };

  const url = new URL(MOT_SIRI_URL);
  url.searchParams.set('Key', MOT_KEY);
  url.searchParams.set('MonitoringRef', codes.join(','));
  url.searchParams.set('StopVisitDetailLevel', 'normal');
  url.searchParams.set('PreviewInterval', `PT${previewMinutes}M`);

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'BetterMoovit/1.0' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`SIRI HTTP ${res.status}`);
    const json = await res.json();
    const raw =
      json?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit ?? [];
    const visits = raw.map((v) => {
      const j = v.MonitoredVehicleJourney;
      const call = j?.MonitoredCall;
      return {
        stopCode: String(v.MonitoringRef ?? call?.StopPointRef ?? ''),
        lineName: String(j?.PublishedLineName ?? ''),
        routeId: String(j?.LineRef ?? ''),
        vehicleId: j?.VehicleRef ? String(j.VehicleRef) : undefined,
        aimed: call?.AimedArrivalTime || null,
        expected: call?.ExpectedArrivalTime || call?.AimedArrivalTime || null,
        live: Boolean(call?.ExpectedArrivalTime),
      };
    });
    return { configured: true, visits, error: null };
  } catch (e) {
    return { configured: true, visits: [], error: String(e.message ?? e) };
  }
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
