import { describe, expect, it } from 'vitest';
import type { DepartureGroup, RouteInfo, TransitLeg } from '../../types';
import { buildWaitOptions } from './buildWaitOptions';

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
    headsign: name === '66' ? 'TLV' : 'Test',
    direction: 0,
    next: [{ minutes, departure, tripId: 1, live: minutes < 10 }],
    siri: minutes < 10,
  };
}

const plannedLeg = {
  mode: 'transit',
  route: route('37'),
  headsign: 'Test',
  fromName: 'A',
  toName: 'B',
  from: { lat: 0, lon: 0, stopId: '1' },
  to: { lat: 1, lon: 1, stopId: '2' },
  departure: 900,
  arrival: 1800,
  durationSec: 900,
  intermediateStops: [],
} as TransitLeg;

describe('buildWaitOptions', () => {
  it('sorts clamped + board rows by soonest arrival at the stop', () => {
    const board = [
      group('51', 20, 2000),
      group('37', 8, 800),
      group('66', 4, 400),
      group('1', 15, 1500),
    ];
    const result = buildWaitOptions({
      plannedLeg,
      preferredRoutes: [route('37'), route('66'), route('51')],
      stopDepartures: board,
      countdownSec: 600,
    });
    expect(result.map((g) => g.route.shortName)).toEqual(['66', '37', '1', '51']);
  });
});
