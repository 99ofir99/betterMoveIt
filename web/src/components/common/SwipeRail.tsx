/**
 * Horizontal swipe rail for Moovit-style leg chip rows.
 * Keeps pan-x inside the rail so a parent card button does not steal the gesture,
 * while vertical wheel / touch scrolls still chain to the nearest scroll parent.
 */

import {
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { useLocale } from '../../lib/i18n';

interface SwipeRailProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /**
   * A leg sequence (walk › bus › train) in trip order. It follows the page
   * direction: left to right in English, right to left (mirrored) in Hebrew.
   * Edges fade while more chips are hidden past them.
   */
  legSequence?: boolean;
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
  legSequence = false,
  ...rest
}: SwipeRailProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const originX = useRef(0);
  const panned = useRef(false);
  const locale = useLocale();
  const [fade, setFade] = useState({ start: false, end: false });

  // Which edges hide chips. scrollLeft is 0 at the start in both directions and
  // goes negative in RTL, so measure distance from the start with Math.abs.
  const updateFade = () => {
    const el = railRef.current;
    if (!el || !legSequence) return;
    const fromStart = Math.abs(el.scrollLeft);
    const hidden = el.scrollWidth - el.clientWidth;
    const next = { start: fromStart > 2, end: hidden - fromStart > 2 };
    setFade((prev) => (prev.start === next.start && prev.end === next.end ? prev : next));
  };

  useEffect(() => {
    const el = railRef.current;
    if (!el || !legSequence) return;
    // A rail that was scrolled in the other direction (locale switch) starts over.
    el.scrollLeft = 0;
    updateFade();
    const ro = new ResizeObserver(updateFade);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legSequence, locale]);

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
      className={[
        className,
        legSequence ? 'swipe-rail--leg-seq' : '',
        legSequence && fade.start ? 'swipe-rail--fade-start' : '',
        legSequence && fade.end ? 'swipe-rail--fade-end' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onScroll={(e) => {
        updateFade();
        rest.onScroll?.(e);
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onClick={handleClick}
    >
      {children}
    </div>
  );
}
