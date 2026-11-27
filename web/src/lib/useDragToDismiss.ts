/**
 * Swipe-down-to-close for small modal bottom sheets (time picker, menus).
 * Spread `handleProps` on the grab area; `panelStyle` follows the finger.
 * Released past DISMISS_PX (or flicked down fast) closes; otherwise it springs back.
 */

import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';

const DISMISS_PX = 80;
const FLICK_PX_PER_MS = 0.6;

/** Pure decision, exported for tests. */
export function shouldDismiss(dy: number, ms: number): boolean {
  if (dy >= DISMISS_PX) return true;
  return dy > 20 && ms > 0 && dy / ms >= FLICK_PX_PER_MS;
}

export function useDragToDismiss(onClose: () => void) {
  const [dy, setDy] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ y: number; t: number; id: number } | null>(null);

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    start.current = { y: e.clientY, t: e.timeStamp, id: e.pointerId };
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    if (!start.current || e.pointerId !== start.current.id) return;
    setDy(Math.max(0, e.clientY - start.current.y));
  };
  const finish = (e: PointerEvent<HTMLElement>) => {
    const s = start.current;
    start.current = null;
    setDragging(false);
    if (!s) return;
    const moved = Math.max(0, e.clientY - s.y);
    if (shouldDismiss(moved, e.timeStamp - s.t)) {
      onClose();
      return;
    }
    setDy(0);
  };

  const handleProps = {
    onPointerDown,
    onPointerMove,
    onPointerUp: finish,
    onPointerCancel: finish,
    style: { touchAction: 'none' } as CSSProperties,
  };
  const panelStyle: CSSProperties = {
    transform: dy ? `translateY(${dy}px)` : undefined,
    transition: dragging ? 'none' : 'transform 0.2s ease',
  };
  return { handleProps, panelStyle };
}
