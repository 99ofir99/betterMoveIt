import { describe, expect, it } from 'vitest';
import { findAnchorIndex } from './lineStopAnchor';

const stops = [
  { id: 'a', lat: 32.0, lon: 34.8 },
  { id: 'b', lat: 32.001, lon: 34.8 },
  { id: 'c', lat: 32.002, lon: 34.8 },
  { id: 'd', lat: 32.003, lon: 34.8 },
];

describe('findAnchorIndex', () => {
  it('matches the GTFS stop id', () => {
    expect(findAnchorIndex(stops, { id: 'c', lat: 0, lon: 0 })).toBe(2);
  });

  it('prefers a visit that is not the terminus on a loop', () => {
    const loop = [...stops, { id: 'a', lat: 32.0, lon: 34.8 }];
    expect(findAnchorIndex(loop, { id: 'a', lat: 32.0, lon: 34.8 })).toBe(0);
    const loop2 = [{ id: 'x', lat: 31, lon: 34 }, ...stops.slice(1), { id: 'x', lat: 31, lon: 34 }];
    expect(findAnchorIndex(loop2, { id: 'x', lat: 31, lon: 34 })).toBe(0);
  });

  it('falls back to the nearest stop (other side of the street)', () => {
    expect(findAnchorIndex(stops, { id: 'zz', lat: 32.0011, lon: 34.8003 })).toBe(1);
  });

  it('gives up when the line does not pass nearby', () => {
    expect(findAnchorIndex(stops, { id: 'zz', lat: 32.1, lon: 34.9 })).toBe(-1);
    expect(findAnchorIndex(stops, null)).toBe(-1);
    expect(findAnchorIndex([], { id: 'a', lat: 32, lon: 34.8 })).toBe(-1);
  });
});
