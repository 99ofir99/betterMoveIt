/**
 * Thin API client. All network access goes through here so components never
 * build URLs themselves.
 */

import type {
  HealthResponse,
  LatLon,
  Line,
  LineDetailResponse,
  LineScheduleResponse,
  LineTimetableResponse,
  NearbyStopBoard,
  PlanResponse,
  SearchResult,
  ServiceAlert,
  StopDeparturesResponse,
  StopDetailResponse,
  Stop,
  VehiclesResponse,
} from '../types';

import {
  formatAddress,
  nearestHouseNumber,
  withHouseNumber,
  type NominatimReverse,
  type OsmAddressPoint,
} from './formatAddress';

// Always same-origin so Vite's `/api` proxy works in dev and Express serves both in prod.
const BASE = '';

/**
 * Statuses worth retrying: the host's proxy answers 502/503/504 while the server
 * restarts (a redeploy, or waking from idle on the free plan, takes ~20-40 s).
 */
const RETRY_STATUS = new Set([502, 503, 504]);
/** Waits between attempts: ~25 s in all, enough to ride out a restart. */
const RETRY_DELAYS_MS = [1200, 2500, 5000, 8000, 8000];

/** Endpoints that proxy third parties (Nominatim, OSRM, vehicle feeds): their 502 is
 *  the upstream failing, so retrying only delays the fallback. */
const NO_RETRY = /^\/api\/(geocode|walk|vehicles)\b/;

/** Listeners told when a core request is being retried (UI: "still searching…"). */
const retryListeners = new Set<(retrying: boolean) => void>();
export function onApiRetry(fn: (retrying: boolean) => void): () => void {
  retryListeners.add(fn);
  return () => {
    retryListeners.delete(fn);
  };
}
let retryingCount = 0;
function setRetrying(delta: number) {
  const before = retryingCount > 0;
  retryingCount = Math.max(0, retryingCount + delta);
  const after = retryingCount > 0;
  if (before !== after) retryListeners.forEach((fn) => fn(after));
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const id = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(id);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true }
    );
  });
}

/** Error carrying the HTTP status so callers can word it (never shown raw). */
export class ApiError extends Error {
  constructor(public status: number, path: string) {
    super(`${status} for ${path}`);
    this.name = 'ApiError';
  }
}

/**
 * fetch with quiet retries on a restarting server (5xx gateway errors) and dropped
 * connections. Requests here are all safe to repeat (reads, and the planner POST).
 */
async function fetchRetry(path: string, init: RequestInit = {}): Promise<Response> {
  const signal = init.signal ?? undefined;
  let retrying = false;
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetch(`${BASE}${path}`, init);
        if (!RETRY_STATUS.has(res.status) || attempt >= RETRY_DELAYS_MS.length) return res;
      } catch (e) {
        if ((e as Error).name === 'AbortError') throw e;
        // Offline: no point hammering; let the caller say so.
        if (typeof navigator !== 'undefined' && navigator.onLine === false) throw e;
        if (attempt >= RETRY_DELAYS_MS.length) throw e;
      }
      if (!retrying) {
        retrying = true;
        setRetrying(1);
      }
      await wait(RETRY_DELAYS_MS[attempt]!, signal);
    }
  } finally {
    if (retrying) setRetrying(-1);
  }
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = NO_RETRY.test(path) ? await fetch(`${BASE}${path}`, { signal }) : await fetchRetry(path, { signal });
  if (!res.ok) throw new ApiError(res.status, path);
  return (await res.json()) as T;
}

