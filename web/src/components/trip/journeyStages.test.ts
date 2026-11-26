import { describe, expect, it } from 'vitest';
import { activeStageIndex, buildJourneyStages } from './journeyStages';
import type { TransitLeg, WalkLeg } from '../../types';

function walk(): WalkLeg {
  return {
    mode: 'walk',
    durationSec: 120,
    distanceM: 100,
  };
}

function transit(name: string): TransitLeg {
  return {
    mode: 'transit',
    route: {
      index: 1,
      displayName: name,
      shortName: name,
      longName: name,
      agency: 'test',
      type: 3,
      typeName: 'Bus',
      color: null,
    },
    headsign: 'X',
    fromName: 'A',
    toName: 'B',
    from: { stopId: '1', lat: 0, lon: 0 },
    to: { stopId: '2', lat: 1, lon: 1 },
    departure: 100,
    arrival: 200,
    durationSec: 100,
    intermediateStops: [],
  };
}

describe('buildJourneyStages', () => {
  it('expands each transit leg into wait then ride', () => {
    const stages = buildJourneyStages([walk(), transit('19'), walk()]);
    expect(stages.map((s) => s.kind)).toEqual(['walk', 'wait', 'ride', 'walk']);
    expect(stages[1]).toMatchObject({ kind: 'wait', legIndex: 1, transitOrdinal: 0 });
    expect(stages[2]).toMatchObject({ kind: 'ride', legIndex: 1, transitOrdinal: 0 });
  });

  it('numbers transit ordinals across multiple rides', () => {
    const stages = buildJourneyStages([transit('1'), walk(), transit('2')]);
    expect(stages.map((s) => [s.kind, s.transitOrdinal])).toEqual([
      ['wait', 0],
      ['ride', 0],
      ['walk', undefined],
      ['wait', 1],
      ['ride', 1],
    ]);
  });
});

describe('activeStageIndex', () => {
  const stages = buildJourneyStages([walk(), transit('19'), walk()]);

  it('maps waiting → wait stage', () => {
    expect(activeStageIndex(stages, 1, 'waiting')).toBe(1);
  });

  it('maps onboard/alight → ride stage', () => {
    expect(activeStageIndex(stages, 1, 'onboard')).toBe(2);
    expect(activeStageIndex(stages, 1, 'alight')).toBe(2);
  });

  it('maps walking → walk stage', () => {
    expect(activeStageIndex(stages, 0, 'walking')).toBe(0);
    expect(activeStageIndex(stages, 2, 'walking')).toBe(3);
  });
});
