/**
 * RAPTOR (Round-Based Public Transit Routing).
 *
 * Plain Dijkstra needs a time-expanded graph, which for this feed is ~10M edges
 * per service day. RAPTOR instead relaxes one "leg" per round: round k holds the
 * best arrival at every stop reachable with exactly k transit legs. That gives us
 * k-leg-bounded answers (and therefore meaningful transfers), while touching only
 * the trips that actually depart from the reached stops.
 *
 * Improvements over textbook RAPTOR that matter in practice here:
 *  - Multi-criteria (Pareto) labels: we keep several non-dominated (arrival,
 *    transfers, walking) tuples per stop, so "fastest" and "fewest changes"
 *    can both be answered from one search.
 *  - Walking transfers are discovered from the spatial grid, not precomputed.
 *  - The access/egress steps are walked, so door-to-door times are real.
 */

import { haversine } from './store.js';
import { modeFamily } from './lightRailBrand.js';

const INF = 0x7fffffff;
const MAX_ROUNDS = 6;
/** Hard ceiling on transit vehicles in one itinerary (sanity, not preference). */
const MAX_RIDES = 4;
/**
 * Moovit "Best": a simpler trip wins when it arrives within this slack of a
 * more-transfer option. Extra buses that only save a few minutes are dropped.
 */
const TRANSFER_SLACK_SEC = 12 * 60;
/** Soft score penalty per transfer for ranking (≈ one transfer ≈ 12 min). */
const TRANSFER_PENALTY_SEC = 12 * 60;
/** How far from the last board stop to look for parallel corridor lines. */
const CORRIDOR_BOARD_RADIUS_M = 550;
/** Alt last-leg may arrive this much later than the representative and still count. */
const CORRIDOR_ARRIVAL_SLACK_SEC = 20 * 60;
/** Max extra short-names to attach per journey as corridor siblings. */
const CORRIDOR_ALT_LIMIT = 8;

function journeyScore(j) {
  return j.arrivalSeconds + j.transfers * TRANSFER_PENALTY_SEC;
}

/** True when a journey rides light rail / heavy rail (Moovit keeps these visible). */
function journeyHasRailMode(journey) {
  return (journey?.legs || []).some(
    (l) =>
      l.mode === 'transit' &&
      (modeFamily(l.route?.type, l.route?.typeName) === 'tram' ||
        modeFamily(l.route?.type, l.route?.typeName) === 'rail')
  );
}

/**
 * True when `simpler` should replace `extra` (fewer rides, close enough ETA).
 * Bus-only itineraries must not cull light-rail options (Moovit shows both).
 */
function transferDominated(extra, simpler) {
  if (simpler.transfers >= extra.transfers) return false;
  if (journeyHasRailMode(extra) && !journeyHasRailMode(simpler)) return false;
  if (simpler.arrivalSeconds > extra.arrivalSeconds + TRANSFER_SLACK_SEC) return false;
  if (simpler.durationSec > extra.durationSec + TRANSFER_SLACK_SEC) return false;
  return true;
}

/** Route indices that board/alight at any of the given stops (active day only). */
function routesServingStops(s, stopIds, day) {
  const out = new Set();
  for (const stop of stopIds) {
    if (day) {
      const start = day.start[stop];
      const end = day.start[stop + 1];
      for (let idx = start; idx < end; idx++) {
        out.add(s.tripRoute[day.trips[idx]]);
      }
    } else {
      const start = s.stopTripStart[stop];
      const end = s.stopTripStart[stop + 1];
      for (let idx = start; idx < end; idx++) {
        out.add(s.tripRoute[s.stopTripTrip[idx]]);
      }
    }
  }
  return out;
}

/** Clone only the parent chain needed to reconstruct one destination stop. */
function cloneParentChain(parents, destStop) {
  const out = new Map();
  let stop = destStop;
  let guard = 0;
  while (guard++ < 64) {
    const p = parents.get(stop);
    if (!p) break;
    out.set(stop, p);
    if (p.type === 'walk') {
      if (p.fromStop === undefined) break;
      stop = p.fromStop;
    } else {
      stop = p.boardStop;
    }
  }
  return out;
}

export class JourneyPlanner {
  constructor(store) {
    this.store = store;
    // Defaults so planOnce() is usable on its own; plan() overrides per request.
    this.walkSpeedMps = 1.35;
    this.maxWalkM = 1200;
    /** @type {Int32Array|null} reused earliest-arrival labels across planOnce calls */
    this._bestBuf = null;
    /** @type {Int32Array|null} trip → board row for the current round */
    this._boardRowBuf = null;
    /** @type {Int32Array|null} generation stamp matching _boardRowBuf */
    this._boardGenBuf = null;
    this._boardGen = 1;
  }

  /** Reuse typed buffers so repeated planOnce calls don't thrash the GC. */
  _ensureSearchBuffers(stopCount, tripCount) {
    if (!this._bestBuf || this._bestBuf.length !== stopCount) {
      this._bestBuf = new Int32Array(stopCount);
    }
    if (!this._boardRowBuf || this._boardRowBuf.length !== tripCount) {
      this._boardRowBuf = new Int32Array(tripCount);
      this._boardGenBuf = new Int32Array(tripCount);
      this._boardGen = 1;
    }
  }

