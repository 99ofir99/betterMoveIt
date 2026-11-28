/**
 * Find "this stop" in a line's stop list when a line is opened from a stop
 * (home Nearest station card, stop departure board).
 *
 * Exact GTFS stop_id first. The schedule shows one representative pattern, so
 * the stop may be missing (a variant) or, after Change direction, be the stop
 * across the street with another id: then fall back to the nearest stop on the
 * line within a short walk. A loop line can visit the stop twice; prefer a
 * visit that isn't the last stop, since nobody departs from the terminus.
 */

export interface AnchorStop {
  id?: string;
  lat: number;
  lon: number;
}

/** Farther than this and the line doesn't really pass "here". */
export const ANCHOR_MAX_M = 400;

function metres(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = (a.lat - b.lat) * 111_320;
  const dLon = (a.lon - b.lon) * 111_320 * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  return Math.hypot(dLat, dLon);
}

export function findAnchorIndex(
  stops: ReadonlyArray<{ id: string; lat: number; lon: number }>,
  anchor: AnchorStop | null | undefined,
): number {
  if (!anchor || stops.length === 0) return -1;
  const lastIdx = stops.length - 1;
  if (anchor.id) {
    const hits: number[] = [];
    stops.forEach((s, i) => {
      if (s.id === anchor.id) hits.push(i);
    });
    if (hits.length) return hits.find((i) => i < lastIdx) ?? hits[0];
  }
  if (!Number.isFinite(anchor.lat) || !Number.isFinite(anchor.lon)) return -1;
  let best = -1;
  let bestD = Infinity;
  stops.forEach((s, i) => {
    // The terminus only wins if nothing else is close.
    const d = metres(s, anchor) + (i === lastIdx && stops.length > 1 ? 50 : 0);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return bestD <= ANCHOR_MAX_M ? best : -1;
}
