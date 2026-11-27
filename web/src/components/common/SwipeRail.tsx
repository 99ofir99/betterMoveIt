/**
 * Horizontal swipe rail for Moovit-style leg chip rows.
 * Keeps pan-x inside the rail so a parent card button does not steal the gesture,
 * while vertical wheel / touch scrolls still chain to the nearest scroll parent.
 */

import {
  useEffect,
  useRef,
  type HTMLAttributes,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';

interface SwipeRailProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /**
   * A leg sequence (walk › bus › train) that reads left to right in every
   * language, in trip order, while staying aligned to the inline end in RTL.
   * The row is dir="ltr"; its first chip takes margin-left:auto so the chips
   * sit on the right in Hebrew (the auto margin drops to 0 when the row
   * overflows, so it still scrolls from the trip's start).
   */
  ltrSequence?: boolean;
}

function nearestVerticalScrollParent(from: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = from.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    const scrolls =
      (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
      node.scrollHeight > node.clientHeight;
    if (scrolls) return node;
    node = node.parentElement;
  }
  return null;
}

export function SwipeRail({
  children,
  className,
  onPointerDown,
  onClick,
  ltrSequence = false,
  ...rest
}: SwipeRailProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const originX = useRef(0);
  const panned = useRef(false);

  // overflow-x rails can trap vertical wheel/trackpad deltas; hand them to the sheet.
  useEffect(() => {
    const el = railRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const parent = nearestVerticalScrollParent(el);
      if (!parent) return;
      parent.scrollTop += e.deltaY;
      e.preventDefault();
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    originX.current = e.clientX;
    panned.current = false;
    onPointerDown?.(e);
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (Math.abs(e.clientX - originX.current) > 8) panned.current = true;
  };

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    // After a horizontal swipe, don't select the parent journey card.
    if (panned.current) {
      e.preventDefault();
      e.stopPropagation();
      panned.current = false;
      return;
    }
    onClick?.(e);
  };

  return (
    <div
      {...rest}
      ref={railRef}
      dir={ltrSequence ? 'ltr' : rest.dir}
      className={[className, ltrSequence ? 'swipe-rail--ltr-seq' : ''].filter(Boolean).join(' ')}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onClick={handleClick}
    >
      {children}
    </div>
  );
}
