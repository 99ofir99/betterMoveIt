/**
 * Moovit-style corridor bundling (journey-pattern deduplication).
 *
 * After RAPTOR returns raw itineraries, group by a structural route signature
 * so lines that share the same physical journey (walk pattern + board/alight
 * stop pairs) collapse into one card with merged line badges and the next
 * upcoming departure among any of them.
 *
 * Real GTFS often uses different stopIds for parallel platforms — stop tokens
 * therefore match by id, display name, or proximity, not raw GTFS id alone.
 */

import type { Journey, RouteInfo, TransitLeg } from '../types';
import { modeFamilyForRoute } from './transportMode';

/** Duration bucket size so express ≠ slow local on the same endpoints (spec: ~5 min). */
const DURATION_BUCKET_SEC = 5 * 60;
/** Absolute floor so very short trips still clamp sensibly. */
const DURATION_TOLERANCE_SEC = 22 * 60;
/**
 * Opposite-curb / parallel bay with no shared name — must be very close.
 * Wider gaps without a name relation are different stops (e.g. Azrieli vs Shaul Hamelech).
 */
const PLATFORM_PROXIMITY_M = 110;
/** Soft-name-related stops may sit this far apart and still count as one. */
const STOP_PROXIMITY_M = 280;
/** First-leg access stops can sit farther apart when alights already match. */
const FIRST_LEG_BOARD_PROXIMITY_M = 400;
/**
 * Transfer / last-leg parallel boards (Dankner platform vs Schneider / Orlov)
 * that still feed the same Jabotinsky corridor toward the destination.
 */
const TRANSFER_BOARD_PROXIMITY_M = 550;
/** Hub / central stations often span a large footprint. */
const HUB_ALIGHT_PROXIMITY_M = 450;
/**
 * Last-ride drop-offs that both still walk a similar distance to the destination
 * may sit this far apart (e.g. Rothschild/Sheinkin vs Yehuda Halevi).
 */
const LAST_ALIGHT_PAIR_M = 450;
/** Max walk from last alight to the shared trip destination for last-leg clamp. */
const LAST_EGRESS_TO_DEST_M = 700;
/** If one trip drops at the door and the other a station away, keep them separate. */
const EGRESS_BALANCE_M = 150;

export interface ClampedJourney {
  /** Representative journey (earliest arrival / next-departing of the group). */
  journey: Journey;
  /**
   * For each transit leg position, the distinct lines that can serve that slot.
   * Length always matches the number of transit legs; length 1 means no alternatives.
   */
  transitAlternatives: RouteInfo[][];
  /** Indices into the pre-clamp journey list that were merged into this card. */
  sourceIndices: number[];
}

function transitLegs(journey: Journey): TransitLeg[] {
  return journey.legs.filter((l): l is TransitLeg => l.mode === 'transit');
}

function routeKey(route: RouteInfo): string {
  const name = (route.displayName || route.shortName || '').trim().toLowerCase();
  const agency = (route.agency || '').trim().toLowerCase();
  const mode = modeFamilyForRoute(route);
  if (name) return `${mode}|${agency}|${name}`;
  return `idx:${route.index}`;
}

/**
 * Corridor identity ignores short transfer walks between platforms
 * (walk>transit>walk>transit>walk vs walk>transit>transit>walk).
 */
function modeSequence(journey: Journey): string {
  const rides = transitLegs(journey).length;
  if (rides === 0) return 'WALK';
  return Array.from({ length: rides }, () => 'TRANSIT').join('>');
}

function durationBucket(durationSec: number): number {
  return Math.round(durationSec / DURATION_BUCKET_SEC);
}

function sameDurationBucket(a: Journey, b: Journey): boolean {
  if (durationBucket(a.durationSec) === durationBucket(b.durationSec)) return true;
  // Soft floor: short trips / RAPTOR noise within absolute tolerance still bundle.
  return Math.abs(a.durationSec - b.durationSec) <= DURATION_TOLERANCE_SEC;
}

