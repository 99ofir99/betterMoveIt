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
const bundledArchive = path.join(root, 'deploy', 'gtfs-dist.tgz');

async function download(url, dest) {
  console.log(`[prepare-data] downloading ${url}`);
  const headers = {};
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
  if (token && /github\.com/i.test(url)) {
    headers.Authorization = `Bearer ${token}`;
    headers.Accept = 'application/octet-stream';
  }
  const res = await fetch(url, { headers, redirect: 'follow' });
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

async function extractArchive(src) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  execFileSync('tar', ['-xzf', src, '-C', outDir], { stdio: 'inherit' });
  if (!fs.existsSync(path.join(outDir, 'meta.json'))) {
    throw new Error(`archive extracted but meta.json is missing (${src})`);
  }
  console.log('[prepare-data] prebuilt store ready');
}

/** A Git LFS pointer is a ~130-byte text stub, not the real archive. */
function isLfsPointer(file) {
  if (fs.statSync(file).size > 1024) return false;
  return fs.readFileSync(file, 'utf8').startsWith('version https://git-lfs');
}

if (fs.existsSync(bundledArchive) && isLfsPointer(bundledArchive)) {
  console.warn(
    `[prepare-data] ${path.relative(root, bundledArchive)} is a Git LFS pointer, not the archive.\n` +
      '  Run `git lfs install && git lfs pull` to fetch it (64 MB). Falling back to the next source.'
  );
} else if (fs.existsSync(bundledArchive)) {
  console.log(`[prepare-data] using bundled ${bundledArchive}`);
  await extractArchive(bundledArchive);
  process.exit(0);
}

if (distUrl) {
  await download(distUrl, archivePath);
  await extractArchive(archivePath);
  fs.rmSync(archivePath, { force: true });
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
