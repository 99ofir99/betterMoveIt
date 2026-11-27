import { describe, expect, it } from 'vitest';
import { journeyHasDeparted } from './journeyStale';
import type { Journey } from '../types';

const ride = (dep: number) =>
  ({
    departSeconds: dep - 300,
    legs: [{ mode: 'walk' }, { mode: 'transit', departure: dep }],
  }) as unknown as Journey;

describe('journeyHasDeparted', () => {
  it('a bus planned for 18:39 has left at 19:17', () => {
    expect(journeyHasDeparted(ride(18 * 3600 + 39 * 60), 19 * 3600 + 17 * 60)).toBe(true);
  });
  it('an upcoming bus has not left', () => {
    expect(journeyHasDeparted(ride(19 * 3600 + 30 * 60), 19 * 3600 + 17 * 60)).toBe(false);
  });
  it("tomorrow morning's bus seen late at night has not left", () => {
    expect(journeyHasDeparted(ride(6 * 3600), 23 * 3600)).toBe(false);
  });
  it('a 24:30 bus at 00:40 has left', () => {
    expect(journeyHasDeparted(ride(24 * 3600 + 30 * 60), 40 * 60)).toBe(true);
  });
});
