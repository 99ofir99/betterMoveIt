/** Journey ranking strategies exposed in the results UI. */

import type { Journey, TransitLeg } from '../types';
import type { TransportPrefs } from './settings';
import { modeFamilyForRoute, transportKeyForRoute } from './transportMode';

export type SortMode = 'best' | 'fastest' | 'fewest-transfers' | 'least-walking';

/** Rank positions a journey drops per transit leg that uses a disabled transport type. */
const DISABLED_MODE_PENALTY = 2;

/**
 * Moovit "Best": an extra transfer costs ~9 minutes of equivalent arrival time.
 * Pure earliest-arrival was promoting 3-bus trips that only saved a few minutes.
 */
const TRANSFER_PENALTY_SEC = 12 * 60;
/** Drop / demote options that need more buses but arrive within this of a simpler trip. */
const TRANSFER_SLACK_SEC = 12 * 60;

/**
 * "Fastest": a light-rail (tram) option wins over a non-light-rail one with the
 * same number of transfers when it is at most this much slower.
 */
export const LIGHT_RAIL_PREFERENCE_SEC = 8 * 60;

function journeyUsesLightRail(journey: Journey): boolean {
  return journey.legs.some(
    (leg) => leg.mode === 'transit' && modeFamilyForRoute(leg.route) === 'tram'
  );
}

/**
 * Sort by duration, then lift each light-rail journey above the non-light-rail
 * journeys just ahead of it that have the same transfer count and are at most
 * LIGHT_RAIL_PREFERENCE_SEC faster. Done as a pass over a stable sort (not a
 * comparator) because a tolerance comparator is not transitive.
 */
function sortFastest(journeys: Journey[]): Journey[] {
  const sorted = journeys.sort(
    (a, b) => a.durationSec - b.durationSec || a.arrivalSeconds - b.arrivalSeconds
  );
  for (let i = 1; i < sorted.length; i++) {
    const tram = sorted[i]!;
    if (!journeyUsesLightRail(tram)) continue;
    let target = i;
    for (let k = i - 1; k >= 0; k--) {
      const other = sorted[k]!;
      if (journeyUsesLightRail(other)) break;
      if (tram.durationSec - other.durationSec > LIGHT_RAIL_PREFERENCE_SEC) break;
      if (other.transfers === tram.transfers) target = k;
    }
    if (target < i) {
      sorted.splice(i, 1);
      sorted.splice(target, 0, tram);
    }
  }
  return sorted;
}

function bestScore(j: Journey): number {
  return j.arrivalSeconds + j.transfers * TRANSFER_PENALTY_SEC;
}

function journeyHasRailMode(journey: Journey): boolean {
  return journey.legs.some((leg) => {
    if (leg.mode !== 'transit') return false;
    const fam = modeFamilyForRoute(leg.route);
    return fam === 'tram' || fam === 'rail';
  });
}

/** Bus-only options must not hide light-rail alternatives (Moovit shows both). */
function transferDominated(extra: Journey, simpler: Journey): boolean {
  if (simpler.transfers >= extra.transfers) return false;
  if (journeyHasRailMode(extra) && !journeyHasRailMode(simpler)) return false;
  if (simpler.arrivalSeconds > extra.arrivalSeconds + TRANSFER_SLACK_SEC) return false;
  if (simpler.durationSec > extra.durationSec + TRANSFER_SLACK_SEC) return false;
  return true;
}

/**
 * Prefer fewer transfers when ETA is similar (Moovit Best).
 * Explicit modes keep pure arrival / walk / transfer sorts.
 */
export function sortJourneys(journeys: Journey[], mode: SortMode): Journey[] {
  const copy = [...journeys];
  switch (mode) {
    case 'fastest':
      return sortFastest(copy);
    case 'fewest-transfers':
      return copy.sort(
        (a, b) =>
          a.transfers - b.transfers ||
          a.arrivalSeconds - b.arrivalSeconds ||
          a.durationSec - b.durationSec
      );
    case 'least-walking':
      return copy.sort(
        (a, b) =>
          a.walkMeters - b.walkMeters ||
          a.arrivalSeconds - b.arrivalSeconds ||
          a.durationSec - b.durationSec
      );
    case 'best':
    default: {
      // Cull transfer-dominated options (3 buses ≈ same ETA as 2) — two-pass
      // so a simpler trip kills a flashier multi-leg even when scored worse.
      const byScore = copy.sort(
        (a, b) =>
          bestScore(a) - bestScore(b) ||
          a.transfers - b.transfers ||
          a.arrivalSeconds - b.arrivalSeconds ||
          a.durationSec - b.durationSec
      );
      return byScore.filter(
        (j) => !byScore.some((p) => p !== j && transferDominated(j, p))
      );
    }
  }
}

/**
 * Sort by `mode`, then softly demote journeys that ride a transport type the user
 * disabled. Nothing is filtered out, so users always still see their options.
 */
export function rankJourneys(
  journeys: Journey[],
  mode: SortMode,
  transportPrefs?: TransportPrefs
): Journey[] {
  const base = sortJourneys(journeys, mode);
  if (!transportPrefs) return base;

  const scored = base.map((journey, baseIndex) => ({
    journey,
    baseIndex,
    score: baseIndex + disabledLegCount(journey, transportPrefs) * DISABLED_MODE_PENALTY,
  }));
  scored.sort((a, b) => a.score - b.score || a.baseIndex - b.baseIndex);
  return scored.map((s) => s.journey);
}

function disabledLegCount(journey: Journey, prefs: TransportPrefs): number {
  return journey.legs.filter((leg): leg is TransitLeg => {
    if (leg.mode !== 'transit') return false;
    const key = transportKeyForRoute(leg.route);
    return key !== null && prefs[key] === false;
  }).length;
}
