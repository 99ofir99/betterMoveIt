/** Format how stale a live vehicle position is (Moovit Live Location "last updated"). */

import type { ArrivalConfidence } from '../types';

/** Keep in sync with arrivalAccuracy.ts / server arrivalAccuracy.js */
const GPS_HIGH_SEC = 45;
const GPS_MEDIUM_SEC = 120;
const GPS_LOW_SEC = 240;

export function formatVehicleAge(timestampMs: number, nowMs = Date.now()): string {
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) return 'no signal';
  const ageSec = Math.max(0, Math.round((nowMs - timestampMs) / 1000));
  if (ageSec < 5) return 'just now';
  if (ageSec < 60) return `${ageSec}s ago`;
  const ageMin = Math.floor(ageSec / 60);
  if (ageMin < 60) return `${ageMin}m ago`;
  return `${Math.floor(ageMin / 60)}h ago`;
}

/** Fresh enough to treat as a live tracking ping (green tier). */
export function isVehicleFresh(
  timestampMs: number,
  nowMs = Date.now(),
  maxAgeSec = GPS_HIGH_SEC
): boolean {
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) return false;
  return nowMs - timestampMs <= maxAgeSec * 1000;
}

/** Map marker confidence from GPS age (Moovit G/Y/R). */
export function confidenceFromAge(
  timestampMs: number | null | undefined,
  nowMs = Date.now()
): ArrivalConfidence {
  if (!Number.isFinite(timestampMs) || !timestampMs || timestampMs <= 0) return 'none';
  const ageSec = (nowMs - timestampMs) / 1000;
  if (ageSec <= GPS_HIGH_SEC) return 'high';
  if (ageSec <= GPS_MEDIUM_SEC) return 'medium';
  if (ageSec <= GPS_LOW_SEC) return 'low';
  return 'none';
}
