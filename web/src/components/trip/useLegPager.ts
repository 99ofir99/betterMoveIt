/**
 * Pager state for the Live Directions step dots and chevrons. The viewed leg
 * follows the active leg until the user pages away; it snaps back when the active leg changes.
 */

import { useCallback, useEffect, useState } from 'react';

export interface LegPagerState {
  viewIndex: number;
  isViewingActive: boolean;
  select: (index: number) => void;
  prev: () => void;
  next: () => void;
  reset: () => void;
}

export function useLegPager(
  activeIndex: number,
  legCount: number,
  onSelectLeg?: (index: number) => void
): LegPagerState {
  const [override, setOverride] = useState<number | null>(null);

  useEffect(() => {
    setOverride(null);
  }, [activeIndex]);

  const maxIndex = Math.max(0, legCount - 1);
  const viewIndex = Math.min(override ?? activeIndex, maxIndex);

  const select = useCallback(
    (index: number) => {
      const clamped = Math.min(Math.max(index, 0), maxIndex);
      setOverride(clamped === activeIndex ? null : clamped);
      onSelectLeg?.(clamped);
    },
    [activeIndex, maxIndex, onSelectLeg]
  );

  const prev = useCallback(() => select(viewIndex - 1), [select, viewIndex]);
  const next = useCallback(() => select(viewIndex + 1), [select, viewIndex]);
  const reset = useCallback(() => select(activeIndex), [select, activeIndex]);

  return { viewIndex, isViewingActive: viewIndex === activeIndex, select, prev, next, reset };
}
