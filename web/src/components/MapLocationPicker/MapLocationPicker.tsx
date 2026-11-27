/**
 * Moovit-style “Choose Location” — pan the map, reverse-geocode center, OK.
 * Visual only; geocode / confirm live in useMapLocationPicker.
 */

import { PinIcon } from '../icons';
import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { ensureRtlTextPlugin } from '../../lib/rtlTextPlugin';
import { DEFAULT_MAP_STYLE_URL, buildRasterStyle } from '../../lib/mapStyle';
import { Icon } from '../icons/Icon';
import { useMapLocationPicker } from './useMapLocationPicker';
import type { MapLocationPickerProps } from './types';
import { t } from '../../lib/i18n';

export function MapLocationPicker({
  initialCenter,
  slot,
  onCancel,
  onConfirm,
}: MapLocationPickerProps) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const s = useMapLocationPicker({ initialCenter, onConfirm });
  const setCenterRef = useRef(s.setCenter);
  setCenterRef.current = s.setCenter;

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    ensureRtlTextPlugin();
    const map = new maplibregl.Map({
      container: mapEl.current,
      style: DEFAULT_MAP_STYLE_URL,
      center: [initialCenter.lon, initialCenter.lat],
      zoom: 16,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

    let basemapFallback: 'vector' | 'carto' | 'google' = 'vector';
    map.on('error', (e) => {
      const msg = e.error?.message?.toLowerCase() ?? '';
      if (!msg.includes('failed') && !msg.includes('ajax') && !msg.includes('style')) return;
      if (basemapFallback === 'vector') {
        basemapFallback = 'carto';
        map.setStyle(buildRasterStyle('carto-dark'));
        return;
      }
      if (basemapFallback === 'carto') {
        basemapFallback = 'google';
        map.setStyle(buildRasterStyle('google-dark'));
      }
    });

    const publishCenter = () => {
      const c = map.getCenter();
      setCenterRef.current({ lat: c.lat, lon: c.lng });
    };
    map.on('moveend', publishCenter);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Intentionally mount once — pan updates flow through moveend → setCenter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="map-pick" role="dialog" aria-label={t("Choose location")}>
      <header className="map-pick__bar">
        <button
          type="button"
          className="icon-button icon-button--ghost"
          onClick={onCancel}
          aria-label={t("Back")}
        >
          <Icon name="arrow-back" />
        </button>
        <h1 className="map-pick__title">{t("Choose Location")}</h1>
      </header>

      <p className="map-pick__hint">{t("Move the map to find your location")}</p>

      <div className="map-pick__map-wrap">
        <div ref={mapEl} className="map-pick__map" />
        <div className="map-pick__pin" aria-hidden="true">
          <span className={`map-pick__pin-dot map-pick__pin-dot--${slot}`} />
          <span className="map-pick__pin-stem" />
        </div>
      </div>

      <footer className="map-pick__footer">
        <div className="map-pick__location">
          <span className="map-pick__location-icon" aria-hidden="true">
            <PinIcon size={20} />
          </span>
          <div className="map-pick__location-text">
            <span className="map-pick__location-label">
              {s.resolving ? t('Finding address…') : s.label}
            </span>
            <span className="map-pick__location-meta">
              {t("Transit will walk to/from the nearest stop")}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="map-pick__ok"
          onClick={s.confirm}
          disabled={s.resolving}
        >
          {t("OK")}
        </button>
      </footer>
    </div>
  );
}
