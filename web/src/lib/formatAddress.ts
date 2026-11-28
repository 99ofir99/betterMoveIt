/**
 * Short Hebrew address from a Nominatim reverse result: "street number, city".
 * The raw display_name ("שדרות עמק איילון, שוהם, נפת רמלה, מחוז המרכז, …") lists
 * districts and leaves out the house number we do have in `address`.
 */

export interface NominatimAddress {
  road?: string;
  pedestrian?: string;
  footway?: string;
  path?: string;
  square?: string;
  house_number?: string;
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  municipality?: string;
}

export interface NominatimReverse {
  name?: string;
  display_name?: string;
  address?: NominatimAddress;
}

const ADMIN = /^(נפת|מחוז|ישראל$)|district|israel$|^\d{5,7}$/i;

export function formatAddress(r: NominatimReverse): string | null {
  const a = r.address ?? {};
  const street = a.road || a.pedestrian || a.square || a.footway || a.path;
  const city = a.city || a.town || a.village || a.hamlet || a.municipality;
  const place = r.name?.trim();
  let first: string | undefined;
  if (street) first = a.house_number ? `${street} ${a.house_number}` : street;
  else first = place || a.neighbourhood || a.suburb || a.quarter;
  if (first && city && first !== city) return `${first}, ${city}`;
  if (first || city) return (first || city)!;
  // Last resort: the display name without districts, postcode and country.
  const parts = (r.display_name ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && !ADMIN.test(s));
  return parts.length ? parts.slice(0, 2).join(', ') : null;
}

/** An OSM address point from Overpass (`out center`). */
export interface OsmAddressPoint {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function metersBetween(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const k = 111_320;
  const dx = (bLon - aLon) * k * Math.cos((aLat * Math.PI) / 180);
  const dy = (bLat - aLat) * k;
  return Math.hypot(dx, dy);
}

/**
 * Nearest mapped house number around a point: on `street` when one is within
 * `maxM`, else any address within `maxOtherM` (its own street then).
 */
export function nearestHouseNumber(
  points: OsmAddressPoint[],
  lat: number,
  lon: number,
  street: string | undefined,
  maxM = 60,
  maxOtherM = 30
): { street: string; number: string } | null {
  let same: { d: number; street: string; number: string } | null = null;
  let other: { d: number; street: string; number: string } | null = null;
  for (const p of points) {
    const number = p.tags?.['addr:housenumber'];
    const pStreet = p.tags?.['addr:street'];
    const pLat = p.lat ?? p.center?.lat;
    const pLon = p.lon ?? p.center?.lon;
    if (!number || !pStreet || pLat == null || pLon == null) continue;
    const d = metersBetween(lat, lon, pLat, pLon);
    if (street && pStreet === street) {
      if (d <= maxM && (!same || d < same.d)) same = { d, street: pStreet, number };
    } else if (d <= maxOtherM && (!other || d < other.d)) {
      other = { d, street: pStreet, number };
    }
  }
  const best = same ?? other;
  return best ? { street: best.street, number: best.number } : null;
}

/** Fill a missing house number from the nearest mapped address point. */
export function withHouseNumber(
  r: NominatimReverse,
  hit: { street: string; number: string } | null
): NominatimReverse {
  if (!hit || r.address?.house_number) return r;
  return { ...r, address: { ...r.address, road: hit.street, house_number: hit.number } };
}
