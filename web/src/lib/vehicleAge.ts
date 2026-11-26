/** Format how stale a live vehicle position is. */

export function formatVehicleAge(timestampMs: number, nowMs = Date.now()): string {
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) return 'no signal';
  const ageSec = Math.max(0, Math.round((nowMs - timestampMs) / 1000));
  if (ageSec < 5) return 'just now';
  if (ageSec < 60) return `${ageSec}s ago`;
  const ageMin = Math.floor(ageSec / 60);
  if (ageMin < 60) return `${ageMin}m ago`;
  return `${Math.floor(ageMin / 60)}h ago`;
}

/** Fresh enough to treat as a live tracking ping. */
export function isVehicleFresh(timestampMs: number, nowMs = Date.now(), maxAgeSec = 90): boolean {
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) return false;
  return nowMs - timestampMs <= maxAgeSec * 1000;
}
