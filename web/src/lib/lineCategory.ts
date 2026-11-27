import type { Line } from '../types';
import type { LineCategoryFilter } from '../components/LinesTab/types';

/** GTFS extended route types that count as bus-like or rail-like for UI filtering. */
export function lineMatchesCategory(line: Line, filter: LineCategoryFilter): boolean {
  if (filter === 'all') return true;
  const t = line.typeName.toLowerCase();
  const gtfs = line.type;
  const isBus =
    t === 'bus' ||
    t === 'trolleybus' ||
    gtfs === 3 ||
    gtfs === 11 ||
    gtfs === 702;
  const isLightRail =
    t === 'tram' ||
    t === 'rail' ||
    t === 'subway' ||
    t === 'light_rail' ||
    t === 'light rail' ||
    gtfs === 0 ||
    gtfs === 1 ||
    gtfs === 2 ||
    // תבל / כפיר may still be type 3 until a re-ingest; agency branding is server-side.
    line.agency === 'תבל' ||
    line.agency === 'כפיר';
  if (filter === 'bus') return isBus;
  return isLightRail;
}

/**
 * Pull a city / locality label from one side of an Israeli GTFS long_name.
 * Examples:
 *  - "הארבל/שורק-אורנית" → "אורנית"
 *  - "מסוף חרש-פתח תקווה-10" → "פתח תקווה"
 *  - "Ariel" → "Ariel"
 */
function endpointCity(side: string): string {
  let s = side.trim();
  if (!s) return '';
  // Strip trailing direction / variant codes: -10, -20, _תחנת…
  s = s.replace(/[-_]\d{1,3}$/u, '').trim();
  // Prefer text after the last slash (stop/area-city pattern).
  const afterSlash = s.includes('/') ? (s.split('/').pop() || s) : s;
  // Street-city hyphen: take the last hyphen segment when it looks like a place.
  const hy = afterSlash.split('-');
  if (hy.length >= 2) {
    const last = (hy[hy.length - 1] || '').trim();
    if (last.length >= 2) return last;
  }
  return afterSlash.trim();
}

function splitEndpoints(longName: string): [string, string] | null {
  const trimmed = longName.trim();
  const arrow = trimmed.split(/\s*<->\s*|\s*↔\s*/);
  if (arrow.length === 2 && arrow[0] && arrow[1]) return [arrow[0], arrow[1]];
  const dash = trimmed.split(/\s*[-–—]\s*/);
  // Only treat as A–B when we get a clean two-sided split (avoid chopping city names).
  if (dash.length === 2 && dash[0] && dash[1]) return [dash[0], dash[1]];
  return null;
}

/** Moovit Lines rows: "StartCity ↔ EndCity" only. */
export function formatLineLongName(longName: string | undefined): string {
  if (!longName) return 'Transit line';
  const trimmed = longName.trim();
  if (trimmed.includes('↔') && !trimmed.includes('/') && !/<->/.test(trimmed)) {
    // Already city-styled
    const parts = trimmed.split(/\s*↔\s*/);
    if (parts.length === 2 && parts[0] && parts[1] && parts[0].length < 40 && parts[1].length < 40) {
      return `${parts[0].trim()} ↔ ${parts[1].trim()}`;
    }
  }
  const ends = splitEndpoints(trimmed);
  if (!ends) return trimmed.length > 48 ? `${trimmed.slice(0, 45)}…` : trimmed;
  const a = endpointCity(ends[0]);
  const b = endpointCity(ends[1]);
  if (a && b) return `${a} ↔ ${b}`;
  if (a || b) return a || b;
  return trimmed;
}

/**
 * Israel Railways long_name is `OriginStation-City<->DestStation-City`.
 * The trip terminates at the right-hand side — return that city only.
 */
export function formatRailFinalCity(longName: string | undefined): string {
  if (!longName) return '';
  const ends = splitEndpoints(longName.trim());
  if (!ends) return endpointCity(longName);
  return endpointCity(ends[1]) || endpointCity(ends[0]);
}
