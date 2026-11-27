/**
 * Drag logic for map bottom sheets.
 * - `behavior: 'free'` — continuous height (Moovit Live Directions card).
 * - `behavior: 'snap'` — peek / half / full rests.
 *
 * Moovit rules:
 * - Finger down → sheet shrinks (collapses toward map).
 * - Finger up → sheet grows.
 * - Grabber / grey strip always resize the sheet.
 * - Body / stop list: scroll first; pull-down collapses only when scrolled to top.
 * - Never fight the user by resetting height after they drag.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { SheetDragBind, SheetSnap, SheetSnapHeights, UseSheetDragOptions } from './types';

const SNAP_ORDER: SheetSnap[] = ['peek', 'half', 'full'];
const DRAG_THRESHOLD_PX = 6;
const VELOCITY_FLICK = 0.28;
const VELOCITY_HARD = 0.55;
const PROJECT_MS = 240;
const FREE_INERTIA_MS = 160;
/** Treat as top-of-list so rubber-band / subpixel scroll still allows collapse. */
const AT_TOP_PX = 4;

function readCssPx(
  varName: string,
  fallback: number,
  el: Element | null = null
): number {
  if (typeof window === 'undefined') return fallback;
  const raw = getComputedStyle(el ?? document.documentElement)
    .getPropertyValue(varName)
    .trim();
  if (!raw) {
    if (el && el !== document.documentElement) {
      return readCssPx(varName, fallback, document.documentElement);
    }
    return fallback;
  }
  if (raw.endsWith('vh')) {
    return (parseFloat(raw) / 100) * window.innerHeight;
  }
  if (raw.endsWith('px')) return parseFloat(raw);
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

function measureSnaps(withNav: boolean, sheetEl: Element | null = null): SheetSnapHeights {
  const tabbar = withNav ? readCssPx('--tabbar-h', 64, sheetEl) : 0;
  const peek = Math.max(
    120,
    readCssPx('--sheet-peek', window.innerHeight * 0.34, sheetEl) - tabbar * 0.15
  );
  const half = Math.max(
    peek + 40,
    readCssPx('--sheet-half', window.innerHeight * 0.54, sheetEl) - tabbar * 0.35
  );
  const full = Math.max(
    half + 40,
    readCssPx('--sheet-full', window.innerHeight * 0.82, sheetEl) - tabbar
  );
  return { peek, half, full };
}

function nearestSnap(height: number, snaps: SheetSnapHeights): SheetSnap {
  let best: SheetSnap = 'full';
  let bestDist = Infinity;
  for (const snap of SNAP_ORDER) {
    const dist = Math.abs(snaps[snap] - height);
    if (dist < bestDist) {
      bestDist = dist;
      best = snap;
    }
  }
  return best;
}

function softZone(height: number, snaps: SheetSnapHeights): SheetSnap {
  const midPeekHalf = (snaps.peek + snaps.half) / 2;
  const midHalfFull = (snaps.half + snaps.full) / 2;
  if (height < midPeekHalf) return 'peek';
  if (height < midHalfFull) return 'half';
  return 'full';
}

function snapFromRelease(
  deltaY: number,
  velocityY: number,
  snaps: SheetSnapHeights,
  startHeight: number
): SheetSnap {
  if (velocityY >= VELOCITY_HARD) return 'peek';
  if (velocityY <= -VELOCITY_HARD) return 'full';

  const useProjection = Math.abs(velocityY) >= VELOCITY_FLICK;
  const projected = useProjection
    ? startHeight - deltaY - velocityY * PROJECT_MS
    : startHeight - deltaY;
  const clamped = Math.max(snaps.peek, Math.min(snaps.full, projected));
  return nearestSnap(clamped, snaps);
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      'button, a, input, select, textarea, summary, [role="button"], [contenteditable="true"]'
    )
  );
}

/** Scroll offset of the visible Live Directions page only. */
function scrollTopOf(sheet: HTMLElement | null): number {
  if (!sheet) return 0;
  if (sheet.scrollTop > AT_TOP_PX) return sheet.scrollTop;

  const page = sheet.querySelector<HTMLElement>(
    '.ld-stage__page[aria-hidden="false"]'
  );
  if (page) return page.scrollTop;

  const inner = sheet.querySelector<HTMLElement>(
    '.directions__scroll, .ld-scroll, [data-sheet-scroll], .sheet__body'
  );
  return inner?.scrollTop ?? 0;
}

function lockInnerScroll(sheet: HTMLElement | null, locked: boolean) {
  if (!sheet) return;
  sheet.style.overflowY = locked ? 'hidden' : '';
  const nodes = sheet.querySelectorAll<HTMLElement>(
    '.directions__scroll, .ld-scroll, .ld-stage__page, [data-sheet-scroll], .sheet__body'
  );
  nodes.forEach((el) => {
    el.style.overflowY = locked ? 'hidden' : '';
  });
}

