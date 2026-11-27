/**
 * Live bus markers on the MapLibre map.
 *
 * Markers are kept per vehicleId and glide between GPS pings instead of being
 * torn down on every poll, so buses visibly drive along the street. Each marker
 * shows the line number, a heading arrow and a freshness dot (Moovit G/Y/R).
 * `spotlight()` makes chosen buses blink so the user finds them after pressing
 * Live location.
 */

import maplibregl from 'maplibre-gl';
import type { LatLon, VehiclePosition } from '../../types';
import { confidenceFromAge, formatVehicleAge } from '../../lib/vehicleAge';

/** Glide duration between pings — shorter than the 5 s poll so buses settle. */
const GLIDE_MS = 1600;
/** Jumps larger than this (km-ish in degrees) snap instead of gliding across town. */
const MAX_GLIDE_DEG = 0.02;

const BUS_SVG =
  '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="currentColor"><path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/></svg>';

interface Entry {
  vehicle: VehiclePosition;
  marker: maplibregl.Marker;
  el: HTMLDivElement;
  heading: HTMLDivElement;
  line: HTMLSpanElement;
  age: HTMLSpanElement;
  from: [number, number];
  to: [number, number];
  start: number;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

export class LiveVehicleLayer {
  private entries = new Map<string, Entry>();
  private raf = 0;
  private spotlightTimer = 0;
  private spotlightIds = new Set<string>();
  private ageTimer = 0;

  constructor(private readonly map: maplibregl.Map) {
    this.map.on('rotate', this.onRotate);
    // Keep "12s ago" honest between polls.
    this.ageTimer = window.setInterval(() => this.refreshAges(), 1000);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    window.clearTimeout(this.spotlightTimer);
    window.clearInterval(this.ageTimer);
    this.map.off('rotate', this.onRotate);
    for (const e of this.entries.values()) e.marker.remove();
    this.entries.clear();
  }

  /** Reconcile markers with the latest poll. */
  update(vehicles: VehiclePosition[]): void {
    const now = performance.now();
    const seen = new Set<string>();
    for (const v of vehicles) {
      if (!Number.isFinite(v.lat) || !Number.isFinite(v.lon)) continue;
      seen.add(v.vehicleId);
      const to: [number, number] = [v.lon, v.lat];
      const existing = this.entries.get(v.vehicleId);
      if (existing) {
        const cur = existing.marker.getLngLat();
        const from: [number, number] = [cur.lng, cur.lat];
        const far =
          Math.abs(from[0] - to[0]) > MAX_GLIDE_DEG || Math.abs(from[1] - to[1]) > MAX_GLIDE_DEG;
        existing.vehicle = v;
        existing.from = far ? to : from;
        existing.to = to;
        existing.start = now;
        if (far) existing.marker.setLngLat(to);
        this.paint(existing);
      } else {
        const entry = this.create(v);
        this.entries.set(v.vehicleId, entry);
      }
    }
    for (const [id, e] of this.entries) {
      if (seen.has(id)) continue;
      e.marker.remove();
      this.entries.delete(id);
    }
    this.kick();
  }

  /** Current on-screen positions (for camera fitting). */
  positions(): Array<{ id: string; lat: number; lon: number }> {
    return [...this.entries.values()].map((e) => ({
      id: e.vehicle.vehicleId,
      lat: e.to[1],
      lon: e.to[0],
    }));
  }

  get size(): number {
    return this.entries.size;
  }

  /**
   * Blink the given buses (and fade the rest) for `ms`, so the user's eye lands
   * on the ones that matter right after pressing Live location.
   */
  spotlight(ids: string[], ms = 6500): void {
    window.clearTimeout(this.spotlightTimer);
    this.spotlightIds = new Set(ids);
    for (const e of this.entries.values()) this.paint(e);
    this.spotlightTimer = window.setTimeout(() => {
      this.spotlightIds.clear();
      for (const e of this.entries.values()) this.paint(e);
    }, ms);
  }

