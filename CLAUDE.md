# BetterMoveIt — codebase map

Ad-free Israeli transit PWA. npm workspaces monorepo: **Express API + RAPTOR router** over a
binary GTFS store (`server/`), **React 18 + Vite + MapLibre PWA** (`web/`), offline data
tools (`tools/`). Node 20 (`.node-version` = 20.19), ESM everywhere. No lint config.

## Commands

| Command | What it does |
| --- | --- |
| `npm run setup` | Install deps, get transit data (real if present, else synthetic sample), typecheck + test. Idempotent, ~12 s fresh |
| `npm run dev` | API on :8787 (`node --watch`) + Vite on :5173 with HMR; Vite proxies `/api` → :8787 |
| `npm run dev:debug` | Same, API with `--inspect` on :9229 |
| `npm test` / `npm run test:watch` | `node --test` for tools/lib (CSV parser) + Vitest for web (`web/src/**/*.test.ts`) |
| `npm run check` | `tsc --noEmit` for web (strict, `noUnusedLocals`) |
| `npm run verify` | check + test + production build |
| `npm run smoke` | Boot API on :8797 and hit every endpoint; `SMOKE_URL=…` to target a running server |
| `npm run routes` / `bench` | RAPTOR sample trips / timing (coordinates assume the real national feed) |
| `npm run data` | Real store → `data/gtfs-dist` (LFS archive `deploy/gtfs-dist.tgz`, else `GTFS_DIST_URL`, else MOT download + ingest, ~8 GB RAM) |
| `npm run data:sample` | Rebuild synthetic feed → `data/gtfs-sample` (26 stops, 4 lines, <1 s) |

Single test file: `cd web && npx vitest run src/lib/sort.test.ts`.
VS Code: `.vscode/launch.json` has server launch/attach, Chrome on Vite, debug current test file,
run current tool script, and a "Full stack" compound.

## Data

- Server loads the first of: `$GTFS_DATA_DIR`, `data/gtfs-dist` (cwd and parent), a Windows dev
  path, then `data/gtfs-sample` (logs a SAMPLE warning). See `getStore()` in `server/src/store.js`.
- `deploy/gtfs-dist.tgz` is Git LFS (64 MB). In a fresh clone without `git lfs pull` it is a
  ~130-byte pointer; `tools/prepare-data.mjs` detects this and moves on to the next source.
- GTFS CSV is parsed by `tools/lib/csv.mjs` (ingest + filter-gtfs). MOT writes Hebrew abbreviations with a bare `"` (e.g. `ת"א`) in unquoted fields; a quote only opens a quoted field at the start of a field. The old per-line quote counting merged/dropped ~3.4% of trips.
- `ingest.mjs --days=N [--from=YYYYMMDD]` (or `INGEST_DAYS`) keeps only trips running in that window. Measured server RSS on the 2026-11-26 MOT feed: whole feed ~800 MB peak, 14 days ~620 MB, 7 days ~495 MB (Render free tier is 512 MB). A windowed store must be rebuilt before the window runs out (`meta.json` → `serviceWindow`).
- Binary format is written by `tools/ingest/ingest.mjs` and read by `TransitStore` in
  `store.js` — change both together. `stop_times.bin` is unpadded typed-array columns: an **odd
  stop_times row count misaligns the Float32 column and the server refuses to boot**.
- Sample feed: fake lines in central Tel Aviv (bus 1 E–W, bus 5 N–S crossing it, Tevel tram R1,
  rail Haifa–TLV–Airport–Jerusalem), all days 05:00–25:00. Plan e.g. `{from:{lat:32.087,lon:34.771},to:{lat:32.113,lon:34.78}}`.
- `.env` at repo root is loaded by `server/src/env.js` (imported first in `index.js`); see `.env.example`.

## Server (`server/src/`)

| File | Role |
| --- | --- |
| `index.js` | Express app, all `/api/*` routes, `feedClock()` (Asia/Jerusalem date/time/dow), serves `web/dist` if built |
| `store.js` | `TransitStore`: loads binary files, stop/route search, nearby grid, stop→trips index, walking transfers, `routeDetail` |
| `raptor.js` | `JourneyPlanner.plan({from,to,dateInt,dow,secondsSinceMidnight})` — RAPTOR rounds, ranking, leg geometry |
| `departures.js` | Departure boards (`departuresAtStop`, `nextForRouteAtStop`) incl. tomorrow-morning peek |
| `siri.js` | Live data: MOT SIRI-SM with `MOT_KEY`, else Hasadna fallback; vehicles + stop monitoring |
| `hasadna.js` | Hasadna Open Bus Stride vehicle positions (no key) |
| `vehicleEta.js` / `arrivalAccuracy.js` | ETA from GPS positions; live/estimated/scheduled accuracy tiers |
| `lightRailBrand.js` | Tevel (agency 22) / Jerusalem tram (21) branding, route_type 0 fix |

Endpoints: `health`, `search`, `nearby`, `stop/:id`, `stop/:id/departures`, `lines/search`,
`lines/:idx`, `lines/:idx/schedule`, `vehicles`, `alerts`, `POST plan`, `geocode` (Nominatim),
`walk` (OSRM). Lines use the numeric route **index**, stops use the GTFS **stop_id**.
`geocode`, `walk`, `vehicles` call third parties and fail (502/empty) in sandboxes.

## Web (`web/src/`)

- `App.tsx` (~1400 lines): screen composition and navigation between tabs/sheets.
- `lib/` — logic only, no rendering. Key: `api.ts` (only place that builds URLs), `useAppState.ts`
  (geolocation, search, planning, selection), `useActiveTrip.ts` + `tripGuidance.ts` (live
  directions), `clampJourneys.ts` (bundle equivalent journeys into corridors), `sort.ts`,
  `favorites.ts` / `history.ts` / `settings.ts` / `tripSession.ts` (localStorage), `mapStyle.ts`.
- `components/` — presentation; each tab is a folder with `X.tsx` + `useX.ts` + `types.ts`
  (`NearbyTab`, `LinesTab`, `FavoritesTab`, `MoreTab`, `StopPanel`, `LineDetailPanel`, …);
  `trip/` live-trip UI, `directions/` + `results/` planner UI, `MapCanvas.tsx` MapLibre.
- i18n: `lib/i18n.ts` — `t('English source {name}', { name })`, Hebrew in `lib/i18n.he.ts` keyed by the English text (missing key → English). Locale comes from Settings (`settings.locale`); `useLocale()` in `App` re-renders the tree and `<html dir>` flips to `rtl`. CSS uses logical properties (`inset-inline-*`, `padding-inline`, `text-align: start`) so RTL mirrors; direction glyphs get `.rtl-flip`. Add every new UI string through `t()` and to `i18n.he.ts` (`i18n.test.ts` checks placeholder parity).
- Shared types: `web/src/types.ts`. Tests sit next to the module (`foo.ts` + `foo.test.ts`).
- PWA service worker is off in dev (`PWA_DEV=1` to enable); `main.tsx` unregisters stale SWs.

## Conventions

- Keep logic in `web/src/lib/` and pure where possible so it can be unit-tested.
- UI mirrors Moovit behaviour; comments often cite the Moovit screen being matched.
- Deploy: Render runs `npm run build:render` then `npm start` (single process serves API + UI).
- `tools/_*.py` are local Android-automation scripts used to study the reference app, not part of the build.
