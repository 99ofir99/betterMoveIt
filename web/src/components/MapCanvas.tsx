/**
 * Map canvas. This is the only component that touches MapLibre; everything else
 * passes plain data in.
 */

import { useEffect, useRef, useState } from 'react';
import maplibregl, { type LngLatBoundsLike } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Journey, LatLon, Stop, VehiclePosition } from '../types';
import { routeColor } from '../lib/format';
import { journeyEndpoints } from '../lib/journeyMap';
import {
  applyMoovitNightPalette,
  applyUprightLabels,
  buildRasterStyle,
  DEFAULT_MAP_STYLE_URL,
} from '../lib/mapStyle';
import { getOverlayCameraPadding, visibleTargetOffset } from '../lib/mapOverlayPadding';
import { LiveVehicleLayer, pickSpotlight } from './map/liveVehicleLayer';

interface MapCanvasProps {
  center: LatLon;
  stops: Stop[];
  journey: Journey | null;
  userLocation: LatLon | null;
  /** Device/GPS facing direction in degrees (0 = north). */
  headingDeg?: number | null;
  onStopClick: (stop: Stop) => void;
  onMapClick: (point: LatLon) => void;
  fitToJourney: boolean;
  /**
   * Bump to force another fitBounds even when the same journey object is still
   * selected (e.g. opening Directions detail for the already-highlighted card).
   */
  fitKey?: number;
  /** Recenters map on the user when tapped (location FAB). */
  onLocate?: () => void;
  /** Optional polyline for a selected line ([lat, lon][]). */
  lineGeometry?: [number, number][] | null;
  /** Faint alternate journey paths ([lat, lon][] per journey). */
  ghostJourneyPolylines?: [number, number][][];
  vehicles?: VehiclePosition[];
  /**
   * When set, non-active journey legs are dimmed to this leg index.
   * Used during active trip mode to focus on the current leg.
   */
  activeLegIndex?: number | null;
  /**
   * When true, the map smoothly follows the user's GPS position on every update.
   * Intended for active trip mode; disables the passive center-on-change behaviour.
   */
  followUser?: boolean;
  /**
   * When set (and different from activeLegIndex), one-shot pans + fits the map
   * to show that journey leg's geometry. Used when user pages the LegPager dots
   * during an active trip so they can preview upcoming/past legs on the map.
   */
  focusLegIndex?: number | null;
  /**
   * Fired when the user manually drags/pans the map (not programmatic easeTo).
   * Used by the parent to show a "Recenter" button.
   */
  onUserPan?: () => void;
  /**
   * Bumping `key` (Live location pressed) fits the camera to the tracked buses
   * nearest `near` (e.g. the boarding stop) and makes them blink.
   */
  liveFocus?: { key: number; near: LatLon | null } | null;
  /** Vehicles still loading — a pending focus waits instead of giving up. */
  liveFocusLoading?: boolean;
  /** Reports how many buses were spotlighted (0 = none reporting right now). */
  onLiveFocusDone?: (count: number) => void;
}

/** @deprecated Prefer VECTOR_STYLE_URL / mapStyle helpers. Kept for external imports. */
export const BASEMAP_TILE_URL =
  'https://mt0.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';

class LocateFabControl implements maplibregl.IControl {
  private container?: HTMLDivElement;

  constructor(private readonly onLocate: () => void) {}

  onAdd(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'maplibregl-ctrl map-locate-ctrl';
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'map-locate-fab';
    el.setAttribute('aria-label', 'My location');
    el.innerHTML =
      '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/></svg>';
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      this.onLocate();
    });
    wrap.appendChild(el);
    this.container = wrap;
    return wrap;
  }

  onRemove(): void {
    this.container?.remove();
    this.container = undefined;
  }
}

function buildYouMarkerElement(headingDeg: number | null | undefined): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'you-marker';
  const hasHeading = headingDeg != null && Number.isFinite(headingDeg);
  // Cone points "up" in marker space; Marker.setRotation(heading) + map alignment turns it.
  el.innerHTML = `
    <div class="you-marker__cone"${hasHeading ? '' : ' hidden'}></div>
    <div class="you-marker__dot"></div>
  `;
  return el;
}

