import { describe, expect, it } from 'vitest';
import { formatAddress, nearestHouseNumber, withHouseNumber } from './formatAddress';

const at = (dLatM: number, street: string, n: string) => ({
  lat: 32.0 + dLatM / 111_320,
  lon: 34.9,
  tags: { 'addr:street': street, 'addr:housenumber': n },
});

describe('nearestHouseNumber', () => {
  it('prefers the closest number on the same street', () => {
    const pts = [at(10, 'הרצל', '3'), at(25, 'שדרות עמק איילון', '12'), at(40, 'שדרות עמק איילון', '14')];
    expect(nearestHouseNumber(pts, 32.0, 34.9, 'שדרות עמק איילון')).toEqual({ street: 'שדרות עמק איילון', number: '12' });
  });
  it('falls back to a very close address on another street', () => {
    expect(nearestHouseNumber([at(10, 'הרצל', '3')], 32.0, 34.9, 'שדרות עמק איילון')).toEqual({ street: 'הרצל', number: '3' });
    expect(nearestHouseNumber([at(50, 'הרצל', '3')], 32.0, 34.9, 'שדרות עמק איילון')).toBeNull();
  });
  it('formats with the filled number', () => {
    const r = { address: { road: 'שדרות עמק איילון', town: 'שוהם' } };
    expect(formatAddress(withHouseNumber(r, { street: 'שדרות עמק איילון', number: '12' }))).toBe('שדרות עמק איילון 12, שוהם');
  });
});
