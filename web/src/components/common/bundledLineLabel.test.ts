import { describe, expect, it } from 'vitest';
import { formatBundledLineLabel } from './bundledLineLabel';

describe('formatBundledLineLabel', () => {
  it('joins all lines with / like Moovit', () => {
    expect(
      formatBundledLineLabel([
        { shortName: '37' },
        { shortName: '66' },
        { shortName: '51' },
        { shortName: '50' },
        { shortName: '1' },
      ])
    ).toBe('37 / 66 / 51 / 50 / 1');
  });
});
