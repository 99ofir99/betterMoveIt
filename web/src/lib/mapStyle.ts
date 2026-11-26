/**
 * Basemap styles for MapLibre.
 * Default is Moovit-night dark (OpenFreeMap Dark vector).
 * Raster dark (Carto) / Google remain as fallbacks when the vector style fails.
 */

import type { StyleSpecification } from 'maplibre-gl';

/** Moovit-like dark vector — labels stay upright while the map rotates. */
export const DARK_VECTOR_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';

/** @deprecated Light Liberty — kept for fallbacks / imports. */
export const VECTOR_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

/** Primary style used by MapCanvas. */
export const DEFAULT_MAP_STYLE_URL = DARK_VECTOR_STYLE_URL;

const CARTO_DARK_TILE_URLS = [
  'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
  'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
  'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
  'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
];

const GOOGLE_TILE_URLS = [
  'https://mt0.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
  'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
  'https://mt2.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
  'https://mt3.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
];

const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export type RasterBasemap = 'carto-dark' | 'google-dark' | 'osm';

/**
 * Raster basemap. Default `carto-dark` matches Moovit night roads.
 * `google-dark` keeps Google street geometry with inverted night paint.
 */
export function buildRasterStyle(kind: RasterBasemap | boolean = 'carto-dark'): StyleSpecification {
  // Legacy: buildRasterStyle(true) meant OSM fallback.
  const mode: RasterBasemap =
    kind === true ? 'osm' : kind === false ? 'google-dark' : kind;

  if (mode === 'osm') {
    return {
      version: 8,
      sources: {
        basemap: {
          type: 'raster',
          tiles: [OSM_TILE_URL],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors',
          maxzoom: 19,
        },
      },
      layers: [
        {
          id: 'basemap',
          type: 'raster',
          source: 'basemap',
          paint: {
            'raster-saturation': -0.85,
            'raster-brightness-min': 0,
            'raster-brightness-max': 0.55,
            'raster-contrast': 0.15,
          },
        },
      ],
    };
  }

  if (mode === 'google-dark') {
    return {
      version: 8,
      sources: {
        basemap: {
          type: 'raster',
          tiles: GOOGLE_TILE_URLS,
          tileSize: 256,
          attribution: '© Google',
          maxzoom: 20,
        },
      },
      layers: [
        {
          id: 'basemap',
          type: 'raster',
          source: 'basemap',
          paint: {
            /* Approximate Google night mode from light tiles */
            'raster-saturation': -0.92,
            'raster-brightness-min': 0,
            'raster-brightness-max': 0.48,
            'raster-contrast': 0.22,
          },
        },
      ],
    };
  }

  // Carto Dark Matter — closest free Moovit-night look.
  return {
    version: 8,
    sources: {
      basemap: {
        type: 'raster',
        tiles: CARTO_DARK_TILE_URLS,
        tileSize: 256,
        attribution: '© CARTO © OpenStreetMap contributors',
        maxzoom: 20,
      },
    },
    layers: [
      {
        id: 'basemap',
        type: 'raster',
        source: 'basemap',
        paint: {
          'raster-saturation': -0.05,
          'raster-contrast': 0.04,
        },
      },
    ],
  };
}

/**
 * Moovit night basemap palette — navy land, tan/gold roads, warm place labels.
 * Applied on top of OpenFreeMap Dark (or any MapLibre style with similar layer ids).
 */
/**
 * Sampled from Moovit Directions night map (Google-styled):
 * land ~#1A222F, roads ~#5D4B37, city labels ~#C8A27B.
 */
export const MOOVIT_NIGHT = {
  land: '#1a222f',
  water: '#141c2a',
  park: '#1c2432',
  building: '#222b3a',
  /* Thin muted brown/beige roads — not bright gold */
  roadMinor: '#4a3d30',
  roadMajor: '#5d4b37',
  roadMotorway: '#6e5a42',
  roadCasing: 'rgba(18, 20, 26, 0.65)',
  rail: '#3a3840',
  label: '#c8a27b',
  labelMuted: '#a88868',
  labelHalo: 'rgba(16, 20, 28, 0.92)',
} as const;

type MapPaintApi = {
  getStyle: () => { layers?: Array<{ id: string; type: string }> };
  getLayer: (id: string) => unknown;
  setPaintProperty: (id: string, key: string, value: unknown) => void;
  setLayoutProperty: (id: string, key: string, value: unknown) => void;
};

function setPaint(map: MapPaintApi, id: string, prop: string, value: unknown): void {
  if (!map.getLayer(id)) return;
  try {
    map.setPaintProperty(id, prop, value);
  } catch {
    /* layer may not support the property */
  }
}

