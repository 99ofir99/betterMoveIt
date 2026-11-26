/**
 * Application state and side effects.
 *
 * Everything that is not rendering lives here: geolocation, debounced search,
 * planning, selection, and persistence of recent places. Components only read
 * state and call actions.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import { saveHistoryEntry } from './history';
import { loadSettings } from './settings';
import { dedupeJourneys, dedupePlaces, dedupeSearchResults } from './dedupeSearch';
import { enrichWalkGeometries } from './enrichWalkGeometries';
import { fillWalkEndpoints } from './journeyMap';
import { normalizeJourneys } from './journeyTiming';
import { useStableLatLon } from './useStableLatLon';
import { useWatchLocation } from './useWatchLocation';
import type {
  Journey,
  LatLon,
  PlanResponse,
  Place,
  SearchResult,
  Stop,
  TransitLeg,
} from '../types';

export type Panel = 'plan' | 'journeys' | 'stop';

interface PlanState {
  journeys: Journey[];
  loading: boolean;
  error: string | null;
  elapsedMs: number | null;
  reason?: string;
}

const DEFAULT_CENTER: LatLon = { lat: 32.0853, lon: 34.7818 }; // Tel Aviv

function todayPlanDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD from HTML date input → YYYYMMDD for the planner API. */
export function planDateToApi(isoDate: string): string {
  return isoDate.replace(/-/g, '');
}

