import { describe, expect, it } from 'vitest';
import { sortGroupsBySoonest } from './useNearestStop';
import type { DepartureGroup } from '../types';

const g = (name: string, mins: number[]): DepartureGroup =>
  ({
    route: { index: 1, shortName: name, displayName: name, longName: '', agency: '', type: 3, typeName: 'bus' },
    headsign: 'x',
    direction: 0,
    next: mins.map((m, i) => ({ minutes: m, departure: m * 60, tripId: i })),
  }) as DepartureGroup;

describe('sortGroupsBySoonest', () => {
  it('orders lines by their next departure and drops empty ones', () => {
    const out = sortGroupsBySoonest([g('a', [12]), g('b', []), g('c', [3, 20])]);
    expect(out.map((x) => x.route.shortName)).toEqual(['c', 'a']);
  });
});
