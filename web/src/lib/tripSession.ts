/**
 * Persist / restore an in-progress Live Directions session so the minimized
 * PiP returns after the tab/app is closed and reopened.
 *
 * Note: a true system overlay over other apps needs native Android code;
 * this is the web/PWA equivalent (session continuity inside the app).
 */

import type { Journey, RouteInfo } from '../types';
import { secondsSinceLocalMidnight } from './format';

const SESSION_KEY = 'bmi_active_trip_session';
/** Drop sessions older than this (ms) even if arrival is still in the future. */
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

export interface TripSessionSnapshot {
  journey: Journey;
  transitAlternatives?: RouteInfo[][];
  corridorMembers?: Journey[];
  minimized: boolean;
  startedAt: number;
  alertsEnabled: boolean;
}

function nowInSeconds(): number {
  return secondsSinceLocalMidnight();
}

function arrivalStillRelevant(journey: Journey, startedAt: number): boolean {
  if (Date.now() - startedAt > MAX_AGE_MS) return false;
  // Allow ~2h past scheduled arrival before auto-clearing.
  const now = nowInSeconds();
  const arrive = journey.arrivalSeconds;
  const grace = 2 * 3600;
  const diff = ((arrive - now) % 86400 + 86400) % 86400;
  // If arrival is more than ~22h ahead, treat as already passed today.
  return diff < 86400 - grace || arrive >= now - grace;
}

export function saveTripSession(snap: TripSessionSnapshot | null): void {
  try {
    if (!snap) {
      localStorage.removeItem(SESSION_KEY);
      return;
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(snap));
  } catch {
    /* noop */
  }
}

export function loadTripSession(): TripSessionSnapshot | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw) as TripSessionSnapshot;
    if (!snap?.journey?.legs?.length || typeof snap.startedAt !== 'number') {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    if (!arrivalStillRelevant(snap.journey, snap.startedAt)) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return snap;
  } catch {
    return null;
  }
}

export function clearTripSession(): void {
  saveTripSession(null);
}
