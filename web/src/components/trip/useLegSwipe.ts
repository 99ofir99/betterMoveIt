/**
 * Horizontal finger swipe to page between journey legs (Moovit-style, no arrows).
 */

import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react';

const SWIPE_MIN_PX = 48;
const AXIS_LOCK_PX = 10;

export function useLegSwipe(onPrev: () => void, onNext: () => void) {
  const session = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    axis: 'x' | 'y' | null;
  } | null>(null);

  const onPointerDown = useCallback((e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    session.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      axis: null,
    };
  }, []);

  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    const s = session.current;
    if (!s || s.pointerId !== e.pointerId) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (!s.axis) {
      if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
      s.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
    }
  }, []);

  const onPointerUp = useCallback(
    (e: ReactPointerEvent) => {
      const s = session.current;
      session.current = null;
      if (!s || s.pointerId !== e.pointerId || s.axis !== 'x') return;
      const dx = e.clientX - s.startX;
      if (Math.abs(dx) < SWIPE_MIN_PX) return;
      if (dx < 0) onNext();
      else onPrev();
    },
    [onNext, onPrev]
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
  };
}
