/**
 * Pointer-drag for the Moovit floating trip chip.
 * Allows tucking almost fully off either side (keeps a peek strip on-screen).
 */

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

export interface PipPoint {
  x: number;
  y: number;
}

export interface PipDragState {
  position: PipPoint;
  dragging: boolean;
  /** True when most of the chip is off the left or right edge. */
  tucked: boolean;
  tuckSide: 'left' | 'right' | null;
  onPointerDown: (e: ReactPointerEvent) => void;
  /** Call from pointer-up: ends gesture; returns true if it was a drag. */
  endGesture: (pointerId: number) => boolean;
  setPosition: (p: PipPoint) => void;
}

const PEEK_PX = 52;
const DRAG_THRESHOLD = 8;
const POS_STORAGE_KEY = 'bmi_trip_pip_pos';

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function readStoredPos(): PipPoint | null {
  try {
    const raw = localStorage.getItem(POS_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PipPoint;
    if (typeof p.x === 'number' && typeof p.y === 'number') return p;
  } catch {
    /* noop */
  }
  return null;
}

function writeStoredPos(p: PipPoint): void {
  try {
    localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* noop */
  }
}

function defaultPos(vw: number): PipPoint {
  return { x: Math.max(12, vw - 240), y: 56 };
}

function tuckInfo(
  x: number,
  width: number,
  vw: number
): { tucked: boolean; tuckSide: 'left' | 'right' | null } {
  if (x + width - PEEK_PX <= 0) return { tucked: true, tuckSide: 'left' };
  if (x + PEEK_PX >= vw) return { tucked: true, tuckSide: 'right' };
  return { tucked: false, tuckSide: null };
}

export function usePipDrag(chipWidth = 228, chipHeight = 96): PipDragState {
  const [position, setPositionState] = useState<PipPoint>(() => {
    if (typeof window === 'undefined') return { x: 12, y: 56 };
    return readStoredPos() ?? defaultPos(window.innerWidth);
  });
  const [dragging, setDragging] = useState(false);

  const posRef = useRef(position);
  posRef.current = position;
  const sizeRef = useRef({ w: chipWidth, h: chipHeight });
  sizeRef.current = { w: chipWidth, h: chipHeight };

  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);
  const setPosition = useCallback((p: PipPoint) => {
    posRef.current = p;
    setPositionState(p);
    writeStoredPos(p);
  }, []);

  // Keep on-screen when viewport resizes.
  useEffect(() => {
    const onResize = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const { w, h } = sizeRef.current;
      const cur = posRef.current;
      const next = {
        x: clamp(cur.x, PEEK_PX - w, vw - PEEK_PX),
        y: clamp(cur.y, 8, Math.max(8, vh - h - 8)),
      };
      if (next.x !== cur.x || next.y !== cur.y) setPosition(next);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [setPosition]);

  const endGesture = useCallback((pointerId: number) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== pointerId) return false;
    const wasDrag = d.moved;
    dragRef.current = null;
    setDragging(false);
    if (wasDrag) writeStoredPos(posRef.current);
    return wasDrag;
  }, []);

  const onPointerDown = useCallback((e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: posRef.current.x,
      origY: posRef.current.y,
      moved: false,
    };
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      d.moved = true;
      setDragging(true);

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const { w, h } = sizeRef.current;
      const next = {
        x: clamp(d.origX + dx, PEEK_PX - w, vw - PEEK_PX),
        y: clamp(d.origY + dy, 8, Math.max(8, vh - h - 8)),
      };
      posRef.current = next;
      setPositionState(next);
    };

    const onLost = (e: PointerEvent) => {
      // Safety if capture is released without our pointerup handler.
      endGesture(e.pointerId);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointercancel', onLost);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointercancel', onLost);
    };
  }, [endGesture]);

  const { tucked, tuckSide } = tuckInfo(
    position.x,
    chipWidth,
    typeof window !== 'undefined' ? window.innerWidth : 400
  );

  return {
    position,
    dragging,
    tucked,
    tuckSide,
    onPointerDown,
    endGesture,
    setPosition,
  };
}
