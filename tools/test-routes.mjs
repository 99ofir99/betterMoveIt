import { TransitStore } from '../server/src/store.js';
import { JourneyPlanner } from '../server/src/raptor.js';

const store = new TransitStore(process.env.GTFS_DATA_DIR);
const planner = new JourneyPlanner(store);
const fmt = (s) => `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`;

const trips = [
  { name: 'TLV -> Jerusalem', from: { lat: 32.0853, lon: 34.7818 }, to: { lat: 31.7683, lon: 35.2137 } },
  { name: 'TLV -> Haifa', from: { lat: 32.0853, lon: 34.7818 }, to: { lat: 32.7940, lon: 34.9896 } },
  { name: 'TLV -> Beer Sheva', from: { lat: 32.0853, lon: 34.7818 }, to: { lat: 31.2518, lon: 34.7913 } },
  { name: 'TLV short hop', from: { lat: 32.0684, lon: 34.7698 }, to: { lat: 32.1093, lon: 34.8042 } },
];

for (const t of trips) {
  const t0 = Date.now();
  const r = planner.plan({ from: t.from, to: t.to, dateInt: 20261124, dow: 2, secondsSinceMidnight: 8 * 3600 });
  const ms = Date.now() - t0;
  console.log(`\n=== ${t.name}  (${r.journeys.length} options, ${ms}ms)`);
  if (!r.journeys.length) { console.log('   NO ROUTE', JSON.stringify(r.diagnostics)); continue; }
  for (const j of r.journeys.slice(0, 3)) {
    const chain = j.legs.filter(l => l.mode === 'transit').map(l => `${l.route.shortName}(${fmt(l.departure)}-${fmt(l.arrival)})`).join(' > ');
    console.log(`   ${fmt(j.departSeconds)}->${fmt(j.arrivalSeconds)} ${Math.round(j.durationSec/60)}min ${j.transfers}x  ${chain || 'walk only'}`);
  }
}
