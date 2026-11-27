/**
 * Normalize Israeli GTFS route_long_name corridors so A↔B and B↔A match.
 * Mirrors web/src/lib/lineCategory.ts endpoint parsing.
 */

function endpointCity(side) {
  let s = String(side || '').trim();
  if (!s) return '';
  s = s.replace(/[-_]\d{1,3}$/u, '').trim();
  const afterSlash = s.includes('/') ? s.split('/').pop() || s : s;
  const hy = afterSlash.split('-');
  if (hy.length >= 2) {
    const last = (hy[hy.length - 1] || '').trim();
    if (last.length >= 2) return last;
  }
  return afterSlash.trim();
}

export function splitCorridorEndpoints(longName) {
  const trimmed = String(longName || '').trim();
  if (!trimmed) return null;
  const arrow = trimmed.split(/\s*<->\s*|\s*↔\s*/);
  if (arrow.length === 2 && arrow[0] && arrow[1]) return [arrow[0], arrow[1]];
  const dash = trimmed.split(/\s*[-–—]\s*/);
  if (dash.length === 2 && dash[0] && dash[1]) return [dash[0], dash[1]];
  return null;
}

/** Direction-agnostic corridor key, or null when long_name is not a corridor. */
export function corridorKey(longName) {
  const ends = splitCorridorEndpoints(longName);
  if (!ends) return null;
  const a = endpointCity(ends[0]);
  const b = endpointCity(ends[1]);
  if (!a || !b) return null;
  return [a, b].sort((x, y) => x.localeCompare(y, 'he')).join('\0');
}

/** City at the destination (right-hand) side of a corridor long_name. */
export function corridorDestCity(longName) {
  const ends = splitCorridorEndpoints(longName);
  if (!ends) return '';
  return endpointCity(ends[1]) || endpointCity(ends[0]);
}

/** City at the origin (left-hand) side of a corridor long_name. */
export function corridorOriginCity(longName) {
  const ends = splitCorridorEndpoints(longName);
  if (!ends) return '';
  return endpointCity(ends[0]) || endpointCity(ends[1]);
}
