/**
 * Horizontal swipe rail for Moovit-style leg chip rows.
 * Keeps pan-x inside the rail so a parent card button does not steal the gesture,
 * while vertical wheel / touch scrolls still chain to the nearest scroll parent.
 */

import {
  useEffect,
  useLayoutEffect,
  useRef,
  type HTMLAttributes,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';

interface SwipeRailProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /**
   * In RTL, open scrolled to the far (left) end. Right for leg chains, where the
   * end is cut; wrong for a line row (badge + headsign), whose start is the badge.
   */
  rtlOpenAtEnd?: boolean;
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
  rtlOpenAtEnd = true,
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

  // In RTL (Hebrew) the browser opens a scroller at its right edge, which hid
  // the left end of the leg row. Open at the left edge instead, until the user
  // swipes it themselves. A large negative scrollLeft clamps to the left edge
  // in both the standard RTL model (0 = right) and old Chrome's (0 = left).
  const touched = useRef(false);
  useLayoutEffect(() => {
    const el = railRef.current;
    if (!el || touched.current || !rtlOpenAtEnd) return;
    if (getComputedStyle(el).direction !== 'rtl') return;
    if (el.scrollWidth <= el.clientWidth) return;
    el.scrollLeft = -el.scrollWidth;
  });

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    touched.current = true;
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
      className={className}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onClick={handleClick}
    >
      {children}
    </div>
  );
}
