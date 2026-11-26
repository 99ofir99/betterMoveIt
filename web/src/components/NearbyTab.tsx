/**
 * NearbyTab — shows stops within ~1.2 km with live departure previews.
 * Uses api.nearbyBoard() (withDepartures=1) so each stop row shows next buses.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import { contrastText, relativeBoardMinutes, routeColor } from '../lib/format';
import type { LatLon, NearbyStopBoard, Stop } from '../types';

/** ~100m — ignore GPS jitter so watchPosition doesn't refetch every tick. */
const FETCH_DELTA = 0.0009;

function outsideCoverage(
  point: LatLon,
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number } | undefined
): boolean {
  if (!bbox) return false;
  return (
    point.lat < bbox.minLat ||
    point.lat > bbox.maxLat ||
    point.lon < bbox.minLon ||
    point.lon > bbox.maxLon
  );
}

// ── Props ────────────────────────────────────────────────────────────────────

interface NearbyTabProps {
  center: LatLon;
  onOpenStop: (stop: Stop) => void;
  onLocate: () => void;
  locating: boolean;
}

// ── Main component ───────────────────────────────────────────────────────────

export function NearbyTab({ center, onOpenStop, onLocate, locating }: NearbyTabProps) {
  const [stops, setStops] = useState<NearbyStopBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [outOfCoverage, setOutOfCoverage] = useState(false);
  /** Stable origin for board fetch — advances on ~100m move or explicit Locate. */
  const [fetchCenter, setFetchCenter] = useState<LatLon>(center);
  const [locateTick, setLocateTick] = useState(0);
  const wasLocatingRef = useRef(false);

  const load = useCallback(
    async (lat: number, lon: number, signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const r = await api.nearbyBoard(lat, lon, 1200, signal);
        setStops(r.stops);
        if (r.stops.length === 0) {
          try {
            const health = await api.health(signal);
            const bbox =
              health.bbox && !Array.isArray(health.bbox) ? health.bbox : undefined;
            setOutOfCoverage(outsideCoverage({ lat, lon }, bbox));
          } catch {
            setOutOfCoverage(false);
          }
        } else {
          setOutOfCoverage(false);
        }
      } catch (e) {
        if (!(e instanceof DOMException && e.name === 'AbortError')) {
          setError((e as Error).message ?? 'Failed to load nearby stops');
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Continuously watched GPS jitters every ~1s; only refetch after meaningful move.
  useEffect(() => {
    setFetchCenter((prev) => {
      if (
        Math.abs(prev.lat - center.lat) >= FETCH_DELTA ||
        Math.abs(prev.lon - center.lon) >= FETCH_DELTA
      ) {
        return { lat: center.lat, lon: center.lon };
      }
      return prev;
    });
  }, [center.lat, center.lon]);

  // Explicit Locate always refreshes departures, even if GPS barely moved.
  useEffect(() => {
    if (wasLocatingRef.current && !locating) {
      setFetchCenter({ lat: center.lat, lon: center.lon });
      setLocateTick((n) => n + 1);
    }
    wasLocatingRef.current = locating;
  }, [locating, center.lat, center.lon]);

  useEffect(() => {
    const ctrl = new AbortController();
    void load(fetchCenter.lat, fetchCenter.lon, ctrl.signal);
    return () => ctrl.abort();
  }, [fetchCenter.lat, fetchCenter.lon, locateTick, load]);

  return (
    <div className="nearby-tab">
      <div className="nearby-tab__head">
        <div>
          <h2 className="nearby-tab__title">Nearby</h2>
          {!loading && (
            <p className="nearby-tab__subtitle">
              {stops.length} stop{stops.length !== 1 ? 's' : ''} found
            </p>
          )}
        </div>
        <button
          type="button"
          className="icon-button icon-button--light"
          onClick={onLocate}
          aria-label="Update my location"
        >
          {locating ? (
            <span style={{ fontSize: 14 }}>…</span>
          ) : (
            <LocateIcon />
          )}
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="muted">Finding nearby stops…</p>}
      {!loading && !error && stops.length === 0 && (
        <p className="muted">
          {outOfCoverage
            ? 'Your location is outside the covered area (metro Tel Aviv / Gush Dan).'
            : 'No stops found nearby. Try a different location.'}
        </p>
      )}

      <ul className="nearby-board">
        {stops.map((stop) => (
          <NearbyStopCard key={stop.id} stop={stop} onPress={onOpenStop} />
        ))}
      </ul>
    </div>
  );
}

// ── Stop card (visual sub-component) ────────────────────────────────────────

function NearbyStopCard({
  stop,
  onPress,
}: {
  stop: NearbyStopBoard;
  onPress: (s: Stop) => void;
}) {
  const deps = stop.departures ?? [];
  const distanceLabel =
    stop.distance != null ? `${Math.round(stop.distance)} m away` : null;
  const metaParts = [stop.code ? `Stop ${stop.code}` : null, distanceLabel].filter(Boolean);

  return (
    <li className="nearby-board__card">
      <button
        type="button"
        className="nearby-board__header"
        onClick={() => onPress(stop)}
        aria-label={`Open stop ${stop.name}`}
      >
        <BusStopSvg />
        <div className="nearby-board__titles">
          <span className="nearby-board__name">{stop.name}</span>
          {metaParts.length > 0 && (
            <span className="nearby-board__meta">{metaParts.join(' · ')}</span>
          )}
        </div>
        <ChevronSvg />
      </button>

      {deps.length > 0 && (
        <ul className="nearby-board__deps">
          {deps.slice(0, 4).map((dep, i) => {
            const bg = routeColor(dep.route.color, dep.route.typeName);
            const next = dep.next[0];
            const eta = next?.minutes;
            const live = next?.live === true;
            const etaLabel =
              eta == null
                ? '—'
                : relativeBoardMinutes(eta, { departureSec: next?.departure });
            return (
              <li key={`${dep.route.index}-${dep.headsign}-${i}`} className="nearby-board__dep">
                <span
                  className="line-chip"
                  style={{ background: bg, color: contrastText(bg), fontSize: 11 }}
                >
                  {dep.route.displayName}
                </span>
                <span className="nearby-board__headsign">{dep.headsign}</span>
                <span className={`nearby-board__eta${live ? ' is-live' : ''}`}>
                  {etaLabel}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

// ── Icons (inline SVG, Material-style) ───────────────────────────────────────

function LocateIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
    </svg>
  );
}

function BusStopSvg() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      style={{ color: 'var(--accent)', flexShrink: 0 }}
    >
      <path d="M4 16c0 1.1.9 2 2 2h1v2c0 .55.45 1 1 1s1-.45 1-1v-2h6v2c0 .55.45 1 1 1s1-.45 1-1v-2h1c1.1 0 2-.9 2-2V6c0-3.5-3.58-4-8-4S4 2.5 4 6v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM12 4c2.84 0 5 .22 6 1H6c1-.78 3.16-1 6-1zM6 8h12v5H6V8z" />
    </svg>
  );
}

function ChevronSvg() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ color: 'var(--text-faint)', flexShrink: 0 }}
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
