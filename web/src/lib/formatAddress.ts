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
