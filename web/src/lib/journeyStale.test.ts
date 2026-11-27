import { describe, expect, it } from 'vitest';
import { dayOffsetOf, departureDayLabel, departureHasPassed, journeyHasDeparted, markNextDay } from './journeyStale';
import { minutesUntilDepart } from './format';
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

describe('tomorrow trips', () => {
  it("a trip planned for tomorrow 18:39 is not 'departed' at 20:14", () => {
    const [j] = markNextDay([ride(18 * 3600 + 39 * 60)]);
    expect(journeyHasDeparted(j, 20 * 3600 + 14 * 60)).toBe(false);
    expect(minutesUntilDepart(18 * 3600 + 39 * 60, 20 * 3600 + 14 * 60, true)).toEqual({
      minutes: 1345,
      nextDay: true,
    });
  });
});

describe('day-aware departures', () => {
  const sat0035 = { isoDate: '2026-11-28', seconds: 35 * 60 };
  const dep = 18 * 3600 + 39 * 60;
  it('a same-day trip 18 h ahead has not departed', () => {
    expect(departureHasPassed(dep, sat0035.seconds, 0)).toBe(false);
    expect(departureHasPassed(dep, sat0035.seconds)).toBe(true); // old clock-wrap guess
  });
  it('a known-today trip that left 10 min ago has departed', () => {
    expect(departureHasPassed(dep, dep + 600, 0)).toBe(true);
  });
  it('names the day of a far same-day trip, says Tomorrow for the next day', () => {
    expect(departureDayLabel(dep, 0, sat0035)).toBe('Saturday');
    expect(departureDayLabel(dep, 1, sat0035)).toBe('Tomorrow');
    expect(departureDayLabel(sat0035.seconds + 1200, 0, sat0035)).toBe('');
    expect(departureDayLabel(86400 + 600, 0, { isoDate: '2026-11-28', seconds: 23 * 3600 })).toBe('Tomorrow');
  });
  it('dayOffsetOf reads the service date', () => {
    expect(dayOffsetOf({ serviceDate: '2026-11-29' }, '2026-11-28')).toBe(1);
    expect(dayOffsetOf({ serviceDate: '2026-11-28' }, '2026-11-28')).toBe(0);
    expect(dayOffsetOf({ nextDay: true }, '2026-11-28')).toBe(1);
    expect(dayOffsetOf({}, '2026-11-28')).toBe(null);
  });
});
