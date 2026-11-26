/**
 * Collapse near-duplicate search hits (same stop / same line corridor).
 */

import type { Journey, Line, Place, SearchResult, TransitLeg } from '../types';
import { formatLineLongName } from './lineCategory';

function coordKey(lat?: number, lon?: number): string {
  if (lat == null || lon == null) return '';
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

/**
 * Stable key so the same stop / geocode lands once in recents.
 * Label is ignored — same coords (or same stopId) = same location.
 */
export function placeDedupeKey(p: Place): string {
  if (p.stopId) return `stop:${p.stopId}`;
  return `coord:${coordKey(p.lat, p.lon)}`;
}

/** One row per location; collapses stop-with-id + same-spot-without-id. */
export function dedupePlaces(places: Place[]): Place[] {
  const seenIds = new Set<string>();
  const seenCoords = new Set<string>();
  const out: Place[] = [];
  for (const p of places) {
    const coords = coordKey(p.lat, p.lon);
    if (p.stopId && seenIds.has(p.stopId)) continue;
    if (coords && seenCoords.has(coords)) continue;
    if (p.stopId) seenIds.add(p.stopId);
    if (coords) seenCoords.add(coords);
    out.push(p);
  }
  return out;
}

/** Prefer a stable key so identical GTFS / geocode rows collapse to one. */
export function searchResultDedupeKey(r: SearchResult): string {
  if (r.kind === 'line') {
    const name = (r.shortName || r.displayName || '').trim();
    const ends = formatLineLongName(r.longName || '');
    const [a, b] = ends.split(/\s*↔\s*/);
    const pair = [a?.trim() || '', b?.trim() || ''].sort().join('|');
    return `line:${name}|${pair}`;
  }
  if (r.kind === 'stop' && r.id) {
    // Parent/child platforms often share a code + name near the same spot.
    const code = r.code ? `code:${r.code}` : `id:${r.id}`;
    return `stop:${code}|${(r.name || '').trim()}|${coordKey(r.lat, r.lon)}`;
  }
  return `place:${(r.name || '').trim()}|${coordKey(r.lat, r.lon)}`;
}

export function dedupeSearchResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const out: SearchResult[] = [];
  for (const r of results) {
    const key = searchResultDedupeKey(r);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

/** Lines tab: one row per shortName + corridor (directions collapse). */
export function dedupeLines(lines: Line[]): Line[] {
  const seen = new Set<string>();
  const out: Line[] = [];
  for (const line of lines) {
    const ends = formatLineLongName(line.longName);
    const [a, b] = ends.split(/\s*↔\s*/);
    const pair = [a?.trim() || '', b?.trim() || ''].sort().join('|');
    const key = `${(line.shortName || line.displayName).trim()}|${pair}|${line.agency || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

/** Collapse identical trip options (same routes + transfers + departure). */
export function dedupeJourneys(journeys: Journey[]): Journey[] {
  const seen = new Set<string>();
  const out: Journey[] = [];
  for (const j of journeys) {
    const routeSig = j.legs
      .filter((l): l is TransitLeg => l.mode === 'transit')
      .map((l) => l.route.shortName || l.route.displayName)
      .join('>');
    const key =
      j.transitKey ||
      j.legSignature ||
      `${j.durationSec}|${j.transfers}|${j.departSeconds}|${routeSig}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(j);
  }
  return out;
}
