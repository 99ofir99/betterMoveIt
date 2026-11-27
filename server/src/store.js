/**
 * Transit data access layer.
 *
 * Files are read once into Buffers (not parsed into objects) and queried with
 * typed-array views over the same memory, so a 175MB timetable costs one read
 * and near-zero per-request allocation.
 */

import fs from 'node:fs';
import path from 'node:path';
import { brandLightRailRoute, modeFamily } from './lightRailBrand.js';

const SEARCH_DEPTH_ENV = 'GTFS_DATA_DIR';

export class TransitStore {
  constructor(dataDir) {
    this.dir = dataDir;
    this.load();
  }

  load() {
    const dir = this.dir;
    const t0 = Date.now();

    this.meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));

    // ---- stops
    const stopsBuf = fs.readFileSync(path.join(dir, 'stops.bin'));
    const gridScale = stopsBuf.readUInt32LE(0);
    const stopCount = stopsBuf.readUInt32LE(4);
    const cellCount = stopsBuf.readUInt32LE(8);
    const strLen = stopsBuf.readUInt32LE(12);
    const cellBytes = stopsBuf.readUInt32LE(16);

    const recOff = 32;
    const strOff = recOff + stopCount * 28;
    const cellOff = strOff + strLen;
    this.stopStrings = JSON.parse(stopsBuf.subarray(strOff, strOff + strLen).toString('utf8'));

    this.stopCount = stopCount;
    this.stopLat = new Float32Array(stopCount);
    this.stopLon = new Float32Array(stopCount);
    this.stopName = new Array(stopCount);
    this.stopNameEn = new Array(stopCount);
    this.stopCode = new Array(stopCount);
    this.stopParent = new Array(stopCount);
    this.stopGtfsId = new Array(stopCount);

    const view = new DataView(stopsBuf.buffer, stopsBuf.byteOffset, stopsBuf.byteLength);
    for (let i = 0; i < stopCount; i++) {
      const o = recOff + i * 28;
      this.stopGtfsId[i] = this.stopStrings[view.getInt32(o, true)];
      this.stopName[i] = this.stopStrings[view.getInt32(o + 4, true)];
      const codeIdx = view.getInt32(o + 8, true);
      this.stopCode[i] = codeIdx >= 0 ? this.stopStrings[codeIdx] : '';
      const pIdx = view.getInt32(o + 12, true);
      this.stopParent[i] = pIdx >= 0 ? this.stopStrings[pIdx] : '';
      this.stopLat[i] = view.getFloat32(o + 16, true);
      this.stopLon[i] = view.getFloat32(o + 20, true);
      const enIdx = view.getInt32(o + 24, true);
      this.stopNameEn[i] = enIdx >= 0 ? this.stopStrings[enIdx] : '';
    }

    this.stopIndexByGtfsId = new Map();
    for (let i = 0; i < stopCount; i++) this.stopIndexByGtfsId.set(this.stopGtfsId[i], i);

    // ---- spatial grid
    this.grid = new Map();
    {
      let off = cellOff;
      const end = cellOff + cellBytes;
      while (off < end) {
        const cy = view.getInt32(off, true);
        const cx = view.getInt32(off + 4, true);
        const n = view.getInt32(off + 8, true);
        const arr = new Int32Array(n);
        for (let k = 0; k < n; k++) arr[k] = view.getInt32(off + 12 + k * 4, true);
        this.grid.set(cy * 100000 + cx, arr);
        off += 12 + n * 4;
      }
    }
    this.gridScale = gridScale / 1e6;

    // ---- routes
    const routesBuf = fs.readFileSync(path.join(dir, 'routes.bin'));
    const routeCount = routesBuf.readUInt32LE(0);
    const rStrLen = routesBuf.readUInt32LE(4);
    const rStrOff = 8 + routeCount * 20;
    this.routeStrings = JSON.parse(routesBuf.subarray(rStrOff, rStrOff + rStrLen).toString('utf8'));
    const rView = new DataView(routesBuf.buffer, routesBuf.byteOffset, routesBuf.byteLength);
    this.routeCount = routeCount;
    this.routeShortName = new Array(routeCount);
    this.routeLongName = new Array(routeCount);
    this.routeAgency = new Array(routeCount);
    this.routeColor = new Array(routeCount);
    this.routeType = new Int32Array(routeCount);
    for (let i = 0; i < routeCount; i++) {
      const o = 8 + i * 20;
      this.routeShortName[i] = this.routeStrings[rView.getInt32(o, true)];
      this.routeLongName[i] = this.routeStrings[rView.getInt32(o + 4, true)];
      this.routeAgency[i] = this.routeStrings[rView.getInt32(o + 8, true)];
      const cIdx = rView.getInt32(o + 12, true);
      this.routeColor[i] = cIdx >= 0 ? this.routeStrings[cIdx] : '';
      this.routeType[i] = rView.getInt32(o + 16, true);
    }
    // First trip per route — used for line detail without scanning all trips per request.
    this.routeFirstTrip = new Int32Array(routeCount).fill(-1);

    // GTFS route_id (MOT LineRef) → short name. Sidecar written by ingest.
    this.routeShortNameByGtfsId = new Map();
    const routeIdsPath = path.join(dir, 'route_ids.json');
    if (fs.existsSync(routeIdsPath)) {
      try {
        const idMap = JSON.parse(fs.readFileSync(routeIdsPath, 'utf8'));
        for (const [gtfsId, shortName] of Object.entries(idMap)) {
          if (shortName) this.routeShortNameByGtfsId.set(String(gtfsId), String(shortName));
        }
      } catch {
        /* optional sidecar */
      }
    }

    // ---- trips
    const tripsBuf = fs.readFileSync(path.join(dir, 'trips.bin'));
    const tripCount = tripsBuf.readUInt32LE(0);
    const tStrLen = tripsBuf.readUInt32LE(4);
    const tStrOff = 8 + tripCount * 18;
    this.tripStrings = JSON.parse(tripsBuf.subarray(tStrOff, tStrOff + tStrLen).toString('utf8'));
    const tView = new DataView(tripsBuf.buffer, tripsBuf.byteOffset, tripsBuf.byteLength);
    this.tripCount = tripCount;
    this.tripRoute = new Int32Array(tripCount);
    this.tripService = new Int32Array(tripCount);
    this.tripShape = new Int32Array(tripCount);
    this.tripDirection = new Int8Array(tripCount);
    this.tripHeadsign = new Array(tripCount);
    for (let i = 0; i < tripCount; i++) {
      const o = 8 + i * 18;
      this.tripRoute[i] = tView.getInt32(o, true);
      this.tripService[i] = tView.getInt32(o + 4, true);
      this.tripShape[i] = tView.getInt32(o + 8, true);
      const hIdx = tView.getInt32(o + 12, true);
      this.tripHeadsign[i] = hIdx >= 0 ? this.tripStrings[hIdx] : '';
      this.tripDirection[i] = tView.getInt8(o + 16);
      const routeIdx = this.tripRoute[i];
      if (routeIdx >= 0 && this.routeFirstTrip[routeIdx] < 0) {
        this.routeFirstTrip[routeIdx] = i;
      }
    }

    // ---- services
    const svc = JSON.parse(fs.readFileSync(path.join(dir, 'services.json'), 'utf8'));
    this.services = svc.entries;
    this.serviceIndexById = new Map(svc.order.map((id, i) => [id, i]));

    // ---- stop_times
    // Keep the file Buffer alive and view into it — Buffer#slice / ArrayBuffer#slice
    // would double ~175MB of timetable data and blow past free-tier RAM.
    const stBuf = fs.readFileSync(path.join(dir, 'stop_times.bin'));
    this._stopTimesBuf = stBuf;
    const stTripCount = stBuf.readUInt32LE(0);
    const stRows = stBuf.readUInt32LE(4);
    let off = 16;
    const take = (Ctor, count) => {
      const bytes = count * Ctor.BYTES_PER_ELEMENT;
      const byteOffset = stBuf.byteOffset + off;
      if (byteOffset % Ctor.BYTES_PER_ELEMENT !== 0) {
        throw new Error(`unaligned ${Ctor.name} view at ${byteOffset}`);
      }
      const arr = new Ctor(stBuf.buffer, byteOffset, count);
      off += bytes;
      return arr;
    };
    this.tripStopStart = take(Int32Array, stTripCount + 1);
    this.stStopIdx = take(Int32Array, stRows);
    this.stArrival = take(Int32Array, stRows);
    this.stDeparture = take(Int32Array, stRows);
    this.stSeq = take(Uint16Array, stRows);
    this.stDist = take(Float32Array, stRows);

    // ---- shapes: keep only the small per-shape index in RAM; read point
    // ranges from disk on demand so the national feed fits free-tier memory.
    const shapesPath = path.join(dir, 'shapes.bin');
    const shHeader = Buffer.alloc(8);
    const shFd = fs.openSync(shapesPath, 'r');
    fs.readSync(shFd, shHeader, 0, 8, 0);
    this.shapeCount = shHeader.readUInt32LE(0);
    this._shapePointCount = shHeader.readUInt32LE(4);
    const metaBytes = this.shapeCount * 12;
    const metaBuf = Buffer.alloc(metaBytes);
    fs.readSync(shFd, metaBuf, 0, metaBytes, 8);
    this._shapesFd = shFd;
    this._shapesPtsFileOff = 8 + metaBytes;
    this.shapeMeta = new DataView(metaBuf.buffer, metaBuf.byteOffset, metaBytes);
    this._shapeMetaBuf = metaBuf;
    this.shapePoints = null;

    // ---- precomputed adjacency (stop -> trips serving it, sorted by departure)
    this.buildStopTripIndex();
    // Walking transfers used every RAPTOR round — same as nearby(500, 6) minus self.
    this.buildTransferNeighbors();

    this.loadMs = Date.now() - t0;
  }

  /**
   * RAPTOR needs, for each stop, the trips that visit it ordered by departure.
   * Built once at boot: ~2.4s for 9.6M rows, then every query is O(boardings).
   */
  buildStopTripIndex() {
    const t0 = Date.now();
    const counts = new Int32Array(this.stopCount);

    // Pass 1: how many stops does each trip serve (to size per-stop position lists)
    for (let t = 0; t < this.tripCount; t++) {
      const s = this.tripStopStart[t];
      const e = this.tripStopStart[t + 1];
      for (let r = s; r < e; r++) counts[this.stStopIdx[r]]++;
    }

    const start = new Int32Array(this.stopCount + 1);
    for (let i = 0; i < this.stopCount; i++) start[i + 1] = start[i] + counts[i];
    const total = start[this.stopCount];

    // Entries encode (trip, stop_times row). Departure is read from stDeparture
    // via stopTripRow so we don't keep a third 9.6M Int32 copy (~38MB).
    const entryTrip = new Int32Array(total);
    const entryRow = new Int32Array(total);
    const cursor = Int32Array.from(start.subarray(0, this.stopCount));
    const depAt = (idx) => this.stDeparture[entryRow[idx]];

    for (let t = 0; t < this.tripCount; t++) {
      const s = this.tripStopStart[t];
      const e = this.tripStopStart[t + 1];
      for (let r = s; r < e; r++) {
        const stop = this.stStopIdx[r];
        const c = cursor[stop]++;
        entryTrip[c] = t;
        entryRow[c] = r;
      }
    }

    // Sort each stop's slice by departure time so we can break early.
    for (let i = 0; i < this.stopCount; i++) {
      const a = start[i];
      const b = start[i + 1];
      const n = b - a;
      if (n < 2) continue;
      const order = new Array(n);
      for (let k = 0; k < n; k++) order[k] = k;
      order.sort((x, y) => depAt(a + x) - depAt(a + y));
      const t2 = new Int32Array(n);
      const r2 = new Int32Array(n);
      for (let k = 0; k < n; k++) {
        t2[k] = entryTrip[a + order[k]];
        r2[k] = entryRow[a + order[k]];
      }
      entryTrip.set(t2, a);
      entryRow.set(r2, a);
    }

    this.stopTripStart = start;
    this.stopTripTrip = entryTrip;
    this.stopTripRow = entryRow;
    this.buildMs = Date.now() - t0;
  }

  /** Departure seconds for an entry in the stop→trip index. */
  stopTripDepAt(idx) {
    return this.stDeparture[this.stopTripRow[idx]];
  }

  /**
   * First index in a stop's departure-sorted trip list with dep >= timeSec.
   * Matches a linear scan that skips earlier departures.
   */
  lowerBoundStopTrip(stop, timeSec) {
    let lo = this.stopTripStart[stop];
    let hi = this.stopTripStart[stop + 1];
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.stopTripDepAt(mid) < timeSec) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  /**
   * Precompute foot-transfer neighbors (radius 500 m, limit 6, exclude self).
   * Same selection as RAPTOR's former per-round nearby() calls.
   */
  buildTransferNeighbors() {
    const t0 = Date.now();
    const radiusM = 500;
    const limit = 6;
    const temp = new Array(this.stopCount);
    let total = 0;
    for (let i = 0; i < this.stopCount; i++) {
      const near = this.nearby(this.stopLat[i], this.stopLon[i], radiusM, limit);
      const filtered = [];
      for (let k = 0; k < near.length; k++) {
        if (near[k].stop === i) continue;
        filtered.push(near[k]);
      }
      temp[i] = filtered;
      total += filtered.length;
    }
    const start = new Int32Array(this.stopCount + 1);
    for (let i = 0; i < this.stopCount; i++) start[i + 1] = start[i] + temp[i].length;
    const stops = new Int32Array(total);
    // Float64 so walk(sec) matches live nearby() distances exactly.
    const dist = new Float64Array(total);
    for (let i = 0; i < this.stopCount; i++) {
      let c = start[i];
      const list = temp[i];
      for (let k = 0; k < list.length; k++) {
        stops[c] = list[k].stop;
        dist[c] = list[k].distance;
        c++;
      }
    }
    this.transferStart = start;
    this.transferStop = stops;
    this.transferDist = dist;
    this.transferBuildMs = Date.now() - t0;
  }

  // ------------------------------------------------------------- queries

  get counts() {
    return this.meta.counts;
  }

  stopByGtfsId(id) {
    const i = this.stopIndexByGtfsId.get(id);
    return i === undefined ? null : i;
  }

  stopObject(i) {
    return {
      index: i,
      id: this.stopGtfsId[i],
      name: this.stopName[i],
      nameEn: this.stopNameEn[i] || '',
      code: this.stopCode[i],
      lat: this.stopLat[i],
      lon: this.stopLon[i],
      parent: this.stopParent[i],
    };
  }

  agencyName(agencyId) {
    if (!agencyId) return '';
    if (!this._agencyById) {
      this._agencyById = new Map();
      for (const a of this.meta.agencies || []) {
        if (a?.id != null) this._agencyById.set(String(a.id), a.name || '');
      }
    }
    const id = String(agencyId);
    return this._agencyById.get(id) || (/^\d+$/.test(id) ? '' : id);
  }

  routeObject(i) {
    const shortName = this.routeShortName[i] || '';
    const longName = this.routeLongName[i] || '';
    let type = this.routeType[i];
    const agencyId = this.routeAgency[i] || '';
    const agency = this.agencyName(agencyId) || agencyId;
    let color = this.routeColor[i];
    let typeName = this.meta.routeTypes?.[type] ?? 'bus';
    // Rail and ferry services often have no line number; give them a readable
    // label instead of an empty string so the UI never renders "undefined".
    let displayName = shortName || longName || typeName || 'Transit';

    // Moovit: תבל 1/2/3 → R1/R2/R3 tram (also repairs tram ingested as bus).
    const branded = brandLightRailRoute({
      agencyId,
      agencyName: agency,
      shortName,
      longName,
      type,
      color,
    });
    if (branded) {
      type = branded.type;
      typeName = branded.typeName;
      displayName = branded.displayName;
      color = branded.color;
    } else if (modeFamily(type, typeName) === 'rail') {
      // Israel Railways: short_name empty; train number lives on trip_headsign / route_desc.
      const trip = this.routeFirstTrip?.[i] ?? -1;
      const trainNum = trip >= 0 ? String(this.tripHeadsign[trip] || '').trim() : '';
      displayName = shortName || trainNum || 'Train';
    }

    return {
      index: i,
      id: String(i),
      // Keep GTFS shortName for SIRI / LineRef matching; UI uses displayName.
      shortName,
      displayName,
      longName,
      agency,
      // GTFS agency_id == SIRI OperatorRef; lets live buses match the exact operator's line.
      agencyId,
      color,
      type,
      typeName,
    };
  }

  /** Resolve MOT LineRef / GTFS route_id to the published line number. */
  shortNameForLineRef(lineRef) {
    if (lineRef == null || lineRef === '') return '';
    return this.routeShortNameByGtfsId.get(String(lineRef)) || '';
  }

  /** Line search by short or long name (Hebrew/English digits and text). */
  searchRoutes(query, limit = 40) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const scored = [];
    for (let i = 0; i < this.routeCount; i++) {
      const shortRaw = this.routeShortName[i] || '';
      const longRaw = this.routeLongName[i] || '';
      const shortName = shortRaw.toLowerCase();
      const longName = longRaw.toLowerCase();
      const agencyId = this.routeAgency[i] || '';
      const type = this.routeType[i];
      const branded = brandLightRailRoute({
        agencyId,
        agencyName: this.agencyName(agencyId) || agencyId,
        shortName: shortRaw,
        longName: longRaw,
        type,
        color: this.routeColor[i],
      });
      let displayRaw = branded?.displayName || shortRaw;
      if (!branded && modeFamily(type, this.meta.routeTypes?.[type] ?? '') === 'rail') {
        const trip = this.routeFirstTrip?.[i] ?? -1;
        const trainNum = trip >= 0 ? String(this.tripHeadsign[trip] || '').trim() : '';
        displayRaw = shortRaw || trainNum;
      }
      const displayName = displayRaw.toLowerCase();
      let best = Infinity;
      if (shortName === q || displayName === q) best = 0;
      else if (shortName.startsWith(q) || displayName.startsWith(q)) best = 1;
      else if (shortName.includes(q) || displayName.includes(q)) best = 2;
      else if (longName.startsWith(q)) best = 3;
      else if (longName.includes(q)) best = 4;
      if (best === Infinity) continue;
      scored.push({ i, score: best, len: shortName.length || longName.length });
    }
    scored.sort((a, b) => a.score - b.score || a.len - b.len);
    return scored.slice(0, limit).map((s) => this.routeObject(s.i));
  }

  /** Distinct direction_id branches for a route (first headsign seen per direction). */
  routeDirections(routeIdx) {
    if (routeIdx < 0 || routeIdx >= this.routeCount) return [];
    const byDir = new Map();
    for (let i = 0; i < this.tripCount; i++) {
      if (this.tripRoute[i] !== routeIdx) continue;
      const dir = this.tripDirection[i];
      if (byDir.has(dir)) continue;
      byDir.set(dir, { direction: dir, headsign: this.tripHeadsign[i] || '' });
    }
    return [...byDir.values()].sort((a, b) => a.direction - b.direction);
  }

  /** Pick a representative trip, optionally for a specific GTFS direction_id. */
  tripForRoute(routeIdx, direction) {
    if (routeIdx < 0 || routeIdx >= this.routeCount) return -1;
    if (direction !== undefined && direction !== null && Number.isFinite(Number(direction))) {
      const want = Number(direction);
      for (let i = 0; i < this.tripCount; i++) {
        if (this.tripRoute[i] === routeIdx && this.tripDirection[i] === want) return i;
      }
    }
    return this.routeFirstTrip[routeIdx];
  }

  /** Stops + polyline for a representative trip of this line. */
  routeDetail(routeIdx, direction) {
    if (routeIdx < 0 || routeIdx >= this.routeCount) return null;
    const trip = this.tripForRoute(routeIdx, direction);
    const directions = this.routeDirections(routeIdx);
    if (trip < 0) {
      return {
        line: this.routeObject(routeIdx),
        stops: [],
        geometry: [],
        headsign: '',
        direction: 0,
        directions,
      };
    }
    const start = this.tripStopStart[trip];
    const end = this.tripStopStart[trip + 1];
    const stops = [];
    for (let r = start; r < end; r++) {
      stops.push(this.stopObject(this.stStopIdx[r]));
    }
    const shapeIdx = this.tripShape[trip];
    const geometry = shapeIdx >= 0 ? this.tripPolyline(shapeIdx) : stops.map((s) => [s.lat, s.lon]);
    return {
      line: this.routeObject(routeIdx),
      stops,
      geometry,
      headsign: this.tripHeadsign[trip] || '',
      direction: this.tripDirection[trip],
      directions,
    };
  }

  /** Nearby stops via the spatial grid, nearest first. */
  nearby(lat, lon, radiusM = 500, limit = 20) {
    const scale = this.gridScale;
    const cells = Math.ceil(radiusM / (scale * 111_320));
    const cy0 = Math.floor(lat / scale);
    const cx0 = Math.floor(lon / scale);
    const out = [];
    const r2 = radiusM * radiusM;
    for (let dy = -cells; dy <= cells; dy++) {
      for (let dx = -cells; dx <= cells; dx++) {
        const cell = this.grid.get((cy0 + dy) * 100000 + (cx0 + dx));
        if (cell === undefined) continue;
        for (let k = 0; k < cell.length; k++) {
          const i = cell[k];
          const dLat = (this.stopLat[i] - lat) * 111320;
          const dLon = (this.stopLon[i] - lon) * 111320 * Math.cos((lat * Math.PI) / 180);
          const d2 = dLat * dLat + dLon * dLon;
          if (d2 <= r2) out.push({ stop: i, distance: Math.sqrt(d2) });
        }
      }
    }
    out.sort((a, b) => a.distance - b.distance);
    return limit < out.length ? out.slice(0, limit) : out;
  }

  searchStops(query, limit = 20, bias = null) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const scored = [];
    for (let i = 0; i < this.stopCount; i++) {
      // Match the local name and the English translation so either language works.
      const name = this.stopName[i];
      const en = this.stopNameEn[i];
      const lowerName = name ? name.toLowerCase() : '';
      const lowerEn = en ? en.toLowerCase() : '';
      let best = Infinity;
      // Tier 0: exact name. Tier 1: prefix. Tier 2: substring anywhere.
      if (lowerName === q || lowerEn === q) best = 0;
      else if (lowerName.startsWith(q) || lowerEn.startsWith(q)) best = 1;
      else if (lowerName.includes(q) || lowerEn.includes(q)) best = 2;
      if (best === Infinity) continue;
      // Distance from the map centre keeps same-named stops in other cities
      // from crowding out the one the user actually means.
      const dist = bias
        ? haversine(bias.lat, bias.lon, this.stopLat[i], this.stopLon[i])
        : 0;
      scored.push({ i, score: best, len: (name || en).length, dist });
    }
    // Exact and prefix hits always rank above substring hits; within a tier the
    // closest stop wins, which is what "Central Station" should mean near you.
    scored.sort((a, b) => a.score - b.score || a.dist - b.dist || a.len - b.len);
    return scored.slice(0, limit).map((s) => this.stopObject(s.i));
  }

  /** Absolute epoch-seconds for a service index on a given YYYYMMDD. */
  serviceActive(svcIdx, dateInt, dow) {
    const s = this.services[svcIdx];
    if (!s) return false;
    if (dateInt < Number(s.start) || dateInt > Number(s.end)) return false;
    // GTFS calendar columns are Sunday..Saturday, bit 0..6; JS getDay() is also Sun=0.
    return (s.daysMask & (1 << dow)) !== 0;
  }

  tripPolyline(shapeIdx) {
    if (shapeIdx < 0 || shapeIdx >= this.shapeCount) return [];
    const o = shapeIdx * 12;
    const offset = this.shapeMeta.getInt32(o, true);
    const count = this.shapeMeta.getInt32(o + 4, true);
    if (count <= 0) return [];
    // Prefer in-memory points when a host loaded the full buffer; else read
    // just this shape's range from the open shapes.bin fd.
    if (this.shapePoints) {
      const out = new Array(count);
      for (let k = 0; k < count; k++) {
        out[k] = [this.shapePoints[(offset + k) * 2], this.shapePoints[(offset + k) * 2 + 1]];
      }
      return out;
    }
    const bytes = count * 8;
    const buf = Buffer.allocUnsafe(bytes);
    fs.readSync(this._shapesFd, buf, 0, bytes, this._shapesPtsFileOff + offset * 8);
    const view = new Float32Array(buf.buffer, buf.byteOffset, count * 2);
    const out = new Array(count);
    for (let k = 0; k < count; k++) {
      out[k] = [view[k * 2], view[k * 2 + 1]];
    }
    return out;
  }
}

