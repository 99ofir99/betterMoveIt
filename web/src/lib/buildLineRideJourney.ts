/**
 * Build a single-leg "already on this line" journey between two stops
 * on the same route pattern (Moovit line-detail Start flow).
 */

import type {
  IntermediateStop,
  Journey,
  Line,
  LineScheduleStop,
  TransitLeg,
} from '../types';
import { secondsSinceLocalMidnight } from './format';

const SEC_PER_STOP = 90;

export interface LineRideInput {
  line: Line;
  headsign: string;
  stops: LineScheduleStop[];
  boardIndex: number;
  alightIndex: number;
  /** Optional full-line shape [lat, lon][] to slice for the map. */
  geometry?: [number, number][] | null;
}

function nowSec(): number {
  return secondsSinceLocalMidnight();
}

function sliceGeometry(
  geometry: [number, number][] | null | undefined,
  board: LineScheduleStop,
  alight: LineScheduleStop,
): [number, number][] | undefined {
  if (!geometry || geometry.length < 2) {
    return [
      [board.lat, board.lon],
      [alight.lat, alight.lon],
    ];
  }
  // Nearest vertices to board / alight — good enough for the ride map.
  const nearest = (lat: number, lon: number) => {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < geometry.length; i++) {
      const [gla, glo] = geometry[i];
      const d = (gla - lat) ** 2 + (glo - lon) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  };
  let a = nearest(board.lat, board.lon);
  let b = nearest(alight.lat, alight.lon);
  if (a > b) [a, b] = [b, a];
  const slice = geometry.slice(a, b + 1);
  return slice.length >= 2 ? slice : [[board.lat, board.lon], [alight.lat, alight.lon]];
}

/**
 * Synthesize a transit-only journey that starts already onboard
 * (departure in the recent past so tripGuidance resolves to `onboard`).
 */
export function buildLineRideJourney(input: LineRideInput): Journey | null {
  const { line, headsign, stops, boardIndex, alightIndex, geometry } = input;
  if (boardIndex < 0 || alightIndex <= boardIndex || alightIndex >= stops.length) {
    return null;
  }

  const segment = stops.slice(boardIndex, alightIndex + 1);
  const board = segment[0];
  const alight = segment[segment.length - 1];
  const stopCount = Math.max(1, segment.length - 1);
  const depart = nowSec() - 60;
  const durationSec = stopCount * SEC_PER_STOP;
  const arrival = depart + durationSec;

  const intermediateStops: IntermediateStop[] = segment.map((s, i) => {
    const t = depart + i * SEC_PER_STOP;
    return {
      id: s.id,
      name: s.name,
      arrival: t,
      departure: t,
      lat: s.lat,
      lon: s.lon,
    };
  });

  const leg: TransitLeg = {
    mode: 'transit',
    route: {
      index: Number(line.id),
      shortName: line.shortName,
      displayName: line.displayName || line.shortName,
      longName: line.longName,
      agency: line.agency ?? '',
      color: line.color,
      type: line.type,
      typeName: line.typeName,
    },
    headsign: headsign || alight.name,
    fromName: board.name,
    toName: alight.name,
    from: { lat: board.lat, lon: board.lon, stopId: board.id },
    to: { lat: alight.lat, lon: alight.lon, stopId: alight.id },
    departure: depart,
    arrival,
    durationSec,
    intermediateStops,
    geometry: sliceGeometry(geometry, board, alight),
    tripId: board.next[0] ? String(board.next[0].tripId) : undefined,
  };

  return {
    legs: [leg],
    departSeconds: depart,
    arrivalSeconds: arrival,
    durationSec,
    transfers: 0,
    walkMeters: 0,
    walkSec: 0,
    transitSec: durationSec,
    routes: [line.displayName || line.shortName],
    primaryRouteColor: line.color ?? null,
    kind: 'best',
  };
}
