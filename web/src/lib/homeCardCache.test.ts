import { describe, expect, it } from 'vitest';
import { HOME_CACHE_MAX_AGE_MS, usableHomeCardTrip, type HomeCardTrip } from './homeCardCache';
import type { Journey } from '../types';

const work = { label: 'Work', lat: 32.0735, lon: 34.793 };
const home = { lat: 31.9985, lon: 34.946 };
const ride = (dep: number) =>
  ({
    departSeconds: dep - 300,
    legs: [{ mode: 'walk' }, { mode: 'transit', departure: dep }],
  }) as unknown as Journey;
const NOW = 1_800_000_000_000;
const trip = (over: Partial<HomeCardTrip> = {}): HomeCardTrip => ({
  place: work,
  origin: home,
  journey: ride(8 * 3600 + 30 * 60),
  savedAt: NOW - 60_000,
  ...over,
});
const at0815 = 8 * 3600 + 15 * 60;

describe('usableHomeCardTrip', () => {
  it('reuses an upcoming trip planned from the same spot', () => {
    expect(usableHomeCardTrip(trip(), work, home, NOW, at0815)).not.toBeNull();
  });
  it('ignores GPS drift of a few dozen metres', () => {
    const near = { lat: home.lat + 0.0005, lon: home.lon };
    expect(usableHomeCardTrip(trip(), work, near, NOW, at0815)).not.toBeNull();
  });
  it('plans fresh from somewhere else', () => {
    const elsewhere = { lat: home.lat + 0.01, lon: home.lon };
    expect(usableHomeCardTrip(trip(), work, elsewhere, NOW, at0815)).toBeNull();
  });
  it('plans fresh for another destination', () => {
    expect(usableHomeCardTrip(trip(), { ...work, lat: 32.1 }, home, NOW, at0815)).toBeNull();
  });
  it('drops a bus that has already left', () => {
    expect(usableHomeCardTrip(trip(), work, home, NOW, 8 * 3600 + 45 * 60)).toBeNull();
  });
  it('drops an old plan', () => {
    const old = trip({ savedAt: NOW - HOME_CACHE_MAX_AGE_MS - 1 });
    expect(usableHomeCardTrip(old, work, home, NOW, at0815)).toBeNull();
  });
  it('survives junk', () => {
    expect(usableHomeCardTrip(null, work, home, NOW, at0815)).toBeNull();
    expect(usableHomeCardTrip({} as HomeCardTrip, work, home, NOW, at0815)).toBeNull();
  });
});