export function useAppState(opts?: { watchLocation?: boolean }) {
  const watchLocation = opts?.watchLocation !== false;
  const [panel, setPanel] = useState<Panel>('plan');
  const [from, setFrom] = useState<Place | null>(null);
  const [to, setTo] = useState<Place | null>(null);
  const [selectedJourney, setSelectedJourney] = useState<number>(0);
  const [plan, setPlan] = useState<PlanState>({ journeys: [], loading: false, error: null, elapsedMs: null });
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [userLocation, setUserLocation] = useState<LatLon | null>(null);
  const [locating, setLocating] = useState(false);
  const [center, setCenter] = useState<LatLon>(DEFAULT_CENTER);
  const [gpsAllowed, setGpsAllowed] = useState(true);

  // Continuous GPS (Moovit): keep blue-dot / origin / frequent-card fresh without tapping Locate.
  const watched = useWatchLocation(watchLocation);
  const [recent, setRecent] = useState<Place[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('bmi.recent') ?? '[]');
    } catch {
      return [];
    }
  });
  const [when, setWhen] = useState<'now' | 'leave'>('now');
  const [departTime, setDepartTime] = useState<string>('');
  const [planDate, setPlanDate] = useState<string>(todayPlanDate);
  const requestRef = useRef<AbortController | null>(null);

  // Persist recents so the app is useful immediately on reopen.
  useEffect(() => {
    localStorage.setItem('bmi.recent', JSON.stringify(recent.slice(0, 6)));
  }, [recent]);

  // Mirror watchPosition into canonical userLocation.
  useEffect(() => {
    if (!watched.location) return;
    setUserLocation(watched.location);
    setGpsAllowed(watched.allowed);
  }, [watched.location?.lat, watched.location?.lon, watched.allowed]);

  // Keep "My location" origin coords in sync when the user walks (label stays until reverse-geocode).
  useEffect(() => {
    if (!userLocation || !from) return;
    const dLat = Math.abs(from.lat - userLocation.lat);
    const dLon = Math.abs(from.lon - userLocation.lon);
    const isMyLoc =
      /my location|current location|מיקום נוכחי/i.test(from.label) ||
      (dLat < 0.0008 && dLon < 0.0008);
    if (!isMyLoc) return;
    // Only update when moved ~25m+ to avoid thrashing.
    if (dLat < 0.00025 && dLon < 0.00025) return;
    setFrom((prev) =>
      prev ? { ...prev, lat: userLocation.lat, lon: userLocation.lon } : prev
    );
  }, [userLocation?.lat, userLocation?.lon, from?.lat, from?.lon, from?.label]);

  const rememberPlace = useCallback((p: Place) => {
    setRecent((prev) => dedupePlaces([p, ...prev]).slice(0, 6));
  }, []);

  const locate = useCallback(async () => {
    if (!navigator.geolocation) {
      setPlan((p) => ({ ...p, error: 'Location is not available on this device.' }));
      return null;
    }
    setLocating(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12000,
          // Explicit recenter should not reuse a stale cached fix.
          maximumAge: 0,
        })
      );
      const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      setUserLocation(loc);
      setCenter(loc);
      setGpsAllowed(true);
      return loc;
    } catch {
      setPlan((p) => ({ ...p, error: 'Could not get your location. Check permissions.' }));
      return null;
    } finally {
      setLocating(false);
    }
  }, []);

  /** Fill "from" with the device position, reverse-geocoded when possible. */
  const useMyLocationAsOrigin = useCallback(async (): Promise<Place | null> => {
    const loc = userLocation ?? (await locate());
    if (!loc) return null;
    const name = await api.reverseGeocode(loc.lat, loc.lon);
    const place: Place = { label: name || 'My location', lat: loc.lat, lon: loc.lon };
    setFrom(place);
    rememberPlace(place);
    return place;
  }, [locate, rememberPlace, userLocation]);

  const selectPlace = useCallback(
    (place: Place, slot: 'from' | 'to') => {
      if (slot === 'from') setFrom(place);
      else setTo(place);
      rememberPlace(place);
      setCenter({ lat: place.lat, lon: place.lon });
    },
    [rememberPlace]
  );

  const planTrip = useCallback(
    async (
      origin?: Place | null,
      destination?: Place | null,
      opts?: {
        forceNow?: boolean;
        leaveAt?: string;
        leaveDate?: string;
        /** Desired arrival HH:MM — we leave ~2h earlier then pick closest arrival. */
        arriveBy?: string;
        arriveDate?: string;
        /** Roll to next calendar day when today's plan is empty (default true for "now"). */
        allowNextDay?: boolean;
      }
    ) => {
      const o = origin ?? from;
      const d = destination ?? to;
      if (!o || !d) return;

      let effectiveWhen: 'now' | 'leave' = opts?.forceNow
        ? 'now'
        : opts?.leaveAt || opts?.arriveBy
          ? 'leave'
          : when;

      if (opts?.forceNow) setWhen('now');
      if (opts?.leaveAt) {
        setWhen('leave');
        setDepartTime(opts.leaveAt.length === 5 ? opts.leaveAt : opts.leaveAt.slice(0, 5));
      }
      if (opts?.leaveDate) setPlanDate(opts.leaveDate);
      let leaveAtOpt = opts?.leaveAt;
      let leaveDateOpt = opts?.leaveDate;
      const arriveByOpt = opts?.arriveBy;

      if (arriveByOpt) {
        setWhen('leave');
        // Seed depart ~2h before desired arrival so RAPTOR still finds candidates.
        const arriveParts = arriveByOpt.split(':').map(Number);
        const arriveSec = (arriveParts[0] || 0) * 3600 + (arriveParts[1] || 0) * 60;
        const leaveSec = (arriveSec - 2 * 3600 + 86400) % 86400;
        const hh = String(Math.floor(leaveSec / 3600)).padStart(2, '0');
        const mm = String(Math.floor((leaveSec % 3600) / 60)).padStart(2, '0');
        leaveAtOpt = `${hh}:${mm}`;
        leaveDateOpt = opts?.arriveDate ?? opts?.leaveDate;
        setDepartTime(leaveAtOpt);
        if (leaveDateOpt) setPlanDate(leaveDateOpt);
        effectiveWhen = 'leave';
      }

      requestRef.current?.abort();
      const ctrl = new AbortController();
      requestRef.current = ctrl;

      setPlan({ journeys: [], loading: true, error: null, elapsedMs: null });
      setPanel('journeys');
      setSelectedJourney(0);

      try {
        const leaveTime = leaveAtOpt ?? departTime;
        const leaveDate = leaveDateOpt ?? planDate;
        const timeParam =
          effectiveWhen === 'leave' && leaveTime
            ? leaveTime.length === 5
              ? `${leaveTime}:00`
              : leaveTime
            : undefined;
        const dateParam =
          effectiveWhen === 'leave' && leaveDate ? planDateToApi(leaveDate) : undefined;
        const settings = loadSettings();
        let res: PlanResponse = await api.plan(
          o,
          d,
          {
            ...(dateParam ? { date: dateParam } : {}),
            ...(timeParam ? { time: timeParam } : {}),
            maxWalk: settings.maxWalkM,
          },
          ctrl.signal
        );
        if (ctrl.signal.aborted) return;

        // Late night / no more service today → roll to tomorrow so cards still show a bus.
        const allowNext =
          opts?.allowNextDay !== false &&
          (effectiveWhen === 'now' || opts?.forceNow) &&
          res.journeys.length === 0;
        if (allowNext) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const y = tomorrow.getFullYear();
          const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
          const day = String(tomorrow.getDate()).padStart(2, '0');
          res = await api.plan(
            o,
            d,
            {
              date: `${y}${m}${day}`,
              time: '04:00:00',
              maxWalk: settings.maxWalkM,
            },
            ctrl.signal
          );
          if (ctrl.signal.aborted) return;
        }

        // Arrive-by: keep journeys that land closest to the desired arrival.
        if (arriveByOpt && res.journeys.length > 1) {
          const parts = arriveByOpt.split(':').map(Number);
          const target = (parts[0] || 0) * 3600 + (parts[1] || 0) * 60;
          res = {
            ...res,
            journeys: [...res.journeys].sort(
              (a, b) =>
                Math.abs(((a.arrivalSeconds % 86400) + 86400) % 86400 - target) -
                Math.abs(((b.arrivalSeconds % 86400) + 86400) % 86400 - target)
            ),
          };
        }

        // Walk endpoints for straight-line map paths. OSRM foot geometry is slow
        // (public router often ~10s) — never block journey cards on it.
        for (const journey of res.journeys) {
          fillWalkEndpoints(journey, o, d);
        }

        if (ctrl.signal.aborted) return;
        const journeys = normalizeJourneys(dedupeJourneys(res.journeys));
        setPlan({
          journeys,
          loading: false,
          error: null,
          elapsedMs: res.elapsedMs ?? null,
          reason: res.reason,
        });
        const best = journeys[0];
        const routeNames =
          best?.routes?.filter(Boolean) ??
          best?.legs
            .filter((leg): leg is TransitLeg => leg.mode === 'transit')
            .flatMap((leg) => [leg.route.shortName, leg.route.displayName].filter(Boolean)) ??
          [];
        saveHistoryEntry({
          from: o,
          to: d,
          durationSec: best?.durationSec,
          transfers: best?.transfers,
          routes: [...new Set(routeNames)],
        });

        void enrichWalkGeometries(journeys, ctrl.signal).then((changed) => {
          if (!changed || ctrl.signal.aborted) return;
          setPlan((prev) =>
            prev.loading || prev.journeys !== journeys
              ? prev
              : { ...prev, journeys: journeys.map((j) => ({ ...j, legs: [...j.legs] })) }
          );
        });
      } catch (e) {
        if (ctrl.signal.aborted || (e as Error).name === 'AbortError') return;
        setPlan({ journeys: [], loading: false, error: (e as Error).message, elapsedMs: null });
      }
    },
    [departTime, from, planDate, to, when]
  );

  const swapEnds = useCallback(() => {
    setFrom(to);
    setTo(from);
  }, [from, to]);

  const openStop = useCallback((stop: Stop) => {
    setSelectedStop(stop);
    setPanel('stop');
    setCenter({ lat: stop.lat, lon: stop.lon });
  }, []);

  const clearStop = useCallback(() => {
    setSelectedStop(null);
    // Prefer returning to results when a plan is still loaded.
    setPanel(plan.journeys.length > 0 ? 'journeys' : 'plan');
  }, [plan.journeys.length]);

  /** Leave results and return to the home / idle planner (keeps origin). */
  const resetPlan = useCallback(() => {
    setPlan({ journeys: [], loading: false, error: null, elapsedMs: null });
    setPanel('plan');
  }, []);

  /** Clear destination and results — full reset toward a new trip. */
  const clearDestination = useCallback(() => {
    setTo(null);
    setPlan({ journeys: [], loading: false, error: null, elapsedMs: null });
    setPanel('plan');
  }, []);

  return useMemo(
    () => ({
      panel,
      setPanel,
      from,
      to,
      selectedJourney,
      setSelectedJourney,
      plan,
      selectedStop,
      userLocation,
      gpsAllowed,
      locating,
      center,
      setCenter,
      recent,
      when,
      setWhen,
      departTime,
      setDepartTime,
      planDate,
      setPlanDate,
      locate,
      useMyLocationAsOrigin,
      selectPlace,
      setFrom,
      setTo,
      planTrip,
      swapEnds,
      openStop,
      clearStop,
      resetPlan,
      clearDestination,
    }),
    [
      panel,
      from,
      to,
      selectedJourney,
      plan,
      selectedStop,
      userLocation,
      gpsAllowed,
      locating,
      center,
      recent,
      when,
      departTime,
      planDate,
      locate,
      useMyLocationAsOrigin,
      selectPlace,
      planTrip,
      swapEnds,
      openStop,
      clearStop,
      resetPlan,
      clearDestination,
    ]
  );
}

