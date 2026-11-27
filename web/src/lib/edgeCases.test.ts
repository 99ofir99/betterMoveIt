import { describe, expect, it } from 'vitest';
import { departsTomorrow, durationMinutes, formatDurationMins } from './format';
import { computeTripInsights } from './tripInsights';
import type { Journey } from '../types';

describe('durationMinutes', () => {
  it('never shows 0 for a trip that takes time', () => {
    expect(durationMinutes(28)).toBe(1);
    expect(durationMinutes(0)).toBe(0);
    expect(durationMinutes(1045)).toBe(17);
    expect(formatDurationMins(20)).not.toMatch(/^0/);
  });
});

describe('departsTomorrow', () => {
  it('flags a board time past midnight', () => {
    expect(departsTomorrow(400, 23 * 3600)).toBe(true);
    expect(departsTomorrow(30, 23 * 3600)).toBe(false);
    expect(departsTomorrow(300, 1 * 3600)).toBe(false);
  });
});

describe('trip insights on a walk-only trip', () => {
  it('does not call a walk "Direct"', () => {
    const walk = {
      legs: [{ mode: 'walk', durationSec: 600, distanceM: 800 }],
      transfers: 0,
      walkMeters: 800,
      durationSec: 600,
      departSeconds: 0,
      arrivalSeconds: 600,
    } as unknown as Journey;
    const labels = computeTripInsights([walk]).get(0) ?? [];
    expect(labels).not.toContain('Direct');
    expect(labels).not.toContain('Fewest transfers');
  });
});
