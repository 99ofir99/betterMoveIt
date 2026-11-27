import { describe, expect, it } from 'vitest';
import { israelClock, minutesUntilDepart } from './format';

describe('feed clock', () => {
  it('reads Israel time whatever the device zone', () => {
    // 22:05 UTC in November is 00:05 the next day in Israel (UTC+2).
    expect(israelClock(new Date('2026-11-27T22:05:09Z'))).toEqual({
      isoDate: '2026-11-28',
      seconds: 309,
    });
  });

  it('a bus that left a minute ago is not tomorrow', () => {
    expect(minutesUntilDepart(36000 - 60, 36000)).toEqual({ minutes: 0, nextDay: false });
  });

  it('a morning bus seen late at night is tomorrow', () => {
    expect(minutesUntilDepart(6 * 3600, 23 * 3600)).toEqual({ minutes: 420, nextDay: true });
  });
});
