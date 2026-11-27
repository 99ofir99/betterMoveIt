/**
 * Saved Home / Work keep the coordinates captured when they were saved. Their
 * subtitle should be a street address, not a placeholder like "My location".
 */

import type { Place } from '../types';
import { api } from './api';
import { loadFavorites, upsertPlace } from './favorites';
import { t } from './i18n';

const PLACEHOLDERS = ['My location', 'Current location', 'Home', 'Work'];

/** A saved subtitle that is a placeholder ("My location", "Home"), not an address. */
export function isPlaceholderAddress(label: string | null | undefined): boolean {
  const l = (label ?? '').trim();
  return !l || PLACEHOLDERS.some((k) => l === k || l === t(k));
}

const COORDS = /^-?\d+\.\d+,\s*-?\d+\.\d+$/;

/** Reverse-geocode a saved Home / Work whose subtitle is a placeholder, and store it. */
export function fillPlaceAddress(kind: 'home' | 'work' | 'custom', place: Place, label?: string): void {
  if (kind === 'custom' || !isPlaceholderAddress(place.label)) return;
  void api.reverseGeocode(place.lat, place.lon).then((address) => {
    // reverseGeocode falls back to raw coordinates when offline: keep trying later.
    if (!address || COORDS.test(address)) return;
    const current = loadFavorites().places.find((p) => p.id === kind);
    if (!current || current.place.lat !== place.lat || current.place.lon !== place.lon) return;
    upsertPlace(kind, { ...current.place, label: address }, label ?? current.label);
  });
}

/** Run once at app start: every saved Home / Work with a placeholder subtitle. */
export function fillSavedPlaceAddresses(): void {
  for (const p of loadFavorites().places) {
    if (p.kind !== 'custom') fillPlaceAddress(p.kind, p.place, p.label);
  }
}
