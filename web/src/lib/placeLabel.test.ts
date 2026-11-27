import { describe, expect, it } from 'vitest';
import { displayPlaceLabel } from './placeLabel';

describe('displayPlaceLabel', () => {
  it('keeps addresses and custom names', () => {
    expect(displayPlaceLabel('Dizengoff 50')).toBe('Dizengoff 50');
    expect(displayPlaceLabel(undefined)).toBe('');
  });
  it('passes the default names through translation', () => {
    expect(displayPlaceLabel('Home')).toBe('Home'); // English locale in tests
  });
});
