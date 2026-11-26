/**
 * GTFS -> compact binary store.
 *
 * The national feed carries ~9.9M stop_times and ~7M shape points. Loading that
 * as JSON into a browser, or re-parsing the CSV per request, is hopeless. So we
 * do the expensive work once and emit small, directly indexable files:
 *
 *   meta.json          feed summary (agencies, feed date, counts)
 *   stops.bin          stop records + spatial grid index
 *   routes.bin         route records + a route string table
 *   trips.bin          trip records
 *   stop_times.bin     per-trip columnar timetables (prefix-summed offsets)
 *   shapes.bin         per-trip polylines (typed-array encoded)
 *   services.json      service_id -> active weekday bitmask + date range
 *
 * Everything is little-endian and fixed-width so the server can read it with
 * Buffer reads instead of JSON.parse.
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const RAW_DIR = process.argv[2];
const OUT_DIR = process.argv[3];

if (!RAW_DIR || !OUT_DIR) {
  console.error('usage: node ingest.mjs <gtfs-raw-dir> <out-dir>');
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

/** Minimal RFC4180 CSV reader that streams rows without building the whole file. */
function readCsv(file, onRow) {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(file, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    let header = null;
    let pending = '';
    let inQuotes = false;
    let lineNo = 0;

    const emit = (line) => {
      const cells = splitCsvLine(line + pending);
      pending = '';
      if (!header) {
        header = cells;
        return;
      }
      if (cells.length === 1 && cells[0] === '') return;
      const row = {};
      for (let i = 0; i < header.length; i++) row[header[i]] = cells[i] ?? '';
      onRow(row);
    };

    // BOM strip + header
    let first = true;
    rl.on('line', (line) => {
      lineNo++;
      if (first) {
        line = line.replace(/^\uFEFF/, '');
        first = false;
      }
      // Track quote parity so multi-line quoted fields survive.
      const quotes = (line.match(/"/g) || []).length;
      if (inQuotes) {
        pending += '\n' + line;
      } else {
        pending = line;
      }
      if (quotes % 2 === 1) {
        inQuotes = !inQuotes;
        return;
      }
      inQuotes = false;
      emit(pending);
    });
    rl.on('close', () => resolve({ header, lineNo }));
    rl.on('error', reject);
    stream.on('error', reject);
  });
}

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

// ---------------------------------------------------------------- agencies & routes

const agencies = new Map();
const routes = [];
const routeIndexByGtfsId = new Map();

log('reading agency.txt');
await readCsv(path.join(RAW_DIR, 'agency.txt'), (r) => {
  agencies.set(r.agency_id, { id: r.agency_id, name: r.agency_name, url: r.agency_url, tz: r.agency_timezone });
});

const ROUTE_TYPE_NAMES = {
  0: 'tram', 1: 'subway', 2: 'rail', 3: 'bus', 4: 'ferry', 5: 'cable', 6: 'gondola', 7: 'funicular',
  11: 'trolleybus', 12: 'monorail',
};

log('reading routes.txt');
await readCsv(path.join(RAW_DIR, 'routes.txt'), (r) => {
  const idx = routes.length;
  routes.push({
    id: r.route_id,
    agencyId: r.agency_id,
    shortName: r.route_short_name || '',
    longName: r.route_long_name || '',
    // GTFS tram is route_type 0 — must not use `|| 3` (0 is falsy → bus).
    type: (() => {
      const n = Number(r.route_type);
      return Number.isFinite(n) ? n : 3;
    })(),
    color: r.route_color ? `#${r.route_color.replace(/^#/, '')}` : null,
  });
  routeIndexByGtfsId.set(r.route_id, idx);
});

// ---------------------------------------------------------------- services

const services = new Map();
log('reading calendar.txt');
await readCsv(path.join(RAW_DIR, 'calendar.txt'), (r) => {
  // Bit 0..6 = Sunday..Saturday, matching GTFS calendar column order.
  let mask = 0;
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  days.forEach((d, i) => {
    if (r[d] === '1') mask |= 1 << i;
  });
  services.set(r.service_id, {
    id: r.service_id,
    daysMask: mask,
    start: r.start_date,
    end: r.end_date,
  });
});

// ---------------------------------------------------------------- stops

// The feed ships Hebrew names only; translations.txt carries the English ones.
// Loading them here means the app is searchable in either language.
const englishNames = new Map();
log('reading translations.txt (English stop names)');
await readCsv(path.join(RAW_DIR, 'translations.txt'), (r) => {
  if ((r.lang || '').toUpperCase() !== 'EN') return;
  englishNames.set(r.trans_id, r.translation);
});
log(`english names: ${englishNames.size}`);

const stops = [];
const stopIndexByGtfsId = new Map();
log('reading stops.txt');
await readCsv(path.join(RAW_DIR, 'stops.txt'), (r) => {
  const lat = Number(r.stop_lat);
  const lon = Number(r.stop_lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
  const idx = stops.length;
  stops.push({
    id: r.stop_id,
    code: r.stop_code || '',
    name: r.stop_name || '',
    nameEn: englishNames.get(r.stop_name) || '',
    lat,
    lon,
    parent: r.parent_station || '',
    locationType: Number(r.location_type) || 0,
  });
  stopIndexByGtfsId.set(r.stop_id, idx);
});
log(`stops: ${stops.length}`);

// ---------------------------------------------------------------- shapes

// Collect point lists per shape_id. 7M points, so store flat.
const shapePoints = new Map(); // shape_id -> number[] (lat, lon interleaved)
log('reading shapes.txt');
await readCsv(path.join(RAW_DIR, 'shapes.txt'), (r) => {
  let arr = shapePoints.get(r.shape_id);
  if (!arr) {
    arr = [];
    shapePoints.set(r.shape_id, arr);
  }
  arr.push(Number(r.shape_pt_lat), Number(r.shape_pt_lon));
});
log(`shapes: ${shapePoints.size}`);

// Encode every shape once into a Float32 slab; trips reference a span.
const shapeMeta = [];
const shapeBlobChunks = [];
let shapePointCursor = 0;
for (const [shapeId, pts] of shapePoints) {
  const n = pts.length / 2;
  const f32 = new Float32Array(pts);
  shapeBlobChunks.push(Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength));
  shapeMeta.push({ id: shapeId, offset: shapePointCursor, count: n });
  shapePointCursor += n;
}
const shapeIndexById = new Map(shapeMeta.map((m, i) => [m.id, i]));
log(`shape points: ${shapePointCursor}`);

// ---------------------------------------------------------------- trips

const trips = [];
const tripIndexByGtfsId = new Map();
log('reading trips.txt');
await readCsv(path.join(RAW_DIR, 'trips.txt'), (r) => {
  const routeIdx = routeIndexByGtfsId.get(r.route_id);
  if (routeIdx === undefined) return;
  const idx = trips.length;
  trips.push({
    id: r.trip_id,
    routeIdx,
    serviceId: r.service_id,
    headsign: r.trip_headsign || '',
    direction: Number(r.direction_id) || 0,
    shapeIdx: r.shape_id && shapeIndexById.has(r.shape_id) ? shapeIndexById.get(r.shape_id) : -1,
  });
  tripIndexByGtfsId.set(r.trip_id, idx);
});
log(`trips: ${trips.length}`);

// ---------------------------------------------------------------- stop_times

// Columnar, pre-sorted by trip then stop_sequence. We keep:
//   tripStopStart[i] .. tripStopStart[i+1]   range of stops for trip i
//   stopIdx[]   stop index per row (Int32)
//   arrival[]   seconds since noon-12h (Int32) - GTFS allows >24:00
//   departure[] same
//   stopSeq[]   stop_sequence (Uint16)
//   shapeDist[] shape_dist_traveled in meters (Float32), -1 when absent
//
// Rows arrive grouped by trip in practice, but we cannot assume it. We do a
// streaming bucket build: accumulate offsets per trip, then fill.
log('reading stop_times.txt (this is the big one)');

const tripStopCount = new Int32Array(trips.length);
const buckets = new Array(trips.length);
let skipped = 0;
let rowCount = 0;

function gtfsTimeToSeconds(t) {
  if (!t) return -1;
  const parts = t.split(':');
  if (parts.length < 3) return -1;
  return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
}

await readCsv(path.join(RAW_DIR, 'stop_times.txt'), (r) => {
  rowCount++;
  if (rowCount % 2_000_000 === 0) log(`  stop_times rows: ${rowCount.toLocaleString()}`);
  const tripIdx = tripIndexByGtfsId.get(r.trip_id);
  if (tripIdx === undefined) return;
  const stopIdx = stopIndexByGtfsId.get(r.stop_id);
  if (stopIdx === undefined) return;
  const arrS = gtfsTimeToSeconds(r.arrival_time);
  const depS = gtfsTimeToSeconds(r.departure_time);
  if (arrS < 0 && depS < 0) return;

  let b = buckets[tripIdx];
  if (!b) {
    b = [];
    buckets[tripIdx] = b;
  }
  b.push({
    stopIdx,
    seq: Number(r.stop_sequence) || b.length + 1,
    arr: arrS >= 0 ? arrS : depS,
    dep: depS >= 0 ? depS : arrS,
    dist: r.shape_dist_traveled ? Number(r.shape_dist_traveled) : -1,
  });
  tripStopCount[tripIdx]++;
});

log(`stop_times parsed: ${rowCount.toLocaleString()} rows`);

// Sort each trip's stops by sequence, then lay out the columnar arrays.
let totalRows = 0;
for (let i = 0; i < trips.length; i++) totalRows += tripStopCount[i];
log(`total kept rows: ${totalRows.toLocaleString()}`);

const tripStopStart = new Int32Array(trips.length + 1);
const stopIdxArr = new Int32Array(totalRows);
const arrivalArr = new Int32Array(totalRows);
const departureArr = new Int32Array(totalRows);
const seqArr = new Uint16Array(totalRows);
const distArr = new Float32Array(totalRows);

let cursor = 0;
for (let i = 0; i < trips.length; i++) {
  tripStopStart[i] = cursor;
  const b = buckets[i];
  if (b && b.length) {
    b.sort((x, y) => x.seq - y.seq);
    for (const e of b) {
      stopIdxArr[cursor] = e.stopIdx;
      arrivalArr[cursor] = e.arr;
      departureArr[cursor] = e.dep;
      seqArr[cursor] = Math.min(e.seq, 65535);
      distArr[cursor] = e.dist;
      cursor++;
    }
    buckets[i] = null;
  }
}
tripStopStart[trips.length] = cursor;

// ---------------------------------------------------------------- write

log('writing stops.bin');
{
  // Build a uniform spatial grid over the stop set for fast nearby lookups.
  const GRID = 0.01; // ~1.1km cells
  const cellMap = new Map();
  const cellFor = (lat, lon) => `${Math.floor(lat / GRID)}:${Math.floor(lon / GRID)}`;
  stops.forEach((s, i) => {
    const k = cellFor(s.lat, s.lon);
    let a = cellMap.get(k);
    if (!a) {
      a = [];
      cellMap.set(k, a);
    }
    a.push(i);
  });

  const cells = [...cellMap.entries()].map(([key, ids]) => {
    const [cy, cx] = key.split(':').map(Number);
    return { cy, cx, ids };
  });

  // strings
  const strings = [];
  const strIdx = new Map();
  const sid = (s) => {
    if (!s) return -1;
    let i = strIdx.get(s);
    if (i === undefined) {
      i = strings.length;
      strings.push(s);
      strIdx.set(s, i);
    }
    return i;
  };
  for (const s of stops) {
    s.nameIdx = sid(s.name);
    s.nameEnIdx = sid(s.nameEn);
    s.codeIdx = sid(s.code);
    s.idIdx = sid(s.id);
    s.parentIdx = sid(s.parent);
  }

  const strBlob = Buffer.from(JSON.stringify(strings), 'utf8');

  const headerBuf = Buffer.alloc(4 * 8);
  headerBuf.writeUInt32LE(GRID * 1e6, 0);
  headerBuf.writeUInt32LE(stops.length, 4);
  headerBuf.writeUInt32LE(cells.length, 8);
  headerBuf.writeUInt32LE(strBlob.length, 12);

  // 28-byte records: 5 int32 string refs + lat/lon float32
  const rec = Buffer.alloc(stops.length * 28);
  stops.forEach((s, i) => {
    const o = i * 28;
    rec.writeInt32LE(s.idIdx, o);
    rec.writeInt32LE(s.nameIdx, o + 4);
    rec.writeInt32LE(s.codeIdx, o + 8);
    rec.writeInt32LE(s.parentIdx, o + 12);
    rec.writeFloatLE(s.lat, o + 16);
    rec.writeFloatLE(s.lon, o + 20);
    rec.writeInt32LE(s.nameEnIdx, o + 24);
  });

  // grid cells: cy, cx, count, then Int32 stop indices
  const cellBufs = [];
  let cellBytes = 0;
  for (const c of cells) {
    const b = Buffer.alloc(12 + c.ids.length * 4);
    b.writeInt32LE(c.cy, 0);
    b.writeInt32LE(c.cx, 4);
    b.writeInt32LE(c.ids.length, 8);
    c.ids.forEach((v, k) => b.writeInt32LE(v, 12 + k * 4));
    cellBufs.push(b);
    cellBytes += b.length;
  }
  headerBuf.writeUInt32LE(cellBytes, 16);

  fs.writeFileSync(path.join(OUT_DIR, 'stops.bin'), Buffer.concat([headerBuf, rec, strBlob, ...cellBufs]));
  // Save the string table for reuse by routes/trips.
  fs.writeFileSync(path.join(OUT_DIR, 'stops.strings.json'), strBlob);
}

log('writing routes.bin / trips.bin');
{
  const strings = [];
  const strIdx = new Map();
  const sid = (s) => {
    if (!s) return -1;
    let i = strIdx.get(s);
    if (i === undefined) {
      i = strings.length;
      strings.push(s);
      strIdx.set(s, i);
    }
    return i;
  };
  for (const r of routes) {
    r.shortIdx = sid(r.shortName);
    r.longIdx = sid(r.longName);
    r.agencyIdx = sid(r.agencyId);
    r.colorIdx = sid(r.color || '');
  }
  const strBlob = Buffer.from(JSON.stringify(strings), 'utf8');

  // 16 bytes: shortIdx, longIdx, agencyIdx, colorIdx ; 4: type ; 4: pad
  const rec = Buffer.alloc(routes.length * 20);
  routes.forEach((r, i) => {
    const o = i * 20;
    rec.writeInt32LE(r.shortIdx, o);
    rec.writeInt32LE(r.longIdx, o + 4);
    rec.writeInt32LE(r.agencyIdx, o + 8);
    rec.writeInt32LE(r.colorIdx, o + 12);
    rec.writeInt32LE(r.type, o + 16);
  });
  const head = Buffer.alloc(8);
  head.writeUInt32LE(routes.length, 0);
  head.writeUInt32LE(strBlob.length, 4);
  fs.writeFileSync(path.join(OUT_DIR, 'routes.bin'), Buffer.concat([head, rec, strBlob]));

  // SIRI LineRef == GTFS route_id — map to published short names for live bus labels.
  const routeIdMap = Object.fromEntries(routes.map((r) => [String(r.id), r.shortName || '']));
  fs.writeFileSync(path.join(OUT_DIR, 'route_ids.json'), JSON.stringify(routeIdMap));

  // trips: routeIdx(int32), serviceIdx(int32), shapeIdx(int32), headsignIdx(int32), direction(int8)
  const svcList = [...services.keys()];
  const svcIdx = new Map(svcList.map((s, i) => [s, i]));
  const tripStrings = [];
  const tripStrIdx = new Map();
  const tsid = (s) => {
    if (!s) return -1;
    let i = tripStrIdx.get(s);
    if (i === undefined) {
      i = tripStrings.length;
      tripStrings.push(s);
      tripStrIdx.set(s, i);
    }
    return i;
  };
  for (const t of trips) t.headsignIdx = tsid(t.headsign);
  const tripStrBlob = Buffer.from(JSON.stringify(tripStrings), 'utf8');

  const trec = Buffer.alloc(trips.length * 18);
  trips.forEach((t, i) => {
    const o = i * 18;
    trec.writeInt32LE(t.routeIdx, o);
    trec.writeInt32LE(svcIdx.get(t.serviceId) ?? 0, o + 4);
    trec.writeInt32LE(t.shapeIdx, o + 8);
    trec.writeInt32LE(t.headsignIdx, o + 12);
    trec.writeInt8(t.direction, o + 16);
    trec.writeInt8(0, o + 17);
  });
  const thead = Buffer.alloc(8);
  thead.writeUInt32LE(trips.length, 0);
  thead.writeUInt32LE(tripStrBlob.length, 4);
  fs.writeFileSync(path.join(OUT_DIR, 'trips.bin'), Buffer.concat([thead, trec, tripStrBlob]));

  // Service table: id string, daysMask, start, end
  fs.writeFileSync(
    path.join(OUT_DIR, 'services.json'),
    JSON.stringify({
      order: svcList,
      entries: svcList.map((s) => services.get(s) || { id: s, daysMask: 0, start: '20200101', end: '20200101' }),
    })
  );
}

log('writing stop_times.bin');
{
  const head = Buffer.alloc(16);
  head.writeUInt32LE(trips.length, 0);
  head.writeUInt32LE(totalRows, 4);
  const parts = [
    head,
    Buffer.from(tripStopStart.buffer, tripStopStart.byteOffset, tripStopStart.byteLength),
    Buffer.from(stopIdxArr.buffer, stopIdxArr.byteOffset, stopIdxArr.byteLength),
    Buffer.from(arrivalArr.buffer, arrivalArr.byteOffset, arrivalArr.byteLength),
    Buffer.from(departureArr.buffer, departureArr.byteOffset, departureArr.byteLength),
    Buffer.from(seqArr.buffer, seqArr.byteOffset, seqArr.byteLength),
    Buffer.from(distArr.buffer, distArr.byteOffset, distArr.byteLength),
  ];
  fs.writeFileSync(path.join(OUT_DIR, 'stop_times.bin'), Buffer.concat(parts));
}

log('writing shapes.bin');
{
  const head = Buffer.alloc(8);
  head.writeUInt32LE(shapeMeta.length, 0);
  head.writeUInt32LE(shapePointCursor, 4);
  const meta = Buffer.alloc(shapeMeta.length * 12);
  shapeMeta.forEach((m, i) => {
    const o = i * 12;
    meta.writeInt32LE(m.offset, o);
    meta.writeInt32LE(m.count, o + 4);
    meta.writeInt32LE(0, o + 8);
  });
  fs.writeFileSync(path.join(OUT_DIR, 'shapes.bin'), Buffer.concat([head, meta, ...shapeBlobChunks]));
}

const feedInfo = {
  generatedAt: new Date().toISOString(),
  agencies: [...agencies.values()],
  counts: {
    stops: stops.length,
    routes: routes.length,
    trips: trips.length,
    stopTimes: totalRows,
    shapes: shapeMeta.length,
    shapePoints: shapePointCursor,
    services: services.size,
  },
  routeTypes: ROUTE_TYPE_NAMES,
  bbox: (() => {
    let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
    for (const s of stops) {
      if (s.lat < minLat) minLat = s.lat;
      if (s.lat > maxLat) maxLat = s.lat;
      if (s.lon < minLon) minLon = s.lon;
      if (s.lon > maxLon) maxLon = s.lon;
    }
    return { minLat, maxLat, minLon, maxLon };
  })(),
};
fs.writeFileSync(path.join(OUT_DIR, 'meta.json'), JSON.stringify(feedInfo, null, 2));

log('done');
console.log(JSON.stringify(feedInfo.counts, null, 2));
