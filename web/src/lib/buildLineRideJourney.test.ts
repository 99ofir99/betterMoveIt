import { describe, expect, it } from 'vitest';
import { buildLineRideJourney } from './buildLineRideJourney';
import type { Line, LineScheduleStop } from '../types';

const line: Line = {
  id: '6538',
  index: 6538,
  shortName: '184',
  displayName: '184',
  longName: 'Oranit - Petah Tikva',
  type: 3,
  typeName: 'Bus',
  color: '#1a65e5',
  agency: 'Tnufa',
};

function stop(id: string, name: string, i: number): LineScheduleStop {
  return {
    id,
    name,
    lat: 32.1 + i * 0.01,
    lon: 34.8 + i * 0.01,
    next: [],
  };
}

describe('buildLineRideJourney', () => {
  const stops = [0, 1, 2, 3, 4].map((i) => stop(String(i), `Stop ${i}`, i));

  it('builds an onboard transit-only journey between two stops', () => {
    const j = buildLineRideJourney({
      line,
      headsign: 'Oranit',
      stops,
      boardIndex: 1,
      alightIndex: 4,
    });
    expect(j).not.toBeNull();
    expect(j!.legs).toHaveLength(1);
    expect(j!.legs[0].mode).toBe('transit');
    if (j!.legs[0].mode !== 'transit') return;
    expect(j!.legs[0].fromName).toBe('Stop 1');
    expect(j!.legs[0].toName).toBe('Stop 4');
    expect(j!.legs[0].intermediateStops).toHaveLength(4);
    // Departure is in the past so resolveActiveLeg starts onboard.
    expect(j!.legs[0].departure).toBeLessThan(j!.departSeconds + 1);
  });

  it('rejects invalid board/alight indices', () => {
    expect(
      buildLineRideJourney({ line, headsign: 'x', stops, boardIndex: 3, alightIndex: 2 }),
    ).toBeNull();
    expect(
      buildLineRideJourney({ line, headsign: 'x', stops, boardIndex: 4, alightIndex: 4 }),
    ).toBeNull();
  });
});
