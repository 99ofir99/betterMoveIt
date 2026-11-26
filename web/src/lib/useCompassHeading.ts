/**
 * Device facing direction in degrees (0 = north, clockwise).
 *
 * Single-source lock with hysteresis so the map cone does not jump between
 * GPS course and compass (the "two directions" flicker on phone).
 */

import { useEffect, useRef, useState } from 'react';

const PUBLISH_DEADBAND_DEG = 3;
const PUBLISH_MIN_MS = 100;
/** Enter GPS course only when clearly moving. */
const GPS_ENTER_MS = 2.2;
/** Leave GPS course only when clearly stopped (hysteresis). */
const GPS_EXIT_MS = 1.0;
const GPS_HOLD_MS = 2500;
const GPS_SMOOTH = 0.28;
const COMPASS_SMOOTH = 0.12;
/** Ignore wild single-sample jumps (sensor glitches). */
const MAX_STEP_DEG = 35;

type Source = 'gps' | 'compass';

function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function lerpAngle(from: number, to: number, t: number): number {
  const delta = ((to - from + 540) % 360) - 180;
  return normalizeDeg(from + delta * t);
}

function shortestDelta(from: number, to: number): number {
  return Math.abs(((to - from + 540) % 360) - 180);
}

/** iOS 13+ requires a user gesture before compass events fire. */
export async function requestCompassPermission(): Promise<void> {
  const DOE = DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<'granted' | 'denied' | 'default'>;
  };
  if (typeof DOE.requestPermission === 'function') {
    try {
      await DOE.requestPermission();
    } catch {
      /* ignore */
    }
  }
}

/**
 * @param enabled Pause listeners when the map is hidden.
 */
export function useCompassHeading(enabled: boolean): number | null {
  const [heading, setHeading] = useState<number | null>(null);
  const headingRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    let smoothed: number | null = null;
    let published: number | null = null;
    let lastPublishAt = 0;
    let source: Source = 'compass';
    let gpsSample: number | null = null;
    let gpsSampleAt = 0;
    let watchId: number | null = null;
    let preferAbsolute = false;
    let rafId: number | null = null;
    let pendingRaw: number | null = null;
    let pendingAlpha = COMPASS_SMOOTH;

    const publish = (value: number) => {
      published = value;
      lastPublishAt = performance.now();
      headingRef.current = value;
      setHeading(value);
    };

    const flush = () => {
      rafId = null;
      if (pendingRaw == null) return;

      const raw = pendingRaw;
      const alpha = pendingAlpha;
      pendingRaw = null;

      if (smoothed == null) {
        smoothed = raw;
      } else {
        // Cap step size so a 180° sensor flip cannot snap the cone.
        let target = raw;
        const step = shortestDelta(smoothed, raw);
        if (step > MAX_STEP_DEG) {
          const dir = ((raw - smoothed + 540) % 360) - 180;
          target = normalizeDeg(smoothed + Math.sign(dir || 1) * MAX_STEP_DEG);
        }
        smoothed = lerpAngle(smoothed, target, alpha);
      }

      const now = performance.now();
      if (now - lastPublishAt < PUBLISH_MIN_MS) return;
      if (published != null && shortestDelta(published, smoothed) < PUBLISH_DEADBAND_DEG) return;
      publish(smoothed);
    };

    const ingest = (raw: number, alpha: number) => {
      if (!Number.isFinite(raw)) return;
      pendingRaw = normalizeDeg(raw);
      pendingAlpha = alpha;
      if (rafId == null) rafId = requestAnimationFrame(flush);
    };

    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const h = pos.coords.heading;
          const speed = pos.coords.speed ?? 0;

          if (source === 'gps') {
            if (speed < GPS_EXIT_MS) {
              source = 'compass';
              gpsSample = null;
              return;
            }
          } else if (speed >= GPS_ENTER_MS && h != null && Number.isFinite(h) && h >= 0) {
            source = 'gps';
          }

          if (source !== 'gps') return;
          if (h == null || !Number.isFinite(h) || h < 0) return;

          gpsSample = h;
          gpsSampleAt = Date.now();
          ingest(h, GPS_SMOOTH);
        },
        () => {
          source = 'compass';
        },
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
      );
    }

    const gpsOwnsHeading = () =>
      source === 'gps' &&
      gpsSample != null &&
      Date.now() - gpsSampleAt < GPS_HOLD_MS;

    const onOrientation = (ev: DeviceOrientationEvent, absolute: boolean) => {
      if (absolute) preferAbsolute = true;
      else if (preferAbsolute) return;

      // Locked to GPS while moving — do not blend compass (causes the jump).
      if (gpsOwnsHeading()) return;

      source = 'compass';

      const webkit = (ev as DeviceOrientationEvent & { webkitCompassHeading?: number })
        .webkitCompassHeading;
      if (webkit != null && Number.isFinite(webkit)) {
        ingest(webkit, COMPASS_SMOOTH);
        return;
      }
      if (ev.alpha == null || !Number.isFinite(ev.alpha)) return;
      ingest(360 - ev.alpha, COMPASS_SMOOTH);
    };

    const onAbsolute = (ev: Event) => onOrientation(ev as DeviceOrientationEvent, true);
    const onRelative = (ev: Event) => onOrientation(ev as DeviceOrientationEvent, false);

    window.addEventListener('deviceorientationabsolute', onAbsolute, true);
    window.addEventListener('deviceorientation', onRelative, true);

    return () => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      if (rafId != null) cancelAnimationFrame(rafId);
      window.removeEventListener('deviceorientationabsolute', onAbsolute, true);
      window.removeEventListener('deviceorientation', onRelative, true);
    };
  }, [enabled]);

  return heading;
}
