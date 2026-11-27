import { describe, expect, it } from 'vitest';
import { nextCompact } from './useCompactOnScroll';

describe('nextCompact', () => {
  it('compacts after scrolling past the threshold', () => expect(nextCompact(false, 200)).toBe(true));
  it('stays compact until back near the top', () => {
    expect(nextCompact(true, 60)).toBe(true);
    expect(nextCompact(true, 0)).toBe(false);
  });
  it('stays expanded for small scrolls', () => expect(nextCompact(false, 60)).toBe(false));
});
