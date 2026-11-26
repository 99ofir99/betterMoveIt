# BetterMoovit

A clean, ad-free transit app focused on what matters: live bus locations and smart trip planning.
Runs as an installable PWA on Android (and anything else with a browser), backed
by a real transit routing engine over open GTFS data.

**Core Focus:**
- Live bus tracking on the map
- Fast, accurate trip planning
- Real departure times
- No AI, no ads, no subscriptions

## Why this exists

Modern transit apps are cluttered with AI features, social integrations, and subscription walls
that get in the way of simply tracking your bus and planning a trip.

This app strips away everything except the essentials:
- **Live vehicle tracking** - See exactly where your bus is
- **Smart routing** - Multiple options sorted by time, transfers, or walking
- **Real-time info** - Actual departure times, not just schedules
- **Clean UI** - Styled to match the best transit apps, without the bloat

Built on open GTFS data with a proper RAPTOR routing engine.

## What works today

- **Multimodal trip planning** — door-to-door journeys with real transfer times,
  walking access/egress, and full route geometry on the map.
- **RAPTOR routing** — round-based public transit routing over ~9.65M timed
  stop visits, answering in roughly 100–500 ms.
- **Live departure boards** — every line at a stop with its next three
  departures, refreshed every 30 s.
- **Bilingual search** — Hebrew and English stop names, biased to your area so
  same-named stops in other cities do not crowd out the local one.
- **Offline-capable PWA** — installable, with map tiles and timetable responses
  cached by a service worker.
- **Sorting and insights** — best/fastest/fewest-changes/least-walking,
  plus per-journey riding time, walking distance, and change count.
- **Live vehicle tracking** — See bus locations on the map in real-time (when GTFS-RT feed available).
- **Zero ads, zero AI, zero accounts.**

## Architecture

```
tools/ingest/      GTFS CSV → compact binary store (one-time, ~45 s)
server/src/        Express API + RAPTOR planner + binary data layer
web/src/           React PWA (logic in lib/, presentation in components/)
```

Three deliberate decisions:

1. **The timetable is never parsed as JSON.** 9.9M stop_times become fixed-width
   typed arrays (`stop_times.bin`, 175 MB) read into memory once. Boot takes ~2 s.
2. **RAPTOR, not Dijkstra.** A time-expanded graph for this feed would be tens of
   millions of edges per service day. RAPTOR relaxes one ride per round and keeps
   a per-round frontier, so a query touches only stops that actually improved.
3. **Logic and visuals are separate.** All state and side effects live in
   `web/src/lib/`; components receive props and render. Shared types live in
   `web/src/types.ts`.

## Running it

Prerequisites: Node 20+.

```bash
npm install
```

### 1. Get transit data

Download a GTFS feed (any agency works; this was built against Israel's national
feed, ~139 MB zipped):

```bash
curl -L -o gtfs.zip https://gtfs.mot.gov.il/gtfsfiles/israel-public-transportation.zip
mkdir -p gtfs/raw && tar -xf gtfs.zip -C gtfs/raw
```

### 2. Build the binary store

```bash
node --max-old-space-size=8192 tools/ingest/ingest.mjs ./gtfs/raw ./data/gtfs-dist
```

This produces ~231 MB of directly indexable files. It is a one-time cost;
re-run only when the feed updates.

### 3. Run

```bash
npm run build     # build the web UI
npm start         # serve API + UI on http://localhost:8787
```

The server finds the data automatically at `GTFS_DATA_DIR`, `./data/gtfs-dist`,
`../data/gtfs-dist`, or the development work directory. If none exist it prints
exactly which paths it tried.

For development with hot reload:

```bash
npm run dev       # API on :8787, Vite on :5173 with proxy
```

### Installing on Android

Open the app in Chrome, then **Menu → Add to Home screen**. It installs as a
standalone PWA with its own icon and an offline shell.

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Feed counts, bounds, generator timestamp |
| `GET /api/search?q=&lat=&lon=` | Stop search, bilingual, distance-biased |
| `GET /api/nearby?lat=&lon=&radius=` | Stops around a point |
| `GET /api/stop/:id` | Stop detail plus all serving lines |
| `GET /api/stop/:id/departures` | Grouped live departure board |
| `POST /api/plan` | Journey planning (`from`, `to`, optional `time`) |
| `GET /api/walk?fromLat=&fromLon=&toLat=&toLon=` | OSRM foot routing |

## Data and licensing

Transit data comes from the agency's published GTFS feed and remains subject to
that agency's terms. Map tiles are © OpenStreetMap contributors under ODbL.
Walking routes use the public OSRM instances at `routing.openstreetmap.de`.

No code, assets, or data from the reference application are included in this
project.

## Known limits

- **No real-time vehicle positions.** The national feed publishes schedule data
  only; no public GTFS-RT endpoint exists for it. Departure boards therefore show
  scheduled times, and the UI labels them as such rather than pretending.
- **Intercity trips need several rides.** That is the network, not a bug — the
  ranking weights simplicity so a 3-change option is offered ahead of a 5-change
  one arriving a minute earlier.
- **`/api/plan` is stateless.** There is no user account, saved-trip sync, or
  cross-device state by design.
