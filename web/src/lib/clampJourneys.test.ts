/**
 * Unit tests for clampJourneys — Moovit-style route clamping.
 * Run with: npx vitest run
 */

import { describe, expect, it } from 'vitest';
import { clampJourneys } from './clampJourneys';
import type { Journey, Leg, RouteInfo, TransitLeg } from '../types';

function makeRoute(shortName: string, index = 0): RouteInfo {
  return {
    index,
    shortName,
    displayName: shortName,
    longName: shortName,
    agency: 'Test',
    color: null,
    type: 3,
    typeName: 'bus',
  };
}

function makeTransitLeg(
  route: RouteInfo,
  fromStopId: string,
  toStopId: string,
  opts?: {
    omitStopIds?: boolean;
    fromName?: string;
    toName?: string;
    from?: { lat: number; lon: number };
    to?: { lat: number; lon: number };
  }
): TransitLeg {
  const fromCoord = opts?.from ?? { lat: 32.07, lon: 34.78 };
  const toCoord = opts?.to ?? { lat: 32.08, lon: 34.79 };
  const from = opts?.omitStopIds
    ? { ...fromCoord }
    : { ...fromCoord, stopId: fromStopId };
  const to = opts?.omitStopIds ? { ...toCoord } : { ...toCoord, stopId: toStopId };
  return {
    mode: 'transit',
    route,
    headsign: 'Test Terminal',
    fromName: opts?.fromName ?? `Stop ${fromStopId}`,
    toName: opts?.toName ?? `Stop ${toStopId}`,
    from,
    to,
    departure: 36000,
    arrival: 37800,
    durationSec: 1800,
    intermediateStops: [],
  };
}

const WALK: Leg = { mode: 'walk', distanceM: 300, durationSec: 240 };

function makeJourney(legs: Leg[], durationSec = 3600): Journey {
  const transitCount = legs.filter((l) => l.mode === 'transit').length;
  return {
    legs,
    departSeconds: 36000,
    arrivalSeconds: 36000 + durationSec,
    durationSec,
    transfers: Math.max(0, transitCount - 1),
    walkMeters: 300,
  };
}