  /**
   * @param {object} p
   * @param {{lat:number,lon:number}} p.from      origin coordinate
   * @param {{lat:number,lon:number}|{stopIndex:number}} p.to  destination
   * @param {number} p.dateInt  YYYYMMDD in feed-local time
   * @param {number} p.dow      0=Sunday
   * @param {number} p.secondsSinceMidnight  departure time (may exceed 86400 for GTFS next-day)
   */
  plan({ from, to, dateInt, dow, secondsSinceMidnight, maxWalkM = 1200, walkSpeedMps = 1.35 }) {
    const s = this.store;
    const t0 = Date.now();
    this.walkSpeedMps = walkSpeedMps;
    this.maxWalkM = maxWalkM;

    const day = s.ensureDayIndex(dateInt, dow);
    const activeService = day.activeSvc;
    let activeCount = 0;
    for (let i = 0; i < activeService.length; i++) if (activeService[i]) activeCount++;
    if (activeCount === 0) {
      return { journeys: [], reason: 'no_active_service', diagnostics: { activeCount } };
    }
    this._ensureSearchBuffers(s.stopCount, s.tripCount);

    // Stops reachable on foot from each endpoint. For long trips the nearest
    // stops are often local-only, so we also consider a wider ring and let the
    // search decide which of them actually pays off.
    const access = this.collectAccess(from, maxWalkM);
    const destPoint = to.stopIndex !== undefined ? s.stopObject(to.stopIndex) : to;
    const egressByStop = new Map();
    for (const e of s.nearby(destPoint.lat, destPoint.lon, maxWalkM, 24)) {
      egressByStop.set(e.stop, Math.round(e.distance / walkSpeedMps));
    }
    if (access.length === 0 || egressByStop.size === 0) {
      return {
        journeys: [],
        reason: 'no_stops_nearby',
        diagnostics: { access: access.length, egress: egressByStop.size },
      };
    }

    const ctx = { access, egressByStop, destPoint, originPoint: from, activeService, day, s };
    const MAX_RESULTS = 8;

    // Primary answer: leave now, arrive as early as possible.
    const journeys = [];
    const seenTrip = new Set();
    const seenRoutes = new Set();

    const pushJourney = (j, kind) => {
      if (!j) return false;
      if (j.routes.length > MAX_RIDES) return false;
      // Prefer structural variety (route sequence). Exact trip keys still avoid clones.
      const routeSig = routeSignature(j);
      if (j.transitKey && seenTrip.has(j.transitKey)) return false;
      // Same corridor is OK for later departures; otherwise keep one per route chain.
      if (routeSig && seenRoutes.has(routeSig) && kind !== 'later') return false;
      if (j.transitKey) seenTrip.add(j.transitKey);
      if (routeSig) seenRoutes.add(routeSig);
      j.kind = kind;
      journeys.push(j);
      return true;
    };

    const firstBoardSec = (j) => {
      const t = j?.legs?.find((l) => l.mode === 'transit');
      return t?.departure ?? j?.departSeconds ?? null;
    };

    const pullRoundAlternatives = (snapshots, queryDepart) => {
      if (!snapshots?.length) return;
      // One best egress per round (already computed while searching).
      const ordered = [];
      for (let k = 1; k < snapshots.length; k++) {
        const snap = snapshots[k];
        if (snap.bestStop < 0 || snap.bestArrive === INF) continue;
        ordered.push({
          k,
          stop: snap.bestStop,
          walkSec: snap.bestWalk,
          arrive: snap.bestArrive,
        });
      }
      ordered.sort((a, b) => a.k - b.k || a.arrive - b.arrive);
      for (const c of ordered) {
        if (journeys.length >= MAX_RESULTS) break;
        const legs = this.reconstruct(snapshots[c.k].parents, c.stop, c.walkSec, destPoint, from);
        if (!legs) continue;
        const j = this.describe(legs, queryDepart, c.arrive);
        j.rounds = c.k;
        if (!j.transitKey) continue;
        // Skip multi-ride alts that a simpler journey already covers within slack.
        const dominated = journeys.some((p) => transferDominated(j, p));
        if (dominated) continue;
        pushJourney(j, 'alternative');
      }
    };

    // 1) Leave-now search + multi-round alternatives.
    const search = this.planOnce({ ...ctx, departAt: secondsSinceMidnight });
    pushJourney(search?.journey ?? null, 'fastest');
    pullRoundAlternatives(search?.snapshots, secondsSinceMidnight);

    // 2) Force different corridors by banning routes from the primary path.
    //    Fixed +15/+30 offsets often reboard the same first bus; bans find real variety.
    const primary = journeys[0];
    if (primary && journeys.length < MAX_RESULTS) {
      const primaryRoutes = primary.legs
        .filter((l) => l.mode === 'transit')
        .map((l) => l.route.index)
        .filter((i) => Number.isFinite(i));
      const banSets = [];
      // Ban first line → other lines that still reach the same corridor / drop-off.
      if (primaryRoutes[0] != null) banSets.push(new Set([primaryRoutes[0]]));
      // Ban last line → alternatives for the final ride (Moovit end-clamp fodder).
      if (primaryRoutes.length > 1) {
        banSets.push(new Set([primaryRoutes[primaryRoutes.length - 1]]));
      }
      if (primaryRoutes.length > 1) banSets.push(new Set(primaryRoutes));
      for (const bannedRoutes of banSets) {
        if (journeys.length >= MAX_RESULTS) break;
        const alt = this.planOnce({
          ...ctx,
          departAt: secondsSinceMidnight,
          bannedRoutes,
        });
        const altJ = alt?.journey ?? null;
        // Ban-sets often invent extra transfers — keep only if not dominated.
        if (altJ && !journeys.some((p) => transferDominated(altJ, p))) {
          pushJourney(altJ, 'alternative');
        }
        pullRoundAlternatives(alt?.snapshots, secondsSinceMidnight);
      }
    }

    // 3) Profile / range query: keep searching after each boarding so we get
    //    later leave options instead of re-hitting the same first trip.
    //    Round alts are already covered by leave-now / ban searches.
    let cursor = firstBoardSec(journeys[0]);
    if (cursor == null) cursor = secondsSinceMidnight;
    else cursor += 60;
    const profileHorizon = secondsSinceMidnight + 4 * 3600;
    for (let i = 0; i < 10 && journeys.length < MAX_RESULTS && cursor <= profileHorizon; i++) {
      const later = this.planOnce({ ...ctx, departAt: cursor });
      if (!later?.journey) break;
      const before = journeys.length;
      pushJourney(later.journey, 'later');
      const board = firstBoardSec(later.journey);
      if (board == null || board + 60 <= cursor) {
        cursor += 20 * 60;
      } else {
        cursor = board + 60;
      }
      // If nothing new stuck and we are not advancing usefully, stop.
      if (journeys.length === before && i >= 2) break;
    }

    // 4) Moovit mode diversity: when light rail serves the destination area,
    //    surface at least one feeder→R1/R3 itinerary even if buses are faster.
    //    Runs even when MAX_RESULTS is full — buses must not hide the tram card.
    if (!journeys.some(journeyHasRailMode)) {
      const destRoutes = routesServingStops(s, egressByStop.keys(), day);
      const tramDestRoutes = [];
      const banDestBuses = new Set();
      for (const ri of destRoutes) {
        const o = s.routeObject(ri);
        const fam = modeFamily(o.type, o.typeName);
        if (fam === 'tram' || fam === 'rail') tramDestRoutes.push(ri);
        else banDestBuses.add(ri);
      }
      if (tramDestRoutes.length && banDestBuses.size) {
        const ensureSlot = () => {
          if (journeys.length < MAX_RESULTS + 2) return;
          const drop = journeys.findIndex((j) => j.kind === 'later' && !journeyHasRailMode(j));
          if (drop >= 0) journeys.splice(drop, 1);
        };

        const railSearch = this.planOnce({
          ...ctx,
          departAt: secondsSinceMidnight,
          bannedRoutes: banDestBuses,
        });
        const railJ = railSearch?.journey ?? null;
        if (railJ && journeyHasRailMode(railJ)) {
          ensureSlot();
          pushJourney(railJ, 'mode_alt');
        }

        let railCursor = firstBoardSec(railJ);
        if (railCursor == null) railCursor = secondsSinceMidnight + 20 * 60;
        else railCursor += 60;
        for (let i = 0; i < 2 && railCursor <= profileHorizon; i++) {
          const laterRail = this.planOnce({
            ...ctx,
            departAt: railCursor,
            bannedRoutes: banDestBuses,
          });
          if (!laterRail?.journey || !journeyHasRailMode(laterRail.journey)) break;
          ensureSlot();
          pushJourney(laterRail.journey, 'mode_alt');
          const board = firstBoardSec(laterRail.journey);
          if (board == null || board + 60 <= railCursor) railCursor += 20 * 60;
          else railCursor = board + 60;
        }
      }
    }

    // A pure walking option is always worth showing for short trips.
    const straight = haversine(from.lat, from.lon, destPoint.lat, destPoint.lon);
    if (straight > 0 && straight < 2500) {
      const walkSec = Math.round(straight / walkSpeedMps);
      const earliestArrive = journeys.length
        ? Math.min(...journeys.map((j) => j.arrivalSeconds))
        : Infinity;
      if (secondsSinceMidnight + walkSec <= earliestArrive + 10 * 60) {
        pushJourney(
          {
            legs: [
              {
                mode: 'walk',
                fromName: from.name || 'Origin',
                toName: destPoint.name || 'Destination',
                from: { lat: from.lat, lon: from.lon },
                to: { lat: destPoint.lat, lon: destPoint.lon },
                distanceM: Math.round(straight),
                durationSec: walkSec,
              },
            ],
            legSignature: 'walk',
            transitKey: '',
            departSeconds: secondsSinceMidnight,
            arrivalSeconds: secondsSinceMidnight + walkSec,
            durationSec: walkSec,
            transfers: 0,
            walkSec,
            walkMeters: Math.round(straight),
            transitSec: 0,
            routes: [],
            primaryRouteColor: null,
          },
          'walk'
        );
      }
    }

    // Moovit "Best": arrival + transfer penalty. Client re-ranks for explicit prefs.
    journeys.sort(
      (a, b) =>
        journeyScore(a) - journeyScore(b) ||
        a.transfers - b.transfers ||
        a.arrivalSeconds - b.arrivalSeconds ||
        a.durationSec - b.durationSec
    );

    const bestArrival = journeys.length
      ? Math.min(...journeys.map((j) => j.arrivalSeconds))
      : INF;
    const bestDuration = journeys.length
      ? Math.min(...journeys.map((j) => j.durationSec))
      : INF;
    // Cull: near-clones, absurd outliers, and transfer-dominated options
    // (3 buses that only beat a 2-bus by a few minutes).
    const maxDuration = Math.max(2.5 * 3600, bestDuration * 2.25);
    const maxArrival = bestArrival + 75 * 60;

    // Two-pass domination: a 1-transfer option must kill a 3-bus that only
    // wins by a few minutes even when the 3-bus ranks first on raw score.
    const candidates = journeys.filter(
      (j) => j.durationSec <= maxDuration && j.arrivalSeconds <= maxArrival
    );
    const pruned = [];
    for (const j of candidates) {
      if (candidates.some((p) => p !== j && transferDominated(j, p))) continue;
      const sig = routeSignature(j);
      const nearClone = pruned.some((p) => {
        if (routeSignature(p) !== sig) return false;
        return (
          Math.abs(p.departSeconds - j.departSeconds) < 180 &&
          Math.abs(p.arrivalSeconds - j.arrivalSeconds) < 180
        );
      });
      if (!nearClone) pruned.push(j);
    }

    // Moovit corridor badges: expand last-leg alternatives (1/66/50/82…, 286/186…)
    // into sibling journeys so the client can clamp them onto one card.
    const withCorridor = [...pruned];
    for (const j of pruned) {
      if (withCorridor.length >= MAX_RESULTS + CORRIDOR_ALT_LIMIT) break;
      for (const alt of this.findLastLegCorridorAlts(j, {
        egressByStop,
        activeService,
        day,
        s,
      })) {
        if (withCorridor.length >= MAX_RESULTS + CORRIDOR_ALT_LIMIT) break;
        if (alt.transitKey && seenTrip.has(alt.transitKey)) continue;
        if (alt.transitKey) seenTrip.add(alt.transitKey);
        withCorridor.push(alt);
      }
    }

    withCorridor.sort(
      (a, b) =>
        journeyScore(a) - journeyScore(b) ||
        a.transfers - b.transfers ||
        a.arrivalSeconds - b.arrivalSeconds
    );

    const kept = withCorridor.slice(0, MAX_RESULTS + CORRIDOR_ALT_LIMIT);
    // Geometry / intermediate stops only for journeys we actually return.
    for (const j of kept) this.enrichJourneyDetails(j);

    return {
      // Keep corridor siblings even past MAX_RESULTS so clamp can merge badges.
      journeys: kept,
      diagnostics: {
        rounds: MAX_ROUNDS,
        activeServices: activeCount,
        accessStops: access.length,
        egressStops: egressByStop.size,
        dayTrips: day.total,
        computeMs: Date.now() - t0,
      },
    };
  }
  /**
   * Origin access points. A nearby-stop-only walk radius strands long trips:
   * the closest stops may only serve local lines. So we widen the ring and keep
   * the walk cost real, letting the search reject the far ones when they lose.
   */
  collectAccess(from, maxWalkM) {
    const s = this.store;
    const tight = s.nearby(from.lat, from.lon, maxWalkM, 16);
    const wide = s.nearby(from.lat, from.lon, maxWalkM * 2.5, 24);
    const byStop = new Map();
    for (const e of tight) byStop.set(e.stop, e.distance);
    for (const e of wide) if (!byStop.has(e.stop)) byStop.set(e.stop, e.distance);
    return [...byStop.entries()].map(([stop, distance]) => ({ stop, distance }));
  }

