/**
 * True once the nearest scrolling sheet has scrolled past `enterPx`; false again
 * only near the top (`exitPx`). The gap keeps the header from flickering while it
 * shrinks and the content moves under the finger.
 */

import { useEffect, useState, type RefObject } from 'react';

export function nextCompact(current: boolean, scrollTop: number, enterPx = 120, exitPx = 8): boolean {
  if (!current && scrollTop > enterPx) return true;
  if (current && scrollTop < exitPx) return false;
  return current;
}

/** @param active re-attach when the element appears (e.g. results panel shown). */
export function useCompactOnScroll(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  /** Scroll distance at which to compact; when given, no hysteresis is needed. */
  threshold?: () => number,
  scroller = '.sheet',
): boolean {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    if (!active) {
      setCompact(false);
      return;
    }
    const el = ref.current?.closest<HTMLElement>(scroller);
    if (!el) return;
    const onScroll = () => {
      const at = threshold?.();
      setCompact((c) => (at != null ? el.scrollTop > at : nextCompact(c, el.scrollTop)));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- threshold reads refs
  }, [ref, active, scroller]);
  return compact;
}
