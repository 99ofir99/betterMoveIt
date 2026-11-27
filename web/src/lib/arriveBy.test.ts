import { describe, expect, it } from 'vitest';
import { arriveBySearchStart, rankForArriveBy } from './arriveBy';

describe('arrive-by', () => {
  it('puts on-time journeys first, latest arrival first', () => {
    const j = (h: number, m: number) => ({ arrivalSeconds: h * 3600 + m * 60 });
    const ranked = rankForArriveBy([j(9, 5), j(8, 40), j(8, 55), j(9, 30)], '09:00');
    expect(ranked.map((x) => x.arrivalSeconds / 60)).toEqual([535, 520, 545, 570]);
  });

  it('does not wrap the search start to the previous evening', () => {
    expect(arriveBySearchStart('01:00')).toBe('00:00');
    expect(arriveBySearchStart('09:30')).toBe('07:30');
  });
});
