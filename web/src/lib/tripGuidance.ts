/**
 * Pure guidance functions for active trip navigation.
 * No side-effects, no React imports — only data in, data out.
 */

import type { Journey, LatLon, TransitLeg, WalkLeg } from '../types';
import type { TripPhase, NextAction } from '../components/trip/types';
import { formatClock12h } from './format';
import { t } from './i18n';

/** Geofence radius used to decide "user has reached a point". */
export const GEOFENCE_M = 55;

// ── Geometry helpers ─────────────────────────────────────────────────────────

/** Haversine distance in metres between two lat/lon points. */
export function haversine(a: LatLon, b: LatLon): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const c =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLon * sinLon;
  return 2 * R * Math.asin(Math.sqrt(c));
}

/** Project pt onto segment [a, b]; return distance in metres. */
function segmentDist(pt: LatLon, a: LatLon, b: LatLon): number {
  const dx = b.lon - a.lon;
  const dy = b.lat - a.lat;
  const len2 = dx * dx + dy * dy;
  const t =
    len2 > 0
      ? Math.max(0, Math.min(1, ((pt.lon - a.lon) * dx + (pt.lat - a.lat) * dy) / len2))
      : 0;
  return haversine(pt, { lat: a.lat + t * dy, lon: a.lon + t * dx });
}

/**
 * Minimum distance from pt to any segment of polyline stored as [lat, lon][].
 * Returns Infinity if the polyline is empty.
 */
export function distToPolyline(pt: LatLon, polyline: [number, number][]): number {
  if (polyline.length === 0) return Infinity;
  if (polyline.length === 1)
    return haversine(pt, { lat: polyline[0][0], lon: polyline[0][1] });
  let min = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const a: LatLon = { lat: polyline[i][0], lon: polyline[i][1] };
    const b: LatLon = { lat: polyline[i + 1][0], lon: polyline[i + 1][1] };
    const d = segmentDist(pt, a, b);
    if (d < min) min = d;
  }
  return min;
}

// ── Timing ───────────────────────────────────────────────────────────────────

/**
 * Compute { startSec, endSec } for each leg.
 * Walk legs infer their window from the surrounding transit departures/arrivals.
 */
export function computeLegTimes(
  journey: Journey
): Array<{ startSec: number; endSec: number }> {
  const result: Array<{ startSec: number; endSec: number }> = [];
  let cursor = journey.departSeconds;
  for (const leg of journey.legs) {
    if (leg.mode === 'transit') {
      result.push({ startSec: leg.departure, endSec: leg.arrival });
      cursor = leg.arrival;
    } else {
      result.push({ startSec: cursor, endSec: cursor + leg.durationSec });
      cursor += leg.durationSec;
    }
  }
  return result;
}

// ── Phase resolution ─────────────────────────────────────────────────────────

function legEndPoint(leg: Journey['legs'][number]): LatLon | null {
  if (leg.mode === 'transit') return { lat: leg.to.lat, lon: leg.to.lon };
  if (leg.to) return { lat: leg.to.lat, lon: leg.to.lon };
  return null;
}

/**
 * Given current GPS position (may be null) and current time in seconds-of-day,
 * determine the active leg index and trip phase.
 *
 * Schedule-based advancement ensures the feature works even without GPS.
 * GPS-based proximity takes over when available, using GEOFENCE_M.
 *
 * Never moves legIndex backwards — callers should persist and pass current index.
 */
export function resolveActiveLeg(
  journey: Journey,
  currentLegIndex: number,
  pos: LatLon | null,
  nowSec: number
): { legIndex: number; phase: TripPhase } {
  const { legs } = journey;
  if (legs.length === 0) return { legIndex: 0, phase: 'done' };

  const times = computeLegTimes(journey);
  let legIdx = Math.min(Math.max(0, currentLegIndex), legs.length - 1);

  // ── 1. Schedule-based advancement ──────────────────────────────────────────
  while (legIdx < legs.length - 1 && nowSec > times[legIdx].endSec + 90) {
    legIdx++;
  }

  // ── 2. GPS-based advancement ────────────────────────────────────────────────
  if (pos) {
    while (legIdx < legs.length - 1) {
      const ep = legEndPoint(legs[legIdx]);
      if (ep && haversine(pos, ep) < GEOFENCE_M) {
        legIdx++;
      } else {
        break;
      }
    }
  }

  // ── 3. Done check ───────────────────────────────────────────────────────────
  if (legIdx === legs.length - 1) {
    const ep = legEndPoint(legs[legIdx]);
    const arrivedByGps = pos && ep ? haversine(pos, ep) < GEOFENCE_M : false;
    const arrivedBySchedule = nowSec > times[legIdx].endSec + 120;
    if (arrivedByGps || arrivedBySchedule) {
      return { legIndex: legIdx, phase: 'done' };
    }
  }

  const leg = legs[legIdx];

  // ── 4. Walk phase ───────────────────────────────────────────────────────────
  if (leg.mode === 'walk') {
    return { legIndex: legIdx, phase: 'walking' };
  }

  // ── 5. Transit phases ───────────────────────────────────────────────────────
  const transitLeg = leg as TransitLeg;

  if (nowSec < transitLeg.departure - 30) {
    return { legIndex: legIdx, phase: 'waiting' };
  }

  // Approaching alight stop?
  const distToAlight = pos
    ? haversine(pos, { lat: transitLeg.to.lat, lon: transitLeg.to.lon })
    : Infinity;
  const timeToAlight = transitLeg.arrival - nowSec;

  if (distToAlight < GEOFENCE_M * 3 || timeToAlight < 120) {
    return { legIndex: legIdx, phase: 'alight' };
  }

  return { legIndex: legIdx, phase: 'onboard' };
}

