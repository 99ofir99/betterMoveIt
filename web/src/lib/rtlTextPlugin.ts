/**
 * MapLibre draws map labels itself (WebGL), so without the RTL text plugin
 * Hebrew/Arabic street names come out letter-reversed ("שוהם" → "םהוש").
 * The plugin (0.2.3, the version MapLibre 4 documents; 0.3.0 fails to import in its worker) ships with the app (web/public/vendor) so it also works offline.
 * Lazy: it only loads when a tile actually has RTL text.
 */
import maplibregl from 'maplibre-gl';

const PLUGIN_URL = `${import.meta.env.BASE_URL}vendor/mapbox-gl-rtl-text-0.2.3.min.js`;

let requested = false;

export function ensureRtlTextPlugin(): void {
  if (requested) return;
  requested = true;
  try {
    if (maplibregl.getRTLTextPluginStatus() !== 'unavailable') return;
    const url = new URL(PLUGIN_URL, window.location.href).href;
    maplibregl.setRTLTextPlugin(url, true).catch((err: unknown) => {
      console.warn('RTL text plugin failed to load', err);
    });
  } catch (err) {
    console.warn('RTL text plugin setup failed', err);
  }
}
