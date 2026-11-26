import { describe, expect, it } from 'vitest';
import {
  findCorridorMember,
  journeyHasCorridorRoute,
  sameCorridorRoute,
} from './corridorLine';
import type { Journey, RouteInfo, TransitLeg } from '../types';

function route(partial: Partial<RouteInfo> & Pick<RouteInfo, 'shortName' | 'index'>): RouteInfo {
  return {
    displayName: partial.shortName,
    longName: partial.shortName,
    agency: 'a',
    type: 3,
    typeName: 'Bus',
    ...partial,
  };
}

function transit(r: RouteInfo, stops: string[]): TransitLeg {
  return {
    mode: 'transit',
    route: r,
    headsign: 'Dest',
    fromName: 'A',
    toName: 'B',
    from: { lat: 0, lon: 0, stopId: 'a' },
    to: { lat: 1, lon: 1, stopId: 'b' },
    departure: 100,
    arrival: 200,
    durationSec: 100,
    intermediateStops: stops.map((id, i) => ({
      id,
      name: id,
      arrival: 100 + i * 30,
      departure: 100 + i * 30,
    })),
  };
}

function journey(routes: RouteInfo[], stopLists: string[][]): Journey {
  return {
    legs: [
      { mode: 'walk', distanceM: 100, durationSec: 80 },
      ...routes.map((r, i) => transit(r, stopLists[i] ?? ['s1', 's2'])),
      { mode: 'walk', distanceM: 80, durationSec: 60 },
    ],
    departSeconds: 0,
    arrivalSeconds: 400,
    durationSec: 400,
    transfers: 0,
    walkMeters: 180,
  };
}

describe('corridorLine', () => {
  it('matches corridor routes by shortName', () => {
    expect(sameCorridorRoute(route({ index: 1, shortName: '37' }), route({ index: 9, shortName: '37' }))).toBe(
      true,
    );
    expect(sameCorridorRoute(route({ index: 1, shortName: '37' }), route({ index: 2, shortName: '66' }))).toBe(
      false,
    );
  });

  it('finds the member journey for a chosen line and stop list', () => {
    const r37 = route({ index: 1, shortName: '37' });
    const r66 = route({ index: 2, shortName: '66' });
    const j37 = journey([r37], [['a', 'b', 'c']]);
    const j66 = journey([r66], [['a', 'x', 'c']]);

    const found = findCorridorMember([j37, j66], 0, r66);
    expect(found).toBe(j66);
    expect(found?.legs.find((l) => l.mode === 'transit')?.intermediateStops.map((s) => s.id)).toEqual([
      'a',
      'x',
      'c',
    ]);
    expect(journeyHasCorridorRoute(j37, 0, r37)).toBe(true);
    expect(journeyHasCorridorRoute(j37, 0, r66)).toBe(false);
  });
});
