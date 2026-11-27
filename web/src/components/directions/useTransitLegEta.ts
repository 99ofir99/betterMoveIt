/**
 * Logic — live/scheduled boarding ETA for one transit leg in the trip preview.
 * Visuals live in TransitLegEtaBadge.tsx.
 */

import { useMemo } from 'react';
import { bestBoardingMinutes, type LeaveEtaEntry } from '../../lib/boardingEta';
import { minutesUntilDepart, secondsSinceLocalMidnight } from '../../lib/format';
import type { RouteInfo, TransitLeg } from '../../types';
import { useStopDepartures } from '../trip/useStopDepartures';
import { dayOffsetOf, departureHasPassed, plannedRideMinMinutes } from '../../lib/journeyStale';

export function useTransitLegEta(
  leg: TransitLeg,
  alternatives?: RouteInfo[]
): LeaveEtaEntry {
  const stopId = leg.from.stopId;
  const board = useStopDepartures(stopId);
  const routesKey = (alternatives ?? [leg.route])
    .map((r) => `${r.index ?? ''}:${r.shortName}`)
    .join('|');

  return useMemo(() => {
    const day = dayOffsetOf(leg);
    const routes =
      alternatives && alternatives.length > 0 ? alternatives : [leg.route];
    // The planned bus already left: say so instead of showing the next one as "now".
    if (departureHasPassed(leg.departure, undefined, day)) {
      return {
        minutes: 0,
        departure: leg.departure,
        live: false,
        confidence: 'none' as const,
        source: 'schedule' as const,
        departed: true,
      };
    }
    // Only buses from the planned one on; an earlier bus belongs to another itinerary.
    const fromBoard = bestBoardingMinutes(board, leg, routes, plannedRideMinMinutes(leg.departure, undefined, day));
    if (fromBoard) return fromBoard;

    // Schedule fallback from the planned leg clock (black / based on schedule).
    const { minutes, nextDay } = minutesUntilDepart(
      leg.departure,
      secondsSinceLocalMidnight(),
      day
    );
    return {
      minutes,
      departure: leg.departure,
      live: false,
      confidence: 'none' as const,
      source: 'schedule' as const,
      nextDay,
    };
    // routesKey captures alternatives + primary route identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, leg.departure, leg.from.stopId, leg.nextDay, leg.serviceDate, leg.route.index, leg.route.shortName, routesKey]);
}