function upsertGlowLineLayer(
  map: maplibregl.Map,
  layerId: string,
  srcId: string,
  color: string,
  width: number,
  opacity: number,
  extra?: {
    dasharray?: number[];
    underColor?: string;
    underWidth?: number;
    /** Dashed walks read clearer with butt caps than round. */
    lineCap?: 'butt' | 'round' | 'square';
  }
) {
  const glowId = `${layerId}-glow`;
  const lineCap = extra?.lineCap ?? 'round';
  const glowPaint: Record<string, unknown> = {
    'line-color': extra?.underColor ?? '#06080c',
    'line-width': extra?.underWidth ?? width + 7,
    'line-opacity': 0.48,
    'line-blur': 1.2,
  };
  const linePaint: Record<string, unknown> = {
    'line-color': color,
    'line-width': width,
    'line-opacity': opacity,
  };
  if (extra?.dasharray) {
    glowPaint['line-dasharray'] = extra.dasharray;
    linePaint['line-dasharray'] = extra.dasharray;
  }

  if (!map.getLayer(glowId)) {
    map.addLayer({
      id: glowId,
      type: 'line',
      source: srcId,
      layout: { 'line-cap': lineCap, 'line-join': 'round' },
      paint: glowPaint,
    });
  } else {
    map.setLayoutProperty(glowId, 'line-cap', lineCap);
    for (const [k, v] of Object.entries(glowPaint)) {
      map.setPaintProperty(glowId, k, v);
    }
  }

  if (!map.getLayer(layerId)) {
    map.addLayer({
      id: layerId,
      type: 'line',
      source: srcId,
      layout: { 'line-cap': lineCap, 'line-join': 'round' },
      paint: linePaint,
    });
  } else {
    map.setLayoutProperty(layerId, 'line-cap', lineCap);
    for (const [k, v] of Object.entries(linePaint)) {
      map.setPaintProperty(layerId, k, v);
    }
  }
}

