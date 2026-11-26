import { describe, expect, it } from 'vitest';
import type { DepartureGroup } from '../../types';
import {
  WAIT_OPTIONS_COLLAPSED_COUNT,
  visibleWaitOptions,
  waitOptionsHiddenCount,
} from './waitOptionsCollapse';

function fakeGroup(name: string): DepartureGroup {
  return {
    route: {
      index: Number(name) || 0,
      shortName: name,
      displayName: name,
      longName: name,
      agency: '',
      color: null,
      type: 3,
      typeName: 'Bus',
    },
    headsign: 'Test',
    direction: 0,
    next: [{ minutes: 5, departure: 1000, tripId: 1, live: false }],
    siri: false,
  };
}

describe('waitOptionsCollapse', () => {
  it('hides nothing when at or under the collapsed window', () => {
    expect(waitOptionsHiddenCount(2)).toBe(0);
    expect(waitOptionsHiddenCount(1)).toBe(0);
    const options = [fakeGroup('37'), fakeGroup('66')];
    expect(visibleWaitOptions(options, false)).toHaveLength(2);
  });

  it('keeps the soonest two collapsed and reveals all when expanded', () => {
    const options = [
      fakeGroup('37'),
      fakeGroup('66'),
      fakeGroup('51'),
      fakeGroup('50'),
      fakeGroup('1'),
    ];
    expect(waitOptionsHiddenCount(options.length)).toBe(
      options.length - WAIT_OPTIONS_COLLAPSED_COUNT,
    );
    expect(visibleWaitOptions(options, false).map((g) => g.route.shortName)).toEqual([
      '37',
      '66',
    ]);
    expect(visibleWaitOptions(options, true)).toHaveLength(5);
  });
});
