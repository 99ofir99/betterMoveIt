/**
 * Logic for the "Wait for one of these options" card: while the traveller is
 * waiting at a boarding stop, fetch live departures and lead with the planned line.
 * When the active trip has transitAlternatives (clamped card), includes ALL
 * preferred lines — sorted by soonest pickup at the station.
 */

import { useMemo } from 'react';
import type { DepartureGroup, RouteInfo, TransitLeg } from '../../types';
import { buildWaitOptions } from './buildWaitOptions';
import type { ActiveTripState } from './types';
import { useStopDepartures } from './useStopDepartures';

/** Map leg-array index to its transit-leg ordinal (0-based among transit legs only). */
function transitOrdinal(legs: ActiveTripState['journey']['legs'], legIndex: number): number {
  let count = -1;
  for (let i = 0; i <= legIndex && i < legs.length; i++) {
    if (legs[i]?.mode === 'transit') count++;
  }
  return count;
}

export function useWaitOptions(state: ActiveTripState): DepartureGroup[] {
  const { journey, phase, legIndex, nextAction } = state;
  const leg = journey.legs[legIndex] ?? null;

  const plannedLeg: TransitLeg | null =
    phase === 'waiting' && leg?.mode === 'transit' ? leg : null;
  const boardingStopId = plannedLeg?.from.stopId ?? null;
  const stopDepartures = useStopDepartures(boardingStopId);

  const preferredRoutes: RouteInfo[] = useMemo(() => {
    if (!plannedLeg || !state.transitAlternatives) return [];
    const ordinal = transitOrdinal(journey.legs, legIndex);
    return state.transitAlternatives[ordinal] ?? [];
  }, [plannedLeg, state.transitAlternatives, journey.legs, legIndex]);

  return useMemo(() => {
    if (!plannedLeg) return [];
    return buildWaitOptions({
      plannedLeg,
      preferredRoutes,
      stopDepartures,
      countdownSec: nextAction.countdownSec,
    });
  }, [plannedLeg, stopDepartures, nextAction.countdownSec, preferredRoutes]);
}