describe('clampJourneys', () => {
  it('merges journeys that differ only on first transit leg into one card with alternatives', () => {
    const r184 = makeRoute('184', 1);
    const r185 = makeRoute('185', 2);
    const j1 = makeJourney([makeTransitLeg(r184, 'stop-A', 'stop-Z'), WALK]);
    const j2 = makeJourney([makeTransitLeg(r185, 'stop-A', 'stop-Z'), WALK]);
    const result = clampJourneys([j1, j2]);
    expect(result).toHaveLength(1);
    expect(result[0]!.transitAlternatives[0]).toHaveLength(2);
    const names = result[0]!.transitAlternatives[0]!.map((r) => r.shortName);
    expect(names).toContain('184');
    expect(names).toContain('185');
    expect(result[0]!.sourceIndices).toEqual([0, 1]);
  });

  it('merges journeys that differ only on last transit leg', () => {
    const r10 = makeRoute('10', 10);
    const r11 = makeRoute('11', 11);
    const j1 = makeJourney([WALK, makeTransitLeg(r10, 'stop-B', 'stop-C')]);
    const j2 = makeJourney([WALK, makeTransitLeg(r11, 'stop-B', 'stop-C')]);
    const result = clampJourneys([j1, j2]);
    expect(result).toHaveLength(1);
    expect(result[0]!.transitAlternatives[0]).toHaveLength(2);
  });

  it('merges journeys that differ only on a middle transit leg (same stop pairs)', () => {
    const rA = makeRoute('A', 1);
    const rC = makeRoute('C', 3);
    const j1 = makeJourney(
      [
        makeTransitLeg(rA, '1', '2'),
        makeTransitLeg(makeRoute('B', 2), '2', '3'),
        makeTransitLeg(rC, '3', '4'),
      ],
      3600
    );
    const j2 = makeJourney(
      [
        makeTransitLeg(rA, '1', '2'),
        makeTransitLeg(makeRoute('B2', 4), '2', '3'),
        makeTransitLeg(rC, '3', '4'),
      ],
      3600
    );
    const result = clampJourneys([j1, j2]);
    expect(result).toHaveLength(1);
    expect(result[0]!.transitAlternatives[1]!.map((r) => r.shortName).sort()).toEqual(['B', 'B2']);
  });

  it('does NOT merge when a transfer uses a different alighting stop', () => {
    const rA = makeRoute('A', 1);
    const rC = makeRoute('C', 3);
    const j1 = makeJourney(
      [
        makeTransitLeg(rA, '1', '2'),
        makeTransitLeg(makeRoute('B', 2), '2', '3'),
        makeTransitLeg(rC, '3', '4'),
      ],
      3600
    );
    const j2 = makeJourney(
      [
        makeTransitLeg(rA, '1', '2'),
        makeTransitLeg(makeRoute('B2', 4), '2', '9', {
          toName: 'Other Hub',
          to: { lat: 32.12, lon: 34.85 },
        }),
        makeTransitLeg(rC, '9', '4', {
          fromName: 'Other Hub',
          from: { lat: 32.12, lon: 34.85 },
        }),
      ],
      3600
    );
    expect(clampJourneys([j1, j2])).toHaveLength(2);
  });

  it('picks the earlier-arriving itinerary as the bundle representative', () => {
    const r10 = makeRoute('10', 10);
    const r14 = makeRoute('14', 14);
    const early = makeJourney([makeTransitLeg(r14, 'stop-A', 'stop-Z')], 3000);
    early.arrivalSeconds = 39000;
    early.departSeconds = 36000;
    const late = makeJourney([makeTransitLeg(r10, 'stop-A', 'stop-Z')], 3600);
    late.arrivalSeconds = 39600;
    late.departSeconds = 36000;
    // Ranked with slower option first (as RAPTOR sometimes surfaces).
    const result = clampJourneys([late, early]);
    expect(result).toHaveLength(1);
    expect(result[0]!.journey.arrivalSeconds).toBe(39000);
    expect(result[0]!.transitAlternatives[0]!.map((r) => r.shortName).sort()).toEqual(['10', '14']);
  });

  it('does NOT merge when board names and locations clearly differ', () => {
    const j1 = makeJourney([
      makeTransitLeg(makeRoute('184', 1), 'stop-A', 'stop-Z', {
        fromName: 'North Terminal',
        toName: 'Central Hub',
        from: { lat: 32.1, lon: 34.8 },
        to: { lat: 32.05, lon: 34.77 },
      }),
    ]);
    const j2 = makeJourney([
      makeTransitLeg(makeRoute('185', 2), 'stop-B', 'stop-Z', {
        fromName: 'South Terminal',
        toName: 'Central Hub',
        from: { lat: 32.0, lon: 34.7 },
        to: { lat: 32.05, lon: 34.77 },
      }),
    ]);
    expect(clampJourneys([j1, j2])).toHaveLength(2);
  });

  it('does NOT merge when alight names and locations clearly differ', () => {
    const j1 = makeJourney([
      makeTransitLeg(makeRoute('184', 1), 'stop-A', 'stop-Z', {
        fromName: 'Plaza',
        toName: 'Airport West',
        from: { lat: 32.07, lon: 34.78 },
        to: { lat: 32.0, lon: 34.9 },
      }),
    ]);
    const j2 = makeJourney([
      makeTransitLeg(makeRoute('185', 2), 'stop-A', 'stop-Y', {
        fromName: 'Plaza',
        toName: 'Airport East',
        from: { lat: 32.07, lon: 34.78 },
        to: { lat: 32.01, lon: 34.95 },
      }),
    ]);
    expect(clampJourneys([j1, j2])).toHaveLength(2);
  });

  it('merges when differing leg has no stopIds on either journey', () => {
    const j1 = makeJourney([
      makeTransitLeg(makeRoute('184', 1), 'stop-A', 'stop-Z', {
        omitStopIds: true,
        fromName: 'Plaza',
        toName: 'Hub',
      }),
    ]);
    const j2 = makeJourney([
      makeTransitLeg(makeRoute('185', 2), 'stop-A', 'stop-Z', {
        omitStopIds: true,
        fromName: 'Plaza',
        toName: 'Hub',
      }),
    ]);
    const result = clampJourneys([j1, j2]);
    expect(result).toHaveLength(1);
    expect(result[0]!.transitAlternatives[0]).toHaveLength(2);
  });

  it('merges parallel platforms with same stop names but different stopIds', () => {
    const j1 = makeJourney([
      makeTransitLeg(makeRoute('184', 1), 'gtfs-100', 'gtfs-200', {
        fromName: 'Dizengoff / Frishman',
        toName: 'Azrieli Center',
      }),
    ]);
    const j2 = makeJourney([
      makeTransitLeg(makeRoute('185', 2), 'gtfs-101', 'gtfs-201', {
        fromName: 'Dizengoff / Frishman',
        toName: 'Azrieli Center',
      }),
    ]);
    const result = clampJourneys([j1, j2]);
    expect(result).toHaveLength(1);
    expect(result[0]!.transitAlternatives[0]!.map((r) => r.shortName).sort()).toEqual([
      '184',
      '185',
    ]);
  });

  it('merges nearby curb stops within proximity even when names differ slightly', () => {
    const j1 = makeJourney([
      makeTransitLeg(makeRoute('5', 5), 'a1', 'z1', {
        fromName: 'Begin / Azrieli',
        toName: 'Central Bus Station',
        from: { lat: 32.0742, lon: 34.792 },
        to: { lat: 32.056, lon: 34.78 },
      }),
    ]);
    const j2 = makeJourney([
      makeTransitLeg(makeRoute('7', 7), 'a2', 'z2', {
        fromName: 'Begin Rd / Azrieli Mall',
        toName: 'Tel Aviv CBS',
        from: { lat: 32.0743, lon: 34.7921 },
        to: { lat: 32.0561, lon: 34.7801 },
      }),
    ]);
    const result = clampJourneys([j1, j2]);
    expect(result).toHaveLength(1);
    expect(result[0]!.transitAlternatives[0]).toHaveLength(2);
  });

  it('merges direct buses with same drop-off name and nearby board stops', () => {
    const j1 = makeJourney([
      makeTransitLeg(makeRoute('480', 480), '13632', '13320', {
        fromName: "המסגר/ריב''ל",
        toName: 'קניון עזריאלי/דרך מנחם בגין',
        from: { lat: 32.0629, lon: 34.785 },
        to: { lat: 32.0744, lon: 34.792 },
      }),
    ]);
    const j2 = makeJourney([
      makeTransitLeg(makeRoute('469', 469), '13295', '13320', {
        fromName: 'הרכבת/סלומון',
        toName: 'קניון עזריאלי/דרך מנחם בגין',
        from: { lat: 32.0635, lon: 34.783 },
        to: { lat: 32.0744, lon: 34.792 },
      }),
    ]);
    const result = clampJourneys([j1, j2]);
    expect(result).toHaveLength(1);
    expect(result[0]!.transitAlternatives[0]!.map((r) => r.shortName).sort()).toEqual([
      '469',
      '480',
    ]);
  });

  it('does NOT merge a station drop-off with a door-side bus to the same destination', () => {
    // Azrieli → מכון מור: red-line/bus to בן גוריון vs buses that alight at מכון מור.
    const dest = { lat: 32.091415, lon: 34.825592 };
    const walkEnd = (from: { lat: number; lon: number }): Leg => ({
      mode: 'walk',
      distanceM: 200,
      durationSec: 160,
      from,
      to: dest,
    });
    const jRail = makeJourney(
      [
        { mode: 'walk', distanceM: 200, durationSec: 160 },
        makeTransitLeg(makeRoute('3', 3), '49149', '49146', {
          fromName: 'שאול המלך',
          toName: 'בן גוריון',
          from: { lat: 32.0766, lon: 34.792 },
          to: { lat: 32.091, lon: 34.8236 },
        }),
        walkEnd({ lat: 32.091, lon: 34.8236 }),
      ],
      786
    );
    const jBus = makeJourney(
      [
        { mode: 'walk', distanceM: 120, durationSec: 100 },
        makeTransitLeg(makeRoute('567', 567), '13320', '13290', {
          fromName: 'קניון עזריאלי/דרך מנחם בגין',
          toName: "מכון מור/דרך זאב ז'בוטינסקי",
          from: { lat: 32.0745, lon: 34.7911 },
          to: { lat: 32.0914, lon: 34.8256 },
        }),
        walkEnd({ lat: 32.0914, lon: 34.8256 }),
      ],
      722
    );
    const result = clampJourneys([jRail, jBus]);
    expect(result).toHaveLength(2);
  });

  it('merges Azrieli→Mor corridor buses including nearby board variants', () => {
    const dest = { lat: 32.091415, lon: 34.825592 };
    const walkEnd = (from: { lat: number; lon: number }): Leg => ({
      mode: 'walk',
      distanceM: 40,
      durationSec: 40,
      from,
      to: dest,
    });
    const j567 = makeJourney(
      [
        { mode: 'walk', distanceM: 120, durationSec: 100 },
        makeTransitLeg(makeRoute('567', 567), '13320', '13290', {
          fromName: 'קניון עזריאלי/דרך מנחם בגין',
          toName: "מכון מור/דרך זאב ז'בוטינסקי",
          from: { lat: 32.0745, lon: 34.7911 },
          to: { lat: 32.0914, lon: 34.8256 },
        }),
        walkEnd({ lat: 32.0914, lon: 34.8256 }),
      ],
      722
    );
    const j50 = makeJourney(
      [
        { mode: 'walk', distanceM: 120, durationSec: 100 },
        makeTransitLeg(makeRoute('50', 50), '13320', '13290', {
          fromName: 'קניון עזריאלי/דרך מנחם בגין',
          toName: "מכון מור/דרך זאב ז'בוטינסקי",
          from: { lat: 32.0745, lon: 34.7911 },
          to: { lat: 32.0914, lon: 34.8256 },
        }),
        walkEnd({ lat: 32.0914, lon: 34.8256 }),
      ],
      722
    );
    const j82 = makeJourney(
      [
        { mode: 'walk', distanceM: 350, durationSec: 280 },
        makeTransitLeg(makeRoute('82', 82), '12990', '13290', {
          fromName: "בית הדר דפנה/שד' שאול המלך",
          toName: "מכון מור/דרך זאב ז'בוטינסקי",
          from: { lat: 32.0774, lon: 34.7905 },
          to: { lat: 32.0914, lon: 34.8256 },
        }),
        walkEnd({ lat: 32.0914, lon: 34.8256 }),
      ],
      908
    );
    const result = clampJourneys([j567, j50, j82]);
    expect(result).toHaveLength(1);
    expect(result[0]!.transitAlternatives[0]!.map((r) => r.shortName).sort()).toEqual([
      '50',
      '567',
      '82',
    ]);
  });

  it('merges direct buses that drop at nearby stops walking to the same destination', () => {
    const dest = { lat: 32.0664, lon: 34.7778 };
    const walkTo = (from: { lat: number; lon: number }): Leg => ({
      mode: 'walk',
      distanceM: 200,
      durationSec: 160,
      from,
      to: dest,
    });
    const j1 = makeJourney(
      [
        {
          mode: 'walk',
          distanceM: 60,
          durationSec: 50,
          from: { lat: 32.0853, lon: 34.7818 },
          to: { lat: 32.085, lon: 34.7815 },
        },
        makeTransitLeg(makeRoute('125', 125), '45039', '13572', {
          fromName: 'אבן גבירול/ארלוזורוב',
          toName: "שד' רוטשילד/שיינקין",
          from: { lat: 32.085, lon: 34.7815 },
          to: { lat: 32.0668, lon: 34.7775 },
        }),
        walkTo({ lat: 32.0668, lon: 34.7775 }),
      ],
      700
    );
    const j2 = makeJourney(
      [
        {
          mode: 'walk',
          distanceM: 60,
          durationSec: 50,
          from: { lat: 32.0853, lon: 34.7818 },
          to: { lat: 32.085, lon: 34.7815 },
        },
        makeTransitLeg(makeRoute('26', 26), '45039', '48082', {
          fromName: 'אבן גבירול/ארלוזורוב',
          toName: 'יהודה הלוי/מרמורק',
          from: { lat: 32.085, lon: 34.7815 },
          to: { lat: 32.0655, lon: 34.7768 },
        }),
        walkTo({ lat: 32.0655, lon: 34.7768 }),
      ],
      780
    );
    const result = clampJourneys([j1, j2]);
    expect(result).toHaveLength(1);
    expect(result[0]!.transitAlternatives[0]!.map((r) => r.shortName).sort()).toEqual([
      '125',
      '26',
    ]);
  });

  it('keeps bus→bus and bus→R1 light rail as separate Moovit-style cards', () => {
    const r184 = makeRoute('184', 184);
    const r37 = makeRoute('37', 37);
    const r1: RouteInfo = {
      index: 9001,
      shortName: '1',
      displayName: 'R1',
      longName: 'הקו האדום',
      agency: 'תבל',
      color: '#E53935',
      type: 0,
      typeName: 'tram',
    };
    const jBus = makeJourney([
      makeTransitLeg(r184, 'oranit', 'transfer-bus', {
        fromName: 'מסוף אורנית',
        toName: 'העברה אוטובוס',
        from: { lat: 32.131, lon: 34.99 },
        to: { lat: 32.085, lon: 34.8 },
      }),
      makeTransitLeg(r37, 'transfer-bus', 'mor-bus', {
        fromName: 'העברה אוטובוס',
        toName: "מכון מור/דרך זאב ז'בוטינסקי",
        from: { lat: 32.085, lon: 34.8 },
        to: { lat: 32.0914, lon: 34.8256 },
      }),
    ]);
    const jRail = makeJourney([
      makeTransitLeg(r184, 'oranit', 'transfer-rail', {
        fromName: 'מסוף אורנית',
        toName: 'העברה רכבת',
        from: { lat: 32.131, lon: 34.99 },
        to: { lat: 32.086, lon: 34.801 },
      }),
      makeTransitLeg(r1, 'transfer-rail', 'mor-rail', {
        fromName: 'העברה רכבת',
        toName: 'בן גוריון',
        from: { lat: 32.086, lon: 34.801 },
        to: { lat: 32.091, lon: 34.8236 },
      }),
    ]);
    const result = clampJourneys([jBus, jRail]);
    expect(result).toHaveLength(2);
    const labels = result.map((c) =>
      c.transitAlternatives.map((alts) => alts.map((r) => r.displayName).join('/')).join('>')
    );
    expect(labels.some((l) => l.includes('R1'))).toBe(true);
    expect(labels.some((l) => l.includes('37'))).toBe(true);
  });
});