  bestEgress(label, egressByStop) {
    let best = INF;
    for (const [stop, walkSec] of egressByStop) {
      const v = label instanceof Map ? label.get(stop) : label[stop];
      if (v !== undefined && v !== INF && v + walkSec < best) best = v + walkSec;
    }
    return best;
  }

  /** Snapshot only egress stop labels — enough for pick / early-stop / round alts. */
  snapshotEgressLabels(best, egressByStop) {
    const label = new Map();
    for (const stop of egressByStop.keys()) label.set(stop, best[stop]);
    return label;
  }

  /** Best door-to-door egress + the parent chain needed to reconstruct it. */
  snapshotRound(best, bestParents, egressByStop) {
    let bestStop = -1;
    let bestArrive = INF;
    let bestWalk = 0;
    for (const [stop, walkSec] of egressByStop) {
      const v = best[stop];
      if (v !== INF && v + walkSec < bestArrive) {
        bestArrive = v + walkSec;
        bestStop = stop;
        bestWalk = walkSec;
      }
    }
    return {
      label: this.snapshotEgressLabels(best, egressByStop),
      parents: bestStop < 0 ? new Map() : cloneParentChain(bestParents, bestStop),
      bestStop,
      bestWalk,
      bestArrive,
    };
  }

  /**
   * One RAPTOR search from a fixed departure time.
   *
   * Rounds are "exactly k rides". Each round relaxes walking from the previous
   * round's transit frontier, then boards vehicles from everything reachable so
   * far and updates a global best-arrival label. Because the label only ever
   * improves, the number of rides a stop was first reached with is what shapes
   * the resulting itinerary, and no round can silently chain extra rides.
   */
  planOnce({
    access,
    egressByStop,
    destPoint,
    originPoint,
    departAt,
    activeService,
    day,
    s,
    bannedRoutes,
  }) {
    const walk = (m) => Math.round(m / this.walkSpeedMps);
    const banned = bannedRoutes instanceof Set ? bannedRoutes : null;
    this._ensureSearchBuffers(s.stopCount, s.tripCount);

    // best[stop] = earliest arrival seen so far (any number of rides).
    const best = this._bestBuf;
    best.fill(INF);
    const bestParents = new Map();
    const snapshots = [];
    const boardRowBuf = this._boardRowBuf;
    const boardGenBuf = this._boardGenBuf;
    const dayStart = day?.start;
    const dayTrips = day?.trips;
    const dayRows = day?.rows;
    const useDay = Boolean(dayStart && dayTrips && dayRows);

    // Round 0: walk from the origin to the first stops.
    const reach0 = [];
    for (const a of access) {
      const arrive = departAt + walk(a.distance);
      if (arrive < best[a.stop]) {
        best[a.stop] = arrive;
        bestParents.set(a.stop, {
          type: 'walk',
          from: 'origin',
          distance: a.distance,
          duration: walk(a.distance),
        });
        reach0.push(a.stop);
      }
    }
    snapshots.push(this.snapshotRound(best, bestParents, egressByStop));

    let frontier = reach0.slice();
    const transferStart = s.transferStart;
    const transferStop = s.transferStop;
    const transferDist = s.transferDist;

    for (let round = 1; round <= MAX_ROUNDS && frontier.length; round++) {
      const improved = [];
      const reachableNow = new Set(frontier);

      // ---- step 1: walking from the transit frontier of the previous round
      for (const stop of frontier) {
        const base = best[stop];
        if (base === INF) continue;
        const t0 = transferStart[stop];
        const t1 = transferStart[stop + 1];
        for (let ti = t0; ti < t1; ti++) {
          const nStop = transferStop[ti];
          const distance = transferDist[ti];
          const arrive = base + walk(distance);
          if (arrive < best[nStop]) {
            best[nStop] = arrive;
            bestParents.set(nStop, {
              type: 'walk',
              fromStop: stop,
              distance,
              duration: walk(distance),
            });
            reachableNow.add(nStop);
            improved.push(nStop);
          }
        }
      }

      // ---- step 2: one ride per round, boarded from anything reachable
      // Trips that depart at/after the current best door-to-door arrival cannot
      // improve any label (or enable a later round that does), so we can stop.
      let boardDepCap = INF;
      if (round >= 2) {
        for (const [stop, walkSec] of egressByStop) {
          const v = best[stop];
          if (v !== INF && v + walkSec < boardDepCap) boardDepCap = v + walkSec;
        }
      }

      let boardGen = this._boardGen + 1;
      if (boardGen >= 0x7fffffff) {
        boardGenBuf.fill(0);
        boardGen = 1;
      }
      this._boardGen = boardGen;

      for (const stop of reachableNow) {
        const boardTime = best[stop];
        if (boardTime === INF) continue;

        let start;
        let end;
        if (useDay) {
          start = s.lowerBoundDayStopTrip(day, stop, boardTime);
          end = dayStart[stop + 1];
        } else {
          start = s.lowerBoundStopTrip(stop, boardTime);
          end = s.stopTripStart[stop + 1];
        }

        for (let idx = start; idx < end; idx++) {
          const dep = useDay ? s.dayStopTripDepAt(day, idx) : s.stopTripDepAt(idx);
          if (dep >= boardDepCap) break;
          const trip = useDay ? dayTrips[idx] : s.stopTripTrip[idx];
          if (banned && banned.has(s.tripRoute[trip])) continue;
          if (!useDay && activeService && !activeService[s.tripService[trip]]) continue;

          const row = useDay ? dayRows[idx] : s.stopTripRow[idx];
          if (boardGenBuf[trip] === boardGen && boardRowBuf[trip] <= row) continue;
          boardGenBuf[trip] = boardGen;
          boardRowBuf[trip] = row;

          const tEnd = s.tripStopStart[trip + 1];
          for (let r = row + 1; r < tEnd; r++) {
            const arr = s.stArrival[r];
            const ds = s.stStopIdx[r];
            if (arr < best[ds]) {
              best[ds] = arr;
              bestParents.set(ds, {
                type: 'transit',
                trip,
                boardStop: stop,
                boardRow: row,
                alightStop: ds,
                alightRow: r,
                departure: dep,
                arrival: arr,
              });
              improved.push(ds);
            }
          }
        }
      }

      const snap = this.snapshotRound(best, bestParents, egressByStop);
      snapshots.push(snap);
      frontier = improved;

      // Stop once more rides no longer beat the previous round by the Moovit slack.
      if (snap.bestArrive < INF && round >= 2) {
        const prevBest = snapshots[snapshots.length - 2]?.bestArrive ?? INF;
        if (snap.bestArrive + 30 >= prevBest) break;
      }
    }

    // ---- choose destination: Moovit Best = arrival + transfer penalty
    // Within a round, best arrival == best score, so one egress per round is enough.
    let pick = null;
    for (let k = 0; k < snapshots.length; k++) {
      const snap = snapshots[k];
      if (snap.bestStop < 0 || snap.bestArrive === INF) continue;
      const arrive = snap.bestArrive;
      const score = arrive + k * TRANSFER_PENALTY_SEC;
      if (
        !pick ||
        score < pick.score ||
        (score === pick.score && k < pick.k) ||
        (score === pick.score && k === pick.k && arrive < pick.arrive)
      ) {
        pick = {
          k,
          stop: snap.bestStop,
          walkSec: snap.bestWalk,
          arrive,
          score,
        };
      }
    }
    if (!pick) return { journey: null, snapshots, debug: 'no_pick' };

    const legs = this.reconstruct(
      snapshots[pick.k].parents,
      pick.stop,
      pick.walkSec,
      destPoint,
      originPoint
    );
    if (!legs) return { journey: null, snapshots, debug: 'reconstruct_failed', pick };
    const j = this.describe(legs, departAt, pick.arrive);
    j.rounds = pick.k;
    return { journey: j, snapshots };
  }

