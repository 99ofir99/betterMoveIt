import { describe, expect, it } from 'vitest';
import type { DepartureGroup, RouteInfo } from '../../types';
import { sortDeparturesByArrival } from './sortDeparturesByArrival';

function route(name: string, index = Number(name) || 0): RouteInfo {
  return {
    index,
    shortName: name,
    displayName: name,
    longName: name,
    agency: '',
    color: null,
    type: 3,
    typeName: 'Bus',
  };
}

function group(name: string, minutes: number, departure: number): DepartureGroup {
  return {
    route: route(name),
    headsign: 'Test',
    direction: 0,
    next: [{ minutes, departure, tripId: 1, live: false }],
    siri: false,
  };
}

describe('sortDeparturesByArrival', () => {
  it('orders by soonest pickup minutes', () => {
    const sorted = sortDeparturesByArrival([
      group('50', 12, 1200),
      group('37', 3, 300),
      group('66', 5, 500),
    ]);
    expect(sorted.map((g) => g.route.shortName)).toEqual(['37', '66', '50']);
  });
});