export function MapCanvas({
  center,
  stops,
  journey,
  userLocation,
  headingDeg = null,
  onStopClick,
  onMapClick,
  fitToJourney,
  fitKey = 0,
  onLocate,
  lineGeometry = null,
  ghostJourneyPolylines = [],
  vehicles = [],
  activeLegIndex = null,
  followUser = false,
  focusLegIndex = null,
  onUserPan,
  liveFocus = null,
  liveFocusLoading = false,
  onLiveFocusDone,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const vehicleLayerRef = useRef<LiveVehicleLayer | null>(null);
  const onLiveFocusDoneRef = useRef(onLiveFocusDone);
  onLiveFocusDoneRef.current = onLiveFocusDone;
  const tripMarkersRef = useRef<maplibregl.Marker[]>([]);
  const previewMarkersRef = useRef<maplibregl.Marker[]>([]);
  const youMarkerRef = useRef<maplibregl.Marker | null>(null);
  const onStopClickRef = useRef(onStopClick);
  const onMapClickRef = useRef(onMapClick);
  const onLocateRef = useRef(onLocate);
  const onUserPanRef = useRef(onUserPan);
  const locateControlRef = useRef<LocateFabControl | null>(null);
  const headingRef = useRef(headingDeg);
  /** Increments on basemap style reload so journey/ghost layers are redrawn. */
  const [styleEpoch, setStyleEpoch] = useState(0);

  // Keep callbacks fresh without re-creating the map.
  onStopClickRef.current = onStopClick;
  onMapClickRef.current = onMapClick;
  onLocateRef.current = onLocate;
  onUserPanRef.current = onUserPan;
  headingRef.current = headingDeg;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    // Moovit night map: dark vector first, then Carto dark / Google-night raster.
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: DEFAULT_MAP_STYLE_URL,
      center: [center.lon, center.lat],
      zoom: 14,
      attributionControl: false,
      dragRotate: true,
      touchPitch: true,
      pitchWithRotate: false,
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: true, showZoom: false, visualizePitch: false }),
      'top-right',
    );
    if (onLocateRef.current) {
      const locate = new LocateFabControl(() => {
        onLocateRef.current?.();
        const m = mapRef.current;
        const you = youMarkerRef.current;
        if (!m || !you) return;
        const ll = you.getLngLat();
        const bearing = headingRef.current;
        m.easeTo({
          center: [ll.lng, ll.lat],
          // Keep the blue dot in the visible band above the half/full sheet.
          offset: visibleTargetOffset(m.getContainer()),
          zoom: Math.max(m.getZoom(), 15),
          bearing: bearing != null && Number.isFinite(bearing) ? bearing : m.getBearing(),
          duration: 550,
        });
      });
      locateControlRef.current = locate;
      map.addControl(locate, 'top-right');
    }

    const onStyleReady = () => {
      applyMoovitNightPalette(map);
      applyUprightLabels(map);
      // setStyle() wipes custom sources — bump epoch so journey effects redraw.
      setStyleEpoch((n) => n + 1);
    };
    map.on('style.load', onStyleReady);
    if (map.isStyleLoaded()) onStyleReady();

    let basemapFallback: 'dark-vector' | 'carto' | 'google-dark' = 'dark-vector';
    map.on('error', (e) => {
      const msg = e.error?.message?.toLowerCase() ?? '';
      if (!msg.includes('failed') && !msg.includes('ajax') && !msg.includes('style')) return;
      if (basemapFallback === 'dark-vector') {
        basemapFallback = 'carto';
        map.setStyle(buildRasterStyle('carto-dark'));
        return;
      }
      if (basemapFallback === 'carto') {
        basemapFallback = 'google-dark';
        map.setStyle(buildRasterStyle('google-dark'));
      }
    });
    map.on('click', (e) => {
      onMapClickRef.current({ lat: e.lngLat.lat, lon: e.lngLat.lng });
    });
    // Detect user-initiated panning (originalEvent is set by touch/mouse, absent on programmatic moves).
    map.on('movestart', (e) => {
      if ((e as unknown as { originalEvent?: Event }).originalEvent) {
        onUserPanRef.current?.();
      }
    });
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      locateControlRef.current = null;
      youMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const hasHandler = Boolean(onLocate);
    const existing = locateControlRef.current;
    if (hasHandler && !existing) {
      const locate = new LocateFabControl(() => {
        onLocateRef.current?.();
        const you = youMarkerRef.current;
        if (!you) return;
        const ll = you.getLngLat();
        const bearing = headingRef.current;
        map.easeTo({
          center: [ll.lng, ll.lat],
          offset: visibleTargetOffset(map.getContainer()),
          zoom: Math.max(map.getZoom(), 15),
          bearing: bearing != null && Number.isFinite(bearing) ? bearing : map.getBearing(),
          duration: 550,
        });
      });
      locateControlRef.current = locate;
      map.addControl(locate, 'top-right');
    } else if (!hasHandler && existing) {
      map.removeControl(existing);
      locateControlRef.current = null;
    }
  }, [onLocate]);

  // Recenter when the app asks for it (respect bottom sheet / chrome).
  // Skip while fitting a planned route — otherwise destination center fights the path.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || fitToJourney || followUser) return;
    map.easeTo({
      center: [center.lon, center.lat],
      offset: visibleTargetOffset(map.getContainer()),
      duration: 500,
    });
  }, [center.lat, center.lon, fitToJourney, followUser]);

  // Stop markers - limit to prevent lag
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const m of markersRef.current) m.remove();
    markersRef.current = [];

    const visibleStops = stops.slice(0, 50);

    for (const stop of visibleStops) {
      const el = document.createElement('button');
      el.className = 'stop-pin';
      el.type = 'button';
      el.setAttribute('aria-label', stop.name);
      el.innerHTML = '<span class="stop-pin__dot"></span>';
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        onStopClickRef.current(stop);
      });
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([stop.lon, stop.lat])
        .addTo(map);
      markersRef.current.push(marker);
    }
  }, [stops]);

  // User location marker — create once, move on GPS updates (do not remount on heading).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLocation) {
      youMarkerRef.current?.remove();
      youMarkerRef.current = null;
      return;
    }

    const existing = youMarkerRef.current;
    if (existing) {
      existing.setLngLat([userLocation.lon, userLocation.lat]);
      return;
    }

    const heading = headingRef.current;
    const el = buildYouMarkerElement(heading);
    youMarkerRef.current = new maplibregl.Marker({
      element: el,
      anchor: 'center',
      rotationAlignment: 'map',
      pitchAlignment: 'map',
    })
      .setLngLat([userLocation.lon, userLocation.lat])
      .setRotation(heading != null && Number.isFinite(heading) ? heading : 0)
      .addTo(map);
  }, [userLocation?.lat, userLocation?.lon]);

  // Facing cone — lerp rotation so GPS↔compass handoffs never hard-snap.
  useEffect(() => {
    const marker = youMarkerRef.current;
    if (!marker) return;
    const cone = marker.getElement().querySelector<HTMLElement>('.you-marker__cone');

    if (headingDeg == null || !Number.isFinite(headingDeg)) {
      cone?.setAttribute('hidden', '');
      return;
    }
    cone?.removeAttribute('hidden');

    const target = ((headingDeg % 360) + 360) % 360;
    let current = marker.getRotation();
    if (!Number.isFinite(current)) current = target;
    current = ((current % 360) + 360) % 360;

    let raf = 0;
    const tick = () => {
      const delta = ((target - current + 540) % 360) - 180;
      if (Math.abs(delta) < 0.4) {
        marker.setRotation(target);
        return;
      }
      current = ((current + delta * 0.22) % 360 + 360) % 360;
      marker.setRotation(current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [headingDeg, userLocation?.lat, userLocation?.lon]);

  // Live bus markers: persistent per vehicle, glide between GPS pings.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!vehicleLayerRef.current) vehicleLayerRef.current = new LiveVehicleLayer(map);
    // Caller (App) already filters to the tracked lines; keep a safety cap.
    vehicleLayerRef.current.update(vehicles.slice(0, 100));
  }, [vehicles]);

  useEffect(
    () => () => {
      vehicleLayerRef.current?.destroy();
      vehicleLayerRef.current = null;
    },
    [],
  );

  // Live location pressed: fly to the nearest tracked buses and make them blink.
  const pendingFocusRef = useRef<{ key: number; near: LatLon | null; since: number } | null>(null);
  const [focusTick, setFocusTick] = useState(0);
  useEffect(() => {
    if (!liveFocus) return;
    pendingFocusRef.current = { key: liveFocus.key, near: liveFocus.near, since: Date.now() };
    // Re-check once the first poll has had time to land, even if nothing changed.
    const t = window.setTimeout(() => setFocusTick((n) => n + 1), 2500);
    const t2 = window.setTimeout(() => setFocusTick((n) => n + 1), 9500);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, [liveFocus?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current;
    const layer = vehicleLayerRef.current;
    const pending = pendingFocusRef.current;
    if (!map || !pending) return;
    const positions = layer?.positions() ?? [];
    if (!positions.length) {
      // First poll may still be in flight — give it a few seconds before giving up.
      const waited = Date.now() - pending.since;
      if (waited > 9000 || (waited > 2000 && !liveFocusLoading)) {
        pendingFocusRef.current = null;
        onLiveFocusDoneRef.current?.(0);
      }
      return;
    }
    pendingFocusRef.current = null;
    const picked = pickSpotlight(positions, pending.near);
    layer?.spotlight(picked.map((p) => p.id));
    const pts = picked.map((p) => [p.lon, p.lat] as [number, number]);
    if (pending.near) pts.push([pending.near.lon, pending.near.lat]);
    let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
    for (const [lon, lat] of pts) {
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
    const pad = getOverlayCameraPadding(map.getContainer());
    map.fitBounds(
      [
        [minLon, minLat],
        [maxLon, maxLat],
      ],
      {
        padding: {
          top: Math.max(pad.top, 80) + 24,
          bottom: Math.max(pad.bottom, 160) + 24,
          left: Math.max(pad.left, 48),
          right: Math.max(pad.right, 48),
        },
        maxZoom: 16,
        duration: 900,
      },
    );
    onLiveFocusDoneRef.current?.(picked.length);
  }, [vehicles, liveFocus?.key, liveFocusLoading, focusTick]);

  // Selected line geometry (Lines tab).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const srcId = 'selected-line';

    const draw = () => {
      if (map.getLayer(`${srcId}-glow`)) map.removeLayer(`${srcId}-glow`);
      if (map.getLayer(srcId)) map.removeLayer(srcId);
      if (map.getSource(srcId)) map.removeSource(srcId);
      if (!lineGeometry || lineGeometry.length < 2) return;
      const coords = lineGeometry.map(([lat, lon]) => [lon, lat] as [number, number]);
      map.addSource(srcId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: coords },
        },
      });
      upsertGlowLineLayer(map, srcId, srcId, '#3b93f7', 6, 1);
      let minLon = 180,
        minLat = 90,
        maxLon = -180,
        maxLat = -90;
      for (const [lon, lat] of coords) {
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      }
      map.fitBounds(
        [
          [minLon, minLat],
          [maxLon, maxLat],
        ],
        { padding: { top: 96, bottom: 320, left: 40, right: 40 }, maxZoom: 14, duration: 600 }
      );
    };

    if (map.isStyleLoaded()) draw();
    else map.once('load', draw);
  }, [lineGeometry]);

  // Non-selected journey alternatives (comparison overlay).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const draw = () => {
      for (let i = 0; i < 8; i++) {
        const srcId = `journey-ghost-${i}`;
        if (map.getLayer(srcId)) map.removeLayer(srcId);
        if (map.getSource(srcId)) map.removeSource(srcId);
      }

      ghostJourneyPolylines.slice(0, 8).forEach((geometry, i) => {
        if (geometry.length < 2) return;
        const srcId = `journey-ghost-${i}`;
        const coords = geometry.map(([lat, lon]) => [lon, lat] as [number, number]);
        map.addSource(srcId, { type: 'geojson', data: lineFc(coords) });
        map.addLayer({
          id: srcId,
          type: 'line',
          source: srcId,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#7a8494',
            'line-width': 3.5,
            'line-opacity': 0.34,
          },
        });
      });
    };

    if (map.isStyleLoaded()) draw();
    else map.once('load', draw);
  }, [ghostJourneyPolylines, styleEpoch]);

  // Journey geometry: one line per transit leg, dashed for walking.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const draw = () => {
      // Remove previous journey layers/sources.
      for (const id of [
        'journey-walk',
        'journey-walk-glow',
        'journey-transit-0',
        'journey-transit-0-glow',
        'journey-transit-1',
        'journey-transit-1-glow',
        'journey-transit-2',
        'journey-transit-2-glow',
        'journey-transit-3',
        'journey-transit-3-glow',
      ]) {
        if (map.getLayer(id)) map.removeLayer(id);
        if (map.getSource(id)) map.removeSource(id);
      }

      if (!journey) return;

      // Collect every walk segment into one FeatureCollection so access,
      // transfer, and egress walks all stay visible as dashed paths.
      const walkFeatures: GeoJSON.Feature[] = [];
      let transitIdx = 0;
      for (const leg of journey.legs) {
        let coords: [number, number][] = [];
        if (leg.mode === 'walk') {
          if (leg.geometry && leg.geometry.length >= 2) {
            // Walk geometry stored as [lat, lon] to match transit convention; MapLibre needs [lon, lat].
            coords = leg.geometry.map(([lat, lon]) => [lon, lat] as [number, number]);
          } else if (leg.from && leg.to) {
            coords = [[leg.from.lon, leg.from.lat], [leg.to.lon, leg.to.lat]];
          }
          if (coords.length >= 2) {
            walkFeatures.push({
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: coords },
            });
          }
          continue;
        }

        // Transit legs: server geometry is always [lat, lon] — MapLibre needs [lon, lat].
        coords = (leg.geometry ?? []).map(([lat, lon]) => [lon, lat] as [number, number]);
        if (coords.length < 2) continue;

        const srcId = `journey-transit-${transitIdx % 4}`;
        if (!map.getSource(srcId)) {
          map.addSource(srcId, { type: 'geojson', data: emptyFc() });
        }
        const layerId = srcId;
        // Moovit paints the active itinerary in cyan/teal, not agency brand colours.
        const tn = leg.route.typeName.toLowerCase();
        const isBus = tn === 'bus' || tn === '' || tn === 'trolleybus';
        const color = isBus
          ? '#4db6ac'
          : routeColor(leg.route.color, leg.route.typeName);
        (map.getSource(srcId) as maplibregl.GeoJSONSource).setData(lineFc(coords));
        upsertGlowLineLayer(map, layerId, srcId, color, 7, 1);
        transitIdx++;
      }

      if (walkFeatures.length > 0) {
        const srcId = 'journey-walk';
        const walkFc: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: walkFeatures,
        };
        if (!map.getSource(srcId)) {
          map.addSource(srcId, { type: 'geojson', data: walkFc });
        } else {
          (map.getSource(srcId) as maplibregl.GeoJSONSource).setData(walkFc);
        }
        // Dotted/dashed footpath — distinct from solid transit lines.
        upsertGlowLineLayer(map, srcId, srcId, '#94a0b0', 3.5, 0.9, {
          dasharray: [1.2, 2.2],
          underColor: '#0c0e12',
          underWidth: 8,
          lineCap: 'butt',
        });
      }

      if (fitToJourney) {
        const all: [number, number][] = [];
        for (const leg of journey.legs) {
          if (leg.mode === 'transit') {
            all.push(...(leg.geometry ?? []).map(([lat, lon]) => [lon, lat] as [number, number]));
          } else if (leg.mode === 'walk') {
            if (leg.geometry?.length) {
              all.push(...leg.geometry.map(([lat, lon]) => [lon, lat] as [number, number]));
            } else if (leg.from && leg.to) {
              all.push([leg.from.lon, leg.from.lat], [leg.to.lon, leg.to.lat]);
            }
          }
        }
        // Endpoints alone often miss the transit line's own path, and fitting to
        // a straight origin-to-destination box pulls the camera far out. Fitting
        // to the actual geometry keeps the view tight around the route.
        if (all.length > 1) {
          let minLon = 180,
            minLat = 90,
            maxLon = -180,
            maxLat = -90;
          for (const [lon, lat] of all) {
            minLon = Math.min(minLon, lon);
            maxLon = Math.max(maxLon, lon);
            minLat = Math.min(minLat, lat);
            maxLat = Math.max(maxLat, lat);
          }
          const bounds: LngLatBoundsLike = [
            [minLon, minLat],
            [maxLon, maxLat],
          ];
          // Defer one frame so a newly opened peek/half sheet is in the DOM for padding.
          requestAnimationFrame(() => {
            if (!mapRef.current) return;
            const pad = getOverlayCameraPadding(map.getContainer());
            map.fitBounds(bounds, {
              padding: {
                top: Math.max(pad.top, 72),
                bottom: Math.max(pad.bottom, 160),
                left: Math.max(pad.left, 36),
                right: Math.max(pad.right, 36),
              },
              maxZoom: 15,
              duration: 700,
            });
          });
        }
      }
    };

    if (map.isStyleLoaded()) draw();
    else map.once('load', draw);
  }, [journey, fitToJourney, fitKey, styleEpoch]);

  // Pre-start route preview: origin + destination pins (board/alight take over after Start).
  useEffect(() => {
    const map = mapRef.current;
    for (const m of previewMarkersRef.current) m.remove();
    previewMarkersRef.current = [];
    if (!map || !journey || activeLegIndex != null) return;

    const ends = journeyEndpoints(journey);
    if (!ends) return;

    const startEl = document.createElement('div');
    startEl.className = 'journey-end-pin journey-end-pin--start';
    startEl.setAttribute('aria-label', 'Trip start');
    previewMarkersRef.current.push(
      new maplibregl.Marker({ element: startEl, anchor: 'center' })
        .setLngLat([ends.start.lon, ends.start.lat])
        .addTo(map)
    );

    const endEl = document.createElement('div');
    endEl.className = 'journey-end-pin journey-end-pin--end';
    endEl.setAttribute('aria-label', 'Trip end');
    previewMarkersRef.current.push(
      new maplibregl.Marker({ element: endEl, anchor: 'bottom' })
        .setLngLat([ends.end.lon, ends.end.lat])
        .addTo(map)
    );
  }, [journey, activeLegIndex, styleEpoch]);

  // Follow user: in trip mode, smoothly pan to GPS position on every update.
  useEffect(() => {
    if (!followUser || !userLocation) return;
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({
      center: [userLocation.lon, userLocation.lat],
      offset: visibleTargetOffset(map.getContainer()),
      zoom: 16,
      duration: 300,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followUser, userLocation?.lat, userLocation?.lon]);

  // Pager-driven leg focus: when user pages to a different leg during an active trip,
  // one-shot fitBounds to that leg's geometry so they can preview it on the map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || focusLegIndex == null || !journey) return;
    const leg = journey.legs[focusLegIndex];
    if (!leg) return;

    const coords: [number, number][] = [];
    if (leg.mode === 'walk') {
      if (leg.geometry && leg.geometry.length >= 2) {
        coords.push(...leg.geometry.map(([lat, lon]) => [lon, lat] as [number, number]));
      } else if (leg.from && leg.to) {
        coords.push([leg.from.lon, leg.from.lat], [leg.to.lon, leg.to.lat]);
      }
    } else {
      coords.push(...(leg.geometry ?? []).map(([lat, lon]) => [lon, lat] as [number, number]));
    }
    if (coords.length < 2) return;

    let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
    for (const [lon, lat] of coords) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    const fitOrEase = () => {
      map.fitBounds(
        [[minLon, minLat], [maxLon, maxLat]],
        { padding: { top: 100, bottom: 340, left: 40, right: 40 }, maxZoom: 16, duration: 600 }
      );
    };
    if (map.isStyleLoaded()) fitOrEase();
    else map.once('load', fitOrEase);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusLegIndex, journey]);

  // Trip mode: pulsing board / alight markers for the active transit leg.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const m of tripMarkersRef.current) m.remove();
    tripMarkersRef.current = [];

    if (activeLegIndex == null || !journey) return;
    const leg = journey.legs[activeLegIndex];
    if (!leg || leg.mode !== 'transit') return;

    const boardEl = document.createElement('div');
    boardEl.className = 'trip-board-pin trip-board-pin--pulse';
    tripMarkersRef.current.push(
      new maplibregl.Marker({ element: boardEl, anchor: 'center' })
        .setLngLat([leg.from.lon, leg.from.lat])
        .addTo(map)
    );

    const alightEl = document.createElement('div');
    alightEl.className = 'trip-alight-pin trip-alight-pin--pulse';
    tripMarkersRef.current.push(
      new maplibregl.Marker({ element: alightEl, anchor: 'center' })
        .setLngLat([leg.to.lon, leg.to.lat])
        .addTo(map)
    );
  }, [activeLegIndex, journey]);

  // Trip mode: dim non-active journey layers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !journey) return;

    const apply = () => {
      if (activeLegIndex == null) {
        // Restore full opacity for all layers.
        if (map.getLayer('journey-walk')) {
          map.setPaintProperty('journey-walk', 'line-opacity', 0.82);
          if (map.getLayer('journey-walk-glow'))
            map.setPaintProperty('journey-walk-glow', 'line-opacity', 0.48);
        }
        for (let i = 0; i < 4; i++) {
          const id = `journey-transit-${i}`;
          if (map.getLayer(id)) {
            map.setPaintProperty(id, 'line-opacity', 1);
            if (map.getLayer(`${id}-glow`))
              map.setPaintProperty(`${id}-glow`, 'line-opacity', 0.48);
          }
        }
        return;
      }

      const activeIsWalk = journey.legs[activeLegIndex]?.mode === 'walk';

      if (map.getLayer('journey-walk')) {
        const op = activeIsWalk ? 0.82 : 0.15;
        map.setPaintProperty('journey-walk', 'line-opacity', op);
        if (map.getLayer('journey-walk-glow'))
          map.setPaintProperty('journey-walk-glow', 'line-opacity', activeIsWalk ? 0.48 : 0.06);
      }

      let transitIdx = 0;
      for (let i = 0; i < journey.legs.length; i++) {
        if (journey.legs[i].mode !== 'transit') continue;
        const layerId = `journey-transit-${transitIdx % 4}`;
        const isActive = i === activeLegIndex;
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, 'line-opacity', isActive ? 1 : 0.18);
          if (map.getLayer(`${layerId}-glow`))
            map.setPaintProperty(`${layerId}-glow`, 'line-opacity', isActive ? 0.48 : 0.06);
        }
        transitIdx++;
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);
  }, [activeLegIndex, journey]);

  return <div ref={containerRef} className="map-canvas" />;
}

function emptyFc(): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}

function lineFc(coords: [number, number][]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }],
  };
}