  reconstruct(parent, destStop, egressWalkSec, destPoint, originPoint) {
    const s = this.store;
    const legs = [];
    let stop = destStop;
    let guard = 0;

    // Walk to destination when needed (Moovit last-mile). Skip ~zero walks
    // when the destination is the alighting stop itself.
    const egressFrom = s.stopObject(destStop);
    const egressDistanceM = Math.round(egressWalkSec * this.walkSpeedMps);
    if (egressDistanceM >= 25 || egressWalkSec >= 20) {
      legs.unshift({
        mode: 'walk',
        fromName: egressFrom.name,
        toName: destPoint.name ?? 'Destination',
        from: { lat: egressFrom.lat, lon: egressFrom.lon, stopId: egressFrom.id },
        to: { lat: destPoint.lat, lon: destPoint.lon },
        distanceM: egressDistanceM,
        durationSec: egressWalkSec,
      });
    }

    while (guard++ < 64) {
      const p = parent.get(stop);
      if (!p) break;
      if (p.type === 'walk') {
        const toStop = s.stopObject(stop);
        const fromStop =
          p.fromStop !== undefined
            ? s.stopObject(p.fromStop)
            : originPoint
              ? { lat: originPoint.lat, lon: originPoint.lon, name: originPoint.name || 'Origin', id: undefined }
              : null;
        legs.unshift({
          mode: 'walk',
          fromName: fromStop?.name ?? (p.fromStop !== undefined ? s.stopName[p.fromStop] : 'Origin'),
          toName: toStop.name,
          ...(fromStop
            ? {
                from: {
                  lat: fromStop.lat,
                  lon: fromStop.lon,
                  ...(fromStop.id ? { stopId: fromStop.id } : {}),
                },
              }
            : {}),
          to: { lat: toStop.lat, lon: toStop.lon, stopId: toStop.id },
          distanceM: p.distance,
          durationSec: p.duration,
        });
        if (p.fromStop === undefined) break;
        stop = p.fromStop;
      } else {
        const trip = p.trip;
        const routeIdx = s.tripRoute[trip];
        const route = s.routeObject(routeIdx);
        const boardStop = s.stopObject(p.boardStop);
        const alightStop = s.stopObject(p.alightStop);
        legs.unshift({
          mode: 'transit',
          route,
          headsign: s.tripHeadsign[trip],
          fromName: boardStop.name,
          toName: alightStop.name,
          from: { lat: boardStop.lat, lon: boardStop.lon, stopId: boardStop.id },
          to: { lat: alightStop.lat, lon: alightStop.lon, stopId: alightStop.id },
          departure: p.departure,
          arrival: p.arrival,
          durationSec: p.arrival - p.departure,
          // Defer shape / intermediate stops until the journey is kept.
          _geo: { trip, boardRow: p.boardRow, alightRow: p.alightRow },
          tripId: s.tripGtfsId ? s.tripGtfsId[trip] : undefined,
        });
        stop = p.boardStop;
      }
    }
    if (legs.length === 0) return null;
    return legs;
  }

