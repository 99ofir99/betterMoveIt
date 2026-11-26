import { describe, expect, it } from 'vitest';
import type { Line, SearchResult } from '../types';
import { dedupeLines, searchResultDedupeKey } from './dedupeSearch';

function line(partial: Partial<Line> & Pick<Line, 'id' | 'shortName' | 'longName'>): Line {
  return {
    index: Number(partial.id) || 0,
    displayName: partial.shortName,
    type: 3,
    typeName: 'Bus',
    agency: 'דן',
    ...partial,
  };
}

describe('dedupeLines', () => {
  it('keeps opposite directions as separate rows', () => {
    const a = line({
      id: '85',
      shortName: '5',
      longName: 'ת. רכבת תל אביב סבידור-תל אביב יפו<->מסוף הלוחמים-חולון',
    });
    const b = line({
      id: '86',
      shortName: '5',
      longName: 'מסוף הלוחמים-חולון<->ת. רכבת תל אביב - סבידור-תל אביב יפו',
    });
    const out = dedupeLines([a, b]);
    expect(out).toHaveLength(2);
    expect(out.map((l) => l.id)).toEqual(['85', '86']);
  });

  it('still collapses same-direction GTFS variants', () => {
    const a = line({
      id: '49',
      shortName: '55',
      agency: 'מטרופולין',
      longName: 'מסוף רדינג/רציפים-תל אביב יפו<->מסוף קרית אונו-קרית אונו-10',
    });
    const b = line({
      id: '50',
      shortName: '55',
      agency: 'מטרופולין',
      longName: 'מסוף רדינג/רציפים-תל אביב יפו<->מסוף קרית אונו-קרית אונו-11',
    });
    const out = dedupeLines([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0]!.id).toBe('49');
  });
});

describe('searchResultDedupeKey', () => {
  it('distinguishes opposite line directions', () => {
    const a: SearchResult = {
      kind: 'line',
      shortName: '5',
      agency: 'דן',
      name: '5',
      longName: 'תל אביב יפו<->חולון',
    };
    const b: SearchResult = {
      kind: 'line',
      shortName: '5',
      agency: 'דן',
      name: '5',
      longName: 'חולון<->תל אביב יפו',
    };
    expect(searchResultDedupeKey(a)).not.toBe(searchResultDedupeKey(b));
  });
});
