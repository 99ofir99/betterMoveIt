/**
 * Load the repo-root `.env` (if any) before other modules read process.env.
 * Imported first in index.js — ESM evaluates imports in order, so siri.js /
 * hasadna.js / store.js see these values. Real env vars always win.
 * See `.env.example` for the knobs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const envFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env');
if (fs.existsSync(envFile) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envFile);
  console.log(`[env] loaded ${envFile}`);
}
