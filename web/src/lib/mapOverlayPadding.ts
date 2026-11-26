/**
 * Measures map chrome (bottom sheet / trip card / nav / topbar) so camera
 * moves can keep a target (e.g. user location) in the visible map area.
 */

import type { MapPadding } from './mapOverlayPaddingTypes';

export type { MapPadding };

const BOTTOM_SELECTORS = [
  '.sheet--overlay',
  '.sheet.sheet--with-nav',
  '.sheet--directions',
  '.trip-progress',
  '.bottom-nav',
].join(', ');

const TOP_SELECTORS = ['.topbar', '.directions-topbar', '.ld-shell__pager'].join(
  ', '
);

const EDGE = 24;
const BREATHING = 36;
/** Sheets sit on top of the tab bar — allow that gap when detecting docked overlays. */
const BOTTOM_DOCK_SLACK_PX = 140;

function visibleOverlapFromBottom(
  mapRect: DOMRect,
  el: Element
): number {
  const r = el.getBoundingClientRect();
  if (r.height < 8 || r.width < 8) return 0;
  // with-nav sheets end above the tab bar; still count them as bottom-docked.
  if (r.bottom < mapRect.bottom - BOTTOM_DOCK_SLACK_PX) return 0;
  // From the overlay's top edge down to the map bottom (includes tab bar under the sheet).
  const occluded = mapRect.bottom - Math.max(r.top, mapRect.top);
  return occluded > 0 ? occluded : 0;
}

function visibleOverlapFromTop(mapRect: DOMRect, el: Element): number {
  const r = el.getBoundingClientRect();
  if (r.height < 8 || r.width < 8) return 0;
  if (r.top > mapRect.top + 32) return 0;
  const top = Math.max(r.top, mapRect.top);
  const bottom = Math.min(r.bottom, mapRect.bottom);
  if (bottom <= top) return 0;
  return bottom - top;
}

/** Camera padding that keeps easeTo/fit targets clear of UI overlays. */
export function getOverlayCameraPadding(
  mapContainer: HTMLElement
): MapPadding {
  const mapRect = mapContainer.getBoundingClientRect();
  let bottom = 0;
  let top = 0;

  for (const el of document.querySelectorAll(BOTTOM_SELECTORS)) {
    bottom = Math.max(bottom, visibleOverlapFromBottom(mapRect, el));
  }
  for (const el of document.querySelectorAll(TOP_SELECTORS)) {
    top = Math.max(top, visibleOverlapFromTop(mapRect, el));
  }

  if (bottom > 0) bottom += BREATHING;
  if (top > 0) top += BREATHING;

  // Keep a usable map band even when the sheet is tall.
  const maxBottom = Math.max(0, mapRect.height * 0.72);
  const maxTop = Math.max(0, mapRect.height * 0.28);

  return {
    top: Math.min(Math.max(EDGE, Math.round(top)), Math.round(maxTop)),
    bottom: Math.min(Math.max(EDGE, Math.round(bottom)), Math.round(maxBottom)),
    left: EDGE,
    right: EDGE,
  };
}

/**
 * Screen-pixel offset for easeTo/flyTo so `center` lands in the middle of
 * the unobscured map band (above the bottom sheet). Prefer this over
 * `padding` — MapLibre offset is applied to the final camera and stays
 * correct when zoom also changes.
 */
export function visibleTargetOffset(
  mapContainer: HTMLElement
): [number, number] {
  const pad = getOverlayCameraPadding(mapContainer);
  // Negative Y moves the geographic center up on screen (above the sheet).
  return [0, (pad.top - pad.bottom) / 2];
}
