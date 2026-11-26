/**
 * Ensure data/gtfs-dist exists for production.
 *
 * Prefer a prebuilt archive (GTFS_DIST_URL) so cloud builds stay under
 * memory limits. Fall back to downloading the MOT GTFS zip and ingesting.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'data');
const outDir = path.join(dataDir, 'gtfs-dist');
const rawDir = path.join(dataDir, 'gtfs-raw');
const zipPath = path.join(dataDir, 'gtfs.zip');
const archivePath = path.join(dataDir, 'gtfs-dist.tgz');
const feedUrl =
  process.env.GTFS_ZIP_URL ||
  'https://gtfs.mot.gov.il/gtfsfiles/israel-public-transportation.zip';
const distUrl = process.env.GTFS_DIST_URL || '';

async function download(url, dest) {
  console.log(`[prepare-data] downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`download failed: ${res.status} ${res.statusText}`);
  }
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(dest));
  console.log(
    `[prepare-data] saved ${dest} (${(fs.statSync(dest).size / 1e6).toFixed(1)} MB)`
  );
}

if (fs.existsSync(path.join(outDir, 'meta.json'))) {
  console.log(`[prepare-data] ${outDir} already present — skipping`);
  process.exit(0);
}

fs.mkdirSync(dataDir, { recursive: true });

if (distUrl) {
  await download(distUrl, archivePath);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  execFileSync('tar', ['-xzf', archivePath, '-C', outDir], { stdio: 'inherit' });
  fs.rmSync(archivePath, { force: true });
  if (!fs.existsSync(path.join(outDir, 'meta.json'))) {
    console.error('[prepare-data] archive extracted but meta.json is missing');
    process.exit(1);
  }
  console.log('[prepare-data] prebuilt store ready');
  process.exit(0);
}

await download(feedUrl, zipPath);

fs.rmSync(rawDir, { recursive: true, force: true });
fs.mkdirSync(rawDir, { recursive: true });

try {
  execFileSync('unzip', ['-q', '-o', zipPath, '-d', rawDir], { stdio: 'inherit' });
} catch {
  execFileSync('tar', ['-xf', zipPath, '-C', rawDir], { stdio: 'inherit' });
}

console.log('[prepare-data] ingesting binary store…');
execFileSync(
  process.execPath,
  ['--max-old-space-size=8192', 'tools/ingest/ingest.mjs', rawDir, outDir],
  { cwd: root, stdio: 'inherit', env: process.env }
);

fs.rmSync(zipPath, { force: true });
fs.rmSync(rawDir, { recursive: true, force: true });
console.log('[prepare-data] done');
