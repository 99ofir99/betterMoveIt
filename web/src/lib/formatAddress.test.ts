import { describe, expect, it } from 'vitest';
import { formatAddress } from './formatAddress';

describe('formatAddress', () => {
  it('uses street, house number and city, no district', () => {
    expect(
      formatAddress({
        display_name: '83, שדרות עמק איילון, שוהם, נפת רמלה, מחוז המרכז, ישראל',
        address: { road: 'שדרות עמק איילון', house_number: '83', town: 'שוהם' },
      })
    ).toBe('שדרות עמק איילון 83, שוהם');
  });
  it('street without a number', () => {
    expect(formatAddress({ address: { road: 'האודם', town: 'שוהם' } })).toBe('האודם, שוהם');
  });
  it('falls back to display_name without admin parts', () => {
    expect(formatAddress({ display_name: 'שוהם, נפת רמלה, מחוז המרכז, 7015001, ישראל' })).toBe('שוהם');
  });
});