export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

let singleton = null;
export function getStore() {
  if (singleton) return singleton;
  // Resolution order: explicit env var, then the in-repo build output, then the
  // out-of-tree work directory used during development. The first one that
  // exists wins so the server just works after a fresh ingest.
  const candidates = [
    process.env.GTFS_DATA_DIR,
    path.resolve(process.cwd(), '../data/gtfs-dist'),
    path.resolve(process.cwd(), 'data/gtfs-dist'),
    'C:/Users/ofir/betterMoveIt-work/gtfs/dist',
    // Last resort: the tiny synthetic feed from `npm run data:sample`.
    path.resolve(process.cwd(), '../data/gtfs-sample'),
    path.resolve(process.cwd(), 'data/gtfs-sample'),
  ].filter(Boolean);

  const dir = candidates.find((d) => {
    try {
      return fs.existsSync(path.join(d, 'meta.json'));
    } catch {
      return false;
    }
  });
  if (!dir) {
    throw new Error(
      `No transit data found. Looked in:\n  ${candidates.join('\n  ')}\n\n` +
        'Quick start with synthetic data:  npm run data:sample\n' +
        'Real data:  npm run data  (bundled LFS archive or MOT download)\n\n' +
        'Or run the ingest step yourself:\n' +
        '  npm run ingest -- <gtfs-raw-dir> <output-dir>\n' +
        'then set GTFS_DATA_DIR to that output directory.'
    );
  }
  if (/gtfs-sample$/.test(dir.replace(/[\\/]+$/, ''))) {
    console.warn(
      `[transit] using SAMPLE data from ${dir} (synthetic, Tel Aviv only). ` +
        'Run `npm run data` for the real national feed.'
    );
  }
  singleton = new TransitStore(dir);
  return singleton;
}
