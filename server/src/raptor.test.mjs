import test from 'node:test';
import assert from 'node:assert/strict';
import { JourneyPlanner, mergeConsecutiveWalks } from './raptor.js';

/**
 * Minimal in-memory store: stops 0..3 on a street, ~300 m apart. Walking
 * transfers only link neighbours (0↔1↔2), so reaching stop 2 from the origin
 * (which only "sees" stop 0) takes two transfer hops. One bus runs 2 → 3.
 */
function chainStore() {
  const stops = [
    { id: 'A', name: 'A', lat: 32.0, lon: 34.8 },
    { id: 'B', name: 'B', lat: 32.0027, lon: 34.8 },
    { id: 'C', name: 'C', lat: 32.0054, lon: 34.8 },
    { id: 'D', name: 'D', lat: 32.05, lon: 34.8 },
  ];
  // transfers: 0→1, 1→0, 1→2, 2→1 (300 m each)
  const adj = [[1], [0, 2], [1], []];
  const transferStart = new Int32Array(5);
  const tStops = [];
  adj.forEach((n, i) => {
    tStops.push(...n);
    transferStart[i + 1] = transferStart[i] + n.length;
  });
  // one trip: rows 0 (stop 2 dep 08:20) and 1 (stop 3 arr 08:30)
  const dep = 8 * 3600 + 20 * 60;
  const arr = 8 * 3600 + 30 * 60;
  const stopTripStart = new Int32Array([0, 0, 0, 1, 1]); // only stop 2 has a boarding
  return {
    stopCount: 4,
    transferStart,
    transferStop: Int32Array.from(tStops),
    transferDist: Float64Array.from(tStops.map(() => 300)),
    stopTripStart,
    stopTripTrip: Int32Array.from([0]),
    stopTripRow: Int32Array.from([0]),
    stopTripDepAt: () => dep,
    lowerBoundStopTrip: (stop, t) => (stop === 2 && t <= dep ? 0 : stopTripStart[stop + 1]),
    tripRoute: Int32Array.from([0]),
    tripService: Int32Array.from([0]),
    tripStopStart: Int32Array.from([0, 2]),
    tripHeadsign: ['D'],
    stArrival: Int32Array.from([dep, arr]),
    stStopIdx: Int32Array.from([2, 3]),
    stopName: stops.map((x) => x.name),
    stopObject: (i) => stops[i],
    routeObject: (idx) => ({ index: idx, displayName: '42', shortName: '42', color: '' }),
  };
}

test('walking to a stop several transfer hops away is one walk leg', () => {
  const s = chainStore();
  const planner = new JourneyPlanner(s);
  const { journey } = planner.planOnce({
    access: [{ stop: 0, distance: 100 }],
    egressByStop: new Map([[3, 60]]),
    destPoint: { lat: 32.0505, lon: 34.8, name: 'Dest' },
    originPoint: { lat: 31.9991, lon: 34.8, name: 'Home' },
    departAt: 8 * 3600,
    activeService: [true],
    s,
  });
  assert.ok(journey, 'expected a journey');
  const modes = journey.legs.map((l) => l.mode);
  assert.deepEqual(modes, ['walk', 'transit', 'walk']);
  const first = journey.legs[0];
  assert.equal(first.fromName, 'Home');
  assert.equal(first.toName, 'C');
  assert.equal(first.distanceM, 700); // 100 access + 300 + 300
  assert.equal(first.durationSec, Math.round(100 / 1.35) + 2 * Math.round(300 / 1.35));
});

test('mergeConsecutiveWalks folds adjacent walks and keeps rides', () => {
  const w = (from, to, m, sec) => ({ mode: 'walk', fromName: from, toName: to, from: { n: from }, to: { n: to }, distanceM: m, durationSec: sec });
  const ride = { mode: 'transit', fromName: 'C', toName: 'D' };
  const out = mergeConsecutiveWalks([w('O', 'A', 100, 70), w('A', 'C', 600, 440), ride, w('D', 'X', 50, 40), w('X', 'Dest', 80, 60)]);
  assert.equal(out.length, 3);
  assert.deepEqual(
    [out[0].fromName, out[0].toName, out[0].distanceM, out[0].durationSec],
    ['O', 'C', 700, 510]
  );
  assert.equal(out[1], ride);
  assert.deepEqual([out[2].fromName, out[2].toName, out[2].distanceM, out[2].durationSec], ['D', 'Dest', 130, 100]);
});