  private create(v: VehiclePosition): Entry {
    const el = document.createElement('div');
    el.className = 'live-bus';
    el.setAttribute('role', 'button');
    el.tabIndex = 0;

    const ring = document.createElement('div');
    ring.className = 'live-bus__ring';
    const heading = document.createElement('div');
    heading.className = 'live-bus__heading';
    const body = document.createElement('div');
    body.className = 'live-bus__body';
    body.innerHTML = BUS_SVG;
    const line = document.createElement('span');
    line.className = 'live-bus__line';
    body.appendChild(line);
    const dot = document.createElement('span');
    dot.className = 'live-bus__dot';
    const age = document.createElement('span');
    age.className = 'live-bus__age';

    body.appendChild(dot);
    el.append(ring, heading, body, age);
    // Tap toggles the "updated 12s ago" caption for that bus.
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      el.classList.toggle('is-expanded');
    });

    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([v.lon, v.lat])
      .addTo(this.map);
    const pos: [number, number] = [v.lon, v.lat];
    const entry: Entry = {
      vehicle: v,
      marker,
      el,
      heading,
      line,
      age,
      from: pos,
      to: pos,
      start: 0,
    };
    this.paint(entry);
    return entry;
  }

  private paint(e: Entry): void {
    const v = e.vehicle;
    const acc = confidenceFromAge(v.timestamp);
    const spot = this.spotlightIds.size > 0;
    const lit = this.spotlightIds.has(v.vehicleId);
    e.el.className = [
      'live-bus',
      `is-acc-${acc}`,
      lit ? 'is-spotlight' : '',
      spot && !lit ? 'is-dimmed' : '',
      e.el.classList.contains('is-expanded') ? 'is-expanded' : '',
    ]
      .filter(Boolean)
      .join(' ');
    const label = v.lineName || v.routeId || '';
    e.line.textContent = label;
    e.el.setAttribute('aria-label', `Bus ${label}, updated ${formatVehicleAge(v.timestamp)}`);
    e.age.textContent = formatVehicleAge(v.timestamp);
    const hasBearing = v.bearing != null && Number.isFinite(v.bearing);
    e.heading.hidden = !hasBearing;
    if (hasBearing) this.rotateHeading(e);
    // Lit buses render above the crowd.
    e.el.style.zIndex = lit ? '3' : spot ? '1' : '2';
  }

  private rotateHeading(e: Entry): void {
    const b = e.vehicle.bearing;
    if (b == null || !Number.isFinite(b)) return;
    e.heading.style.transform = `rotate(${b - this.map.getBearing()}deg)`;
  }

  private onRotate = () => {
    for (const e of this.entries.values()) this.rotateHeading(e);
  };

  private refreshAges(): void {
    for (const e of this.entries.values()) {
      const acc = confidenceFromAge(e.vehicle.timestamp);
      if (!e.el.classList.contains(`is-acc-${acc}`)) this.paint(e);
      else e.age.textContent = formatVehicleAge(e.vehicle.timestamp);
    }
  }

  private kick(): void {
    cancelAnimationFrame(this.raf);
    const step = () => {
      const now = performance.now();
      let moving = false;
      for (const e of this.entries.values()) {
        if (!e.start) continue;
        const t = Math.min(1, (now - e.start) / GLIDE_MS);
        const k = easeInOut(t);
        e.marker.setLngLat([
          e.from[0] + (e.to[0] - e.from[0]) * k,
          e.from[1] + (e.to[1] - e.from[1]) * k,
        ]);
        if (t < 1) moving = true;
        else e.start = 0;
      }
      if (moving) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }
}

/** Pick the buses to spotlight: nearest to `near`, at most `max`, within `maxKm`. */
export function pickSpotlight(
  positions: Array<{ id: string; lat: number; lon: number }>,
  near: LatLon | null,
  max = 3,
  maxKm = 8
): Array<{ id: string; lat: number; lon: number }> {
  if (!positions.length) return [];
  if (!near) return positions.slice(0, max);
  const kmPerDegLat = 111.32;
  const kmPerDegLon = 111.32 * Math.cos((near.lat * Math.PI) / 180);
  const ranked = positions
    .map((p) => ({
      p,
      d: Math.hypot((p.lat - near.lat) * kmPerDegLat, (p.lon - near.lon) * kmPerDegLon),
    }))
    .sort((a, b) => a.d - b.d);
  const within = ranked.filter((r) => r.d <= maxKm);
  // Nothing close: still show the single nearest so the button never "does nothing".
  return (within.length ? within : ranked.slice(0, 1)).slice(0, max).map((r) => r.p);
}
