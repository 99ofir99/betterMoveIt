/**
 * Shared types for BetterMoovit.
 * API response shapes mirror the RAPTOR server / GTFS store.
 */

export interface LatLon {
  lat: number;
  lon: number;
}

export interface Stop {
  index?: number;
  id: string;
  name: string;
  nameEn?: string;
  lat: number;
  lon: number;
  code?: string;
  parent?: string;
  distance?: number;
}

export interface Place extends LatLon {
  label: string;
  stopId?: string;
}

export interface RouteInfo {
  index: number;
  shortName: string;
  displayName: string;
  longName: string;
  agency: string;
  color?: string | null;
  type: number;
  typeName: string;
  trips?: number;
}

export interface IntermediateStop {
  id: string;
  name: string;
  arrival: number;
  departure: number;
  /** Stop coordinates — used for live "current stop" rail (Moovit). */
  lat?: number;
  lon?: number;
}

export interface LegPoint {
  lat: number;
  lon: number;
  stopId?: string;
}

export interface WalkLeg {
  mode: "walk";
  fromName?: string;
  toName?: string;
  from?: LegPoint;
  to?: LegPoint;
  distanceM: number;
  durationSec: number;
  /** Polyline vertices as [lat, lon] (app API convention; MapLibre swaps in MapCanvas). */
  geometry?: [number, number][];
}

export interface TransitLeg {
  mode: "transit";
  route: RouteInfo;
  headsign: string;
  fromName: string;
  toName: string;
  from: LegPoint;
  to: LegPoint;
  departure: number;
  arrival: number;
  durationSec: number;
  intermediateStops: IntermediateStop[];
  /** Shape slice from planner; each pair is [lat, lon]. */
  geometry?: [number, number][];
  tripId?: string;
}

export type Leg = WalkLeg | TransitLeg;

export interface Journey {
  legs: Leg[];
  legSignature?: string;
  transitKey?: string;
  departSeconds: number;
  arrivalSeconds: number;
  durationSec: number;
  transfers: number;
  walkSec?: number;
  walkMeters: number;
  transitSec?: number;
  routes?: string[];
  primaryRouteColor?: string | null;
  /** Total fare in ILS when the planner supplies one (UI omits the price otherwise). */
  fareIls?: number;
  kind?: "fastest" | "fewest" | "best" | string;
}

export interface PlanResponse {
  journeys: Journey[];
  reason?: string;
  elapsedMs?: number;
  query?: unknown;
}

export interface SearchResult {
  kind: "stop" | "line" | "place";
  id?: string;
  name: string;
  nameEn?: string;
  lat?: number;
  lon?: number;
  code?: string;
  label?: string;
  shortName?: string;
  longName?: string;
  displayName?: string;
  color?: string | null;
  type?: number;
  typeName?: string;
  agency?: string;
  index?: number;
}

export interface DepartureNext {
  minutes: number;
  departure: number;
  tripId: number;
  /** True when this prediction comes from a real-time feed (SIRI / GTFS-RT). */
  live?: boolean;
}

export interface DepartureGroup {
  route: RouteInfo;
  headsign: string;
  direction: number;
  /** Boarding platform / bay, when the feed provides one. */
  platform?: string | null;
  next: DepartureNext[];
  /** True when at least one departure in this group has real-time data. */
  siri?: boolean;
}

export interface StopDeparturesResponse {
  stop: Stop;
  time: { dateInt: number; seconds: number; dow: number };
  departures: DepartureGroup[];
  rawCount: number;
}

export interface StopDetailResponse {
  stop: Stop;
  routes: RouteInfo[];
}

export interface HealthResponse {
  ok: boolean;
  counts: Record<string, number>;
  loadMs?: number;
  indexMs?: number;
  generatedAt?: string;
  bbox?: number[] | { minLat: number; maxLat: number; minLon: number; maxLon: number };
  agencies?: unknown[];
  siri?: boolean;
}

/** Bottom-nav tabs — Moovit-style shell. */
export type TabName = "favorites" | "lines" | "directions" | "nearby" | "more";

export interface Line {
  id: string;
  index: number;
  shortName: string;
  longName: string;
  displayName: string;
  type: number;
  typeName: string;
  color?: string | null;
  agency?: string;
}

export interface LineDirectionOption {
  direction: number;
  headsign: string;
}

export interface LineDetailResponse {
  line: Line;
  stops: Stop[];
  /** Line shape from server as [lat, lon][] (MapCanvas converts for GeoJSON). */
  geometry?: [number, number][];
  headsign?: string;
  direction?: number;
  directions?: LineDirectionOption[];
}

export interface LineScheduleStop extends Stop {
  next: Array<{ departure: number; minutes: number; headsign: string; tripId: number }>;
}

export interface LineScheduleResponse {
  line: Line;
  headsign?: string;
  direction?: number;
  directions?: LineDirectionOption[];
  stops: LineScheduleStop[];
  time: { dateInt: number; seconds: number; dow: number };
}

export interface NearbyStopBoard extends Stop {
  distance?: number;
  departures?: Array<{
    route: RouteInfo;
    headsign: string;
    minutes: number | null;
    next: Array<{ minutes: number; departure: number; tripId: number }>;
  }>;
}

export interface VehiclesResponse {
  configured: boolean;
  vehicles: VehiclePosition[];
  updatedAt: number | null;
  error: string | null;
}

export interface ServiceAlert {
  id: string;
  title: string;
  description: string;
  severity: "info" | "warning" | "critical";
  affectedRoutes: string[];
  startTime?: string;
  endTime?: string;
}

export interface VehiclePosition {
  vehicleId: string;
  routeId: string;
  lineName?: string;
  lat: number;
  lon: number;
  bearing?: number;
  speed?: number;
  timestamp: number;
  stopCode?: string;
}

export interface SavedTrip {
  id: string;
  name: string;
  from: Place;
  to: Place;
  createdAt: string;
  lastUsed?: string;
}

export interface FavoritePlace {
  id: string;
  kind: "home" | "work" | "custom";
  label: string;
  place: Place;
}

export interface FavoriteStop {
  id: string;
  stop: Stop;
}

export interface FavoriteLine {
  id: string;
  line: Line;
  stopId?: string;
  stopName?: string;
}
