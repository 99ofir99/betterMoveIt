/**
 * Build a tiny synthetic GTFS feed and ingest it into data/gtfs-sample.
 *
 * Why: the real store (deploy/gtfs-dist.tgz, Git LFS, 64 MB) or a fresh ingest
 * of the national feed (~139 MB zip, ~8 GB RAM) is slow to get. This sample
 * boots the server in well under a second, so you can develop and debug the
 * API and UI immediately. Routes and times are fake; geography is central
 * Tel Aviv so the map, nearby, search and planner all have something to show.
 *
 * Network (both directions, every day, 05:00–25:00):
 *   bus 1     east–west along Arlozorov-ish latitude, every 10 min
 *   bus 5     north–south, crosses bus 1 (transfer point), every 12 min
 *   tram R1   light rail diagonal (Tevel agency id 22), every 6 min
 *   rail      Haifa – Tel Aviv Savidor – Airport – Jerusalem, every 30 min
 *
 * Usage: node tools/sample-data.mjs [--force]
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rawDir = path.join(root, 'data', 'gtfs-sample-raw');
const outDir = path.join(root, 'data', 'gtfs-sample');
const force = process.argv.includes('--force');

if (!force && fs.existsSync(path.join(outDir, 'meta.json'))) {
  console.log(`[sample-data] ${path.relative(root, outDir)} already present (use --force to rebuild)`);
  process.exit(0);
}

const lerp = (a, b, t) => a + (b - a) * t;
const pad = (n) => String(n).padStart(2, '0');
const hms = (s) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
const csv = (rows) =>
  rows
    .map((r) => r.map((c) => (/[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c)).join(','))
    .join('\n') + '\n';

/** Evenly spaced stops on a straight segment. */
function line(prefix, from, to, n, names) {
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefix}${i + 1}`,
    code: `${prefix.charCodeAt(0)}${pad(i + 1)}`,
    he: names[i][0],
    en: names[i][1],
    lat: +lerp(from[0], to[0], i / (n - 1)).toFixed(6),
    lon: +lerp(from[1], to[1], i / (n - 1)).toFixed(6),
  }));
}

const bus1Stops = line('E', [32.0870, 34.7700], [32.0870, 34.8300], 8, [
  ['חוף הים', 'Beach'], ['בן יהודה', 'Ben Yehuda'], ['דיזנגוף', 'Dizengoff'], ['אבן גבירול', 'Ibn Gabirol'],
  ['נמיר', 'Namir'], ['סבידור מרכז', 'Savidor Center'], ['רמת גן', 'Ramat Gan'], ['בורסה', 'Bursa'],
]);
const bus5Stops = line('N', [32.0500, 34.7800], [32.1150, 34.7800], 8, [
  ['יפו', 'Jaffa'], ['פלורנטין', 'Florentin'], ['רוטשילד', 'Rothschild'], ['כיכר רבין', 'Rabin Square'],
  ['ארלוזורוב', 'Arlozorov'], ['נמל תל אביב', 'Tel Aviv Port'], ['רמת אביב', 'Ramat Aviv'], ['אוניברסיטה', 'University'],
]);
const tramStops = line('T', [32.0450, 34.7600], [32.1000, 34.8400], 6, [
  ['בת ים', 'Bat Yam'], ['אליפלט', 'Elifelet'], ['קרליבך', 'Carlebach'], ['ארלוזורוב רכבת קלה', 'Arlozorov LRT'],
  ['בני ברק', 'Bnei Brak'], ['פתח תקווה', 'Petah Tikva'],
]);
const railStops = [
  { id: 'R1', code: '3700', he: 'חיפה מרכז', en: 'Haifa Center', lat: 32.8226, lon: 34.9973 },
  { id: 'R2', code: '3600', he: 'תל אביב סבידור מרכז', en: 'Tel Aviv Savidor Center', lat: 32.0838, lon: 34.7979 },
  { id: 'R3', code: '8600', he: 'נתב"ג', en: 'Ben Gurion Airport', lat: 32.0004, lon: 34.8706 },
  { id: 'R4', code: '3500', he: 'ירושלים יצחק נבון', en: 'Jerusalem Yitzhak Navon', lat: 31.7889, lon: 35.2026 },
];

const routes = [
  { id: 'bus1', agency: '3', short: '1', long: 'חוף הים - בורסה', type: 3, color: '', stops: bus1Stops, headway: 600, hop: 150 },
  { id: 'bus5', agency: '5', short: '5', long: 'יפו - אוניברסיטה', type: 3, color: '', stops: bus5Stops, headway: 720, hop: 180 },
  { id: 'tramR1', agency: '22', short: '1', long: 'בת ים - פתח תקווה', type: 0, color: 'E53935', stops: tramStops, headway: 360, hop: 120 },
  { id: 'rail', agency: '2', short: '', long: 'חיפה - ירושלים', type: 2, color: '', stops: railStops, headway: 1800, hop: 1500 },
];

const agencies = [
  ['3', 'אגד', 'https://example.invalid', 'Asia/Jerusalem'],
  ['5', 'דן', 'https://example.invalid', 'Asia/Jerusalem'],
  ['22', 'תבל', 'https://example.invalid', 'Asia/Jerusalem'],
  ['2', 'רכבת ישראל', 'https://example.invalid', 'Asia/Jerusalem'],
];

const allStops = [...bus1Stops, ...bus5Stops, ...tramStops, ...railStops];
const stopRows = [['stop_id', 'stop_code', 'stop_name', 'stop_lat', 'stop_lon', 'location_type', 'parent_station']];
const translationRows = [['trans_id', 'lang', 'translation']];
for (const s of allStops) {
  stopRows.push([s.id, s.code, s.he, s.lat, s.lon, 0, '']);
  translationRows.push([s.he, 'EN', s.en]);
}

const routeRows = [['route_id', 'agency_id', 'route_short_name', 'route_long_name', 'route_type', 'route_color']];
const tripRows = [['route_id', 'service_id', 'trip_id', 'trip_headsign', 'direction_id', 'shape_id']];
const shapeRows = [['shape_id', 'shape_pt_lat', 'shape_pt_lon', 'shape_pt_sequence']];
const stopTimeRows = [['trip_id', 'arrival_time', 'departure_time', 'stop_id', 'stop_sequence', 'shape_dist_traveled']];

for (const r of routes) {
  routeRows.push([r.id, r.agency, r.short, r.long, r.type, r.color]);
  for (const dir of [0, 1]) {
    const seq = dir === 0 ? r.stops : [...r.stops].reverse();
    const shapeId = `${r.id}_${dir}`;
    seq.forEach((s, i) => shapeRows.push([shapeId, s.lat, s.lon, i + 1]));
    const offset = dir === 0 ? 0 : Math.floor(r.headway / 2);
    let n = 0;
    for (let t = 5 * 3600 + offset; t <= 25 * 3600; t += r.headway) {
      const tripId = `${r.id}_${dir}_${n++}`;
      tripRows.push([r.id, 'ALL', tripId, seq[seq.length - 1].he, dir, shapeId]);
      seq.forEach((s, i) => {
        const at = hms(t + i * r.hop);
        stopTimeRows.push([tripId, at, at, s.id, i + 1, '']);
      });
    }
  }
}

// store.js maps stop_times.bin as typed-array views with no padding: an odd
// row count leaves the Float32 column after the Uint16 one unaligned and the
// server refuses to boot. Keep every route at an even stop count.
if ((stopTimeRows.length - 1) % 2) throw new Error('sample stop_times row count must be even');

fs.rmSync(rawDir, { recursive: true, force: true });
fs.mkdirSync(rawDir, { recursive: true });
const files = {
  'agency.txt': [['agency_id', 'agency_name', 'agency_url', 'agency_timezone'], ...agencies],
  'calendar.txt': [
    ['service_id', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'start_date', 'end_date'],
    ['ALL', 1, 1, 1, 1, 1, 1, 1, '20200101', '20351231'],
  ],
  'routes.txt': routeRows,
  'stops.txt': stopRows,
  'translations.txt': translationRows,
  'trips.txt': tripRows,
  'shapes.txt': shapeRows,
  'stop_times.txt': stopTimeRows,
};
for (const [name, rows] of Object.entries(files)) fs.writeFileSync(path.join(rawDir, name), csv(rows));
console.log(
  `[sample-data] wrote ${allStops.length} stops, ${routes.length} routes, ${tripRows.length - 1} trips, ` +
    `${stopTimeRows.length - 1} stop_times → ${path.relative(root, rawDir)}`
);

execFileSync(process.execPath, [path.join(root, 'tools/ingest/ingest.mjs'), rawDir, outDir], { stdio: 'inherit' });
console.log(`[sample-data] ready: ${path.relative(root, outDir)}`);
