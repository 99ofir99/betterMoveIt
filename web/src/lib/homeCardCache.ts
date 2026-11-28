/**
 * Last trip the home card planned, kept in localStorage so reopening the app
 * shows it at once instead of a skeleton while the server plans again (seconds
 * on Render's free tier, up to a minute when it was asleep). The fresh plan
 * replaces it as soon as it lands.
 */

import type { Journey, LatLon, Place } from '../types';
import { haversine } from './tripGuidance';
import { journeyHasDeparted } from './journeyStale';

const KEY = 'bmi.homeCardTrip.v1';

/** Reuse only when planned from about the same spot (GPS fix drifts indoors). */
export const HOME_CACHE_ORIGIN_M = 300;
/** Older plans may miss a faster bus that was added since; plan fresh then. */
export const HOME_CACHE_MAX_AGE_MS = 2 * 60 * 60 * 1000;

export type HomeCardTrip = {
  place: Place;
  origin: LatLon;
  journey: Journey;
  savedAt: number;
};

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function saveHomeCardTrip(trip: HomeCardTrip): void {
  try {
    storage()?.setItem(KEY, JSON.stringify(trip));
  } catch {
    /* quota / private mode: the card just plans as before */
  }
}

/** Pure check, separate from storage so it can be tested. */
export function usableHomeCardTrip(
  trip: HomeCardTrip | null,
  place: Place,
  origin: LatLon,
  nowMs = Date.now(),
  nowSec?: number,
): Journey | null {
  if (!trip?.journey || !trip.place || !trip.origin) return null;
  if (trip.place.lat !== place.lat || trip.place.lon !== place.lon) return null;
  if (nowMs - trip.savedAt > HOME_CACHE_MAX_AGE_MS || nowMs < trip.savedAt) return null;
  if (haversine(trip.origin, origin) > HOME_CACHE_ORIGIN_M) return null;
  if (journeyHasDeparted(trip.journey, nowSec)) return null;
  return trip.journey;
}

export function loadHomeCardTrip(place: Place, origin: LatLon): Journey | null {
  try {
    const raw = storage()?.getItem(KEY);
    if (!raw) return null;
    return usableHomeCardTrip(JSON.parse(raw) as HomeCardTrip, place, origin);
  } catch {
    return null;
  }
}
