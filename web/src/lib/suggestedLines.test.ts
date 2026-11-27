import { describe, expect, it } from 'vitest';
import { rankPersonalLines } from './suggestedLines';
import type { Line } from '../types';
import type { TripHistoryEntry } from './history';

const line = (n: number): Line => ({
  id: String(n), index: n, shortName: String(n), longName: `A-B ${n}`, displayName: String(n),
  type: 3, typeName: 'bus',
});
const trip = (lines: Line[]): TripHistoryEntry => ({
  id: 'x', createdAt: '', from: { lat: 0, lon: 0, label: '' }, to: { lat: 0, lon: 0, label: '' }, lines,
});

describe('rankPersonalLines', () => {
  it('ranks lines ridden more often first and adds starred lines', () => {
    const out = rankPersonalLines([trip([line(5)]), trip([line(7)]), trip([line(7), line(9)])], [line(42)]);
    expect(out.map((l) => l.id)).toEqual(['7', '5', '9', '42']);
  });
  it('ignores legacy history without lines', () => {
    expect(rankPersonalLines([trip(undefined as unknown as Line[])], [])).toEqual([]);
  });
});
