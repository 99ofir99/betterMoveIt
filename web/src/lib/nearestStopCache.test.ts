import { describe, expect, it } from 'vitest';
import {
  NEAREST_CACHE_NO_FIX_MS,
  ageGroups,
  usableNearestStop,
  type NearestStopSnapshot,
} from './nearestStopCache';
import type { DepartureGroup, Stop } from '../types';

const group = (line: string, ...mins: number[]) =>
  ({
    route: { shortName: line },
    headsign: 'x',
    direction: 0,
    live: true,
    next: mins.map((m, i) => ({ minutes: m, departure: 0, tripId: i, live: true, confidence: 'high' })),
  }) as unknown as DepartureGroup;
const NOW = 1_800_000_000_000;
const here = { lat: 31.9985, lon: 34.946 };
const snap = (over: Partial<NearestStopSnapshot> = {}): NearestStopSnapshot => ({
  origin: here,
  stop: { id: '16680', name: 'Stop' } as Stop,
  distanceM: 57,
  groups: [group('13', 3, 20), group('500', 8)],
  savedAt: NOW - 5 * 60_000,
  ...over,
});

describe('ageGroups', () => {
  it('counts down, drops buses that left and re-sorts', () => {
    const out = ageGroups([group('13', 3, 20), group('500', 8)], 5 * 60_000);
    expect(out.map((g) => g.route.shortName)).toEqual(['500', '13']);
    expect(out[0].next[0].minutes).toBe(3);
    expect(out[1].next.map((n) => n.minutes)).toEqual([15]);
  });
  it('never claims a saved ETA is live', () => {
    const [g] = ageGroups([group('13', 9)], 60_000);
    expect(g.live).toBe(false);
    expect(g.next[0].live).toBe(false);
    expect(g.next[0].confidence).toBe('none');
  });
  it('shows no departures from long ago', () => {
    expect(ageGroups([group('13', 90)], 31 * 60_000)).toEqual([]);
  });
});

describe('usableNearestStop', () => {
  it('reuses the stop at the same spot', () => {
    expect(usableNearestStop(snap(), { lat: here.lat + 0.0003, lon: here.lon }, NOW)?.stop.id).toBe('16680');
  });
  it('ignores it somewhere else', () => {
    expect(usableNearestStop(snap(), { lat: here.lat + 0.01, lon: here.lon }, NOW)).toBeNull();
  });
  it('before a fix, only a recent one', () => {
    expect(usableNearestStop(snap(), null, NOW)).not.toBeNull();
    expect(usableNearestStop(snap({ savedAt: NOW - NEAREST_CACHE_NO_FIX_MS - 1 }), null, NOW)).toBeNull();
  });
});
