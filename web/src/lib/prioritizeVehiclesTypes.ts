import type { LatLon, VehiclePosition } from '../types';

export interface PrioritizeVehiclesOptions {
  /** Prefer vehicles closest to this point (GPS or map center). */
  near: LatLon | null;
  /** Line short names / display names / route ids to match. */
  preferredKeys: Iterable<string>;
  /** Max markers to keep (map performance). Default 100. */
  limit?: number;
  /**
   * Slots reserved for the geographically nearest vehicles.
   * Remaining slots prefer matching preferred lines.
   * Ignored when `preferredOnly` is true.
   */
  nearbyQuota?: number;
  /** When true, only vehicles matching `preferredKeys` are kept. */
  preferredOnly?: boolean;
}

export interface RankedVehicle {
  vehicle: VehiclePosition;
  distanceM: number;
  preferred: boolean;
}
