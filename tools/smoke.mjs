/**
 * API smoke test: boots the server on a spare port and hits every endpoint once.
 *
 *   npm run smoke                 # uses whatever data the server finds
 *   npm run smoke -- --keep       # leave the server running afterwards
 *   SMOKE_URL=http://localhost:8787 npm run smoke   # test an already-running server
 *
 * Endpoints that call third-party services (Nominatim, OSRM, Hasadna/MOT SIRI)
 * are reported but never fail the run, since sandboxes and CI often block them.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const keep = process.argv.includes('--keep');
const port = Number(process.env.SMOKE_PORT || 8797);
let base = process.env.SMOKE_URL || '';
let child = null;

if (!base) {
  base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['src/index.js'], {
    cwd: path.join(root, 'server'),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => process.stdout.write(`  [server] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`  [server] ${d}`));
  child.on('exit', (code) => {
    if (code) {
      console.error(`server exited with code ${code}`);
      process.exit(1);
    }
  });
}

async function waitForHealth() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${base}/api/health`);
      if (r.ok) return r.json();
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`server did not become healthy at ${base}`);
}

const results = [];
async function hit(name, url, { method = 'GET', body, external = false, check } = {}) {
  const t0 = performance.now();
  let status = 0;
  let json = null;
  let err = '';
  try {
    const r = await fetch(`${base}${url}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    status = r.status;
    json = await r.json().catch(() => null);
    if (r.ok && check) err = check(json) || '';
  } catch (e) {
    err = String(e.message || e);
  }
  const ms = Math.round(performance.now() - t0);
  const pass = status >= 200 && status < 300 && !err;
  results.push({ name, pass, external });
  const mark = pass ? '\x1b[32m✓\x1b[0m' : external ? '\x1b[33m~\x1b[0m' : '\x1b[31m✗\x1b[0m';
  console.log(`${mark} ${String(status).padEnd(3)} ${String(ms).padStart(5)}ms  ${method} ${url}${err ? `  (${err})` : ''}`);
  return json;
}

try {
  const health = await waitForHealth();
  console.log(`\nhealthy: ${health.counts.stops} stops, ${health.counts.routes} routes\n`);

  // Pick real ids from the loaded feed so this works on sample and national data.
  const near = await hit('nearby', '/api/nearby?lat=32.0853&lon=34.7818&radius=1500', {
    check: (j) => (j?.stops?.length ? '' : 'no stops near central Tel Aviv'),
  });
  const stopId = near?.stops?.[0]?.id;
  await hit('search', '/api/search?q=Arlozorov&lat=32.0853&lon=34.7818');
  if (stopId) {
    await hit('stop', `/api/stop/${encodeURIComponent(stopId)}`);
    await hit('departures', `/api/stop/${encodeURIComponent(stopId)}/departures`);
  }
  const lines = await hit('lines/search', '/api/lines/search?q=1', {
    check: (j) => (j?.results?.length ? '' : 'no lines'),
  });
  const lineIdx = lines?.results?.[0]?.index ?? lines?.results?.[0]?.routeIdx ?? 0;
  await hit('line', `/api/lines/${lineIdx}`);
  await hit('line schedule', `/api/lines/${lineIdx}/schedule?time=09:00`);
  await hit('plan', '/api/plan', {
    method: 'POST',
    body: { from: { lat: 32.087, lon: 34.771 }, to: { lat: 32.113, lon: 34.78 }, time: '09:00' },
    check: (j) => (j?.journeys?.length ? '' : 'no journeys'),
  });
  await hit('alerts', '/api/alerts');
  await hit('vehicles', '/api/vehicles', { external: true });
  await hit('geocode', '/api/geocode?q=Dizengoff', { external: true });
  await hit('walk', '/api/walk?fromLat=32.087&fromLon=34.771&toLat=32.09&toLon=34.78', { external: true });
} catch (e) {
  console.error(e.message);
  results.push({ name: 'boot', pass: false, external: false });
}

const failed = results.filter((r) => !r.pass && !r.external);
const flaky = results.filter((r) => !r.pass && r.external);
console.log(
  `\n${results.length - failed.length - flaky.length}/${results.length} passed` +
    (flaky.length ? `, ${flaky.length} external skipped (${flaky.map((r) => r.name).join(', ')})` : '') +
    (failed.length ? `, \x1b[31m${failed.length} FAILED\x1b[0m` : '')
);
if (child && !keep) child.kill();
if (keep && child) console.log(`server still running at ${base} (Ctrl+C to stop)`);
else process.exit(failed.length ? 1 : 0);
