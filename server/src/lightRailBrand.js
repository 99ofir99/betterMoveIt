/**
 * Moovit-style light-rail branding for Israel MOT GTFS.
 *
 * Tel Aviv תבל publishes short names 1/2/3; Moovit shows them as R1/R2/R3
 * in a red circular badge. Jerusalem כפיר stays numeric but is still tram.
 *
 * Also repairs ingest of GTFS route_type 0 (tram), which `Number(x) || 3`
 * incorrectly stored as bus.
 */

/** Tel Aviv light rail (Tevel / Dan Light Rail). */
export const TEVEL_AGENCY_IDS = new Set(['22']);
/** Jerusalem light rail (Cfir / כפיר). */
export const JERUSALEM_TRAM_AGENCY_IDS = new Set(['21']);

/** SIRI OperatorRef values for light rail — no live bus tracking for these. */
export function isLightRailOperator(operatorRef) {
  const id = String(operatorRef ?? '');
  return TEVEL_AGENCY_IDS.has(id) || JERUSALEM_TRAM_AGENCY_IDS.has(id);
}

/** Moovit Red Line fill when the feed leaves route_color empty. */
export const LIGHT_RAIL_RED = '#E53935';

/** Safe GTFS route_type parse — keeps tram `0` (falsy) instead of defaulting to bus. */
export function parseRouteType(raw) {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 3;
}

function isTevel(agencyId, agencyName) {
  const id = String(agencyId ?? '');
  return TEVEL_AGENCY_IDS.has(id) || agencyName === 'תבל';
}

function isJerusalemTram(agencyId, agencyName) {
  const id = String(agencyId ?? '');
  return JERUSALEM_TRAM_AGENCY_IDS.has(id) || agencyName === 'כפיר';
}

/**
 * @returns {{ type: number, typeName: string, displayName: string, color: string } | null}
 */
export function brandLightRailRoute({ agencyId, agencyName, shortName, longName, type, color }) {
  const tevel = isTevel(agencyId, agencyName);
  const kfir = isJerusalemTram(agencyId, agencyName);
  if (!tevel && !kfir && type !== 0) return null;

  const num = String(shortName ?? '').trim();
  const displayName =
    tevel && /^\d+$/.test(num) ? `R${num}` : num || longName || 'Light rail';

  return {
    type: 0,
    typeName: 'tram',
    displayName,
    color: normalizeHexColor(color) || LIGHT_RAIL_RED,
  };
}

function normalizeHexColor(color) {
  if (!color || typeof color !== 'string') return null;
  const hex = color.startsWith('#') ? color : `#${color}`;
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : null;
}

/** Coarse mode family so bus corridors never absorb light-rail alts. */
export function modeFamily(type, typeName) {
  const t = String(typeName || '').toLowerCase();
  if (t === 'tram' || t === 'light_rail' || t === 'light rail' || t === 'subway' || type === 0 || type === 1) {
    return 'tram';
  }
  if (t === 'rail' || type === 2 || (type >= 100 && type < 200)) return 'rail';
  return 'bus';
}
