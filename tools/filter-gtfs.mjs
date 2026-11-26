/**
 * Filter a raw GTFS folder to stops inside a bbox (and trips that serve them).
 * Streams large files so peak memory stays reasonable.
 *
 * Usage: node tools/filter-gtfs.mjs <raw-dir> <out-dir> [minLat minLon maxLat maxLon]
 * Default bbox: central Tel Aviv — sized for Render free (512MB RAM).
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const RAW = process.argv[2];
const OUT = process.argv[3];
const minLat = Number(process.argv[4] ?? 32.04);
const minLon = Number(process.argv[5] ?? 34.75);
const maxLat = Number(process.argv[6] ?? 32.12);
const maxLon = Number(process.argv[7] ?? 34.85);

if (!RAW || !OUT) {
  console.error(
    'usage: node filter-gtfs.mjs <raw-dir> <out-dir> [minLat minLon maxLat maxLon]'
  );
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });

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

async function forEachCsv(file, onHeader, onRow) {
  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(file, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    let header = null;
    let pending = '';
    let inQuotes = false;
    let first = true;
    const emit = (line) => {
      const cells = splitCsvLine(line);
      if (!header) {
        header = cells;
        onHeader?.(header);
        return;
      }
      if (cells.length === 1 && cells[0] === '') return;
      const row = {};
      for (let i = 0; i < header.length; i++) row[header[i]] = cells[i] ?? '';
      onRow(row, header, line);
    };
    rl.on('line', (line) => {
      if (first) {
        line = line.replace(/^\uFEFF/, '');
        first = false;
      }
      const quotes = (line.match(/"/g) || []).length;
      if (inQuotes) pending += '\n' + line;
      else pending = line;
      if (quotes % 2 === 1) {
        inQuotes = !inQuotes;
        return;
      }
      inQuotes = false;
      emit(pending);
    });
    rl.on('close', resolve);
    rl.on('error', reject);
    stream.on('error', reject);
  });
}

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(file, header, rows) {
  const fh = fs.createWriteStream(file);
  fh.write(header.join(',') + '\n');
  for (const row of rows) {
    fh.write(header.map((h) => csvEscape(row[h])).join(',') + '\n');
  }
  fh.end();
  return new Promise((resolve, reject) => {
    fh.on('finish', resolve);
    fh.on('error', reject);
  });
}

const t0 = Date.now();
const log = (...a) => console.log(`[filter ${(Date.now() - t0) / 1000 | 0}s]`, ...a);

const keepStops = new Set();
const stopById = new Map();
let stopHeader = null;
log(`bbox ${minLat},${minLon} → ${maxLat},${maxLon}`);
log('filtering stops…');
await forEachCsv(
  path.join(RAW, 'stops.txt'),
  (h) => {
    stopHeader = h;
  },
  (r) => {
    const lat = Number(r.stop_lat);
    const lon = Number(r.stop_lon);
    if (lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon) {
      keepStops.add(r.stop_id);
      stopById.set(r.stop_id, r);
    } else {
      stopById.set(r.stop_id, r); // may need as parent later
    }
  }
);
log(`stops in bbox: ${keepStops.size}`);

// Only keep stop_times whose stop is inside the bbox. That clips long
 // intercity trips to their local segment so the free-tier image stays small.
const tripStopCounts = new Map();
log('pass 1 stop_times → local trip segments…');
await forEachCsv(path.join(RAW, 'stop_times.txt'), null, (r) => {
  if (!keepStops.has(r.stop_id)) return;
  tripStopCounts.set(r.trip_id, (tripStopCounts.get(r.trip_id) || 0) + 1);
});
const keepTrips = new Set(
  [...tripStopCounts.entries()].filter(([, n]) => n >= 2).map(([id]) => id)
);
log(`trips with ≥2 local stops: ${keepTrips.size}`);

const tripRows = [];
let tripHeader = null;
const keepRoutes = new Set();
const keepServices = new Set();
const shapeIds = new Set();
log('filtering trips…');
await forEachCsv(
  path.join(RAW, 'trips.txt'),
  (h) => {
    tripHeader = h;
  },
  (r) => {
    if (!keepTrips.has(r.trip_id)) return;
    tripRows.push(r);
    keepRoutes.add(r.route_id);
    keepServices.add(r.service_id);
    if (r.shape_id) shapeIds.add(r.shape_id);
  }
);
log(`kept trips=${tripRows.length} routes=${keepRoutes.size}`);

const usedStops = new Set();
let stopTimeHeader = null;
let stopTimeCount = 0;
log('pass 2 stop_times → write local stops only…');
{
  const out = fs.createWriteStream(path.join(OUT, 'stop_times.txt'));
  await forEachCsv(
    path.join(RAW, 'stop_times.txt'),
    (h) => {
      stopTimeHeader = h;
      out.write(h.join(',') + '\n');
    },
    (r, _h, line) => {
      if (!keepTrips.has(r.trip_id) || !keepStops.has(r.stop_id)) return;
      out.write(line + '\n');
      usedStops.add(r.stop_id);
      stopTimeCount++;
    }
  );
  await new Promise((resolve, reject) => {
    out.end();
    out.on('finish', resolve);
    out.on('error', reject);
  });
}
log(`kept stop_times=${stopTimeCount}`);

const finalStops = [];
for (const id of usedStops) {
  const r = stopById.get(id);
  if (r) finalStops.push(r);
}
for (const r of [...finalStops]) {
  if (r.parent_station && stopById.has(r.parent_station) && !usedStops.has(r.parent_station)) {
    finalStops.push(stopById.get(r.parent_station));
    usedStops.add(r.parent_station);
  }
}

const routeRows = [];
let routeHeader = null;
await forEachCsv(
  path.join(RAW, 'routes.txt'),
  (h) => {
    routeHeader = h;
  },
  (r) => {
    if (keepRoutes.has(r.route_id)) routeRows.push(r);
  }
);

const agencyIds = new Set(routeRows.map((r) => r.agency_id).filter(Boolean));
const agencyRows = [];
let agencyHeader = null;
if (fs.existsSync(path.join(RAW, 'agency.txt'))) {
  await forEachCsv(
    path.join(RAW, 'agency.txt'),
    (h) => {
      agencyHeader = h;
    },
    (r) => {
      if (!agencyIds.size || agencyIds.has(r.agency_id)) agencyRows.push(r);
    }
  );
}

const calRows = [];
let calHeader = null;
if (fs.existsSync(path.join(RAW, 'calendar.txt'))) {
  await forEachCsv(
    path.join(RAW, 'calendar.txt'),
    (h) => {
      calHeader = h;
    },
    (r) => {
      if (keepServices.has(r.service_id)) calRows.push(r);
    }
  );
}

const calDateRows = [];
let calDateHeader = null;
if (fs.existsSync(path.join(RAW, 'calendar_dates.txt'))) {
  await forEachCsv(
    path.join(RAW, 'calendar_dates.txt'),
    (h) => {
      calDateHeader = h;
    },
    (r) => {
      if (keepServices.has(r.service_id)) calDateRows.push(r);
    }
  );
}

let shapeCount = 0;
if (fs.existsSync(path.join(RAW, 'shapes.txt')) && shapeIds.size) {
  log('filtering shapes…');
  const out = fs.createWriteStream(path.join(OUT, 'shapes.txt'));
  await forEachCsv(
    path.join(RAW, 'shapes.txt'),
    (h) => {
      out.write(h.join(',') + '\n');
    },
    (_r, _h, line) => {
      // cheap prefix check: shape_id is first column
      const comma = line.indexOf(',');
      const sid = comma === -1 ? line : line.slice(0, comma);
      if (!shapeIds.has(sid)) return;
      out.write(line + '\n');
      shapeCount++;
    }
  );
  await new Promise((resolve, reject) => {
    out.end();
    out.on('finish', resolve);
    out.on('error', reject);
  });
  log(`kept shape points=${shapeCount}`);
}

await writeCsv(path.join(OUT, 'stops.txt'), stopHeader, finalStops);
await writeCsv(path.join(OUT, 'trips.txt'), tripHeader, tripRows);
await writeCsv(path.join(OUT, 'routes.txt'), routeHeader, routeRows);
if (agencyHeader) await writeCsv(path.join(OUT, 'agency.txt'), agencyHeader, agencyRows);
if (calHeader) await writeCsv(path.join(OUT, 'calendar.txt'), calHeader, calRows);
if (calDateHeader) {
  await writeCsv(path.join(OUT, 'calendar_dates.txt'), calDateHeader, calDateRows);
}

for (const extra of ['feed_info.txt', 'translations.txt']) {
  const src = path.join(RAW, extra);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(OUT, extra));
}

log(
  `done → ${OUT} (stops=${finalStops.length}, trips=${tripRows.length}, stop_times=${stopTimeCount})`
);
