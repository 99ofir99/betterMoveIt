/** Trip history — save planned journeys for replay. */

import type { Line, Place } from '../types';

export interface TripHistoryEntry {
  id: string;
  from: Place;
  to: Place;
  createdAt: string;
  durationSec?: number;
  transfers?: number;
  /** Line labels from the planned journey (short / display names). */
  routes?: string[];
  /** Transit lines of the planned journey (feeds the Lines tab "For you" list). */
  lines?: Line[];
}

const KEY = 'bmi.history.v1';
const MAX = 40;

export function loadHistory(): TripHistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as TripHistoryEntry[];
  } catch {
    return [];
  }
}

export function saveHistoryEntry(entry: Omit<TripHistoryEntry, 'id' | 'createdAt'>): TripHistoryEntry[] {
  const next: TripHistoryEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  const prev = loadHistory().filter(
    (h) =>
      !(
        h.from.lat.toFixed(4) === next.from.lat.toFixed(4) &&
        h.from.lon.toFixed(4) === next.from.lon.toFixed(4) &&
        h.to.lat.toFixed(4) === next.to.lat.toFixed(4) &&
        h.to.lon.toFixed(4) === next.to.lon.toFixed(4)
      )
  );
  const list = [next, ...prev].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(list));
  return list;
}

export function clearHistory(): void {
  localStorage.removeItem(KEY);
}

export function removeHistoryEntry(id: string): TripHistoryEntry[] {
  const list = loadHistory().filter((h) => h.id !== id);
  localStorage.setItem(KEY, JSON.stringify(list));
  return list;
}