  /** Attach map geometry after pruning so discarded candidates skip the work. */
  enrichJourneyDetails(journey) {
    if (!journey?.legs) return;
    for (const leg of journey.legs) {
      if (leg.mode !== 'transit' || !leg._geo) continue;
      const { trip, boardRow, alightRow } = leg._geo;
      leg.intermediateStops = this.intermediateStops(trip, boardRow, alightRow);
      leg.geometry = this.legGeometry(trip, boardRow, alightRow);
      delete leg._geo;
    }
  }

  intermediateStops(trip, fromRow, toRow) {
    const s = this.store;
    const out = [];
    for (let r = fromRow; r <= toRow; r++) {
      const stop = s.stopObject(s.stStopIdx[r]);
      out.push({
        name: stop.name,
        id: stop.id,
        arrival: s.stArrival[r],
        departure: s.stDeparture[r],
        lat: stop.lat,
        lon: stop.lon,
      });
    }
    return out;
  }

  /**
   * Slice the trip's shape between board and alight stops.
   * Always nearest-vertex slice — returning the full GTFS shape made routes
   * snake across the whole country (and look like they go into the sea).
   */
  legGeometry(trip, fromRow, toRow) {
    const s = this.store;
    const a = s.stopObject(s.stStopIdx[fromRow]);
    const b = s.stopObject(s.stStopIdx[toRow]);
    const shapeIdx = s.tripShape[trip];
    if (shapeIdx < 0) {
      return [
        [a.lat, a.lon],
        [b.lat, b.lon],
      ];
    }
    const full = s.tripPolyline(shapeIdx);
    if (full.length < 2) {
      return [
        [a.lat, a.lon],
        [b.lat, b.lon],
      ];
    }

    const i0 = nearestVertex(full, a.lat, a.lon);
    const i1 = nearestVertex(full, b.lat, b.lon);
    if (i0 === i1) {
      return [
        [a.lat, a.lon],
        [b.lat, b.lon],
      ];
    }
    const sliced = i0 < i1 ? full.slice(i0, i1 + 1) : full.slice(i1, i0 + 1).reverse();
    // Anchor endpoints exactly on the stop coordinates.
    if (sliced.length >= 2) {
      sliced[0] = [a.lat, a.lon];
      sliced[sliced.length - 1] = [b.lat, b.lon];
    }
    return sliced;
  }

