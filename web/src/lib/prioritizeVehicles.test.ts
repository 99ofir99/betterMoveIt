import { describe, expect, it } from 'vitest';
import type { FavoriteLine, Journey, VehiclePosition } from '../types';
import {
  journeyHasLiveTrackableLeg,
  lineKeysFromFavoriteLines,
  lineKeysFromJourneys,
  prioritizeVehicles,
  toPreferredKeySet,
  vehicleMatchesPreferred,
} from './prioritizeVehicles';

function bus(
  id: string,
  lat: number,
  lon: number,
  lineName: string,
  routeId = lineName
): VehiclePosition {
  return {
    vehicleId: id,
    routeId,
    lineName,
    lat,
    lon,
    timestamp: Date.now(),
  };
}

const NEAR = { lat: 32.07, lon: 34.78 };

describe('prioritizeVehicles', () => {
  it('keeps the geographically nearest buses within the nearby quota', () => {
    const vehicles = [
      bus('far', 32.2, 34.9, '1'),
      bus('near-a', 32.071, 34.781, '2'),
      bus('near-b', 32.072, 34.782, '3'),
    ];
    const out = prioritizeVehicles(vehicles, {
      near: NEAR,
      preferredKeys: [],
      limit: 2,
      nearbyQuota: 2,
    });
    expect(out.map((v) => v.vehicleId)).toEqual(['near-a', 'near-b']);
  });

  it('still includes preferred journey lines even when farther', () => {
    const vehicles = [
      bus('near-noise', 32.071, 34.781, '99'),
      bus('journey-bus', 32.12, 34.85, '184'),
      bus('near-2', 32.072, 34.782, '98'),
    ];
    const out = prioritizeVehicles(vehicles, {
      near: NEAR,
      preferredKeys: ['184'],
      limit: 2,
      nearbyQuota: 1,
    });
    expect(out.map((v) => v.vehicleId)).toContain('journey-bus');
    expect(out.map((v) => v.vehicleId)).toContain('near-noise');
    expect(out[0]!.vehicleId).toBe('journey-bus');
  });

  it('preferredOnly keeps only matching favourite lines', () => {
    const vehicles = [
      bus('near-noise', 32.071, 34.781, '99'),
      bus('fav-far', 32.12, 34.85, '184'),
      bus('fav-near', 32.072, 34.782, '184'),
    ];
    const out = prioritizeVehicles(vehicles, {
      near: NEAR,
      preferredKeys: ['184'],
      preferredOnly: true,
      limit: 10,
    });
    expect(out.map((v) => v.vehicleId)).toEqual(['fav-near', 'fav-far']);
  });

  it('matches display-name favourite keys against a short vehicle lineName', () => {
    const vehicles = [
      bus('noise', 32.071, 34.781, '99'),
      bus('both-ways-a', 32.072, 34.782, '5'),
      bus('both-ways-b', 32.073, 34.783, '5'),
    ];
    const out = prioritizeVehicles(vehicles, {
      near: NEAR,
      preferredKeys: ['5 dan'],
      preferredOnly: true,
      limit: 10,
    });
    expect(out.map((v) => v.vehicleId)).toEqual(['both-ways-a', 'both-ways-b']);
  });

  it('does not treat line 5 as a match for line 55', () => {
    const out = prioritizeVehicles([bus('fifty-five', 32.07, 34.78, '55')], {
      near: NEAR,
      preferredKeys: ['5'],
      preferredOnly: true,
    });
    expect(out).toEqual([]);
  });

  it('preferredOnly returns nothing without preferred keys', () => {
    const out = prioritizeVehicles([bus('a', 32.07, 34.78, '1')], {
      near: NEAR,
      preferredKeys: [],
      preferredOnly: true,
    });
    expect(out).toEqual([]);
  });

  it('caps at the configured limit', () => {
    const vehicles = Array.from({ length: 20 }, (_, i) =>
      bus(`v${i}`, 32.07 + i * 0.001, 34.78, String(i))
    );
    const out = prioritizeVehicles(vehicles, {
      near: NEAR,
      preferredKeys: [],
      limit: 5,
      nearbyQuota: 5,
    });
    expect(out).toHaveLength(5);
  });
});

