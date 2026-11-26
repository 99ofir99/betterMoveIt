/**
 * Local favorites persistence (Home / Work / stops / lines).
 * Logic only — UI lives in FavoritesTab.
 */

import type { FavoriteLine, FavoritePlace, FavoriteStop, Line, Place, Stop } from '../types';

const KEY = 'bmi.favorites.v1';
/** Dispatched after local favorites are written — App listens to refresh live buses. */
export const FAVORITES_CHANGED_EVENT = 'bmi:favorites-changed';

export interface FavoritesState {
  places: FavoritePlace[];
  stops: FavoriteStop[];
  lines: FavoriteLine[];
}

const EMPTY: FavoritesState = { places: [], stops: [], lines: [] };

export function loadFavorites(): FavoritesState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as FavoritesState;
    return {
      places: parsed.places ?? [],
      stops: parsed.stops ?? [],
      lines: parsed.lines ?? [],
    };
  } catch {
    return EMPTY;
  }
}

export function saveFavorites(state: FavoritesState): void {
  localStorage.setItem(KEY, JSON.stringify(state));
  window.dispatchEvent(new Event(FAVORITES_CHANGED_EVENT));
}

/** Stable id for a custom favourite place (lat/lon rounded). */
export function customPlaceId(place: Place): string {
  return `custom-${place.lat.toFixed(5)},${place.lon.toFixed(5)}`;
}

export function upsertPlace(kind: 'home' | 'work' | 'custom', place: Place, label?: string): FavoritesState {
  const state = loadFavorites();
  const id = kind === 'custom' ? customPlaceId(place) : kind;
  const next: FavoritePlace = {
    id,
    kind,
    label: label ?? (kind === 'home' ? 'Home' : kind === 'work' ? 'Work' : place.label),
    place,
  };
  const places = state.places.filter((p) => p.id !== id);
  places.unshift(next);
  const updated = { ...state, places };
  saveFavorites(updated);
  return updated;
}

export function removePlace(id: string): FavoritesState {
  const state = loadFavorites();
  const updated = { ...state, places: state.places.filter((p) => p.id !== id) };
  saveFavorites(updated);
  return updated;
}

/** Toggle a custom place favourite (search / home Add flow). */
export function toggleFavoritePlace(place: Place, label?: string): FavoritesState {
  const id = customPlaceId(place);
  const state = loadFavorites();
  if (state.places.some((p) => p.id === id)) {
    return removePlace(id);
  }
  return upsertPlace('custom', place, label ?? place.label);
}

export function isFavoritePlace(place: Place): boolean {
  const id = customPlaceId(place);
  return loadFavorites().places.some((p) => p.id === id);
}

export function toggleFavoriteStop(stop: Stop): FavoritesState {
  const state = loadFavorites();
  const exists = state.stops.some((s) => s.id === stop.id);
  const stops = exists
    ? state.stops.filter((s) => s.id !== stop.id)
    : [{ id: stop.id, stop }, ...state.stops].slice(0, 40);
  const updated = { ...state, stops };
  saveFavorites(updated);
  return updated;
}

export function toggleFavoriteLine(line: Line, stopId?: string, stopName?: string): FavoritesState {
  const state = loadFavorites();
  const exists = state.lines.some((l) => l.id === line.id);
  const lines = exists
    ? state.lines.filter((l) => l.id !== line.id)
    : [{ id: line.id, line, stopId, stopName }, ...state.lines].slice(0, 40);
  const updated = { ...state, lines };
  saveFavorites(updated);
  return updated;
}

export function isFavoriteStop(stopId: string): boolean {
  return loadFavorites().stops.some((s) => s.id === stopId);
}

export function isFavoriteLine(lineId: string): boolean {
  return loadFavorites().lines.some((l) => l.id === lineId);
}
