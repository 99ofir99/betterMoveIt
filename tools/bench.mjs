import { TransitStore, getStore } from '../server/src/store.js';
import { JourneyPlanner } from '../server/src/raptor.js';

// GTFS_DATA_DIR wins; otherwise the same lookup the server uses (data/gtfs-dist, then data/gtfs-sample).
const store = process.env.GTFS_DATA_DIR ? new TransitStore(process.env.GTFS_DATA_DIR) : getStore();
const planner = new JourneyPlanner(store);

// Warm up the JIT.
planner.plan({
  from: { lat: 32.0853, lon: 34.7818 },
  to: { lat: 32.1133, lon: 34.8044 },
  dateInt: 20261124,
  dow: 2,
  secondsSinceMidnight: 8 * 3600 + 30 * 60,
});

const runs = [];
for (let i = 0; i < 5; i++) {
  const t = Date.now();
  const r = planner.plan({
    from: { lat: 32.0853, lon: 34.7818 },
    to: { lat: 32.1133, lon: 34.8044 },
    dateInt: 20261124,
    dow: 2,
    secondsSinceMidnight: (8 * 3600 + 30 * 60) + i * 600,
  });
  runs.push({ ms: Date.now() - t, n: r.journeys.length, diagMs: r.diagnostics.computeMs });
}
console.log(runs);
