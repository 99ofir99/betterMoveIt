import { readFileSync } from 'fs';
import { clampJourneys } from '../src/lib/clampJourneys.ts';
import { dedupeJourneys } from '../src/lib/dedupeSearch.ts';
const raw = JSON.parse(readFileSync('../_tmp_habima2.json', 'utf8'));
const journeys = dedupeJourneys(raw);
const clamped = clampJourneys(journeys);
console.log('raw', raw.length, 'deduped', journeys.length, 'clamped', clamped.length);
for (const c of clamped) {
  const alts = c.transitAlternatives.map(a => a.map(r => r.shortName || r.displayName).join('/')).join(' > ');
  console.log('src', c.sourceIndices.join(','), alts, c.transitAlternatives.some(a=>a.length>1)?'<<CLAMPED':'');
}