  /**
   * Other lines that board near the last transfer and drop near the same
   * alight / destination (Moovit "take any of 1 / 66 / 50 / 82"). Returns
   * full sibling journeys so client-side clamp can merge the badges.
   */
  findLastLegCorridorAlts(journey, { egressByStop, activeService, day, s }) {
    const legs = journey?.legs;
    if (!legs?.length) return [];
    let lastIdx = -1;
    for (let i = 0; i < legs.length; i++) if (legs[i].mode === 'transit') lastIdx = i;
    if (lastIdx < 0) return [];
    const last = legs[lastIdx];
    if (!last?.from || !last?.to || !last.route) return [];

    let readySec = last.departure - 120;
    for (let i = lastIdx - 1; i >= 0; i--) {
      if (legs[i].mode === 'transit' && Number.isFinite(legs[i].arrival)) {
        readySec = legs[i].arrival;
        break;
      }
    }

    // Stay on the same drop-off corridor — do NOT use the full 1.6 km egress
    // ring (that pulled in unrelated Petah Tikva streets as "alts").
    const alightTargets = new Set();
    for (const e of s.nearby(last.to.lat, last.to.lon, 450, 20)) alightTargets.add(e.stop);
    if (last.to.stopId) {
      const ti = s.stopIndexByGtfsId.get(last.to.stopId);
      if (ti !== undefined) alightTargets.add(ti);
    }
    // Also accept stops that are themselves tight destination egress.
    for (const [stop, walkSec] of egressByStop) {
      if (walkSec <= 360) alightTargets.add(stop); // ≤ ~6 min walk to dest
    }

    const boardStops = s.nearby(last.from.lat, last.from.lon, CORRIDOR_BOARD_RADIUS_M, 28);
    if (last.from.stopId) {
      const bi = s.stopIndexByGtfsId.get(last.from.stopId);
      if (bi !== undefined && !boardStops.some((n) => n.stop === bi)) {
        boardStops.unshift({ stop: bi, distance: 0 });
      }
    }

    const primaryName = (last.route.displayName || last.route.shortName || '').trim();
    const primaryFamily = modeFamily(last.route.type, last.route.typeName);
    const arrivalCap = last.arrival + CORRIDOR_ARRIVAL_SLACK_SEC;
    /** @type {Map<string, { routeIdx: number, trip: number, boardStop: number, boardRow: number, alightStop: number, alightRow: number, departure: number, arrival: number }>} */
    const bestByName = new Map();
    const useDay = Boolean(day?.start && day?.trips && day?.rows);

    const depCap = readySec + 2.5 * 3600;
    for (const n of boardStops) {
      const stop = n.stop;
      const start = useDay
        ? s.lowerBoundDayStopTrip(day, stop, readySec)
        : s.lowerBoundStopTrip(stop, readySec);
      const end = useDay ? day.start[stop + 1] : s.stopTripStart[stop + 1];
      for (let idx = start; idx < end; idx++) {
        const dep = useDay ? s.dayStopTripDepAt(day, idx) : s.stopTripDepAt(idx);
        if (dep > depCap) break; // sorted by dep
        const trip = useDay ? day.trips[idx] : s.stopTripTrip[idx];
        if (!useDay && activeService && !activeService[s.tripService[trip]]) continue;
        const routeIdx = s.tripRoute[trip];
        const cand = s.routeObject(routeIdx);
        // Never bundle light rail into a bus corridor chip (Moovit keeps R1 separate).
        if (modeFamily(cand.type, cand.typeName) !== primaryFamily) continue;
        const sn = (cand.displayName || cand.shortName || '').trim();
        if (!sn || sn === primaryName) continue;
        const prev = bestByName.get(sn);
        if (prev && prev.departure <= dep) continue;

        const row = useDay ? day.rows[idx] : s.stopTripRow[idx];
        const tEnd = s.tripStopStart[trip + 1];
        let hit = null;
        for (let r = row + 1; r < tEnd; r++) {
          const ds = s.stStopIdx[r];
          if (!alightTargets.has(ds)) continue;
          const arr = s.stArrival[r];
          if (arr > arrivalCap) break;
          hit = { alightStop: ds, alightRow: r, arrival: arr };
          break;
        }
        if (!hit) continue;
        bestByName.set(sn, {
          routeIdx,
          trip,
          boardStop: stop,
          boardRow: row,
          alightStop: hit.alightStop,
          alightRow: hit.alightRow,
          departure: dep,
          arrival: hit.arrival,
        });
      }
    }

    const ranked = [...bestByName.values()]
      .sort((a, b) => a.arrival - b.arrival || a.departure - b.departure)
      .slice(0, CORRIDOR_ALT_LIMIT);

    const out = [];
    for (const alt of ranked) {
      const route = s.routeObject(alt.routeIdx);
      const boardStop = s.stopObject(alt.boardStop);
      const alightStop = s.stopObject(alt.alightStop);
      const altLeg = {
        mode: 'transit',
        route,
        headsign: s.tripHeadsign[alt.trip],
        fromName: boardStop.name,
        toName: alightStop.name,
        from: { lat: boardStop.lat, lon: boardStop.lon, stopId: boardStop.id },
        to: { lat: alightStop.lat, lon: alightStop.lon, stopId: alightStop.id },
        departure: alt.departure,
        arrival: alt.arrival,
        durationSec: alt.arrival - alt.departure,
        _geo: { trip: alt.trip, boardRow: alt.boardRow, alightRow: alt.alightRow },
        tripId: s.tripGtfsId ? s.tripGtfsId[alt.trip] : undefined,
      };
      const newLegs = legs.map((l, i) => (i === lastIdx ? altLeg : l));
      // Egress walk after last ride still ends at the same destination.
      const arriveAt = alt.arrival + (journey.arrivalSeconds - last.arrival);
      const j = this.describe(newLegs, journey.departSeconds, arriveAt);
      j.kind = 'corridor_alt';
      j.corridorOf = journey.transitKey;
      out.push(j);
    }
    return out;
  }

