/**
 * Pick which live vehicles to show on the map:
 * favourite-line matches (preferredOnly), or nearby + preferred when mixed.
 */

import type { FavoriteLine, Journey, LatLon, RouteInfo, VehiclePosition } from '../types';
import { modeFamilyForRoute } from './transportMode';
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

/** Separator for operator-scoped keys: `${agencyId}|${line}`. */
const SCOPE_SEP = '|';

type LiveRouteRef = Pick<RouteInfo, 'type' | 'typeName' | 'shortName' | 'displayName'> & {
  agencyId?: string;
};

/**
 * Only buses report Live location. Light rail (R1/R2/R3, Jerusalem tram) and
 * trains share line numbers with buses ("R1" is GTFS short name "1"), so
 * tracking them would paint unrelated bus 1 vehicles on the map.
 */
export function isLiveTrackableRoute(route: Pick<RouteInfo, 'type' | 'typeName'>): boolean {
  return modeFamilyForRoute(route) === 'bus';
}

/**
 * Match keys for one route. With an agency id the key is operator-scoped so
 * Dan 1 and Kavim 1 (both inside the map bbox) are told apart.
 */
export function liveKeysForRoute(route: LiveRouteRef): string[] {
  if (!isLiveTrackableRoute(route)) return [];
  const name = (route.shortName || route.displayName || '').trim();
  if (!name) return [];
  const agency = (route.agencyId ?? '').trim();
  return [agency ? `${agency}${SCOPE_SEP}${name}` : name];
}

/** Human label for a match key ("5|18" → "18"). */
export function liveKeyLabel(key: string): string {
  const sep = key.indexOf(SCOPE_SEP);
  return sep >= 0 ? key.slice(sep + 1) : key;
}

/** True when any transit leg of the journey can show Live location. */
export function journeyHasLiveTrackableLeg(journey: Journey | null | undefined): boolean {
  return Boolean(
    journey?.legs.some((leg) => leg.mode === 'transit' && isLiveTrackableRoute(leg.route))
  );
}

/** Collect live-bus match keys from planned / active journeys (bus legs only). */
export function lineKeysFromJourneys(journeys: Iterable<Journey | null | undefined>): string[] {
  const keys: string[] = [];
  for (const journey of journeys) {
    if (!journey) continue;
    for (const leg of journey.legs) {
      if (leg.mode !== 'transit') continue;
      keys.push(...liveKeysForRoute(leg.route));
    }
  }
  return keys;
}

/** Collect match tokens from saved favourite lines (bus lines only). */
export function lineKeysFromFavoriteLines(favorites: Iterable<FavoriteLine>): string[] {
  const keys: string[] = [];
  for (const fav of favorites) {
    keys.push(...liveKeysForRoute(fav.line));
    // Old favourites saved display names like "184 Dan" without an agency id.
    if (!fav.line.agencyId && isLiveTrackableRoute(fav.line) && fav.line.displayName) {
      keys.push(fav.line.displayName);
    }
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
  if (!line) return false;
  const op = vehicle.operatorRef ? normalizeLineKey(vehicle.operatorRef) : '';
  if (op && preferred.has(`${op}${SCOPE_SEP}${line}`)) return true;
  for (const key of preferred) {
    const sep = key.indexOf(SCOPE_SEP);
    if (sep >= 0) {
      // Operator-scoped key: only a vehicle without an operator (old feed) may
      // fall back to the bare line number.
      if (!op && labelMatchesKey(line, key.slice(sep + 1))) return true;
      continue;
    }
    if (labelMatchesKey(line, key)) return true;
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
