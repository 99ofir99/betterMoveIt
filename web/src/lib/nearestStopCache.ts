/**
 * Last "Nearest station" card, kept in localStorage so reopening the app shows
 * the stop and its next departures at once instead of an empty card while GPS
 * and two requests run. Fresh data replaces it as soon as it lands.
 */

import type { DepartureGroup, LatLon, Stop } from '../types';
import { haversine } from './tripGuidance';

const KEY = 'bmi.nearestStop.v1';

/** Reuse only when the user is about where it was saved. */
export const NEAREST_CACHE_ORIGIN_M = 150;
/** Before any GPS fix, show the saved card only if it is this recent. */
export const NEAREST_CACHE_NO_FIX_MS = 10 * 60 * 1000;
/** Departures older than this are not shown (the stop still is). */
export const NEAREST_CACHE_DEPARTURES_MS = 30 * 60 * 1000;

export type NearestStopSnapshot = {
  origin: LatLon;
  stop: Stop;
  distanceM: number | null;
  groups: DepartureGroup[];
  savedAt: number;
};

export function saveNearestStop(snap: NearestStopSnapshot): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(snap));
  } catch {
    /* private mode / quota: the card just loads as before */
  }
}

export function readNearestStop(): NearestStopSnapshot | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw) as NearestStopSnapshot;
    return snap?.stop?.id && snap.origin && Number.isFinite(snap.savedAt) ? snap : null;
  } catch {
    return null;
  }
}

/**
 * Saved departures counted down by the time since they were saved; buses that
 * have left are dropped and nothing claims to be live any more.
 */
export function ageGroups(groups: DepartureGroup[], elapsedMs: number): DepartureGroup[] {
  if (elapsedMs < 0 || elapsedMs > NEAREST_CACHE_DEPARTURES_MS) return [];
  const passed = elapsedMs / 60_000;
  return groups
    .map((g) => ({
      ...g,
      live: false,
      siri: false,
      next: g.next
        .map((n) => ({
          ...n,
          minutes: Math.round(n.minutes - passed),
          live: false,
          confidence: 'none' as const,
          source: 'schedule' as const,
        }))
        .filter((n) => n.minutes >= 0),
    }))
    .filter((g) => g.next.length > 0)
    .sort((a, b) => a.next[0].minutes - b.next[0].minutes);
}

/**
 * The saved card if it fits: near `origin` when there is a fix, otherwise only
 * when saved in the last few minutes.
 */
export function usableNearestStop(
  snap: NearestStopSnapshot | null,
  origin: LatLon | null,
  nowMs = Date.now(),
): NearestStopSnapshot | null {
  if (!snap) return null;
  const age = nowMs - snap.savedAt;
  if (age < 0) return null;
  if (origin) {
    if (haversine(origin, snap.origin) > NEAREST_CACHE_ORIGIN_M) return null;
  } else if (age > NEAREST_CACHE_NO_FIX_MS) {
    return null;
  }
  return { ...snap, groups: ageGroups(snap.groups, age) };
}
