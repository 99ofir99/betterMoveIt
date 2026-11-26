/**
 * Background OSRM enrichment for walk legs.
 *
 * The public foot router is often multi-second per call. Journey cards must not
 * wait on it — show straight-line walks first, then patch geometries.
 */

import { api } from './api';
import type { Journey, WalkLeg } from '../types';

const MIN_WALK_OSRM_M = 45;

function approxDistanceM(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

function walkKey(from: { lat: number; lon: number }, to: { lat: number; lon: number }): string {
  const q = (n: number) => Math.round(n * 1e4);
  return `${q(from.lat)},${q(from.lon)}>${q(to.lat)},${q(to.lon)}`;
}

/** Fetch foot geometries (deduped). Mutates legs; returns whether any geometry was applied. */
export async function enrichWalkGeometries(
  journeys: Journey[],
  signal?: AbortSignal
): Promise<boolean> {
  type Entry = {
    fromLat: number;
    fromLon: number;
    toLat: number;
    toLon: number;
    legs: WalkLeg[];
  };
  const byKey = new Map<string, Entry>();

  for (const journey of journeys) {
    for (const leg of journey.legs) {
      if (leg.mode !== 'walk' || !leg.from || !leg.to) continue;
      if (leg.geometry && leg.geometry.length >= 2) continue;
      const dist =
        typeof leg.distanceM === 'number' && leg.distanceM > 0
          ? leg.distanceM
          : approxDistanceM(leg.from, leg.to);
      if (dist < MIN_WALK_OSRM_M) continue;
      const key = walkKey(leg.from, leg.to);
      const existing = byKey.get(key);
      if (existing) existing.legs.push(leg);
      else {
        byKey.set(key, {
          fromLat: leg.from.lat,
          fromLon: leg.from.lon,
          toLat: leg.to.lat,
          toLon: leg.to.lon,
          legs: [leg],
        });
      }
    }
  }

  if (byKey.size === 0) return false;

  const entries = [...byKey.values()];
  const CONCURRENCY = 3;
  let applied = false;
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < entries.length) {
      if (signal?.aborted) return;
      const entry = entries[cursor++]!;
      const result = await api
        .walkRoute(entry.fromLat, entry.fromLon, entry.toLat, entry.toLon, signal)
        .catch(() => null);
      if (signal?.aborted || !result?.geometry?.length) continue;
      const geometry = result.geometry.map(
        ([lon, lat]) => [lat, lon] as [number, number]
      );
      for (const leg of entry.legs) {
        leg.geometry = geometry;
        if (Number.isFinite(result.distanceM)) leg.distanceM = result.distanceM;
        if (Number.isFinite(result.durationSec)) leg.durationSec = result.durationSec;
      }
      applied = true;
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, entries.length) }, () => worker())
  );
  return applied;
}
