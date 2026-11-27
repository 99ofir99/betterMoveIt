import { describe, expect, it } from 'vitest';
import { isAtDestination, pickFrequentDestination } from './atDestination';
import type { Journey } from '../types';

const home = { lat: 32.0, lon: 34.8 };
const j = (legs: string[], sec: number) =>
  ({ legs: legs.map((mode) => ({ mode })), durationSec: sec }) as unknown as Journey;

describe('isAtDestination', () => {
  it('is true at the same spot', () => {
    expect(isAtDestination(home, home, null)).toBe(true);
  });
  it('is true about 150 m away', () => {
    expect(isAtDestination({ lat: 32.00135, lon: 34.8 }, home, null)).toBe(true);
  });
  it('is false 1 km away with a bus trip', () => {
    expect(isAtDestination({ lat: 32.009, lon: 34.8 }, home, j(['walk', 'transit'], 900))).toBe(false);
  });
  it('is true for a short walk-only plan', () => {
    expect(isAtDestination({ lat: 32.004, lon: 34.8 }, home, j(['walk'], 240))).toBe(true);
  });
  it('is false for a long walk-only plan', () => {
    expect(isAtDestination({ lat: 32.009, lon: 34.8 }, home, j(['walk'], 900))).toBe(false);
  });
});

describe('pickFrequentDestination', () => {
  const homeP = { label: 'Home', ...home };
  const work = { label: 'Work', lat: 32.07, lon: 34.79 };
  it('shows work when at home', () => {
    expect(pickFrequentDestination([homeP, work], home)).toBe(work);
  });
  it('shows home when at work', () => {
    expect(pickFrequentDestination([homeP, work], work)).toBe(homeP);
  });
  it('shows the first place when elsewhere or location unknown', () => {
    expect(pickFrequentDestination([homeP, work], { lat: 31.5, lon: 35 })).toBe(homeP);
    expect(pickFrequentDestination([homeP, work], null)).toBe(homeP);
  });
  it('is null when every place is here', () => {
    expect(pickFrequentDestination([homeP], home)).toBeNull();
  });
});
