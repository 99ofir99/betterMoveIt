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

function withTram(j: Journey, legIndex = 0): Journey {
  const legs = j.legs.map((leg, i) =>
    i === legIndex && leg.mode === 'transit'
      ? { ...leg, route: { ...leg.route, type: 0, typeName: 'tram' } }
      : leg
  );
  return { ...j, legs };
}

describe('sortJourneys fastest — light-rail preference', () => {
  it('prefers light rail over a slightly faster bus with the same transfers', () => {
    const bus = journey({ transfers: 1, arrival: 36000, duration: 40 * 60, routes: ['1', '66'] });
    const tram = withTram(
      journey({ transfers: 1, arrival: 36000 + 3 * 60, duration: 43 * 60, routes: ['R1', '66'] })
    );
    const ranked = sortJourneys([bus, tram], 'fastest');
    expect(ranked[0]).toBe(tram);
    expect(ranked[1]).toBe(bus);
  });

  it('keeps the bus first when light rail is clearly slower', () => {
    const bus = journey({ transfers: 1, arrival: 36000, duration: 40 * 60, routes: ['1', '66'] });
    const tram = withTram(
      journey({ transfers: 1, arrival: 36000 + 10 * 60, duration: 50 * 60, routes: ['R1', '66'] })
    );
    expect(sortJourneys([tram, bus], 'fastest')[0]).toBe(bus);
  });

  it('still prefers light rail when it is 8 minutes slower', () => {
    const bus = journey({ transfers: 0, arrival: 36000, duration: 30 * 60, routes: ['1'] });
    const tram = withTram(
      journey({ transfers: 0, arrival: 36000 + 8 * 60, duration: 38 * 60, routes: ['R1'] })
    );
    expect(sortJourneys([bus, tram], 'fastest')[0]).toBe(tram);
  });

  it('does not lift light rail over a faster trip with fewer transfers', () => {
    const direct = journey({ transfers: 0, arrival: 36000, duration: 40 * 60, routes: ['1'] });
    const tram = withTram(
      journey({ transfers: 1, arrival: 36000 + 2 * 60, duration: 42 * 60, routes: ['R1', '66'] })
    );
    expect(sortJourneys([tram, direct], 'fastest')[0]).toBe(direct);
  });

  it('jumps over an in-between option with other transfers when a same-transfer bus is ahead', () => {
    const bus = journey({ transfers: 1, arrival: 36000, duration: 40 * 60, routes: ['1', '66'] });
    const direct = journey({ transfers: 0, arrival: 36060, duration: 41 * 60, routes: ['5'] });
    const tram = withTram(
      journey({ transfers: 1, arrival: 36180, duration: 43 * 60, routes: ['R1', '66'] })
    );
    expect(sortJourneys([direct, bus, tram], 'fastest')).toEqual([tram, bus, direct]);
  });
});
