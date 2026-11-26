/**
 * Pick which live vehicles to show on the map:
 * favourite-line matches (preferredOnly), or nearby + preferred when mixed.
 */

import type { FavoriteLine, Journey, LatLon, VehiclePosition } from '../types';
import { haversine } from './tripGuidance';
import type { PrioritizeVehiclesOptions, RankedVehicle } from './prioritizeVehiclesTypes';

const DEFAULT_LIMIT = 100;
const DEFAULT_NEARBY_QUOTA = 70;

export function normalizeLineKey(value: string): string {
  return value.trim().toLowerCase();
}

/** Build a set of line tokens used to match vehicle.lineName / routeId. */
export function toPreferredKeySet(keys: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const key of keys) {
    const n = normalizeLineKey(key);
    if (n) out.add(n);
  }
  return out;
}

/** Collect line labels from planned / active journeys. */
export function lineKeysFromJourneys(journeys: Iterable<Journey | null | undefined>): string[] {
  const keys: string[] = [];
  for (const journey of journeys) {
    if (!journey) continue;
    for (const name of journey.routes ?? []) {
      if (name) keys.push(name);
    }
    for (const leg of journey.legs) {
      if (leg.mode !== 'transit') continue;
      if (leg.route.shortName) keys.push(leg.route.shortName);
      if (leg.route.displayName) keys.push(leg.route.displayName);
    }
  }
  return keys;
}

/** Collect match tokens from saved favourite lines. */
export function lineKeysFromFavoriteLines(favorites: Iterable<FavoriteLine>): string[] {
  const keys: string[] = [];
  for (const fav of favorites) {
    if (fav.id) keys.push(fav.id);
    if (fav.line.id) keys.push(fav.line.id);
    if (fav.line.shortName) keys.push(fav.line.shortName);
    if (fav.line.displayName) keys.push(fav.line.displayName);
  }
  return keys;
}

/** True when `label` equals `key`, or starts with `key` + a delimiter. */
function labelMatchesKey(label: string, key: string): boolean {
  if (!label || !key) return false;
  if (label === key) return true;
  // Avoid "5" matching "55" — require a separator after the key.
  return (
    label.startsWith(`${key} `) ||
    label.startsWith(`${key}-`) ||
    label.startsWith(`${key}/`) ||
    key.startsWith(`${label} `) ||
    key.startsWith(`${label}-`)
  );
}

export function vehicleMatchesPreferred(
  vehicle: VehiclePosition,
  preferred: Set<string>
): boolean {
  if (!preferred.size) return false;
  const line = vehicle.lineName ? normalizeLineKey(vehicle.lineName) : '';
  const route = vehicle.routeId ? normalizeLineKey(vehicle.routeId) : '';
  if (line && preferred.has(line)) return true;
  if (route && preferred.has(route)) return true;
  // Favourite display names like "184 dan" vs vehicle "184".
  if (line) {
    for (const key of preferred) {
      if (labelMatchesKey(line, key)) return true;
    }
  }
  return false;
}

function rankVehicle(
  vehicle: VehiclePosition,
  near: LatLon | null,
  preferred: Set<string>
): RankedVehicle {
  return {
    vehicle,
    distanceM: near ? haversine(near, { lat: vehicle.lat, lon: vehicle.lon }) : Number.POSITIVE_INFINITY,
    preferred: vehicleMatchesPreferred(vehicle, preferred),
  };
}

function byDistance(a: RankedVehicle, b: RankedVehicle): number {
  return a.distanceM - b.distanceM;
}

/**
 * Keep up to `limit` vehicles.
 * With `preferredOnly`, only preferred matches (nearest first).
 * Otherwise: nearby quota, then preferred, then fill by distance.
 */
export function prioritizeVehicles(
  vehicles: VehiclePosition[],
  opts: PrioritizeVehiclesOptions
): VehiclePosition[] {
  if (!vehicles.length) return [];

  const limit = opts.limit ?? DEFAULT_LIMIT;
  const preferred = toPreferredKeySet(opts.preferredKeys);
  const ranked = vehicles.map((v) => rankVehicle(v, opts.near, preferred));

  if (opts.preferredOnly) {
    if (!preferred.size) return [];
    return ranked
      .filter((r) => r.preferred)
      .sort(byDistance)
      .slice(0, limit)
      .map((r) => r.vehicle);
  }

  const nearbyQuota = Math.min(opts.nearbyQuota ?? DEFAULT_NEARBY_QUOTA, limit);
  const byDist = [...ranked].sort(byDistance);
  const preferredByDist = ranked.filter((r) => r.preferred).sort(byDistance);

  const picked = new Map<string, RankedVehicle>();

  for (const row of byDist) {
    if (picked.size >= nearbyQuota) break;
    picked.set(row.vehicle.vehicleId, row);
  }

  for (const row of preferredByDist) {
    if (picked.size >= limit) break;
    if (!picked.has(row.vehicle.vehicleId)) picked.set(row.vehicle.vehicleId, row);
  }

  for (const row of byDist) {
    if (picked.size >= limit) break;
    if (!picked.has(row.vehicle.vehicleId)) picked.set(row.vehicle.vehicleId, row);
  }

  return [...picked.values()]
    .sort((a, b) => {
      if (a.preferred !== b.preferred) return a.preferred ? -1 : 1;
      return a.distanceM - b.distanceM;
    })
    .map((r) => r.vehicle);
}
