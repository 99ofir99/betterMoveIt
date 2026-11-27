import { describe, expect, it } from 'vitest';
import { shouldDismiss } from './useDragToDismiss';

describe('shouldDismiss', () => {
  it('closes past the distance threshold', () => expect(shouldDismiss(90, 1000)).toBe(true));
  it('closes on a quick flick', () => expect(shouldDismiss(40, 50)).toBe(true));
  it('springs back on a short slow drag', () => expect(shouldDismiss(40, 600)).toBe(false));
});
