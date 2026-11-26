import { describe, expect, it } from 'vitest';
import { sortJourneys } from './sort';
import type { Journey, TransitLeg } from '../types';

function transit(name: string): TransitLeg {
  return {
    mode: 'transit',
    route: {
      index: Number(name) || 1,
      shortName: name,
      displayName: name,
      longName: name,
      type: 3,
      typeName: 'bus',
      color: null,
      agency: 'test',
    },
    headsign: '',
    fromName: 'A',
    toName: 'B',
    from: { lat: 0, lon: 0 },
    to: { lat: 0, lon: 0 },
    departure: 0,
    arrival: 0,
    durationSec: 600,
    intermediateStops: [],
  };
}

function journey(opts: {
  transfers: number;
  arrival: number;
  duration: number;
  routes: string[];
}): Journey {
  const legs = opts.routes.map(transit);
  return {
    legs,
    departSeconds: opts.arrival - opts.duration,
    arrivalSeconds: opts.arrival,
    durationSec: opts.duration,
    transfers: opts.transfers,
    walkMeters: 200,
    routes: opts.routes,
  };
}

describe('sortJourneys best — Moovit transfer preference', () => {
  it('ranks a 1-transfer trip above a 2-transfer that is only a few minutes faster', () => {
    const twoBus = journey({
      transfers: 1,
      arrival: 36000,
      duration: 45 * 60,
      routes: ['184', '66'],
    });
    const threeBus = journey({
      transfers: 2,
      arrival: 36000 - 3 * 60, // 3 min earlier
      duration: 42 * 60,
      routes: ['184', '50', '23'],
    });
    const ranked = sortJourneys([threeBus, twoBus], 'best');
    expect(ranked).toHaveLength(1);
    expect(ranked[0]!.transfers).toBe(1);
    expect(ranked[0]!.routes).toEqual(['184', '66']);
  });

  it('keeps a multi-transfer trip when it is clearly faster', () => {
    const twoBus = journey({
      transfers: 1,
      arrival: 36000,
      duration: 50 * 60,
      routes: ['1', '2'],
    });
    const threeBus = journey({
      transfers: 2,
      arrival: 36000 - 20 * 60, // 20 min earlier — worth the change
      duration: 30 * 60,
      routes: ['9', '8', '7'],
    });
    const ranked = sortJourneys([twoBus, threeBus], 'best');
    expect(ranked.length).toBeGreaterThanOrEqual(1);
    expect(ranked[0]!.transfers).toBe(2);
  });

  it('fastest mode still prefers pure duration', () => {
    const slowSimple = journey({
      transfers: 0,
      arrival: 40000,
      duration: 60 * 60,
      routes: ['1'],
    });
    const fastComplex = journey({
      transfers: 2,
      arrival: 35000,
      duration: 30 * 60,
      routes: ['2', '3', '4'],
    });
    const ranked = sortJourneys([slowSimple, fastComplex], 'fastest');
    expect(ranked[0]!.transfers).toBe(2);
  });
});