// ── Progress ─────────────────────────────────────────────────────────────────

/**
 * Progress 0–1 for the given leg.
 * When GPS is available, finds the nearest geometry vertex as a proxy.
 * Falls back to linear schedule interpolation.
 */
export function computeLegProgress(
  journey: Journey,
  legIndex: number,
  pos: LatLon | null,
  nowSec: number
): number {
  const { legs } = journey;
  if (legIndex >= legs.length) return 1;
  const leg = legs[legIndex];
  const times = computeLegTimes(journey);
  const { startSec, endSec } = times[legIndex];
  const duration = endSec - startSec;
  if (duration <= 0) return 0;

  if (pos) {
    const polyline = leg.geometry ?? [];
    if (polyline.length >= 2) {
      let minDist = Infinity;
      let nearestIdx = 0;
      for (let i = 0; i < polyline.length; i++) {
        const d = haversine(pos, { lat: polyline[i][0], lon: polyline[i][1] });
        if (d < minDist) {
          minDist = d;
          nearestIdx = i;
        }
      }
      return Math.min(1, nearestIdx / (polyline.length - 1));
    }
  }

  return Math.max(0, Math.min(1, (nowSec - startSec) / duration));
}

// ── Alight countdown ─────────────────────────────────────────────────────────

/**
 * Index of the stop the rider is at / just left.
 * intermediateStops[0] = board, last = alight.
 *
 * Prefers nearest stop by GPS when a position is supplied (Moovit live rail).
 * Falls back to schedule + geometry progress.
 */
export function resolveStopCursor(
  leg: TransitLeg,
  nowSec: number,
  progress = 0,
  pos: LatLon | null = null
): number {
  const stops = leg.intermediateStops;
  if (!stops || stops.length === 0) return 0;

  let bySchedule = 0;
  for (let i = 0; i < stops.length; i++) {
    if (stops[i]!.arrival <= nowSec) bySchedule = i;
  }

  if (pos) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < stops.length; i++) {
      const s = stops[i]!;
      if (s.lat == null || s.lon == null || !Number.isFinite(s.lat) || !Number.isFinite(s.lon)) continue;
      const d = haversine(pos, { lat: s.lat, lon: s.lon });
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    // Within ~180m of a stop → treat as that stop; otherwise stay between schedule and nearest.
    if (bestDist <= 180) {
      return Math.min(stops.length - 1, Math.max(bySchedule, bestIdx));
    }
  }

  const byProgress = Math.round(
    Math.max(0, Math.min(1, progress)) * (stops.length - 1)
  );
  // Never jump ahead of schedule by more than one stop via geometry noise.
  return Math.min(stops.length - 1, Math.max(bySchedule, Math.min(byProgress, bySchedule + 1)));
}

/**
 * Stops remaining until alight (including the alight stop once you've left the current one).
 * Moovit "Ride N stops to" uses this count.
 */
export function countStopsToAlight(
  leg: TransitLeg,
  nowSec: number,
  progress = 0,
  pos: LatLon | null = null
): number {
  const stops = leg.intermediateStops;
  if (!stops || stops.length === 0) return 0;
  const cursor = resolveStopCursor(leg, nowSec, progress, pos);
  return Math.max(0, stops.length - 1 - cursor);
}

// ── Next action builder ───────────────────────────────────────────────────────