export const api = {
  health: (signal?: AbortSignal) => getJson<HealthResponse>('/api/health', signal),

  search: async (
    q: string,
    bias?: { lat: number; lon: number } | null,
    signal?: AbortSignal
  ): Promise<SearchResult[]> => {
    if (!q.trim()) return [];
    const biasParam = bias ? `&lat=${bias.lat}&lon=${bias.lon}` : '';
    const data = await getJson<{ results: SearchResult[] }>(
      `/api/search?q=${encodeURIComponent(q)}${biasParam}`,
      signal
    );
    return data.results;
  },

  searchStops: async (
    q: string,
    bias?: { lat: number; lon: number } | null,
    signal?: AbortSignal
  ): Promise<SearchResult[]> => {
    const all = await api.search(q, bias, signal);
    return all.filter((r) => r.kind === 'stop' || r.kind === 'place');
  },

  nearby: (lat: number, lon: number, radius = 700, signal?: AbortSignal) =>
    getJson<{ stops: Stop[] }>(`/api/nearby?lat=${lat}&lon=${lon}&radius=${radius}`, signal),

  nearbyBoard: (lat: number, lon: number, radius = 1200, signal?: AbortSignal) =>
    getJson<{ stops: NearbyStopBoard[] }>(
      `/api/nearby?lat=${lat}&lon=${lon}&radius=${radius}&withDepartures=1`,
      signal
    ),

  nearbyLines: (lat: number, lon: number, radius = 600, signal?: AbortSignal) =>
    getJson<{ lines: Line[] }>(
      `/api/nearby?lat=${lat}&lon=${lon}&radius=${radius}&withLines=1&limit=20`,
      signal
    ),

  stopDepartures: (stopId: string, signal?: AbortSignal) =>
    getJson<StopDeparturesResponse>(`/api/stop/${encodeURIComponent(stopId)}/departures`, signal),

  stopDetail: (stopId: string, signal?: AbortSignal) =>
    getJson<StopDetailResponse>(`/api/stop/${encodeURIComponent(stopId)}`, signal),

  plan: async (
    from: LatLon & { stopId?: string; label?: string; name?: string },
    to: LatLon & { stopId?: string; label?: string; name?: string },
    when?: { date?: string; time?: string; maxWalk?: number },
    signal?: AbortSignal
  ): Promise<PlanResponse> => {
    const endpoint = (p: LatLon & { stopId?: string; label?: string; name?: string }) => ({
      lat: p.lat,
      lon: p.lon,
      stopId: p.stopId,
      // Place uses `label`; server reads `name` for walk leg place names.
      name: p.name ?? p.label,
    });
    const res = await fetchRetry('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: endpoint(from), to: endpoint(to), ...when }),
      signal,
    });
    if (!res.ok) throw new ApiError(res.status, '/api/plan');
    return (await res.json()) as PlanResponse;
  },


  reverseGeocode: async (lat: number, lon: number, signal?: AbortSignal): Promise<string> =>
    (await api.reverseGeocodeDetail(lat, lon, signal)).full,

  /**
   * Reverse geocode, plus the nearest mapped house number when Nominatim gives a
   * street without one (common on long boulevards). `plain` is the Nominatim-only
   * label, so a label saved before this can be recognised and upgraded.
   */
  reverseGeocodeDetail: async (
    lat: number,
    lon: number,
    signal?: AbortSignal
  ): Promise<{ plain: string; full: string }> => {
    const coords = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    try {
      // zoom=18 = building level, so a mapped house number comes back in `address`.
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=jsonv2&addressdetails=1&zoom=18&accept-language=he,en`;
      const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
      const j = (await res.json()) as NominatimReverse;
      const plain = formatAddress(j) ?? coords;
      const a = j.address ?? {};
      const street = a.road || a.pedestrian || a.square;
      if (!street || a.house_number) return { plain, full: plain };
      try {
        const q = `[out:json][timeout:8];nwr(around:60,${lat},${lon})["addr:housenumber"]["addr:street"];out center 60;`;
        const ov = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          body: new URLSearchParams({ data: q }),
          signal,
        });
        const data = (await ov.json()) as { elements?: OsmAddressPoint[] };
        const hit = nearestHouseNumber(data.elements ?? [], lat, lon, street);
        return { plain, full: formatAddress(withHouseNumber(j, hit)) ?? plain };
      } catch {
        return { plain, full: plain };
      }
    } catch {
      return { plain: coords, full: coords };
    }
  },

  /** Forward geocode via server proxy (avoids CORS). Results are kind:'place'. */
  geocodeSearch: async (
    q: string,
    bias?: { lat: number; lon: number } | null,
    signal?: AbortSignal
  ): Promise<SearchResult[]> => {
    if (!q.trim()) return [];
    const biasParam = bias ? `&lat=${bias.lat}&lon=${bias.lon}` : '';
    try {
      const data = await getJson<{ results: SearchResult[] }>(
        `/api/geocode?q=${encodeURIComponent(q)}${biasParam}`,
        signal
      );
      return data.results ?? [];
    } catch {
      return [];
    }
  },

  /** Fetch a walk route geometry from the server (OSRM). Returns null on failure. */
  walkRoute: async (
    fromLat: number,
    fromLon: number,
    toLat: number,
    toLon: number,
    signal?: AbortSignal
  ): Promise<{ distanceM: number; durationSec: number; geometry: [number, number][] } | null> => {
    try {
      const data = await getJson<{
        journey: { distanceM: number; durationSec: number; geometry: [number, number][] } | null;
      }>(
        `/api/walk?fromLat=${fromLat}&fromLon=${fromLon}&toLat=${toLat}&toLon=${toLon}`,
        signal
      );
      return data.journey ?? null;
    } catch {
      return null;
    }
  },

  searchLines: async (q: string, signal?: AbortSignal): Promise<Line[]> => {
    if (!q.trim()) return [];
    const data = await getJson<{ results: Line[] }>(
      `/api/lines/search?q=${encodeURIComponent(q)}`,
      signal
    );
    return data.results;
  },

  lineDetail: (
    lineId: string,
    opts?: { direction?: number },
    signal?: AbortSignal
  ) => {
    const q =
      opts?.direction !== undefined ? `?direction=${encodeURIComponent(String(opts.direction))}` : '';
    return getJson<LineDetailResponse>(`/api/lines/${encodeURIComponent(lineId)}${q}`, signal);
  },

  lineSchedule: (
    lineId: string,
    opts?: { direction?: number; date?: string; time?: string },
    signal?: AbortSignal
  ) => {
    const params = new URLSearchParams();
    if (opts?.direction !== undefined) params.set('direction', String(opts.direction));
    if (opts?.date) params.set('date', opts.date);
    if (opts?.time) params.set('time', opts.time);
    const q = params.toString();
    return getJson<LineScheduleResponse>(
      `/api/lines/${encodeURIComponent(lineId)}/schedule${q ? `?${q}` : ''}`,
      signal
    );
  },

  /** A line's departures at one stop for one day (day 0 = today from now, … 6). */
  lineTimetable: (
    lineId: string,
    opts: { stopId: string; direction?: number; day?: number },
    signal?: AbortSignal
  ) => {
    const params = new URLSearchParams({ stop: opts.stopId, day: String(opts.day ?? 0) });
    if (opts.direction !== undefined) params.set('direction', String(opts.direction));
    return getJson<LineTimetableResponse>(
      `/api/lines/${encodeURIComponent(lineId)}/timetable?${params}`,
      signal
    );
  },

  vehicles: (opts?: { bbox?: number[]; routeId?: string }, signal?: AbortSignal) => {
    const params = new URLSearchParams();
    if (opts?.bbox?.length === 4) params.set('bbox', opts.bbox.join(','));
    if (opts?.routeId) params.set('routeId', opts.routeId);
    const q = params.toString();
    return getJson<VehiclesResponse>(`/api/vehicles${q ? `?${q}` : ''}`, signal);
  },

  alerts: (signal?: AbortSignal) =>
    getJson<{ alerts: ServiceAlert[]; siri: boolean }>('/api/alerts', signal),
};