describe('lineKeysFromFavoriteLines', () => {
  it('collects shortName / displayName tokens for bus favourites', () => {
    const favs = [
      {
        id: 'line-1',
        line: {
          id: 'line-1',
          index: 0,
          shortName: '184',
          longName: 'A–B',
          displayName: '184 Dan',
          type: 3,
          typeName: 'Bus',
        },
      },
    ] as FavoriteLine[];
    const keys = toPreferredKeySet(lineKeysFromFavoriteLines(favs));
    expect(keys.has('line-1')).toBe(false);
    expect(keys.has('184')).toBe(true);
    expect(keys.has('184 dan')).toBe(true);
  });
});

describe('lineKeysFromJourneys', () => {
  it('extracts short names from bus legs', () => {
    const journey = {
      routes: ['480'],
      legs: [
        {
          mode: 'transit',
          route: {
            index: 1,
            shortName: '184',
            displayName: '184',
            longName: 'A–B',
            agency: 'Dan',
            type: 3,
            typeName: 'Bus',
          },
          headsign: 'x',
          fromName: 'a',
          toName: 'b',
          from: { lat: 0, lon: 0 },
          to: { lat: 1, lon: 1 },
          departure: 0,
          arrival: 1,
          durationSec: 1,
          intermediateStops: [],
        },
      ],
      departSeconds: 0,
      arrivalSeconds: 1,
      durationSec: 1,
      transfers: 0,
      walkMeters: 0,
    } as Journey;

    const keys = toPreferredKeySet(lineKeysFromJourneys([journey]));
    expect(keys.has('184')).toBe(true);
  });
});

function leg(route: Partial<Journey['legs'][number] & { mode: 'transit' }>['route']) {
  return {
    mode: 'transit',
    route,
    headsign: 'x',
    fromName: 'a',
    toName: 'b',
    from: { lat: 0, lon: 0 },
    to: { lat: 1, lon: 1 },
    departure: 0,
    arrival: 1,
    durationSec: 1,
    intermediateStops: [],
  };
}

function journeyOf(...legs: ReturnType<typeof leg>[]): Journey {
  return {
    legs,
    departSeconds: 0,
    arrivalSeconds: 1,
    durationSec: 1,
    transfers: 0,
    walkMeters: 0,
  } as Journey;
}

const R1 = {
  index: 6350,
  shortName: '1',
  displayName: 'R1',
  longName: 'Bat Yam – Petah Tikva',
  agency: 'תבל',
  agencyId: '22',
  type: 0,
  typeName: 'tram',
};
const DAN_18 = {
  index: 470,
  shortName: '18',
  displayName: '18',
  longName: 'x',
  agency: 'דן',
  agencyId: '5',
  type: 3,
  typeName: 'bus',
};

describe('light rail is never live-tracked', () => {
  it('an R1 journey yields no live keys, so bus 1 never shows', () => {
    const j = journeyOf(leg(R1));
    expect(lineKeysFromJourneys([j])).toEqual([]);
    expect(journeyHasLiveTrackableLeg(j)).toBe(false);
    const dan1 = { ...bus('dan-1', 32.07, 34.78, '1'), operatorRef: '5' };
    const out = prioritizeVehicles([dan1], {
      near: NEAR,
      preferredKeys: lineKeysFromJourneys([j]),
      preferredOnly: true,
    });
    expect(out).toEqual([]);
  });

  it('keeps the bus leg of a mixed bus + R1 journey', () => {
    const j = journeyOf(leg(DAN_18), leg(R1));
    expect(lineKeysFromJourneys([j])).toEqual(['5|18']);
    expect(journeyHasLiveTrackableLeg(j)).toBe(true);
  });

  it('skips tram favourites', () => {
    const favs = [{ id: '6350', line: { ...R1, id: '6350' } }] as FavoriteLine[];
    expect(lineKeysFromFavoriteLines(favs)).toEqual([]);
  });
});

describe('operator-scoped matching', () => {
  const keys = toPreferredKeySet(['5|18']);
  it('matches the same operator and line', () => {
    expect(vehicleMatchesPreferred({ ...bus('a', 0, 0, '18'), operatorRef: '5' }, keys)).toBe(true);
  });
  it('rejects another operator running the same number', () => {
    expect(vehicleMatchesPreferred({ ...bus('b', 0, 0, '18'), operatorRef: '3' }, keys)).toBe(false);
  });
  it('falls back to the line number when the feed has no operator', () => {
    expect(vehicleMatchesPreferred(bus('c', 0, 0, '18'), keys)).toBe(true);
    expect(vehicleMatchesPreferred(bus('d', 0, 0, '180'), keys)).toBe(false);
  });
});
