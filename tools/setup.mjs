/**
 * One-command dev setup: `npm run setup`.
 *
 * 1. Checks Node (20+, .node-version pins 20.19).
 * 2. Installs workspace deps if node_modules is missing or stale.
 * 3. Makes sure the server has transit data:
 *      data/gtfs-dist present        → real data, done
 *      deploy/gtfs-dist.tgz real     → extract it (npm run data)
 *      otherwise                     → build the tiny synthetic sample
 * 4. Runs the typecheck + unit tests so you know the tree is green.
 *
 * Cross-platform (Windows / macOS / Linux): plain Node, no bash.
 * Flags: --real (fail instead of falling back to sample data), --skip-verify
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });
const step = (msg) => console.log(`\n\x1b[36m▸ ${msg}\x1b[0m`);
const ok = (msg) => console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
const warn = (msg) => console.log(`  \x1b[33m!\x1b[0m ${msg}`);
const exists = (p) => fs.existsSync(path.join(root, p));

step('Node');
const major = Number(process.versions.node.split('.')[0]);
if (major < 20) {
  console.error(`  Node ${process.versions.node} is too old. Install Node 20+ (see .node-version).`);
  process.exit(1);
}
ok(`node ${process.versions.node}`);

step('Dependencies');
const lock = path.join(root, 'package-lock.json');
const marker = path.join(root, 'node_modules', '.package-lock.json');
const stale =
  !fs.existsSync(marker) || fs.statSync(lock).mtimeMs > fs.statSync(marker).mtimeMs;
if (stale) run('npm install --no-audit --no-fund');
else ok('node_modules up to date');

step('Transit data');
const archive = path.join(root, 'deploy', 'gtfs-dist.tgz');
const archiveIsReal = fs.existsSync(archive) && fs.statSync(archive).size > 1024;
if (exists('data/gtfs-dist/meta.json')) {
  ok('real data in data/gtfs-dist');
} else if (archiveIsReal) {
  run('node tools/prepare-data.mjs');
  ok('extracted deploy/gtfs-dist.tgz → data/gtfs-dist');
} else if (args.has('--real')) {
  console.error(
    '  deploy/gtfs-dist.tgz is only a Git LFS pointer. Run `git lfs install && git lfs pull`,\n' +
      '  or set GTFS_DIST_URL / let `npm run data` download and ingest the MOT feed (~8 GB RAM).'
  );
  process.exit(1);
} else {
  run('node tools/sample-data.mjs');
  warn('using SYNTHETIC sample data (data/gtfs-sample). For the real feed: git lfs pull && npm run data');
}

if (!args.has('--skip-verify')) {
  step('Typecheck + unit tests');
  run('npm run check --silent');
  run('npm test --silent');
  ok('green');
}

console.log(`
\x1b[32mReady.\x1b[0m
  npm run dev          API :8787 (auto-restart) + Vite :5173 (HMR)  → http://localhost:5173
  npm run dev:debug    same, with the Node inspector on :9229 (attach from VS Code / chrome://inspect)
  npm test             web unit tests (vitest)   ·  npm run test:watch
  npm run verify       typecheck + tests + production build
  npm run smoke        boot the API and hit every endpoint once
`);
