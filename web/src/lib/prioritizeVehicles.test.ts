import { describe, expect, it } from 'vitest';
import type { FavoriteLine, Journey, VehiclePosition } from '../types';
import {
  lineKeysFromFavoriteLines,
  lineKeysFromJourneys,
  prioritizeVehicles,
  toPreferredKeySet,
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
  it('collects id / shortName / displayName tokens', () => {
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
    expect(keys.has('line-1')).toBe(true);
    expect(keys.has('184')).toBe(true);
    expect(keys.has('184 dan')).toBe(true);
  });
});

describe('lineKeysFromJourneys', () => {
  it('extracts short names from transit legs and journey.routes', () => {
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
    expect(keys.has('480')).toBe(true);
    expect(keys.has('184')).toBe(true);
  });
});