/** Build the user-facing next-action object for the given leg/phase. */
export function buildNextAction(
  journey: Journey,
  legIndex: number,
  phase: TripPhase,
  nowSec: number,
  progress = 0,
  pos: LatLon | null = null
): NextAction {
  const { legs } = journey;

  if (phase === 'done' || legIndex >= legs.length) {
    const lastLeg = legs[legs.length - 1];
    const destName = lastLeg
      ? lastLeg.mode === 'transit'
        ? (lastLeg as TransitLeg).toName
        : (lastLeg as WalkLeg).toName ?? ''
      : '';
    return { title: t("You're here!"), subtitle: destName };
  }

  const leg = legs[legIndex];
  const nextLeg = legs[legIndex + 1];

  if (phase === 'walking') {
    const walkLeg = leg as WalkLeg;
    const toName =
      walkLeg.toName ??
      (nextLeg?.mode === 'transit' ? (nextLeg as TransitLeg).fromName : '');
    // Moovit: walk strip shows remaining walk time, not schedule window to the bus.
    const countdownSec = Math.max(
      0,
      Math.round(walkLeg.durationSec * (1 - Math.min(1, Math.max(0, progress))))
    );
    return {
      title: t('Walk {m} m to {name}', { m: Math.round(walkLeg.distanceM), name: toName }),
      subtitle: nextLeg
        ? nextLeg.mode === 'transit'
          ? t('Then take {line}', { line: (nextLeg as TransitLeg).route.displayName })
          : t('Then continue')
        : t('Your destination'),
      countdownSec,
    };
  }

  if (phase === 'waiting') {
    const transitLeg = leg as TransitLeg;
    return {
      title: t('Wait for {line}', { line: transitLeg.route.displayName }),
      subtitle: `→ ${transitLeg.headsign}`,
      countdownSec: Math.max(0, transitLeg.departure - nowSec),
      routeColor: transitLeg.route.color,
      routeLabel: transitLeg.route.displayName,
      typeName: transitLeg.route.typeName,
    };
  }

  if (phase === 'onboard' || phase === 'alight') {
    const transitLeg = leg as TransitLeg;
    const stopsToAlight = countStopsToAlight(transitLeg, nowSec, progress, pos);
    const countdownSec = Math.max(0, transitLeg.arrival - nowSec);
    // Moovit: strip says "Ride N stops to"; body title is the alight stop name.
    const rideLabel =
      stopsToAlight <= 0
        ? t('Get off now')
        : stopsToAlight === 1
          ? t('Ride 1 stop to')
          : t('Ride {n} stops to', { n: stopsToAlight });
    return {
      title: transitLeg.toName,
      subtitle: rideLabel,
      countdownSec,
      stopsToAlight,
      routeColor: transitLeg.route.color,
      routeLabel: transitLeg.route.displayName,
      typeName: transitLeg.route.typeName,
    };
  }

  return { title: t('Locating…'), subtitle: '' };
}

// ── Minimized PiP chip (Moovit multi_leg_nav_pip_layout) ──────────────────────

export type PipKind = 'walk' | 'wait' | 'ride' | 'done';

/** Display model for the floating active-trip bubble after Back. */
export interface PipContent {
  kind: PipKind;
  /** Primary instruction, e.g. "Walk to Ha-Tavor". */
  title: string;
  /** Accent detail: remaining meters / wait mins / ride mins. */
  detail: string;
  /** Absolute arrival clock for the whole trip. */
  arriveClock: string;
  /** Relative time until trip arrival, e.g. "63 min". */
  arriveRelative: string;
  routeColor?: string | null;
}

function remainingWalkMeters(
  leg: WalkLeg,
  pos: LatLon | null,
  progress: number
): number {
  if (pos && leg.to) {
    return Math.max(0, Math.round(haversine(pos, { lat: leg.to.lat, lon: leg.to.lon })));
  }
  return Math.max(0, Math.round(leg.distanceM * (1 - Math.min(1, Math.max(0, progress)))));
}

function formatArriveRelative(sec: number): string {
  const mins = Math.max(0, Math.round(sec / 60));
  if (mins <= 0) return t('now');
  return t('{n} min', { n: mins });
}

/**
 * Moovit PiP content for a minimized Live Directions session.
 * Title / accent detail follow the current phase; footer is whole-trip ETA.
 */
export function buildPipContent(
  journey: Journey,
  legIndex: number,
  phase: TripPhase,
  nowSec: number,
  progress = 0,
  pos: LatLon | null = null
): PipContent {
  const arriveClock = formatClock12h(journey.arrivalSeconds);
  const arriveRelative = formatArriveRelative(journey.arrivalSeconds - nowSec);
  const footer = { arriveClock, arriveRelative };

  if (phase === 'done' || legIndex >= journey.legs.length) {
    return { kind: 'done', title: t("You're here!"), detail: '', ...footer };
  }

  const leg = journey.legs[legIndex]!;
  const nextLeg = journey.legs[legIndex + 1];

  if (phase === 'walking') {
    const walk = leg as WalkLeg;
    const toName =
      walk.toName ??
      (nextLeg?.mode === 'transit' ? (nextLeg as TransitLeg).fromName : '') ??
      t('destination');
    const meters = remainingWalkMeters(walk, pos, progress);
    return {
      kind: 'walk',
      title: t('Walk to {name}', { name: toName }),
      detail: t('{n} m', { n: meters }),
      ...footer,
    };
  }

  if (phase === 'waiting') {
    const transit = leg as TransitLeg;
    const waitSec = Math.max(0, transit.departure - nowSec);
    return {
      kind: 'wait',
      title: t('Wait for {line}', { line: transit.route.displayName }),
      detail: formatArriveRelative(waitSec),
      routeColor: transit.route.color,
      ...footer,
    };
  }

  // onboard / alight
  const transit = leg as TransitLeg;
  const stops = countStopsToAlight(transit, nowSec, progress, pos);
  const rideSec = Math.max(0, transit.arrival - nowSec);
  const title =
    stops <= 0
      ? t('Get off now')
      : stops === 1
        ? t('Ride 1 stop to {name}', { name: transit.toName })
        : t('Ride {n} stops to {name}', { n: stops, name: transit.toName });
  return {
    kind: 'ride',
    title,
    detail: formatArriveRelative(rideSec),
    routeColor: transit.route.color,
    ...footer,
  };
}