export type AppState = ReturnType<typeof useAppState>;

/** Debounced stop + place search used by the place inputs. */
export function useStopSearch(query: string, bias?: { lat: number; lon: number } | null, delayMs = 180) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  // Live GPS updates every ~1s; keep bias stable so results don't reshuffle.
  const stableBias = useStableLatLon(bias ?? null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 1) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const [stops, places] = await Promise.all([
          api.searchStops(trimmed, stableBias, ctrl.signal),
          trimmed.length >= 2
            ? api.geocodeSearch(trimmed, stableBias, ctrl.signal)
            : Promise.resolve<SearchResult[]>([]),
        ]);
        if (!ctrl.signal.aborted) {
          const stopKeys = new Set(stops.map((s) => `${s.lat?.toFixed(4)},${s.lon?.toFixed(4)}`));
          const uniquePlaces = places.filter(
            (p) => !stopKeys.has(`${p.lat?.toFixed(4)},${p.lon?.toFixed(4)}`)
          );
          setResults(dedupeSearchResults([...stops, ...uniquePlaces]));
        }
      } catch (e) {
        if (ctrl.signal.aborted || (e as Error).name === 'AbortError') return;
        setResults([]);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, delayMs);

    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, stableBias?.lat, stableBias?.lon, delayMs]);

  return { results, loading };
}

/** Debounced reverse geocoding for a map-picked point. */
export function useReverseGeocode(point: LatLon | null) {
  const [label, setLabel] = useState<string>('');
  useEffect(() => {
    if (!point) {
      setLabel('');
      return;
    }
    const ctrl = new AbortController();
    api.reverseGeocode(point.lat, point.lon, ctrl.signal).then((n) => {
      if (!ctrl.signal.aborted) setLabel(n);
    });
    return () => ctrl.abort();
  }, [point?.lat, point?.lon]);
  return label;
}