/** Recolor the loaded vector style to Moovit's tan-on-navy night map. */
export function applyMoovitNightPalette(map: MapPaintApi): void {
  const c = MOOVIT_NIGHT;

  setPaint(map, 'background', 'background-color', c.land);
  setPaint(map, 'water', 'fill-color', c.water);
  setPaint(map, 'waterway', 'line-color', c.water);
  setPaint(map, 'landcover_ice_shelf', 'fill-color', c.land);
  setPaint(map, 'landcover_glacier', 'fill-color', c.land);
  setPaint(map, 'landuse_residential', 'fill-color', c.land);
  setPaint(map, 'landcover_wood', 'fill-color', c.park);
  setPaint(map, 'landuse_park', 'fill-color', c.park);
  setPaint(map, 'building', 'fill-color', c.building);
  setPaint(map, 'building', 'fill-opacity', 0.85);

  setPaint(map, 'highway_path', 'line-color', c.roadMinor);
  setPaint(map, 'highway_path', 'line-opacity', 0.75);
  setPaint(map, 'highway_minor', 'line-color', c.roadMinor);
  setPaint(map, 'highway_minor', 'line-opacity', 0.9);
  setPaint(map, 'highway_major_inner', 'line-color', c.roadMajor);
  setPaint(map, 'highway_major_subtle', 'line-color', c.roadMajor);
  setPaint(map, 'highway_major_casing', 'line-color', c.roadCasing);
  setPaint(map, 'highway_motorway_inner', 'line-color', c.roadMotorway);
  setPaint(map, 'highway_motorway_subtle', 'line-color', c.roadMajor);
  setPaint(map, 'highway_motorway_casing', 'line-color', c.roadCasing);

  setPaint(map, 'road_area_pier', 'fill-color', c.roadMinor);
  setPaint(map, 'road_pier', 'line-color', c.roadMinor);
  setPaint(map, 'aeroway-taxiway', 'line-color', c.roadMinor);
  setPaint(map, 'aeroway-runway', 'line-color', c.roadMajor);
  setPaint(map, 'aeroway-runway-casing', 'line-color', c.roadCasing);
  setPaint(map, 'aeroway-area', 'fill-color', c.building);

  setPaint(map, 'railway', 'line-color', c.rail);
  setPaint(map, 'railway_minor', 'line-color', c.rail);
  setPaint(map, 'railway_transit', 'line-color', c.rail);
  setPaint(map, 'railway_dashline', 'line-color', c.land);
  setPaint(map, 'railway_minor_dashline', 'line-color', c.land);
  setPaint(map, 'railway_transit_dashline', 'line-color', c.land);

  setPaint(map, 'boundary_state', 'line-color', '#2a303c');
  setPaint(map, 'boundary_country_z0-4', 'line-color', '#323846');
  setPaint(map, 'boundary_country_z5-', 'line-color', '#323846');

  const placeIds = [
    'place_other',
    'place_suburb',
    'place_village',
    'place_town',
    'place_city',
    'place_city_large',
    'place_state',
    'place_country_other',
    'place_country_minor',
    'place_country_major',
  ];
  for (const id of placeIds) {
    setPaint(map, id, 'text-color', c.label);
    setPaint(map, id, 'text-halo-color', c.labelHalo);
    setPaint(map, id, 'text-halo-width', 1.2);
  }

  setPaint(map, 'highway_name_other', 'text-color', c.labelMuted);
  setPaint(map, 'highway_name_other', 'text-halo-color', c.labelHalo);
  setPaint(map, 'highway_name_motorway', 'text-color', c.labelMuted);
  setPaint(map, 'highway_name_motorway', 'text-halo-color', c.labelHalo);
  setPaint(map, 'water_name', 'text-color', '#6a7a92');
  setPaint(map, 'water_name', 'text-halo-color', c.labelHalo);
}

/** Keep city/road names readable while the user rotates the map. */
export function applyUprightLabels(map: MapPaintApi): void {
  const layers = map.getStyle().layers ?? [];
  for (const layer of layers) {
    if (layer.type !== 'symbol' || !map.getLayer(layer.id)) continue;
    try {
      map.setLayoutProperty(layer.id, 'text-rotation-alignment', 'viewport');
      map.setLayoutProperty(layer.id, 'text-keep-upright', true);
      map.setLayoutProperty(layer.id, 'icon-rotation-alignment', 'viewport');
    } catch {
      /* some symbol layers reject individual props */
    }
  }
}
