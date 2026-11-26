/**
 * Moovit arrival-accuracy presentation (v5.125 / App Store copy).
 *
 * Green  — Arrival time is accurate
 * Yellow — Arrival time is fairly accurate
 * Red    — Arrival time may not be accurate
 * Red+!  — Line may have left its route
 * Black  — Based on schedule | Based on previous arrivals
 *
 * Definitive clock when ETA > 60 minutes.
 */

import type { ArrivalConfidence, ArrivalSource, DepartureNext } from '../types';
import { formatArrivalClock } from './format';
import { formatVehicleAge } from './vehicleAge';

export type { ArrivalConfidence, ArrivalSource };

/** Moovit docs: definitive clock beyond one hour. */
export const RELATIVE_ETA_MAX_MIN = 60;

/** GPS age tiers — keep in sync with server/src/arrivalAccuracy.js */
export const GPS_HIGH_SEC = 45;
export const GPS_MEDIUM_SEC = 120;
export const GPS_LOW_SEC = 240;

export function resolveConfidence(next?: DepartureNext | null): ArrivalConfidence {
  if (!next) return 'none';
  if (next.offRoute || next.confidence === 'off_route') return 'off_route';
  if (next.confidence) return next.confidence;
  if (next.live) return 'high';
  return 'none';
}

export function resolveSource(next?: DepartureNext | null): ArrivalSource {
  if (!next) return 'schedule';
  if (next.source) return next.source;
  if (next.live) return 'live';
  return 'schedule';
}

/** App Store / help-center accuracy captions under the ETA. */
export function accuracyCaption(
  confidence: ArrivalConfidence,
  source: ArrivalSource = 'schedule'
): string {
  switch (confidence) {
    case 'high':
      return 'Arrival time is accurate';
    case 'medium':
      return 'Arrival time is fairly accurate';
    case 'low':
      return 'Arrival time may not be accurate';
    case 'off_route':
      return 'Line may have left its route';
    case 'none':
    default:
      return source === 'historical'
        ? 'Based on previous arrivals'
        : 'Based on schedule';
  }
}

/** CSS modifier for the ETA pill / text color. */
export function confidenceClass(confidence: ArrivalConfidence): string {
  switch (confidence) {
    case 'high':
      return 'is-acc-high';
    case 'medium':
      return 'is-acc-medium';
    case 'low':
      return 'is-acc-low';
    case 'off_route':
      return 'is-acc-off-route';
    default:
      return 'is-acc-none';
  }
}

export function isLiveConfidence(confidence: ArrivalConfidence): boolean {
  return (
    confidence === 'high' ||
    confidence === 'medium' ||
    confidence === 'low' ||
    confidence === 'off_route'
  );
}

export function shouldShowRelativeEta(minutes: number, nextDay = false): boolean {
  return !nextDay && minutes <= RELATIVE_ETA_MAX_MIN;
}

export function formatEtaLabel(
  minutes: number,
  opts?: { departureSec?: number; nextDay?: boolean }
): string {
  if (!opts?.nextDay && minutes <= 0) return 'now';
  if (shouldShowRelativeEta(minutes, opts?.nextDay)) {
    return minutes === 1 ? '1 min' : `${minutes} min`;
  }
  return formatArrivalClock(minutes, opts?.departureSec);
}

export function formatSignalUpdated(next?: DepartureNext | null): string | null {
  if (!next?.lastUpdated && next?.signalAgeSec == null) return null;
  if (next.lastUpdated) return `Updated ${formatVehicleAge(next.lastUpdated)}`;
  if (next.signalAgeSec != null) {
    const fakeTs = Date.now() - next.signalAgeSec * 1000;
    return `Updated ${formatVehicleAge(fakeTs)}`;
  }
  return null;
}

/** Delay caption when aimed vs expected differ by ≥2 min. */
export function formatDelayLabel(delayMin: number | undefined): string | null {
  if (delayMin == null || Math.abs(delayMin) < 2) return null;
  if (delayMin > 0) return `${delayMin} min late`;
  return `${Math.abs(delayMin)} min early`;
}
