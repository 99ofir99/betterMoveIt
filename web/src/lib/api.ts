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
  NearbyStopBoard,
  PlanResponse,
  SearchResult,
  ServiceAlert,
  StopDeparturesResponse,
  StopDetailResponse,
  Stop,
  VehiclesResponse,
} from '../types';

// Always same-origin so Vite's `/api` proxy works in dev and Express serves both in prod.
const BASE = '';

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { signal });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${path}`);
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
    const res = await fetch(`${BASE}/api/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: endpoint(from), to: endpoint(to), ...when }),
      signal,
    });
    if (!res.ok) throw new Error(`plan failed: ${res.status}`);
    return (await res.json()) as PlanResponse;
  },


  reverseGeocode: async (lat: number, lon: number, signal?: AbortSignal): Promise<string> => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=jsonv2&accept-language=he,en`;
      const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
      const j = await res.json();
      return j.display_name?.split(',').slice(0, 3).join(', ') ?? `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    } catch {
      return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
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
