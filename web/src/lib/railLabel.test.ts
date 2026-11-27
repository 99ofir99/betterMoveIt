import { describe, expect, it } from 'vitest';
import {
  isHeavyRailRoute,
  isRailTrainNumber,
  railTrainNumber,
  transitDestinationLabel,
} from './railLabel';
import { formatRailFinalCity } from './lineCategory';

const rail = {
  type: 2,
  typeName: 'rail',
  shortName: '',
  displayName: '270',
  longName: 'אשקלון-אשקלון<->בנימינה-בנימינה גבעת עדה',
};

describe('formatRailFinalCity', () => {
  it('takes the destination city from the right side of <->', () => {
    expect(formatRailFinalCity('נהריה-נהריה<->מודיעין מרכז-מודיעין מכבים רעות')).toBe(
      'מודיעין מכבים רעות'
    );
    expect(formatRailFinalCity('בית שאן-בית שאן<->עתלית-עתלית')).toBe('עתלית');
    expect(formatRailFinalCity(rail.longName)).toBe('בנימינה גבעת עדה');
  });
});

describe('railTrainNumber', () => {
  it('uses displayName when it is the train number', () => {
    expect(railTrainNumber(rail)).toBe('270');
  });

  it('falls back to numeric headsign when displayName is still a corridor', () => {
    expect(
      railTrainNumber(
        { ...rail, displayName: rail.longName },
        '270'
      )
    ).toBe('270');
  });
});

describe('transitDestinationLabel', () => {
  it('shows final city for rail instead of the train-number headsign', () => {
    expect(transitDestinationLabel(rail, '270')).toBe('בנימינה גבעת עדה');
  });

  it('passes through bus headsigns', () => {
    expect(
      transitDestinationLabel(
        { type: 3, typeName: 'bus', shortName: '25', displayName: '25', longName: 'x' },
        'חולון_מוזיאון'
      )
    ).toBe('חולון_מוזיאון');
  });
});

describe('isHeavyRailRoute / isRailTrainNumber', () => {
  it('detects rail and numeric train numbers', () => {
    expect(isHeavyRailRoute(rail)).toBe(true);
    expect(isRailTrainNumber('270')).toBe(true);
    expect(isRailTrainNumber('נהריה')).toBe(false);
  });
});
