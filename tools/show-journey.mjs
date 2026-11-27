import { TransitStore, getStore } from '../server/src/store.js';
import { JourneyPlanner } from '../server/src/raptor.js';

// GTFS_DATA_DIR wins; otherwise the same lookup the server uses (data/gtfs-dist, then data/gtfs-sample).
const store = process.env.GTFS_DATA_DIR ? new TransitStore(process.env.GTFS_DATA_DIR) : getStore();
const planner = new JourneyPlanner(store);

const fmt = (s) => `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`;

const r = planner.plan({
  from: { lat: 32.0853, lon: 34.7818, name: 'Tel Aviv Center' },
  to: { lat: 32.1133, lon: 34.8044, name: 'Ramat Aviv' },
  dateInt: 20261124,
  dow: 2,
  secondsSinceMidnight: 8 * 3600 + 30 * 60,
});

console.log('journeys:', r.journeys.length, 'compute', r.diagnostics.computeMs, 'ms');
for (const [i, j] of r.journeys.entries()) {
  console.log(`\n--- option ${i + 1}: ${j.durationSec / 60} min, ${j.transfers} transfers, walk ${j.walkMeters}m, arrive ${fmt(j.arrivalSeconds)}`);
  for (const l of j.legs) {
    if (l.mode === 'transit') {
      console.log(`  ${l.route.typeName.toUpperCase()} ${l.route.shortName} ${l.route.agency}: ${l.fromName} -> ${l.toName}  ${fmt(l.departure)}-${fmt(l.arrival)}  [${l.intermediateStops.length} stops, geom ${l.geometry.length} pts]`);
    } else {
      console.log(`  WALK ${l.fromName ?? ''} -> ${l.toName} ${l.distanceM}m`);
    }
  }
}