export function useSheetDrag(options: UseSheetDragOptions = {}): {
  bind: SheetDragBind;
  snap: SheetSnap;
  setSnap: (snap: SheetSnap, notify?: boolean) => void;
  /** Programmatic snap that clears the user-pinned lock (page changes). */
  forceSnap: (snap: SheetSnap) => void;
  dragging: boolean;
  heightPx: number;
} {
  const {
    initialSnap = 'full',
    withNav = false,
    enabled = true,
    behavior = 'snap',
    onSnapChange,
    onHeightChange,
  } = options;

  const free = behavior === 'free';

  const [heights, setHeights] = useState<SheetSnapHeights>(() =>
    typeof window !== 'undefined'
      ? measureSnaps(withNav)
      : { peek: 240, half: 400, full: 600 }
  );
  const [heightPx, setHeightPx] = useState(() => heights[initialSnap]);
  const [snap, setSnapState] = useState<SheetSnap>(initialSnap);
  const [dragging, setDragging] = useState(false);

  const nodeRef = useRef<HTMLElement | null>(null);
  const snapRef = useRef(snap);
  const heightRef = useRef(heightPx);
  const heightsRef = useRef(heights);
  const onSnapChangeRef = useRef(onSnapChange);
  const onHeightChangeRef = useRef(onHeightChange);
  const mountedRef = useRef(false);
  /** After the user finishes a drag, ignore programmatic setSnap until page changes call it explicitly. */
  const userPinnedRef = useRef(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startHeight: number;
    lastY: number;
    lastT: number;
    velocityY: number;
    active: boolean;
    fromGrabber: boolean;
    fromStage: boolean;
  } | null>(null);

  onSnapChangeRef.current = onSnapChange;
  onHeightChangeRef.current = onHeightChange;
  snapRef.current = snap;
  heightRef.current = heightPx;
  heightsRef.current = heights;

    // notifySnap 'always': tell the owner even when the zone didn't change on release.
  // A slow drag already moved the zone during pointermove (no notify there), so a
  // controlled sheet never heard about it and yanked itself back to the old snap.
  const publishHeight = useCallback((next: number, nextSnap: SheetSnap, notifySnap: boolean | 'always') => {
    const snaps = heightsRef.current;
    const clamped = Math.max(snaps.peek * 0.85, Math.min(snaps.full, next));
    heightRef.current = clamped;
    setHeightPx(clamped);
    onHeightChangeRef.current?.(clamped);

    if (nextSnap !== snapRef.current) {
      snapRef.current = nextSnap;
      setSnapState(nextSnap);
      if (notifySnap) onSnapChangeRef.current?.(nextSnap);
    } else if (notifySnap === 'always') {
      onSnapChangeRef.current?.(nextSnap);
    }
  }, []);

  const setSnap = useCallback(
    (next: SheetSnap, notify: boolean = true, force = false) => {
      if (userPinnedRef.current && !force) return;
      const h = heightsRef.current[next];
      publishHeight(h, next, notify);
    },
    [publishHeight]
  );

  /** Allow TripProgressSheet to auto-open a page once without fighting later drags. */
  const forceSnap = useCallback(
    (next: SheetSnap) => {
      userPinnedRef.current = false;
      const h = heightsRef.current[next];
      publishHeight(h, next, false);
    },
    [publishHeight]
  );

  useEffect(() => {
    const refresh = () => {
      if (dragRef.current?.active) return;
      const next = measureSnaps(withNav, nodeRef.current);
      heightsRef.current = next;
      setHeights(next);
      // Keep current height — never jump back to a snap zone on resize.
      const clamped = Math.max(next.peek * 0.85, Math.min(next.full, heightRef.current));
      publishHeight(clamped, softZone(clamped, next), false);
    };
    refresh();
    window.addEventListener('resize', refresh);
    return () => window.removeEventListener('resize', refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withNav]);

  const canDrag = enabled;

  const endDrag = useCallback(
    (clientY: number) => {
      const session = dragRef.current;
      dragRef.current = null;
      lockInnerScroll(nodeRef.current, false);

      if (!session?.active) {
        setDragging(false);
        return;
      }

      const delta = clientY - session.startY;
      const snaps = heightsRef.current;
      userPinnedRef.current = true;

      if (free) {
        // Finger down (positive delta) shrinks the sheet — settle where released.
        let projected =
          session.startHeight - delta - session.velocityY * FREE_INERTIA_MS;
        // Decisive pull-down → peek; decisive pull-up → full.
        if (session.velocityY >= VELOCITY_HARD || delta >= 72) {
          projected = Math.min(projected, snaps.peek);
        } else if (session.velocityY <= -VELOCITY_HARD || delta <= -72) {
          projected = Math.max(projected, snaps.full * 0.92);
        }
        const clamped = Math.max(snaps.peek, Math.min(snaps.full, projected));
        publishHeight(clamped, softZone(clamped, snaps), 'always');
      } else {
        const next = snapFromRelease(delta, session.velocityY, snaps, session.startHeight);
        publishHeight(snaps[next], next, 'always');
      }
      setDragging(false);
    },
    [free, publishHeight]
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (!canDrag || e.button !== 0) return;
      const el = nodeRef.current;
      if (!el) return;

      const target = e.target as Element | null;
      const fromGrabber = Boolean(
        target?.closest(
          '[data-sheet-grabber], .sheet__grabber, .trip-progress__grabber, [data-sheet-drag]'
        )
      );

      if (!fromGrabber && isInteractiveTarget(e.target)) return;

      const fromStage = Boolean(
        target?.closest('.ld-stage, .ld-stage__page, .ld-stage__track, .ld-stops, .ld-ride')
      );

      // Always track the gesture. If the stop list is mid-scroll, we only
      // collapse once it hits the top (Moovit overscroll → sheet).
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startHeight: heightRef.current,
        lastY: e.clientY,
        lastT: performance.now(),
        velocityY: 0,
        active: false,
        fromGrabber,
        fromStage,
      };

      if (fromGrabber) {
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
    },
    [canDrag]
  );

  useEffect(() => {
    if (!canDrag) return;

    const onMove = (e: PointerEvent) => {
      const session = dragRef.current;
      if (!session || session.pointerId !== e.pointerId) return;

      const dy = e.clientY - session.startY;
      const now = performance.now();
      const dt = Math.max(1, now - session.lastT);
      const instant = (e.clientY - session.lastY) / dt;
      session.velocityY = session.velocityY * 0.35 + instant * 0.65;
      session.lastY = e.clientY;
      session.lastT = now;

      if (!session.active) {
        const dx = e.clientX - session.startX;
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > DRAG_THRESHOLD_PX) {
          dragRef.current = null;
          return;
        }
        if (Math.abs(dy) < DRAG_THRESHOLD_PX) return;

        // Horizontal bias on the pager — abort sheet drag.
        if (session.fromStage && Math.abs(dy) < Math.abs(dx) * 1.25) {
          dragRef.current = null;
          return;
        }

        const atTop = scrollTopOf(nodeRef.current) <= AT_TOP_PX;
        // Expand always. Collapse from grabber/strip, or from body once list is at top.
        // If list still has scroll room, leave the gesture alone so the list can scroll.
        if (dy > 0 && !session.fromGrabber && !atTop) {
          return;
        }
        if (dy < 0 || session.fromGrabber || atTop) {
          // Re-base height when collapsing after the list scrolled to top mid-gesture.
          if (dy > 0 && !session.fromGrabber) {
            session.startHeight = heightRef.current;
            session.startY = e.clientY;
          }
          session.active = true;
          setDragging(true);
          lockInnerScroll(nodeRef.current, true);
          try {
            nodeRef.current?.setPointerCapture(session.pointerId);
          } catch {
            /* ignore */
          }
        } else {
          dragRef.current = null;
          return;
        }
      }

      e.preventDefault();
      const snaps = heightsRef.current;
      const minH = snaps.peek * 0.85;
      // dy > 0 (finger down) → smaller height. dy < 0 → taller.
      const nextH = Math.max(minH, Math.min(snaps.full, session.startHeight - dy));
      heightRef.current = nextH;
      setHeightPx(nextH);
      onHeightChangeRef.current?.(nextH);
      const zone = softZone(nextH, snaps);
      if (zone !== snapRef.current) {
        snapRef.current = zone;
        setSnapState(zone);
      }
    };

    const onUp = (e: PointerEvent) => {
      const session = dragRef.current;
      if (!session || session.pointerId !== e.pointerId) return;
      // pointercancel may carry no coordinates; settle where the finger last was.
      endDrag(e.type === 'pointercancel' ? session.lastY : e.clientY);
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [canDrag, endDrag]);

  const setNode = useCallback(
    (node: HTMLElement | null) => {
      nodeRef.current = node;
      if (!node) {
        mountedRef.current = false;
        return;
      }
      const next = measureSnaps(withNav, node);
      heightsRef.current = next;
      setHeights(next);
      if (!mountedRef.current) {
        mountedRef.current = true;
        const start = next[snapRef.current] ?? next.peek;
        publishHeight(start, softZone(start, next), false);
      } else {
        // Remeasure only — do not yank the sheet back up after a user collapse.
        const clamped = Math.max(next.peek * 0.85, Math.min(next.full, heightRef.current));
        publishHeight(clamped, softZone(clamped, next), false);
      }
    },
    [publishHeight, withNav]
  );

  const style: CSSProperties = canDrag
    ? {
        height: heightPx,
        maxHeight: heights.full,
        transition: dragging ? 'none' : 'height 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
        touchAction: 'pan-y',
      }
    : {};

  const bind: SheetDragBind = {
    ref: setNode,
    style,
    className: dragging ? 'is-sheet-dragging' : '',
    'data-snap': snap,
    'data-dragging': dragging ? 'true' : 'false',
    onPointerDown,
  };

  return { bind, snap, setSnap, forceSnap, dragging, heightPx };
}
