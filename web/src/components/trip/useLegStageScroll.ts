/**
 * Moovit CustomViewPager — horizontal finger-track + snap between legs.
 *
 * Uses window-level non-passive pointer listeners so iOS/Android (ngrok PWA)
 * can preventDefault once the gesture locks to X. Vertical motion is released
 * to the sheet / stop-list scroll.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';

const AXIS_LOCK_PX = 6;
const PAGE_THRESHOLD = 0.18;
const FLICK_VX = 0.35;

type Axis = 'x' | 'y' | null;

interface DragSession {
  pointerId: number;
  startX: number;
  startY: number;
  originOffset: number;
  lastX: number;
  lastT: number;
  velocityX: number;
  axis: Axis;
  width: number;
}

function isInteractive(target: EventTarget | null): boolean {
  const el = target as Element | null;
  return Boolean(el?.closest('button, a, input, select, textarea, summary, [role="button"]'));
}

export function useLegStageScroll(
  viewIndex: number,
  legCount: number,
  onSelect: (index: number) => void
) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragSession | null>(null);
  const viewIndexRef = useRef(viewIndex);
  const onSelectRef = useRef(onSelect);
  const legCountRef = useRef(legCount);
  const [width, setWidth] = useState(0);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const [animating, setAnimating] = useState(false);
  const [paging, setPaging] = useState(false);

  viewIndexRef.current = viewIndex;
  onSelectRef.current = onSelect;
  legCountRef.current = legCount;

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // Overflowing pages can still shift scrollLeft under overflow:hidden —
    // that desyncs the CSS transform pager and shows the wrong leg.
    const lockScroll = () => {
      if (el.scrollLeft !== 0) el.scrollLeft = 0;
      if (el.scrollTop !== 0) el.scrollTop = 0;
    };
    lockScroll();
    el.addEventListener('scroll', lockScroll, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', lockScroll);
    };
  }, [legCount]);

  // Settle onto the programmed page when dots / active leg change (no finger).
  useEffect(() => {
    if (dragRef.current) return;
    setDragOffset(null);
    setAnimating(true);
    const t = window.setTimeout(() => setAnimating(false), 280);
    return () => window.clearTimeout(t);
  }, [viewIndex, legCount]);

  const finishTo = useCallback((index: number) => {
    const max = Math.max(0, legCountRef.current - 1);
    const clamped = Math.max(0, Math.min(max, index));
    setDragOffset(null);
    setPaging(false);
    setAnimating(true);
    window.setTimeout(() => setAnimating(false), 280);
    if (clamped !== viewIndexRef.current) onSelectRef.current(clamped);
  }, []);

  // Native listeners — React synthetic events cannot reliably preventDefault on mobile.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || legCount <= 1) return;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (isInteractive(e.target)) return;

      const w = Math.max(1, viewport.clientWidth);
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originOffset: -viewIndexRef.current * w,
        lastX: e.clientX,
        lastT: performance.now(),
        velocityX: 0,
        axis: null,
        width: w,
      };
    };

    const onPointerMove = (e: PointerEvent) => {
      const session = dragRef.current;
      if (!session || session.pointerId !== e.pointerId) return;

      const dx = e.clientX - session.startX;
      const dy = e.clientY - session.startY;
      const now = performance.now();
      const dt = Math.max(1, now - session.lastT);
      session.velocityX = session.velocityX * 0.35 + ((e.clientX - session.lastX) / dt) * 0.65;
      session.lastX = e.clientX;
      session.lastT = now;

      if (!session.axis) {
        if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
        session.axis = Math.abs(dx) >= Math.abs(dy) * 0.85 ? 'x' : 'y';
        if (session.axis === 'y') {
          // Let sheet / vertical scroll own the gesture.
          dragRef.current = null;
          setDragOffset(null);
          setPaging(false);
          return;
        }
        setPaging(true);
        try {
          viewport.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }

      if (session.axis !== 'x') return;
      e.preventDefault();
      e.stopPropagation();

      const max = 0;
      const min = -(legCountRef.current - 1) * session.width;
      const raw = session.originOffset + dx;
      let next = raw;
      if (raw > max) next = max + (raw - max) * 0.28;
      else if (raw < min) next = min + (raw - min) * 0.28;
      setDragOffset(next);
    };

    const onPointerUp = (e: PointerEvent) => {
      const session = dragRef.current;
      if (!session || session.pointerId !== e.pointerId) return;
      dragRef.current = null;

      if (session.axis !== 'x') {
        setDragOffset(null);
        setPaging(false);
        return;
      }

      const dx = e.clientX - session.startX;
      const pageW = session.width;
      const current = viewIndexRef.current;
      let target = current;

      if (Math.abs(session.velocityX) >= FLICK_VX) {
        target = session.velocityX < 0 ? current + 1 : current - 1;
      } else if (Math.abs(dx) >= pageW * PAGE_THRESHOLD) {
        target = dx < 0 ? current + 1 : current - 1;
      }

      finishTo(target);
    };

    viewport.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    return () => {
      viewport.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [finishTo, legCount]);

  const settled = width > 0 ? -viewIndex * width : 0;
  // Track stays viewport-width; each page is flex: 0 0 100% of that.
  // Do NOT set track width to N×viewport — that makes page 100% = all pages.
  const trackStyle: CSSProperties = {
    transform: `translate3d(${dragOffset != null ? dragOffset : settled}px, 0, 0)`,
    transition:
      dragOffset != null || !animating
        ? 'none'
        : 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
  };

  return {
    viewportRef,
    trackStyle,
    dragging: paging || dragOffset != null,
    /** No React pointer bind — native listeners own the gesture. */
    bind: {},
  };
}
