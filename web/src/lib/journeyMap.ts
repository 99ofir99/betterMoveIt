/**
 * Map helpers for journey polylines — keeps MapCanvas free of journey logic.
 */

import type { Journey, LatLon, WalkLeg } from '../types';

/**
 * Fill missing walk-leg endpoints from adjacent transit stops or the trip
 * origin/destination so OSRM (and the map) always have a from→to path.
 */
export function fillWalkEndpoints(
  journey: Journey,
  origin: LatLon,
  destination: LatLon
): void {
  const { legs } = journey;
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    if (leg.mode !== 'walk') continue;
    const walk = leg as WalkLeg;
    if (!walk.from) {
      const prev = legs[i - 1];
      if (prev?.mode === 'transit' && prev.to) {
        walk.from = { lat: prev.to.lat, lon: prev.to.lon, stopId: prev.to.stopId };
      } else if (i === 0) {
        walk.from = { lat: origin.lat, lon: origin.lon };
      }
    }
    if (!walk.to) {
      const next = legs[i + 1];
      if (next?.mode === 'transit' && next.from) {
        walk.to = { lat: next.from.lat, lon: next.from.lon, stopId: next.from.stopId };
      } else if (i === legs.length - 1) {
        walk.to = { lat: destination.lat, lon: destination.lon };
      }
    }
  }
}

/** Full map path for a journey as [lat, lon][] (server / app convention). */
export function journeyPolylineCoords(journey: Journey): [number, number][] {
  const all: [number, number][] = [];
  for (const leg of journey.legs) {
    if (leg.mode === 'transit') {
      if (leg.geometry?.length) all.push(...leg.geometry);
    } else if (leg.mode === 'walk') {
      if (leg.geometry && leg.geometry.length >= 2) {
        all.push(...leg.geometry);
      } else if (leg.from && leg.to) {
        all.push([leg.from.lat, leg.from.lon], [leg.to.lat, leg.to.lon]);
      }
    }
  }
  return all;
}

/** Origin / destination pins for pre-start route preview on the map. */
export function journeyEndpoints(journey: Journey): { start: LatLon; end: LatLon } | null {
  let start: LatLon | null = null;
  let end: LatLon | null = null;
  for (const leg of journey.legs) {
    if (!start && leg.from && Number.isFinite(leg.from.lat) && Number.isFinite(leg.from.lon)) {
      start = { lat: leg.from.lat, lon: leg.from.lon };
    }
    if (leg.to && Number.isFinite(leg.to.lat) && Number.isFinite(leg.to.lon)) {
      end = { lat: leg.to.lat, lon: leg.to.lon };
    }
  }
  if (!start || !end) return null;
  return { start, end };
}

/** Polylines for journeys that are not the selected list index. */
/** Non-selected journeys with their card index, so a tap on the map finds the card. */
export function ghostJourneyRoutes(
  journeys: Journey[],
  selectedIndex: number
): { index: number; coords: [number, number][] }[] {
  const out: { index: number; coords: [number, number][] }[] = [];
  journeys.forEach((j, i) => {
    if (i === selectedIndex) return;
    const coords = journeyPolylineCoords(j);
    if (coords.length >= 2) out.push({ index: i, coords });
  });
  return out;
}

export function ghostJourneyPolylines(
  journeys: Journey[],
  selectedIndex: number
): [number, number][][] {
  return ghostJourneyRoutes(journeys, selectedIndex).map((g) => g.coords);
}