function normName(name: string | undefined): string {
  return (name ?? '')
    .trim()
    .toLowerCase()
    .replace(/['"`׳״]/g, '')
    .replace(/[־–—]/g, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ');
}

function looksLikeHub(name: string): boolean {
  return /מרכז|central|terminal|תחנה|מסוף|station|bus station|ת\.מ|ת\. רכבת/i.test(name);
}

function haversineM(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function hasCoords(p: { lat: number; lon: number }): boolean {
  return (
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lon) &&
    (p.lat !== 0 || p.lon !== 0)
  );
}

function namesRelated(nameA: string, nameB: string): boolean {
  const na = normName(nameA);
  const nb = normName(nameB);
  if (!na || !nb) return false;
  if (na === nb) return true;
  return (na.includes(nb) || nb.includes(na)) && Math.min(na.length, nb.length) >= 4;
}

/**
 * Same physical stop for clamping: identical stopId, else same / related display
 * name (with proximity), else a true parallel platform within ~110 m.
 * Bare proximity past PLATFORM_PROXIMITY_M without a name relation does NOT match —
 * that was merging distinct corridors (light-rail station vs bus stop).
 */
function sameStop(
  a: { stopId?: string; lat: number; lon: number },
  b: { stopId?: string; lat: number; lon: number },
  nameA: string,
  nameB: string,
  proximityM: number = STOP_PROXIMITY_M
): boolean {
  if (a.stopId && b.stopId && a.stopId === b.stopId) return true;

  const na = normName(nameA);
  const nb = normName(nameB);
  if (na && nb && na === nb) return true;

  const related = namesRelated(nameA, nameB);
  const near = hasCoords(a) && hasCoords(b) ? haversineM(a, b) : Infinity;

  if (related) {
    const limit =
      looksLikeHub(nameA) || looksLikeHub(nameB)
        ? Math.max(proximityM, HUB_ALIGHT_PROXIMITY_M)
        : proximityM;
    // Related names with unknown coords still count (tests omit coords sometimes).
    if (!Number.isFinite(near) || near === Infinity || near <= limit) return true;
  }

  // True parallel bay / opposite curb — no name required, but must be tight.
  if (near <= PLATFORM_PROXIMITY_M) return true;

  // Large hub footprint only when both names look like hubs.
  if (
    looksLikeHub(nameA) &&
    looksLikeHub(nameB) &&
    near <= Math.max(proximityM, HUB_ALIGHT_PROXIMITY_M)
  ) {
    return true;
  }

  return false;
}

/**
 * Deterministic stop token for signatures when ids/names align.
 * Fuzzy proximity is handled separately via sameCorridorStructure.
 */
function stopToken(
  point: { stopId?: string; lat: number; lon: number },
  name: string
): string {
  const n = normName(name);
  if (n) return `n:${n}`;
  if (point.stopId) return `id:${point.stopId}`;
  if (Number.isFinite(point.lat) && Number.isFinite(point.lon) && (point.lat !== 0 || point.lon !== 0)) {
    return `g:${point.lat.toFixed(3)},${point.lon.toFixed(3)}`;
  }
  return 'unknown';
}

/**
 * Route signature: mode sequence + board/alight stop pairs per transit leg +
 * duration bucket. Line identity is intentionally excluded so interchangeable
 * buses on the same corridor share a key.
 */
export function routeGroupSignature(journey: Journey): string {
  const modes = modeSequence(journey);
  // Include mode family per ride so bus→bus never clamps with bus→R1.
  const families = transitLegs(journey)
    .map((leg) => modeFamilyForRoute(leg.route))
    .join('>');
  const pairs = transitLegs(journey)
    .map((leg) => `${stopToken(leg.from, leg.fromName)}>${stopToken(leg.to, leg.toName)}`)
    .join(';');
  return `${modes}|${families}|${pairs}|t${durationBucket(journey.durationSec)}`;
}

function journeyEndpoint(
  journey: Journey,
  which: 'start' | 'end'
): { lat: number; lon: number } | null {
  if (which === 'start') {
    for (const leg of journey.legs) {
      if (leg.from && Number.isFinite(leg.from.lat) && Number.isFinite(leg.from.lon)) {
        return leg.from;
      }
    }
    return null;
  }
  for (let i = journey.legs.length - 1; i >= 0; i--) {
    const leg = journey.legs[i]!;
    if (leg.to && Number.isFinite(leg.to.lat) && Number.isFinite(leg.to.lon)) {
      return leg.to;
    }
  }
  return null;
}

/**
 * Last transit drop-offs for one corridor card.
 * Same stop / parallel platform wins; otherwise both must walk a similar
 * distance to the shared destination from nearby alights — not one door-side
 * bus and one station a block away (מכון מור vs בן גוריון).
 */
function sameLastAlight(
  la: TransitLeg,
  lb: TransitLeg,
  destA: { lat: number; lon: number } | null,
  destB: { lat: number; lon: number } | null
): boolean {
  if (sameStop(la.to, lb.to, la.toName, lb.toName, HUB_ALIGHT_PROXIMITY_M)) return true;

  const dest =
    destA && destB && haversineM(destA, destB) <= 150
      ? destA
      : destA && destB
        ? null
        : (destA ?? destB);
  if (!dest || !hasCoords(la.to) || !hasCoords(lb.to)) return false;

  const egressA = haversineM(la.to, dest);
  const egressB = haversineM(lb.to, dest);
  if (egressA > LAST_EGRESS_TO_DEST_M || egressB > LAST_EGRESS_TO_DEST_M) return false;
  if (Math.abs(egressA - egressB) > EGRESS_BALANCE_M) return false;
  return haversineM(la.to, lb.to) <= LAST_ALIGHT_PAIR_M;
}

/**
 * Two itineraries share a corridor if the rider experiences the same physical
 * journey (walk pattern + stop pairs), differing only by which vehicle they board.
 * Last-leg alights may be nearby parallels that walk to the same destination —
 * Moovit still clamps those into one card (e.g. 24 / 25).
 */
function sameCorridorStructure(a: Journey, b: Journey): boolean {
  if (!sameDurationBucket(a, b)) return false;
  if (modeSequence(a) !== modeSequence(b)) return false;

  const ta = transitLegs(a);
  const tb = transitLegs(b);
  if (ta.length !== tb.length || ta.length === 0) return false;

  const destA = journeyEndpoint(a, 'end');
  const destB = journeyEndpoint(b, 'end');

  for (let i = 0; i < ta.length; i++) {
    const la = ta[i]!;
    const lb = tb[i]!;
    // Bus 37 and light rail R1 can share Jabotinsky stops — keep them separate.
    if (modeFamilyForRoute(la.route) !== modeFamilyForRoute(lb.route)) return false;
    const isLast = i === ta.length - 1;

    if (isLast) {
      if (!sameLastAlight(la, lb, destA, destB)) return false;
    } else if (!sameStop(la.to, lb.to, la.toName, lb.toName)) {
      return false;
    }

    if (sameStop(la.from, lb.from, la.fromName, lb.fromName)) continue;

    const boardLimit = i === 0 ? FIRST_LEG_BOARD_PROXIMITY_M : TRANSFER_BOARD_PROXIMITY_M;
    if (haversineM(la.from, lb.from) <= boardLimit) continue;

    return false;
  }

  return true;
}

function firstBoardSec(journey: Journey): number {
  const first = transitLegs(journey)[0];
  return first?.departure ?? journey.departSeconds;
}

/** Next-arriving / earliest board wins as the card's primary trip + map geometry. */
function isBetterRepresentative(candidate: Journey, current: Journey): boolean {
  if (candidate.arrivalSeconds !== current.arrivalSeconds) {
    return candidate.arrivalSeconds < current.arrivalSeconds;
  }
  const cBoard = firstBoardSec(candidate);
  const curBoard = firstBoardSec(current);
  if (cBoard !== curBoard) return cBoard < curBoard;
  return candidate.durationSec < current.durationSec;
}

function pushUniqueRoute(list: RouteInfo[], route: RouteInfo): void {
  if (list.some((r) => routeKey(r) === routeKey(route))) return;
  list.push(route);
}

interface Bundle {
  /** Stable signature of the first member (for exact-hash fast path). */
  signature: string;
  journey: Journey;
  /** All members — fuzzy match against any so transfer-board drift cannot split a corridor. */
  members: Journey[];
  transitAlternatives: RouteInfo[][];
  sourceIndices: number[];
}

/**
 * Collapse ranked journeys into Moovit-style corridor bundles.
 * Preserves input order of the first (primary) member of each group; the
 * representative itinerary is the earliest-arriving member of that bundle.
 */
export function clampJourneys(journeys: readonly Journey[]): ClampedJourney[] {
  const bundles: Bundle[] = [];
  /** Exact signature → first bundle index (fast path when stop tokens align). */
  const bySignature = new Map<string, number>();

  for (let i = 0; i < journeys.length; i++) {
    const journey = journeys[i]!;
    const sig = routeGroupSignature(journey);
    const legs = transitLegs(journey);

    let bundleIdx = bySignature.get(sig);

    // Fuzzy path: parallel platforms / nearby curbs may produce different tokens.
    // Match against any member — not only the representative — so a park board
    // alt does not strand later Orlov/Dankner alts in a second card.
    if (bundleIdx == null) {
      for (let b = 0; b < bundles.length; b++) {
        if (bundles[b]!.members.some((m) => sameCorridorStructure(m, journey))) {
          bundleIdx = b;
          break;
        }
      }
    }

    if (bundleIdx == null) {
      bySignature.set(sig, bundles.length);
      bundles.push({
        signature: sig,
        journey,
        members: [journey],
        transitAlternatives: legs.map((leg) => [leg.route]),
        sourceIndices: [i],
      });
      continue;
    }

    const bundle = bundles[bundleIdx]!;
    bySignature.set(sig, bundleIdx);
    bundle.sourceIndices.push(i);
    bundle.members.push(journey);

    const otherLegs = transitLegs(journey);
    for (let slot = 0; slot < bundle.transitAlternatives.length; slot++) {
      const otherRoute = otherLegs[slot]?.route;
      if (otherRoute) pushUniqueRoute(bundle.transitAlternatives[slot]!, otherRoute);
    }

    if (isBetterRepresentative(journey, bundle.journey)) {
      // Keep line order: representative's routes first, then prior alternatives.
      const merged: RouteInfo[][] = otherLegs.map((leg, slot) => {
        const list: RouteInfo[] = [leg.route];
        for (const r of bundle.transitAlternatives[slot] ?? []) {
          pushUniqueRoute(list, r);
        }
        return list;
      });
      bundle.journey = journey;
      bundle.transitAlternatives = merged;
    }
  }

  return bundles.map(({ journey, transitAlternatives, sourceIndices }) => ({
    journey,
    transitAlternatives,
    sourceIndices,
  }));
}
