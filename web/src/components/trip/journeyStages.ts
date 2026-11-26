/**
 * Moovit Live Directions stages — each transit leg expands into two pager
 * steps: wait (lines only) then ride (single assumed/picked line + stops).
 */

import type { Journey, Leg } from '../../types';
import type { TripPhase } from './types';

export type JourneyStageKind = 'walk' | 'wait' | 'ride';

export interface JourneyStage {
  kind: JourneyStageKind;
  /** Index into journey.legs */
  legIndex: number;
  /** Transit-only ordinal (0, 1, …); set for wait/ride stages. */
  transitOrdinal?: number;
}

/** Expand journey legs into Moovit pager stages. */
export function buildJourneyStages(legs: readonly Leg[]): JourneyStage[] {
  const stages: JourneyStage[] = [];
  let transitOrdinal = 0;
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i]!;
    if (leg.mode === 'walk') {
      stages.push({ kind: 'walk', legIndex: i });
      continue;
    }
    stages.push({ kind: 'wait', legIndex: i, transitOrdinal });
    stages.push({ kind: 'ride', legIndex: i, transitOrdinal });
    transitOrdinal++;
  }
  return stages;
}

/**
 * Which pager stage is "active" for the current leg + phase.
 * Waiting → wait stage; onboard/alight → ride stage; walk → walk stage.
 */
export function activeStageIndex(
  stages: readonly JourneyStage[],
  legIndex: number,
  phase: TripPhase,
): number {
  if (stages.length === 0) return 0;

  if (phase === 'done') {
    return stages.length - 1;
  }

  if (phase === 'waiting') {
    const idx = stages.findIndex((s) => s.kind === 'wait' && s.legIndex === legIndex);
    return idx >= 0 ? idx : findFirstForLeg(stages, legIndex);
  }

  if (phase === 'onboard' || phase === 'alight') {
    const idx = stages.findIndex((s) => s.kind === 'ride' && s.legIndex === legIndex);
    return idx >= 0 ? idx : findFirstForLeg(stages, legIndex);
  }

  // walking / idle
  const idx = stages.findIndex((s) => s.kind === 'walk' && s.legIndex === legIndex);
  return idx >= 0 ? idx : findFirstForLeg(stages, legIndex);
}

function findFirstForLeg(stages: readonly JourneyStage[], legIndex: number): number {
  const idx = stages.findIndex((s) => s.legIndex === legIndex);
  return idx >= 0 ? idx : 0;
}

/** Convenience: stages for a whole journey. */
export function stagesForJourney(journey: Journey): JourneyStage[] {
  return buildJourneyStages(journey.legs);
}