  /**
   * When the rider should leave home for this itinerary: first boarding minus
   * the access walks before it. Never the planner query time ("now") — that
   * would inflate duration with idle wait until the first bus.
   */
  journeyDepartSeconds(legs, fallbackDepart) {
    const firstTransit = legs.find((l) => l.mode === 'transit');
    if (!firstTransit || firstTransit.departure == null) return fallbackDepart;
    let walkBefore = 0;
    for (const l of legs) {
      if (l.mode === 'transit') break;
      walkBefore += l.durationSec || 0;
    }
    return firstTransit.departure - walkBefore;
  }

  describe(legs, queryDepartAt, arriveAt) {
    let walkSec = 0;
    let transitSec = 0;
    let walkM = 0;
    const routes = [];
    for (const l of legs) {
      if (l.mode === 'walk') {
        walkSec += l.durationSec;
        walkM += l.distanceM ?? 0;
      } else {
        transitSec += l.durationSec;
        routes.push(l.route.displayName);
      }
    }
    // Transfers = number of rides minus one.
    const transfers = Math.max(0, routes.length - 1);
    const sig = legs.map((l) => (l.mode === 'transit' ? `${l.route.index}@${l.departure}` : 'w')).join('>');
    // Routes actually ridden, which is what makes two options "the same journey".
    const transitKey = legs
      .filter((l) => l.mode === 'transit')
      .map((l) => `${l.route.index}:${l.departure}`)
      .join('|');

    // Travel time = leave-for-this-trip → arrive (not query-now → arrive).
    const departSeconds = this.journeyDepartSeconds(legs, queryDepartAt);
    let durationSec = arriveAt - departSeconds;
    // Guard against crossed midnight / GTFS day wrap weirdness.
    if (durationSec < 0) durationSec += 86400;
    if (durationSec < 0 || durationSec > 16 * 3600) {
      durationSec = Math.max(0, walkSec + transitSec);
    }

    return {
      legs,
      legSignature: sig,
      transitKey,
      departSeconds,
      arrivalSeconds: arriveAt,
      durationSec,
      transfers,
      walkSec,
      walkMeters: Math.round(walkM),
      transitSec,
      routes,
      primaryRouteColor: legs.find((l) => l.mode === 'transit')?.route.color || null,
    };
  }
}

/** Route indices only — used to keep structurally different alternatives. */
function routeSignature(journey) {
  if (!journey?.legs) return '';
  return journey.legs
    .filter((l) => l.mode === 'transit')
    .map((l) => l.route?.index)
    .join('>');
}

function nearestVertex(pts, lat, lon) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const d = (pts[i][0] - lat) ** 2 + (pts[i][1] - lon) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}
